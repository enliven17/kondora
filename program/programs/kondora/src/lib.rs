//! Kondora: leveraged YES/NO prediction markets priced by a pm-AMM.
//! AI agents (creator, oracle, auditor keys) open and resolve markets.
//! Users trade inside a MagicBlock Ephemeral Rollup with session keys.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};

pub mod engine;
pub mod errors;
pub mod events;
pub mod math;
pub mod state;

use errors::KondoraError;
use events::*;
use state::*;

declare_id!("BoZu45xZ4HFe4bvpYaGjcaDeqPaPTKSjMGYg5xFyXSuJ");

/// Shortest market life the creator may open.
pub const MIN_MARKET_SECS: i64 = 15 * 60;

#[ephemeral]
#[program]
pub mod kondora {
    use super::*;

    // ── Admin ────────────────────────────────────────────────────────────

    pub fn initialize(
        ctx: Context<Initialize>,
        creator: Pubkey,
        oracle: Pubkey,
        auditor: Pubkey,
        validator: Pubkey,
        params: Params,
    ) -> Result<()> {
        require!(params.validate(), KondoraError::InvalidParams);
        let c = &mut ctx.accounts.config;
        c.admin = ctx.accounts.admin.key();
        c.validator = validator;
        c.creator = creator;
        c.oracle = oracle;
        c.auditor = auditor;
        c.usdc_mint = ctx.accounts.usdc_mint.key();
        c.vault = ctx.accounts.vault.key();
        c.params = params;
        c.next_market_id = 1;
        c.bump = ctx.bumps.config;
        c.vault_bump = ctx.bumps.vault;
        Ok(())
    }

    pub fn update_config(
        ctx: Context<AdminOnly>,
        creator: Pubkey,
        oracle: Pubkey,
        auditor: Pubkey,
        validator: Pubkey,
        params: Params,
        paused: bool,
    ) -> Result<()> {
        require!(params.validate(), KondoraError::InvalidParams);
        let c = &mut ctx.accounts.config;
        c.validator = validator;
        c.creator = creator;
        c.oracle = oracle;
        c.auditor = auditor;
        c.params = params;
        c.paused = paused;
        Ok(())
    }

