//! Position engine: opening, closing, liquidating and claiming against a
//! market. Pure state transitions on `Market` and `UserAccount`, so the whole
//! leverage lifecycle is unit tested without a validator.
//!
//! Conservation (checked in tests): sum(user balances) + cash + lend_pool + fees
//! is constant across every trade. Solvency: cash >= q_yes and cash >= q_no.

use anchor_lang::prelude::*;

use crate::errors::KondoraError;
use crate::math::*;
use crate::state::*;

fn side_of(v: u8) -> Result<Side> {
    Side::from_u8(v).ok_or_else(|| error!(KondoraError::InvalidParams))
}

fn mul_div(a: u64, b: u64, d: u64) -> u64 {
    (a as u128 * b as u128 / d as u128) as u64
}

fn mul_div_up(a: u64, b: u64, d: u64) -> u64 {
    ((a as u128 * b as u128 + d as u128 - 1) / d as u128) as u64
}

pub fn sync_liquidity(m: &mut Market, now: i64) {
    let lt = liquidity_at(m.l0, m.open_time, m.close_time, now, m.params.l_floor_bps as u64);
    if lt < m.l {
        m.l = lt;
    }
}

/// Advances the time-weighted mark toward the price that held since the last update.
/// Call before any change to `z`.
pub fn update_mark(m: &mut Market, now: i64) {
    if m.mark_t == 0 {
        m.mark_z = m.z;
        m.mark_t = now;
        return;
    }
    let a = ema_alpha(now - m.mark_t, MARK_TAU_SECS);
    if a > 0.0 {
        m.mark_z += a * (m.z - m.mark_z);
        m.mark_t = now;
    }
}

pub fn accrue(p: &mut Position, rate: u64, now: i64) {
    if p.debt > 0 {
        p.accrued = p
            .accrued
            .saturating_add(borrow_fee(p.debt, rate, now - p.last_accrual));
    }
    p.last_accrual = now;
}

pub fn check_solvency(m: &Market) -> Result<()> {
    require!(m.cash >= m.q_yes && m.cash >= m.q_no, KondoraError::Math);
    require!(m.z.is_finite() && m.z.abs() <= Z_LIMIT, KondoraError::Math);
    Ok(())
}

fn add_q(m: &mut Market, side: Side, n: u64) -> Result<()> {
    let q = match side {
        Side::Yes => &mut m.q_yes,
        Side::No => &mut m.q_no,
    };
    *q = q.checked_add(n).ok_or(KondoraError::Math)?;
    Ok(())
}

fn sub_q(m: &mut Market, side: Side, n: u64) -> Result<()> {
    let q = match side {
        Side::Yes => &mut m.q_yes,
        Side::No => &mut m.q_no,
    };
    *q = q.checked_sub(n).ok_or(KondoraError::Math)?;
    Ok(())
}

#[derive(Clone, Copy, Debug)]
pub struct Health {
    pub value: u64,
    pub equity: i128,
    pub liquidatable: bool,
}

/// Exact exit value of a position right now (AMM sell minus fee).
pub fn health(m: &Market, p: &Position, now: i64) -> Result<Health> {
    health_at(m, p, now, m.z, m.l)
}

/// Exit value of a position at an arbitrary AMM state (z, l).
pub fn health_at(m: &Market, p: &Position, now: i64, z: f64, l: f64) -> Result<Health> {
    let side = side_of(p.side)?;
    let (gross, _) = sell_proceeds(z, l, side, p.shares).ok_or(KondoraError::Math)?;
    let fee = bps_up(gross, m.params.fee_bps as u64).min(gross);
    let value = gross - fee;
    let accrued = p.accrued as u128
        + borrow_fee(p.debt, m.params.borrow_bps_per_hour as u64, now - p.last_accrual) as u128;
    let equity = value as i128 - p.debt as i128 - accrued as i128;
    let maint = bps_down(value, m.params.mm_bps as u64) as i128;
    Ok(Health { value, equity, liquidatable: p.debt > 0 && equity <= maint })
}

#[derive(Clone, Copy, Debug, Default)]
pub struct OpenResult {
    pub shares: u64,
    pub notional: u64,
    pub debt: u64,
    pub fee: u64,
    pub slot: usize,
}

