use anchor_lang::prelude::*;

pub const CONFIG_SEED: &[u8] = b"config";
pub const VAULT_SEED: &[u8] = b"vault";
pub const USER_SEED: &[u8] = b"user";
pub const MARKET_SEED: &[u8] = b"market";

pub const MAX_POSITIONS: usize = 24;

pub const ST_OPEN: u8 = 0;
pub const ST_CLOSED: u8 = 1;
pub const ST_PROPOSED: u8 = 2;
pub const ST_DISPUTED: u8 = 3;
pub const ST_RESOLVED: u8 = 4;

pub const OUT_NONE: u8 = 0;
pub const OUT_YES: u8 = 1;
pub const OUT_NO: u8 = 2;
pub const OUT_INVALID: u8 = 3;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq)]
pub struct Params {
    pub fee_bps: u16,
    pub mm_bps: u16,
    pub liq_bps: u16,
    pub max_lev_bps: u32,
    pub borrow_bps_per_hour: u16,
    pub l_floor_bps: u16,
    pub max_price_bps: u16,
    pub min_trade: u64,
    pub tau0: i64,
    pub reduce_only_secs: i64,
    pub halt_secs: i64,
    pub dispute_secs: i64,
}

impl Params {
    pub fn validate(&self) -> bool {
        self.fee_bps <= 500
            && self.mm_bps >= 100
            && self.mm_bps <= 5_000
            && self.liq_bps <= 1_000
            && self.max_lev_bps >= 10_000
            && self.max_lev_bps <= 100_000
            && self.borrow_bps_per_hour <= 100
            && self.l_floor_bps >= 500
            && self.l_floor_bps <= 10_000
            && self.max_price_bps > 5_000
            && self.max_price_bps < 10_000
            && self.min_trade > 0
            && self.tau0 > 0
            && self.reduce_only_secs >= 0
            && self.halt_secs >= 0
            && self.halt_secs <= self.reduce_only_secs
            && self.dispute_secs >= 0
    }
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub creator: Pubkey,
    pub oracle: Pubkey,
    pub auditor: Pubkey,
    pub usdc_mint: Pubkey,
    pub vault: Pubkey,
    pub params: Params,
    pub next_market_id: u64,
    /// House (protocol market maker) capital not committed to any market.
    pub house_free: u64,
    pub house_deposited: u64,
    pub house_allocated: u64,
    pub house_returned: u64,
    pub paused: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub id: u64,
    pub category: u8,
    pub state: u8,
    pub outcome: u8,
    pub swept: bool,
    pub question_hash: [u8; 32],
    pub rules_hash: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub open_time: i64,
    pub close_time: i64,
    pub proposed_at: i64,
    pub resolved_at: i64,
    pub z0: f64,
    pub z: f64,
    pub l0: f64,
    pub l: f64,
    /// Price of YES frozen when trading closed. Used for INVALID payouts.
    pub final_price_yes: f64,
    /// Complete sets minted (USDC held by the AMM side of the market).
    pub cash: u64,
    pub q_yes: u64,
    pub q_no: u64,
    pub subsidy: u64,
    pub lend_initial: u64,
    /// USDC available to lend for leverage.
    pub lend_pool: u64,
    /// Outstanding borrowed principal.
    pub open_debt: u64,
    pub debt_positions: u32,
    pub fees: u64,
    pub bad_debt: u64,
    pub volume: u64,
    pub trades: u64,
    pub params: Params,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, InitSpace, PartialEq)]
pub struct Position {
    pub market_id: u64,
    pub side: u8,
    pub shares: u64,
    /// Borrowed principal still owed to the market's lend pool.
    pub debt: u64,
    /// Accrued, unpaid borrow fee.
    pub accrued: u64,
    /// Own capital still at work in this position.
    pub margin: u64,
    pub last_accrual: i64,
    pub opened_at: i64,
}

impl Position {
    pub fn is_empty(&self) -> bool {
        self.shares == 0 && self.debt == 0 && self.margin == 0
    }
}

#[account]
#[derive(InitSpace)]
pub struct UserAccount {
    pub owner: Pubkey,
    pub balance: u64,
    pub deposited: u64,
    pub withdrawn: u64,
    pub realized_pnl: i64,
    pub trades: u32,
    pub liquidations: u32,
    pub positions: [Position; MAX_POSITIONS],
    pub bump: u8,
}

impl UserAccount {
    pub fn find(&self, market_id: u64, side: u8) -> Option<usize> {
        self.positions
            .iter()
            .position(|p| !p.is_empty() && p.market_id == market_id && p.side == side)
    }

    pub fn find_or_alloc(&mut self, market_id: u64, side: u8) -> Option<usize> {
        if let Some(i) = self.find(market_id, side) {
            return Some(i);
        }
        let i = self.positions.iter().position(|p| p.is_empty())?;
        self.positions[i] = Position { market_id, side, ..Default::default() };
        Some(i)
    }
}