    pub fn house_deposit(ctx: Context<HouseFunds>, amount: u64) -> Result<()> {
        require!(amount > 0, KondoraError::TooSmall);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.admin_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            amount,
        )?;
        let c = &mut ctx.accounts.config;
        c.house_free = c.house_free.checked_add(amount).ok_or(KondoraError::Math)?;
        c.house_deposited = c.house_deposited.checked_add(amount).ok_or(KondoraError::Math)?;
        Ok(())
    }

    pub fn house_withdraw(ctx: Context<HouseFunds>, amount: u64) -> Result<()> {
        let c = &mut ctx.accounts.config;
        require!(amount > 0 && amount <= c.house_free, KondoraError::HouseLiquidity);
        c.house_free -= amount;
        let bump = c.bump;
        vault_pay(
            &ctx.accounts.token_program,
            &ctx.accounts.vault,
            &ctx.accounts.admin_token,
            &ctx.accounts.config.to_account_info(),
            bump,
            amount,
        )
    }

    // ── Users (base layer) ───────────────────────────────────────────────

    pub fn init_user(ctx: Context<InitUser>) -> Result<()> {
        let u = &mut ctx.accounts.user;
        u.owner = ctx.accounts.owner.key();
        u.bump = ctx.bumps.user;
        Ok(())
    }

    pub fn deposit(ctx: Context<UserFunds>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.config.paused, KondoraError::Paused);
        require!(amount > 0, KondoraError::TooSmall);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.owner_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;
        let u = &mut ctx.accounts.user;
        u.balance = u.balance.checked_add(amount).ok_or(KondoraError::Math)?;
        u.deposited = u.deposited.checked_add(amount).ok_or(KondoraError::Math)?;
        Ok(())
    }

    pub fn withdraw(ctx: Context<UserFunds>, amount: u64) -> Result<()> {
        let u = &mut ctx.accounts.user;
        require!(amount > 0 && amount <= u.balance, KondoraError::InsufficientBalance);
        u.balance -= amount;
        u.withdrawn = u.withdrawn.checked_add(amount).ok_or(KondoraError::Math)?;
        let bump = ctx.accounts.config.bump;
        vault_pay(
            &ctx.accounts.token_program,
            &ctx.accounts.vault,
            &ctx.accounts.owner_token,
            &ctx.accounts.config.to_account_info(),
            bump,
            amount,
        )
    }

    // ── Markets (creator agent) ──────────────────────────────────────────

    #[allow(clippy::too_many_arguments)]
    pub fn create_market(
        ctx: Context<CreateMarket>,
        category: u8,
        question_hash: [u8; 32],
        rules_hash: [u8; 32],
        close_time: i64,
        z0: f64,
        subsidy: u64,
        lend: u64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let c = &mut ctx.accounts.config;
        require!(!c.paused, KondoraError::Paused);
        require!(close_time >= now + MIN_MARKET_SECS, KondoraError::InvalidParams);
        require!(z0.is_finite() && z0.abs() <= 2.0, KondoraError::InvalidParams);
        require!(subsidy >= 10 * c.params.min_trade, KondoraError::InvalidParams);
        let need = subsidy.checked_add(lend).ok_or(KondoraError::Math)?;
        require!(need <= c.house_free, KondoraError::HouseLiquidity);
        c.house_free -= need;
        c.house_allocated = c.house_allocated.checked_add(need).ok_or(KondoraError::Math)?;

        let id = c.next_market_id;
        c.next_market_id += 1;
        let l0 = math::initial_liquidity(subsidy, z0);
        let m = &mut ctx.accounts.market;
        m.id = id;
        m.category = category;
        m.state = ST_OPEN;
        m.question_hash = question_hash;
        m.rules_hash = rules_hash;
        m.open_time = now;
        m.close_time = close_time;
        m.z0 = z0;
        m.z = z0;
        m.mark_z = z0;
        m.mark_t = now;
        m.l0 = l0;
        m.l = l0;
        m.cash = subsidy;
        m.subsidy = subsidy;
        m.lend_initial = lend;
        m.lend_pool = lend;
        m.params = c.params;
        m.bump = ctx.bumps.market;
        emit!(MarketCreated {
            id,
            category,
            question_hash,
            close_time,
            price_yes: math::cdf(z0),
            subsidy,
            lend,
        });
        Ok(())
    }

    // ── Trading (Ephemeral Rollup, owner or session key) ─────────────────

    #[session_auth_or(
        ctx.accounts.authority.key() == ctx.accounts.signer.key(),
        SessionError::InvalidToken
    )]
    pub fn open_position(
        ctx: Context<Trade>,
        side: u8,
        margin: u64,
        lev_bps: u64,
        min_shares: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, KondoraError::Paused);
        let now = Clock::get()?.unix_timestamp;
        let m = &mut ctx.accounts.market;
        let u = &mut ctx.accounts.user;
        let r = engine::open(m, u, side, margin, lev_bps, min_shares, now)?;
        emit!(PositionOpened {
            market_id: m.id,
            owner: u.owner,
            side,
            margin,
            lev_bps,
            shares: r.shares,
            notional: r.notional,
            fee: r.fee,
            price_yes: math::cdf(m.z),
            ts: now,
        });
        Ok(())
    }

    #[session_auth_or(
        ctx.accounts.authority.key() == ctx.accounts.signer.key(),
        SessionError::InvalidToken
    )]
    pub fn close_position(ctx: Context<Trade>, side: u8, fraction_bps: u64, min_out: u64) -> Result<()> {
        // A session key may only close with a slippage bound, so a leaked key
        // cannot dump positions into a sandwich.
        if ctx.accounts.signer.key() != ctx.accounts.authority.key() {
            require!(min_out > 0, KondoraError::Slippage);
        }
        let now = Clock::get()?.unix_timestamp;
        let m = &mut ctx.accounts.market;
        let u = &mut ctx.accounts.user;
        let r = engine::close(m, u, side, fraction_bps, min_out, now)?;
        emit!(PositionClosed {
            market_id: m.id,
            owner: u.owner,
            side,
            shares: r.shares,
            gross: r.gross,
            to_user: r.to_user,
            shortfall: r.shortfall,
            penalty: r.penalty,
            liquidation: false,
            price_yes: math::cdf(m.z),
            ts: now,
        });
        Ok(())
    }

    /// Permissionless crank: liquidations and pre-close force closes.
    pub fn liquidate(ctx: Context<Crank>, side: u8) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let m = &mut ctx.accounts.market;
        let u = &mut ctx.accounts.user;
        let r = engine::liquidate(m, u, side, now)?;
        emit!(PositionClosed {
            market_id: m.id,
            owner: u.owner,
            side,
            shares: r.shares,
            gross: r.gross,
            to_user: r.to_user,
            shortfall: r.shortfall,
            penalty: r.penalty,
            liquidation: r.penalty > 0,
            price_yes: math::cdf(m.z),
            ts: now,
        });
        Ok(())
    }

    /// Permissionless: credits winnings to the position owner's balance.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let u = &mut ctx.accounts.user;
        let amount = engine::claim(&ctx.accounts.market, u)?;
        emit!(Claimed { market_id: ctx.accounts.market.id, owner: u.owner, amount });
        Ok(())
    }

    /// Base-layer close for a market that was never delegated.
    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let m = &mut ctx.accounts.market;
        engine::close_market(m, now)?;
        emit!(MarketClosed { id: m.id, final_price_yes: m.final_price_yes });
        Ok(())
    }

    // ── Resolution (oracle, auditor, admin) ──────────────────────────────

    pub fn propose_resolution(ctx: Context<Propose>, outcome: u8, evidence_hash: [u8; 32]) -> Result<()> {
        require!((OUT_YES..=OUT_INVALID).contains(&outcome), KondoraError::InvalidOutcome);
        let now = Clock::get()?.unix_timestamp;
        let m = &mut ctx.accounts.market;
        require!(m.state == ST_CLOSED, KondoraError::WrongState);
        m.outcome = outcome;
        m.evidence_hash = evidence_hash;
        m.proposed_at = now;
        m.state = ST_PROPOSED;
        emit!(ResolutionProposed {
            id: m.id,
            outcome,
            evidence_hash,
            finalize_after: now + m.params.dispute_secs,
        });
        Ok(())
    }

    pub fn challenge(ctx: Context<Challenge>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let m = &mut ctx.accounts.market;
        require!(m.state == ST_PROPOSED, KondoraError::WrongState);
        require!(now < m.proposed_at + m.params.dispute_secs, KondoraError::DisputeWindowClosed);
        m.state = ST_DISPUTED;
        emit!(ResolutionChallenged { id: m.id, auditor: ctx.accounts.auditor.key() });
        Ok(())
    }

    pub fn finalize(ctx: Context<Finalize>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let m = &mut ctx.accounts.market;
        require!(m.state == ST_PROPOSED, KondoraError::WrongState);
        require!(now >= m.proposed_at + m.params.dispute_secs, KondoraError::DisputeWindowOpen);
        m.state = ST_RESOLVED;
        m.resolved_at = now;
        emit!(MarketResolved { id: m.id, outcome: m.outcome, by_rule: false });
        Ok(())
    }

    /// Admin settles a dispute, or a market the oracle never proposed.
    pub fn rule(ctx: Context<Rule>, outcome: u8, evidence_hash: [u8; 32]) -> Result<()> {
        require!((OUT_YES..=OUT_INVALID).contains(&outcome), KondoraError::InvalidOutcome);
        let m = &mut ctx.accounts.market;
        require!(
            m.state == ST_CLOSED || m.state == ST_PROPOSED || m.state == ST_DISPUTED,
            KondoraError::WrongState
        );
        m.outcome = outcome;
        m.evidence_hash = evidence_hash;
        m.state = ST_RESOLVED;
        m.resolved_at = Clock::get()?.unix_timestamp;
        emit!(MarketResolved { id: m.id, outcome, by_rule: true });
        Ok(())
    }

    /// Permissionless: returns the House's share of a resolved market.
    pub fn sweep(ctx: Context<Sweep>) -> Result<()> {
        let m = &mut ctx.accounts.market;
        require!(!m.swept, KondoraError::AlreadySwept);
        let amount = engine::sweep_amount(m)?;
        m.swept = true;
        let c = &mut ctx.accounts.config;
        c.house_free = c.house_free.checked_add(amount).ok_or(KondoraError::Math)?;
        c.house_returned = c.house_returned.checked_add(amount).ok_or(KondoraError::Math)?;
        emit!(Swept { market_id: m.id, amount, allocated: m.subsidy + m.lend_initial });
        Ok(())
    }

    // ── Ephemeral Rollup delegation ──────────────────────────────────────

    pub fn delegate_user(ctx: Context<DelegateUser>) -> Result<()> {
        let validator = pinned_validator(&ctx.accounts.config, ctx.remaining_accounts)?;
        let owner = ctx.accounts.owner.key();
        ctx.accounts.delegate_user(
            &ctx.accounts.owner,
            &[USER_SEED, owner.as_ref()],
            DelegateConfig { validator, ..Default::default() },
        )?;
        Ok(())
    }

    pub fn undelegate_user(ctx: Context<UndelegateUser>) -> Result<()> {
        // A borrowed position must stay where the crank can liquidate it and
        // force close it before the market closes. Leaving the rollup with
        // debt would freeze the market (security review H1).
        engine::require_no_debt(&ctx.accounts.user)?;
        ctx.accounts.user.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.user.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn delegate_market(ctx: Context<DelegateMarket>, id: u64) -> Result<()> {
        {
            let data = ctx.accounts.market.try_borrow_data()?;
            let m = Market::try_deserialize(&mut &data[..])?;
            require!(m.state == ST_OPEN, KondoraError::WrongState);
        }
        let validator = pinned_validator(&ctx.accounts.config, ctx.remaining_accounts)?;
        ctx.accounts.delegate_market(
            &ctx.accounts.payer,
            &[MARKET_SEED, &id.to_le_bytes()],
            DelegateConfig { validator, ..Default::default() },
        )?;
        Ok(())
    }

    /// Permissionless after close once every leveraged position is gone:
    /// freezes the final mark and returns the market to the base layer.
    pub fn undelegate_market(ctx: Context<UndelegateMarket>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        engine::close_market(&mut ctx.accounts.market, now)?;
        emit!(MarketClosed {
            id: ctx.accounts.market.id,
            final_price_yes: ctx.accounts.market.final_price_yes,
        });
        ctx.accounts.market.exit(&crate::ID)?;
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.market.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

/// The validator from remaining_accounts[0], which must match Config.validator
/// when one is pinned.
fn pinned_validator(config: &Config, remaining: &[AccountInfo]) -> Result<Option<Pubkey>> {
    let given = remaining.first().map(|a| a.key());
    if config.validator != Pubkey::default() {
        require!(given == Some(config.validator), KondoraError::Unauthorized);
    }
    Ok(given)
}

fn vault_pay<'info>(
    token_program: &Program<'info, Token>,
    vault: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    config: &AccountInfo<'info>,
    config_bump: u8,
    amount: u64,
) -> Result<()> {
    let seeds: &[&[u8]] = &[CONFIG_SEED, &[config_bump]];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.key(),
            Transfer {
                from: vault.to_account_info(),
                to: to.to_account_info(),
                authority: config.clone(),
            },
            &[seeds],
        ),
        amount,
    )
}