pub fn open(
    m: &mut Market,
    u: &mut UserAccount,
    side_u8: u8,
    margin: u64,
    lev_bps: u64,
    min_shares: u64,
    now: i64,
) -> Result<OpenResult> {
    require!(m.state == ST_OPEN, KondoraError::MarketNotOpen);
    require!(now >= m.open_time && now < m.close_time, KondoraError::TradingClosed);
    require!(margin >= m.params.min_trade, KondoraError::TooSmall);
    require!(u.balance >= margin, KondoraError::InsufficientBalance);
    let side = side_of(side_u8)?;
    sync_liquidity(m, now);
    update_mark(m, now);

    let p_now = price(m.z, side);
    let cap = max_leverage_bps(
        m.params.max_lev_bps as u64,
        m.close_time - now,
        m.params.tau0,
        p_now,
        m.params.reduce_only_secs,
    );
    require!(lev_bps >= BPS && lev_bps <= cap, KondoraError::LeverageTooHigh);

    let notional = mul_div(margin, lev_bps, BPS);
    let debt = notional - margin;
    require!(debt <= m.lend_pool, KondoraError::InsufficientLiquidity);
    let fee = bps_up(notional, m.params.fee_bps as u64);
    let spend = notional.checked_sub(fee).ok_or(KondoraError::TooSmall)?;
    let (shares, z2) = shares_for_cost(m.z, m.l, side, spend).ok_or(KondoraError::Math)?;
    require!(shares > 0 && shares >= min_shares, KondoraError::Slippage);
    require!(
        price(z2, side) <= m.params.max_price_bps as f64 / BPS as f64,
        KondoraError::PriceOutOfRange
    );

    let slot = u.find_or_alloc(m.id, side_u8).ok_or(KondoraError::NoSlot)?;
    let mut pos = u.positions[slot];
    accrue(&mut pos, m.params.borrow_bps_per_hour as u64, now);
    let had_debt = pos.debt > 0;
    if pos.opened_at == 0 {
        pos.opened_at = now;
    }
    pos.shares = pos.shares.checked_add(shares).ok_or(KondoraError::Math)?;
    pos.debt = pos.debt.checked_add(debt).ok_or(KondoraError::Math)?;
    pos.margin = pos.margin.checked_add(margin).ok_or(KondoraError::Math)?;

    m.z = z2;
    m.cash = m.cash.checked_add(spend).ok_or(KondoraError::Math)?;
    add_q(m, side, shares)?;
    m.lend_pool -= debt;
    m.open_debt = m.open_debt.checked_add(debt).ok_or(KondoraError::Math)?;
    m.fees = m.fees.checked_add(fee).ok_or(KondoraError::Math)?;
    m.volume = m.volume.saturating_add(notional);
    m.trades += 1;
    if !had_debt && pos.debt > 0 {
        m.debt_positions += 1;
    }

    if pos.debt > 0 {
        require!(!health(m, &pos, now)?.liquidatable, KondoraError::Unhealthy);
        // Size cap: the position must stay healthy even after liquidity decays
        // to its floor, so a leveraged position is always small next to market
        // depth and its forced sale cannot be farmed by a sandwich.
        let floor_l = m.l0 * m.params.l_floor_bps as f64 / BPS as f64;
        require!(!health_at(m, &pos, now, m.z, floor_l)?.liquidatable, KondoraError::Unhealthy);
    }
    u.positions[slot] = pos;
    u.balance -= margin;
    u.trades += 1;
    check_solvency(m)?;
    Ok(OpenResult { shares, notional, debt, fee, slot })
}

#[derive(Clone, Copy, Debug, Default)]
pub struct CloseResult {
    pub shares: u64,
    pub gross: u64,
    pub fee: u64,
    pub repaid: u64,
    pub interest: u64,
    pub shortfall: u64,
    pub penalty: u64,
    pub to_user: u64,
}

/// Sells `fraction_bps` of a position, repays its share of the debt and
/// credits the rest. `penalty_bps` is charged on liquidations only.
pub fn close_slot(
    m: &mut Market,
    u: &mut UserAccount,
    slot: usize,
    fraction_bps: u64,
    penalty_bps: u64,
    require_solvent: bool,
    now: i64,
) -> Result<CloseResult> {
    let mut pos = u.positions[slot];
    require!(!pos.is_empty() && pos.market_id == m.id, KondoraError::NoPosition);
    require!(fraction_bps > 0, KondoraError::InvalidParams);
    let side = side_of(pos.side)?;
    sync_liquidity(m, now);
    update_mark(m, now);
    accrue(&mut pos, m.params.borrow_bps_per_hour as u64, now);

    let mut s = mul_div(pos.shares, fraction_bps.min(BPS), BPS);
    let all = fraction_bps >= BPS || s >= pos.shares;
    if all {
        s = pos.shares;
    }
    let (d, mut a, mg) = if all {
        (pos.debt, pos.accrued, pos.margin)
    } else {
        (
            mul_div_up(pos.debt, fraction_bps, BPS).min(pos.debt),
            mul_div_up(pos.accrued, fraction_bps, BPS).min(pos.accrued),
            mul_div(pos.margin, fraction_bps, BPS),
        )
    };
    // Once the principal is fully repaid, all accrued interest is due too.
    if d == pos.debt {
        a = pos.accrued;
    }

    let (gross, z2) = if s > 0 {
        sell_proceeds(m.z, m.l, side, s).ok_or(KondoraError::Math)?
    } else {
        (0, m.z)
    };
    let fee = bps_up(gross, m.params.fee_bps as u64).min(gross);
    let net = gross - fee;
    let owed = d + a;
    // Only liquidations may realize bad debt; an owner cannot dump an
    // underwater position onto the lend pool.
    require!(!(require_solvent && net < owed), KondoraError::Unhealthy);
    let (repaid, interest, shortfall, mut to_user) = if net >= owed {
        (d, a, 0, net - owed)
    } else {
        let repaid = net.min(d);
        (repaid, net - repaid, d - repaid, 0)
    };
    let penalty = bps_down(net, penalty_bps).min(to_user);
    to_user -= penalty;

    m.z = z2;
    m.cash = m.cash.checked_sub(gross).ok_or(KondoraError::Math)?;
    sub_q(m, side, s)?;
    m.fees = m.fees.saturating_add(fee + interest + penalty);
    m.lend_pool = m.lend_pool.checked_add(repaid).ok_or(KondoraError::Math)?;
    m.open_debt = m.open_debt.checked_sub(d).ok_or(KondoraError::Math)?;
    m.bad_debt = m.bad_debt.saturating_add(shortfall);
    m.volume = m.volume.saturating_add(gross);
    m.trades += 1;

    let had_debt = pos.debt > 0;
    pos.shares -= s;
    pos.debt -= d;
    pos.accrued -= a;
    pos.margin -= mg;
    if had_debt && pos.debt == 0 {
        m.debt_positions = m.debt_positions.checked_sub(1).ok_or(KondoraError::Math)?;
    }
    if all {
        pos = Position::default();
    }
    u.positions[slot] = pos;
    u.balance = u.balance.checked_add(to_user).ok_or(KondoraError::Math)?;
    u.realized_pnl = u.realized_pnl.saturating_add(to_user as i64 - mg as i64);
    u.trades += 1;
    check_solvency(m)?;
    Ok(CloseResult { shares: s, gross, fee, repaid, interest, shortfall, penalty, to_user })
}

pub fn close(
    m: &mut Market,
    u: &mut UserAccount,
    side_u8: u8,
    fraction_bps: u64,
    min_out: u64,
    now: i64,
) -> Result<CloseResult> {
    require!(m.state == ST_OPEN, KondoraError::MarketNotOpen);
    require!(now < m.close_time, KondoraError::TradingClosed);
    let slot = u.find(m.id, side_u8).ok_or(KondoraError::NoPosition)?;
    let r = close_slot(m, u, slot, fraction_bps, 0, true, now)?;
    require!(r.to_user >= min_out, KondoraError::Slippage);
    Ok(r)
}

/// Mark-based health: value of the shares at the time-weighted mark, no AMM.
pub fn mark_health(m: &Market, p: &Position, now: i64) -> Result<Health> {
    let side = side_of(p.side)?;
    let value = libm::floor(p.shares as f64 * price(m.mark_z, side)) as u64;
    let accrued = p.accrued as u128
        + borrow_fee(p.debt, m.params.borrow_bps_per_hour as u64, now - p.last_accrual) as u128;
    let equity = value as i128 - p.debt as i128 - accrued as i128;
    let maint = bps_down(value, m.params.mm_bps as u64) as i128;
    Ok(Health { value, equity, liquidatable: p.debt > 0 && equity <= maint })
}