// ── Account contexts ─────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Box<Account<'info, Config>>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = admin,
        seeds = [VAULT_SEED],
        bump,
        token::mint = usdc_mint,
        token::authority = config,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ KondoraError::Unauthorized)]
    pub config: Box<Account<'info, Config>>,
}

#[derive(Accounts)]
pub struct HouseFunds<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ KondoraError::Unauthorized, has_one = vault)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = config.usdc_mint)]
    pub admin_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitUser<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init, payer = owner, space = 8 + UserAccount::INIT_SPACE, seeds = [USER_SEED, owner.key().as_ref()], bump)]
    pub user: Box<Account<'info, UserAccount>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UserFunds<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = vault)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [USER_SEED, owner.key().as_ref()], bump = user.bump, has_one = owner @ KondoraError::Unauthorized)]
    pub user: Box<Account<'info, UserAccount>>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = config.usdc_mint, token::authority = owner)]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = creator @ KondoraError::Unauthorized)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, &config.next_market_id.to_le_bytes()],
        bump
    )]
    pub market: Box<Account<'info, Market>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts, Session)]
pub struct Trade<'info> {
    pub signer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: wallet that owns `user`; checked by the PDA seeds and the session macro.
    pub authority: UncheckedAccount<'info>,
    #[account(mut, seeds = [USER_SEED, authority.key().as_ref()], bump = user.bump)]
    pub user: Box<Account<'info, UserAccount>>,
    #[account(mut, seeds = [MARKET_SEED, &market.id.to_le_bytes()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[session(signer = signer, authority = authority.key())]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts)]