/// Permissionless. Uses the mark to trigger liquidation and the halt window to
/// force close remaining debt. Solvent force closes execute against the pool;
/// underwater positions go to the House without moving the pool price.
/// - under maintenance at the mark: liquidation with penalty,
/// - inside the halt window before close: force close, no penalty.
/// A healthy force close must never pay the marginal mark for every share:
/// that would pay a trader for their own price impact. Selling bad debt into
/// the pool is also unsafe: a second account could farm the forced sale.
pub fn liquidate(m: &mut Market, u: &mut UserAccount, side_u8: u8, now: i64) -> Result<CloseResult> {
    require!(m.state == ST_OPEN, KondoraError::MarketNotOpen);
    let slot = u.find(m.id, side_u8).ok_or(KondoraError::NoPosition)?;
    let mut pos = u.positions[slot];
    require!(pos.debt > 0, KondoraError::NoPosition);
    let side = side_of(side_u8)?;
    sync_liquidity(m, now);
    update_mark(m, now);
    accrue(&mut pos, m.params.borrow_bps_per_hour as u64, now);
    let h = mark_health(m, &pos, now)?;
    let halted = now >= m.close_time - m.params.halt_secs;
    require!(h.liquidatable || halted, KondoraError::Healthy);

    let owed = pos.debt as u128 + pos.accrued as u128;
    let (gross, exit_z) = sell_proceeds(m.z, m.l, side, pos.shares).ok_or(KondoraError::Math)?;
    let net = gross - bps_up(gross, m.params.fee_bps as u64).min(gross);
    let (qy, qn) = match side {
        Side::Yes => (m.q_yes.saturating_sub(pos.shares), m.q_no),
        Side::No => (m.q_yes, m.q_no.saturating_sub(pos.shares)),
    };
    let spare_cash = m.cash.saturating_sub(qy.max(qn));
    if !h.liquidatable && net as u128 >= owed && gross <= spare_cash {
        return close_slot(m, u, slot, BPS, 0, true, now);
    }

    let penalty = if h.liquidatable { bps_down(h.value, m.params.liq_bps as u64) } else { 0 };
    let equity = h.value as u128;
    // Backstop a sale that would consume the other side's reserved claims.
    // Value it at the executable exit and update z; it must not pay the mark
    // or leave the trader's price impact available to a second account.
    // Underwater positions never sell into the pool (sandwich protection).
    let mut to_user = if h.liquidatable {
        equity.saturating_sub(owed).saturating_sub(penalty as u128) as u64
    } else {
        if net as u128 >= owed {
            m.z = exit_z;
        }
        (net as u128).saturating_sub(owed) as u64
    };
    let from_lend = to_user.min(m.lend_pool);
    let from_cash = (to_user - from_lend).min(spare_cash);
    to_user = from_lend + from_cash;
    m.lend_pool -= from_lend;
    m.cash -= from_cash;
    sub_q(m, side, pos.shares)?;
    m.open_debt = m.open_debt.checked_sub(pos.debt).ok_or(KondoraError::Math)?;
    m.bad_debt = m.bad_debt.saturating_add((pos.debt as u128).saturating_sub(equity) as u64);
    m.debt_positions = m.debt_positions.checked_sub(1).ok_or(KondoraError::Math)?;
    m.trades += 1;
    u.balance = u.balance.checked_add(to_user).ok_or(KondoraError::Math)?;
    u.realized_pnl = u.realized_pnl.saturating_add(to_user as i64 - pos.margin as i64);
    if h.liquidatable {
        u.liquidations += 1;
    }
    u.positions[slot] = Position::default();
    check_solvency(m)?;
    Ok(CloseResult {
        shares: pos.shares,
        gross: h.value,
        fee: 0,
        repaid: 0,
        interest: 0,
        shortfall: owed.saturating_sub(equity) as u64,
        penalty: if h.liquidatable { penalty.max(1) } else { 0 },
        to_user,
    })
}

/// A user account with borrowed positions may not leave the rollup.
pub fn require_no_debt(u: &UserAccount) -> Result<()> {
    require!(u.positions.iter().all(|p| p.debt == 0), KondoraError::DebtOutstanding);
    Ok(())
}

/// Payout per share side for a resolved market.
fn payout_for(m: &Market, side: u8, shares: u64) -> u64 {
    match m.outcome {
        OUT_YES if side == 0 => shares,
        OUT_NO if side == 1 => shares,
        OUT_INVALID => {
            let p = if side == 0 { m.final_price_yes } else { 1.0 - m.final_price_yes };
            libm::floor(shares as f64 * p.clamp(0.0, 1.0)) as u64
        }
        _ => 0,
    }
}

pub fn claim(m: &Market, u: &mut UserAccount) -> Result<u64> {
    require!(m.state == ST_RESOLVED, KondoraError::WrongState);
    let mut total: u64 = 0;
    let mut found = false;
    for side in [0u8, 1u8] {
        if let Some(i) = u.find(m.id, side) {
            let p = u.positions[i];
            require!(p.debt == 0, KondoraError::DebtOutstanding);
            let pay = payout_for(m, side, p.shares);
            total = total.checked_add(pay).ok_or(KondoraError::Math)?;
            u.realized_pnl = u.realized_pnl.saturating_add(pay as i64 - p.margin as i64);
            u.positions[i] = Position::default();
            found = true;
        }
    }
    require!(found, KondoraError::NoPosition);
    u.balance = u.balance.checked_add(total).ok_or(KondoraError::Math)?;
    Ok(total)
}

/// Stops trading. Requires every leveraged position to be closed.
pub fn close_market(m: &mut Market, now: i64) -> Result<()> {
    require!(m.state == ST_OPEN, KondoraError::WrongState);
    require!(now >= m.close_time, KondoraError::TradingStillOpen);
    require!(m.debt_positions == 0 && m.open_debt == 0, KondoraError::DebtOutstanding);
    update_mark(m, now);
    m.state = ST_CLOSED;
    // Time-weighted, so a last-second push cannot set the INVALID payout.
    m.final_price_yes = price(m.mark_z, Side::Yes);
    Ok(())
}