pub struct Crank<'info> {
    pub payer: Signer<'info>,
    #[account(mut, seeds = [USER_SEED, user.owner.as_ref()], bump = user.bump)]
    pub user: Box<Account<'info, UserAccount>>,
    #[account(mut, seeds = [MARKET_SEED, &market.id.to_le_bytes()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    pub payer: Signer<'info>,
    #[account(mut, seeds = [USER_SEED, user.owner.as_ref()], bump = user.bump)]
    pub user: Box<Account<'info, UserAccount>>,
    #[account(seeds = [MARKET_SEED, &market.id.to_le_bytes()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
}

#[derive(Accounts)]
pub struct CloseMarket<'info> {
    pub payer: Signer<'info>,
    #[account(mut, seeds = [MARKET_SEED, &market.id.to_le_bytes()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
}

#[derive(Accounts)]
pub struct Propose<'info> {
    pub oracle: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = oracle @ KondoraError::Unauthorized)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [MARKET_SEED, &market.id.to_le_bytes()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
}

#[derive(Accounts)]
pub struct Challenge<'info> {
    pub auditor: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = auditor @ KondoraError::Unauthorized)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [MARKET_SEED, &market.id.to_le_bytes()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
}

#[derive(Accounts)]
pub struct Finalize<'info> {
    pub payer: Signer<'info>,
    #[account(mut, seeds = [MARKET_SEED, &market.id.to_le_bytes()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
}

#[derive(Accounts)]
pub struct Rule<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ KondoraError::Unauthorized)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [MARKET_SEED, &market.id.to_le_bytes()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
}

#[derive(Accounts)]
pub struct Sweep<'info> {
    pub payer: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [MARKET_SEED, &market.id.to_le_bytes()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateUser<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: the owner's user PDA, validated by seeds.
    #[account(mut, del, seeds = [USER_SEED, owner.key().as_ref()], bump)]
    pub user: AccountInfo<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateUser<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [USER_SEED, owner.key().as_ref()], bump = user.bump)]
    pub user: Box<Account<'info, UserAccount>>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(id: u64)]
pub struct DelegateMarket<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = config.creator == payer.key() @ KondoraError::Unauthorized)]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: market PDA, validated by seeds; state checked in the handler.
    #[account(mut, del, seeds = [MARKET_SEED, &id.to_le_bytes()], bump)]
    pub market: AccountInfo<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateMarket<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [MARKET_SEED, &market.id.to_le_bytes()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
}