/// What the House gets back from a resolved market: everything except the
/// winners' payout.
pub fn sweep_amount(m: &Market) -> Result<u64> {
    require!(m.state == ST_RESOLVED, KondoraError::WrongState);
    let payout = match m.outcome {
        OUT_YES => m.q_yes,
        OUT_NO => m.q_no,
        OUT_INVALID => {
            let p = m.final_price_yes.clamp(0.0, 1.0);
            let v = m.q_yes as f64 * p + m.q_no as f64 * (1.0 - p);
            (ceil_u64(v).ok_or(KondoraError::Math)? + 1).min(m.cash)
        }
        _ => return err!(KondoraError::InvalidOutcome),
    };
    let rest = m.cash.checked_sub(payout).ok_or(KondoraError::Math)?;
    Ok(rest + m.lend_pool + m.fees)
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOUR: i64 = 3600;
    const USDC: u64 = 1_000_000;

    fn params() -> Params {
        Params {
            fee_bps: 50,
            mm_bps: 500,
            liq_bps: 100,
            max_lev_bps: 50_000,
            borrow_bps_per_hour: 2,
            l_floor_bps: 3000,
            max_price_bps: 9900,
            min_trade: USDC,
            tau0: 24 * HOUR,
            reduce_only_secs: HOUR,
            halt_secs: 600,
            dispute_secs: 900,
        }
    }

    fn market(subsidy: u64, lend: u64, z0: f64) -> Market {
        let l0 = initial_liquidity(subsidy, z0);
        Market {
            id: 1,
            category: 0,
            state: ST_OPEN,
            outcome: 0,
            swept: false,
            question_hash: [0; 32],
            rules_hash: [0; 32],
            evidence_hash: [0; 32],
            open_time: 0,
            close_time: 72 * HOUR,
            proposed_at: 0,
            resolved_at: 0,
            z0,
            z: z0,
            l0,
            l: l0,
            final_price_yes: 0.0,
            mark_z: z0,
            mark_t: 0,
            cash: subsidy,
            q_yes: 0,
            q_no: 0,
            subsidy,
            lend_initial: lend,
            lend_pool: lend,
            open_debt: 0,
            debt_positions: 0,
            fees: 0,
            bad_debt: 0,
            volume: 0,
            trades: 0,
            params: params(),
            bump: 0,
        }
    }

    fn user(balance: u64) -> UserAccount {
        UserAccount {
            owner: Pubkey::default(),
            balance,
            deposited: balance,
            withdrawn: 0,
            realized_pnl: 0,
            trades: 0,
            liquidations: 0,
            positions: [Position::default(); MAX_POSITIONS],
            bump: 0,
        }
    }

    fn total(m: &Market, users: &[&UserAccount]) -> u128 {
        users.iter().map(|u| u.balance as u128).sum::<u128>()
            + m.cash as u128
            + m.lend_pool as u128
            + m.fees as u128
    }

    #[test]
    fn open_and_close_conserves_money_and_debt_counter() {
        let mut m = market(10_000 * USDC, 20_000 * USDC, 0.0);
        let mut a = user(1_000 * USDC);
        let t0 = total(&m, &[&a]);
        let r = open(&mut m, &mut a, 0, 100 * USDC, 50_000, 0, HOUR).unwrap();
        assert_eq!(r.debt, 400 * USDC);
        assert_eq!(m.debt_positions, 1);
        assert_eq!(total(&m, &[&a]), t0);
        // adding to the same slot keeps one debt position
        open(&mut m, &mut a, 0, 10 * USDC, 20_000, 0, HOUR).unwrap();
        assert_eq!(m.debt_positions, 1);
        close(&mut m, &mut a, 0, 5_000, 0, 2 * HOUR).unwrap();
        assert_eq!(m.debt_positions, 1);
        close(&mut m, &mut a, 0, 10_000, 0, 2 * HOUR).unwrap();
        assert_eq!(m.debt_positions, 0);
        assert_eq!(m.open_debt, 0);
        assert!(a.find(1, 0).is_none());
        assert_eq!(total(&m, &[&a]), t0);
        // round trip costs fees, never profits
        assert!(a.balance < 1_000 * USDC);
        assert_eq!(m.lend_pool + m.bad_debt, 20_000 * USDC);
    }

    #[test]
    fn leverage_cap_enforced() {
        let mut m = market(10_000 * USDC, 20_000 * USDC, 0.0);
        let mut a = user(1_000 * USDC);
        assert!(open(&mut m, &mut a, 0, 10 * USDC, 50_001, 0, HOUR).is_err());
        // 30 minutes before close: reduce-only, 1x only
        let late = m.close_time - 1800;
        assert!(open(&mut m, &mut a, 0, 10 * USDC, 20_000, 0, late).is_err());
        assert!(open(&mut m, &mut a, 0, 10 * USDC, 10_000, 0, late).is_ok());
        assert_eq!(m.debt_positions, 0);
    }

    #[test]
    fn adverse_move_liquidates_with_penalty_and_conserves() {
        let mut m = market(5_000 * USDC, 20_000 * USDC, 0.0);
        let mut a = user(1_000 * USDC);
        let mut whale = user(100_000 * USDC);
        let t0 = total(&m, &[&a, &whale]);
        open(&mut m, &mut a, 0, 200 * USDC, 50_000, 0, HOUR).unwrap();
        assert!(liquidate(&mut m, &mut a, 0, HOUR).is_err(), "healthy must not liquidate");
        // whale pushes YES down by buying NO
        for _ in 0..30 {
            if open(&mut m, &mut whale, 1, 200 * USDC, 10_000, 0, HOUR).is_err() {
                break;
            }
            let mut probe = m.clone();
            probe.mark_z = probe.z;
            if mark_health(&probe, &a.positions[a.find(1, 0).unwrap()], HOUR).unwrap().liquidatable {
                break;
            }
        }
        let h = health(&m, &a.positions[a.find(1, 0).unwrap()], HOUR).unwrap();
        assert!(h.liquidatable);
        // Spot is under water but the time-weighted mark has not followed yet.
        assert!(liquidate(&mut m, &mut a, 0, HOUR).is_err(), "mark must lag a sudden move");
        let r = liquidate(&mut m, &mut a, 0, 2 * HOUR).unwrap();
        assert_eq!(m.debt_positions, 0);
        assert_eq!(a.liquidations, 1);
        assert!(r.penalty > 0 || r.to_user == 0);
        assert_eq!(total(&m, &[&a, &whale]), t0);
        check_solvency(&m).unwrap();
    }

    #[test]
    fn halt_window_force_closes_without_penalty_then_resolution_pays() {
        let mut m = market(5_000 * USDC, 20_000 * USDC, 0.2);
        let mut a = user(1_000 * USDC);
        let mut b = user(1_000 * USDC);
        let t0 = total(&m, &[&a, &b]);
        open(&mut m, &mut a, 0, 100 * USDC, 30_000, 0, HOUR).unwrap();
        open(&mut m, &mut b, 1, 100 * USDC, 10_000, 0, HOUR).unwrap();
        open(&mut m, &mut a, 1, 50 * USDC, 10_000, 0, 2 * HOUR).unwrap();
        // cannot close market while debt is open
        assert!(close_market(&mut m, 72 * HOUR).is_err());
        assert!(liquidate(&mut m, &mut a, 0, 2 * HOUR).is_err());
        let halt = m.close_time - 300;
        let r = liquidate(&mut m, &mut a, 0, halt).unwrap();
        assert_eq!(r.penalty, 0);
        assert!(liquidate(&mut m, &mut b, 1, halt).is_err(), "1x is never force closed");
        // trading after close is rejected
        assert!(open(&mut m, &mut b, 1, 10 * USDC, 10_000, 0, 72 * HOUR).is_err());
        close_market(&mut m, 72 * HOUR).unwrap();
        assert_eq!(total(&m, &[&a, &b]), t0);

        m.state = ST_RESOLVED;
        m.outcome = OUT_NO;
        let house_back = sweep_amount(&m).unwrap();
        let pa = claim(&m, &mut a).unwrap();
        let pb = claim(&m, &mut b).unwrap();
        assert!(claim(&m, &mut a).is_err(), "double claim");
        // claims + house return equal everything the market held
        let before_claims = t0 - (a.balance - pa) as u128 - (b.balance - pb) as u128;
        assert_eq!((pa + pb + house_back) as u128, before_claims);
    }

    #[test]
    fn invalid_outcome_pays_final_mark_and_stays_solvent() {
        let mut m = market(5_000 * USDC, 5_000 * USDC, -0.5);
        let mut a = user(1_000 * USDC);
        let mut b = user(1_000 * USDC);
        open(&mut m, &mut a, 0, 300 * USDC, 10_000, 0, HOUR).unwrap();
        open(&mut m, &mut b, 1, 120 * USDC, 10_000, 0, HOUR).unwrap();
        close_market(&mut m, 72 * HOUR).unwrap();
        m.state = ST_RESOLVED;
        m.outcome = OUT_INVALID;
        let cash = m.cash;
        let back = sweep_amount(&m).unwrap();
        let pa = claim(&m, &mut a).unwrap();
        let pb = claim(&m, &mut b).unwrap();
        assert!(pa + pb + back - m.lend_pool - m.fees <= cash);
        assert!(pa > 0 && pb > 0);
    }

    #[test]
    fn borrow_fee_accrues_and_is_paid() {
        let mut m = market(10_000 * USDC, 20_000 * USDC, 0.0);
        let mut a = user(1_000 * USDC);
        open(&mut m, &mut a, 0, 100 * USDC, 50_000, 0, 0).unwrap();
        let fees_before = m.fees;
        let r = close(&mut m, &mut a, 0, 10_000, 0, 10 * HOUR).unwrap();
        // 400 USDC debt, 2 bps/hour, 10 hours = 0.8 USDC
        assert_eq!(r.interest, 800_000);
        assert!(m.fees > fees_before + r.interest);
    }

    /// Attack from the security review: a leveraged position plus a second
    /// account that dumps the price must not extract value from the lend pool.
    #[test]
    fn sandwich_on_own_leverage_is_not_profitable() {
        for margin in [5_000 * USDC, 1_000 * USDC, 200 * USDC] {
            let mut m = market(10_000 * USDC, 50_000 * USDC, 0.0);
            let mut a = user(margin);
            let mut b = user(200_000 * USDC);
            let t0 = a.balance as i128 + b.balance as i128;
            if open(&mut m, &mut a, 0, margin, 50_000, 0, HOUR).is_err() {
                continue; // size cap rejected it: attack impossible
            }
            for _ in 0..200 {
                if open(&mut m, &mut b, 1, 1_000 * USDC, 10_000, 0, HOUR).is_err() {
                    break;
                }
            }
            // owner cannot dump an underwater position
            let slot = a.find(1, 0).unwrap();
            let h = health(&m, &a.positions[slot], HOUR).unwrap();
            if h.equity < 0 {
                assert!(close(&mut m, &mut a, 0, 10_000, 0, HOUR).is_err());
            }
            // same-slot liquidation is blocked by the mark; attacker must hold the price
            assert!(liquidate(&mut m, &mut a, 0, HOUR).is_err() || !h.liquidatable);
            let later = HOUR + 2 * 3600;
            let _ = liquidate(&mut m, &mut a, 0, later);
            close(&mut m, &mut b, 1, 10_000, 0, later).unwrap();
            if let Some(i) = a.find(1, 0) {
                let _ = i;
                let _ = close(&mut m, &mut a, 0, 10_000, 0, later);
            }
            let t1 = a.balance as i128 + b.balance as i128;
            assert!(t1 <= t0, "attacker profit {} at margin {}", t1 - t0, margin);
        }
    }

    /// From the security review: a lopsided market plus decay must never lock
    /// a leveraged position (and therefore the market).
    #[test]
    fn decayed_lopsided_market_still_liquidates_and_closes() {
        for margin in [10_000 * USDC, 2_000 * USDC, 300 * USDC] {
            let mut m = market(10_000 * USDC, 50_000 * USDC, -2.0);
            let mut a = user(100_000 * USDC);
            if open(&mut m, &mut a, 0, margin, 11_000, 0, HOUR).is_err() {
                continue;
            }
            let halt = m.close_time - 300;
            liquidate(&mut m, &mut a, 0, halt).unwrap();
            assert_eq!(m.debt_positions, 0);
            close_market(&mut m, 72 * HOUR).unwrap();
            check_solvency(&m).unwrap();
        }
    }

    #[test]
    fn invalid_mark_ignores_last_second_push() {
        let mut m = market(5_000 * USDC, 5_000 * USDC, 0.0);
        let mut whale = user(50_000 * USDC);
        let close_t = m.close_time;
        // price sits at 0.5 for the whole market life, then a push in the last second
        open(&mut m, &mut whale, 0, 10 * USDC, 10_000, 0, HOUR).unwrap();
        open(&mut m, &mut whale, 0, 4_000 * USDC, 10_000, 0, close_t - 1).unwrap();
        assert!(price(m.z, Side::Yes) > 0.8);
        close_market(&mut m, close_t).unwrap();
        assert!(m.final_price_yes < 0.55, "final mark {}", m.final_price_yes);
    }

    #[test]
    fn partial_closes_settle_all_interest() {
        let mut m = market(10_000 * USDC, 50_000 * USDC, 0.0);
        let mut a = user(1_000 * USDC);
        open(&mut m, &mut a, 0, 100 * USDC, 30_000, 0, 0).unwrap();
        close(&mut m, &mut a, 0, 3_333, 0, 7 * HOUR).unwrap();
        close(&mut m, &mut a, 0, 5_000, 0, 9 * HOUR).unwrap();
        close(&mut m, &mut a, 0, 10_000, 0, 11 * HOUR).unwrap();
        assert!(a.find(1, 0).is_none());
        assert_eq!(m.open_debt, 0);
        assert_eq!(m.lend_pool + m.bad_debt, 50_000 * USDC);
    }

    #[test]
    fn debt_blocks_leaving_the_rollup() {
        let mut m = market(10_000 * USDC, 20_000 * USDC, 0.0);
        let mut a = user(1_000 * USDC);
        assert!(require_no_debt(&a).is_ok());
        open(&mut m, &mut a, 0, 10 * USDC, 10_000, 0, HOUR).unwrap();
        assert!(require_no_debt(&a).is_ok(), "1x positions may leave");
        open(&mut m, &mut a, 1, 10 * USDC, 20_000, 0, HOUR).unwrap();
        assert!(require_no_debt(&a).is_err(), "leveraged positions may not");
        close(&mut m, &mut a, 1, 10_000, 0, HOUR).unwrap();
        assert!(require_no_debt(&a).is_ok());
    }

    #[test]
    fn own_price_impact_cannot_profit_from_force_close() {
        let mut m = market(50 * USDC, 100 * USDC, 0.0);
        let mut a = user(100 * USDC);
        let starting_balance = a.balance;
        let close_t = m.close_time;
        open(&mut m, &mut a, 0, 20 * USDC, 11_000, 0, close_t - 3601).unwrap();
        liquidate(&mut m, &mut a, 0, close_t - 300).unwrap();
        assert!(a.balance <= starting_balance, "risk-free profit {} micro USDC", a.balance.saturating_sub(starting_balance));
        assert_eq!(m.debt_positions, 0);
        check_solvency(&m).unwrap();
    }

    #[test]
    fn force_close_preserves_other_sides_reserved_claims() {
        let mut m = market(50 * USDC, 100 * USDC, 0.0);
        let mut a = user(100 * USDC);
        let close_t = m.close_time;
        open(&mut m, &mut a, 0, 20 * USDC, 11_000, 0, close_t - 3601).unwrap();
        // The other side can retain all cash after prior House takeovers.
        m.q_no = m.cash;
        let before = total(&m, &[&a]);
        liquidate(&mut m, &mut a, 0, close_t - 300).unwrap();
        assert_eq!(m.debt_positions, 0);
        assert_eq!(m.open_debt, 0);
        assert_eq!(before, total(&m, &[&a]));
        check_solvency(&m).unwrap();
        close_market(&mut m, close_t).unwrap();
    }
}
