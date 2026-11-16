//! pm-AMM pricing (Paradigm, static invariant + time-decaying liquidity) and
//! leverage helpers. Pure functions, no Anchor types, unit tested below.
//!
//! State is (z, L). Reserves: x = L*g(-z) YES, y = L*g(z) NO, where
//! g(z) = z*Phi(z) + phi(z). P(YES) = Phi(z). Every trade is expressed on the
//! side-oriented coordinate zs (z for YES, -z for NO):
//!   buy n shares:  cost     = L*(g(zs + n/L) - g(zs)),  zs += n/L
//!   sell n shares: proceeds = L*(g(zs) - g(zs - n/L)),  zs -= n/L
//! Rounding always favors the pool.

use libm::{erfc, exp, floor, sqrt};

const INV_SQRT2: f64 = core::f64::consts::FRAC_1_SQRT_2;
const INV_SQRT_2PI: f64 = 0.398_942_280_401_432_7;
pub const BPS: u64 = 10_000;
/// Hard bound on |z| for any state the program accepts (Phi(-8) ~ 6e-16).
pub const Z_LIMIT: f64 = 8.0;

#[inline]
pub fn cdf(z: f64) -> f64 {
    0.5 * erfc(-z * INV_SQRT2)
}

#[inline]
pub fn pdf(z: f64) -> f64 {
    INV_SQRT_2PI * exp(-0.5 * z * z)
}

#[inline]
pub fn g(z: f64) -> f64 {
    z * cdf(z) + pdf(z)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Side {
    Yes,
    No,
}

impl Side {
    pub fn from_u8(v: u8) -> Option<Side> {
        match v {
            0 => Some(Side::Yes),
            1 => Some(Side::No),
            _ => None,
        }
    }
}

#[inline]
pub fn oriented(z: f64, side: Side) -> f64 {
    match side {
        Side::Yes => z,
        Side::No => -z,
    }
}

/// Price of `side` in [0,1].
pub fn price(z: f64, side: Side) -> f64 {
    cdf(oriented(z, side))
}

/// USDC cost (micro, rounded up) to buy `n` shares. None if the result leaves the state bounds.
pub fn buy_cost(z: f64, l: f64, side: Side, n: u64) -> Option<(u64, f64)> {
    let zs = oriented(z, side);
    let zs2 = zs + n as f64 / l;
    if !(zs2.is_finite()) || zs2 > Z_LIMIT {
        return None;
    }
    let cost = l * (g(zs2) - g(zs));
    let cost = ceil_u64(cost)?.checked_add(1)?;
    Some((cost, oriented(zs2, side)))
}

/// USDC proceeds (micro, rounded down) for selling `n` shares, and the new z.
/// Never fails for a valid state: past the lower bound the curve is clamped at
/// -Z_LIMIT and the excess shares are absorbed at (almost) zero price, so a
/// position can always be closed or liquidated. Solvency still holds because
/// proceeds never exceed the shares sold and the other side's reserve stays
/// non-negative.
pub fn sell_proceeds(z: f64, l: f64, side: Side, n: u64) -> Option<(u64, f64)> {
    let zs = oriented(z, side);
    if !(l > 0.0) || !zs.is_finite() {
        return None;
    }
    let zs2 = (zs - n as f64 / l).max(-Z_LIMIT).min(zs);
    let raw = l * (g(zs) - g(zs2));
    let out = if raw <= 1.0 { 0 } else { (floor(raw) as u64 - 1).min(n) };
    Some((out, oriented(zs2, side)))
}

/// Shares bought with exactly `c` micro USDC (rounded down) and the new z.
/// Solves g(w) = g(zs) + c/L with Newton from the right of the root
/// (g is convex and increasing, so iterates decrease monotonically).
pub fn shares_for_cost(z: f64, l: f64, side: Side, c: u64) -> Option<(u64, f64)> {
    if c == 0 || !(l > 0.0) {
        return None;
    }
    let zs = oriented(z, side);
    let target = g(zs) + c as f64 / l;
    let mut w = zs + c as f64 / (l * cdf(zs));
    if !w.is_finite() {
        return None;
    }
    for _ in 0..100 {
        let step = (g(w) - target) / cdf(w);
        w -= step;
        if step.abs() <= 1e-13 * (1.0 + w.abs()) {
            break;
        }
    }
    if !(w.is_finite()) || w > Z_LIMIT {
        return None;
    }
    let raw = (w - zs) * l;
    if raw < 2.0 {
        return None;
    }
    // Marginal price at the end of the trade: shares per micro USDC is 1/p.
    let p_end = cdf(w).max(1e-12);
    let mut n = (floor(raw) as u64).checked_sub(ceil_u64(2.0 / p_end)? + 1)?;
    // Guarantee cost(n) <= c even under float noise.
    for _ in 0..8 {
        let (cost, z2) = buy_cost(z, l, side, n)?;
        if cost <= c {
            return Some((n, z2));
        }
        let over = (cost - c) as f64;
        n = n.checked_sub(ceil_u64((over + 1.0) / p_end)? + 1)?;
    }
    None
}

pub fn ceil_u64(v: f64) -> Option<u64> {
    if !(v.is_finite()) || v < 0.0 || v >= 9.0e15 {
        return None;
    }
    let f = floor(v);
    Some(if f == v { f as u64 } else { f as u64 + 1 })
}

/// Liquidity at time `now`: L0 * sqrt(clamp(remaining fraction, floor^2, 1)).
pub fn liquidity_at(l0: f64, open: i64, close: i64, now: i64, floor_bps: u64) -> f64 {
    let span = (close - open).max(1) as f64;
    let rem = ((close - now) as f64 / span).clamp(0.0, 1.0);
    let fl = floor_bps as f64 / BPS as f64;
    l0 * sqrt(rem.max(fl * fl))
}

/// L0 so that the funding `s0` covers both initial reserves at z0.
pub fn initial_liquidity(s0: u64, z0: f64) -> f64 {
    s0 as f64 / g(z0.abs())
}

/// Maximum leverage (bps) allowed right now.
pub fn max_leverage_bps(max_lev_bps: u64, tau: i64, tau0: i64, p: f64, reduce_only_secs: i64) -> u64 {
    if tau <= reduce_only_secs {
        return BPS;
    }
    let extra = max_lev_bps.saturating_sub(BPS) as f64;
    let t = (tau as f64 / tau0.max(1) as f64).min(1.0);
    let by_time = BPS as f64 + extra * t;
    let by_price = BPS as f64 + 8.0 * BPS as f64 * p.min(1.0 - p).max(0.0);
    let cap = (max_lev_bps as f64).min(by_time).min(by_price);
    (floor(cap) as u64).max(BPS)
}

/// Linear borrow fee on `debt` over `dt` seconds.
/// Exponential moving average weight for `dt` seconds with time constant `tau`.
pub fn ema_alpha(dt: i64, tau: i64) -> f64 {
    if dt <= 0 {
        return 0.0;
    }
    1.0 - exp(-(dt as f64) / tau.max(1) as f64)
}

pub fn borrow_fee(debt: u64, bps_per_hour: u64, dt: i64) -> u64 {
    if dt <= 0 || debt == 0 {
        return 0;
    }
    let v = debt as u128 * bps_per_hour as u128 * dt as u128;
    (v / (3600u128 * BPS as u128)) as u64
}

/// a * b / BPS rounded up.
pub fn bps_up(a: u64, b: u64) -> u64 {
    ((a as u128 * b as u128 + (BPS as u128 - 1)) / BPS as u128) as u64
}

/// a * b / BPS rounded down.
pub fn bps_down(a: u64, b: u64) -> u64 {
    (a as u128 * b as u128 / BPS as u128) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: f64, b: f64, tol: f64) -> bool {
        (a - b).abs() <= tol
    }

    #[test]
    fn invariant_matches_paradigm_form() {
        for &z in &[-3.0, -1.2, -0.3, 0.0, 0.4, 1.7, 2.9] {
            let l = 1.0e9;
            let x = l * g(-z);
            let y = l * g(z);
            let u = (y - x) / l;
            let lhs = (y - x) * cdf(u) + l * pdf(u) - y;
            assert!(close(lhs / l, 0.0, 1e-12), "z={z} lhs={lhs}");
            assert!(close(u, z, 1e-12));
        }
    }

    #[test]
    fn prices_sum_to_one_and_are_monotone() {
        let mut prev = 0.0;
        for i in -40..=40 {
            let z = i as f64 / 10.0;
            let py = price(z, Side::Yes);
            assert!(close(py + price(z, Side::No), 1.0, 1e-15));
            assert!(py > prev);
            prev = py;
        }
    }

    #[test]
    fn shares_for_cost_is_tight_and_safe() {
        let l = initial_liquidity(10_000_000_000, 0.0);
        for &z in &[-2.0, -0.5, 0.0, 0.7, 1.9] {
            for &c in &[1_000_000u64, 25_000_000, 1_000_000_000, 5_000_000_000] {
                for side in [Side::Yes, Side::No] {
                    let (n, z2) = shares_for_cost(z, l, side, c).unwrap();
                    let (cost, z3) = buy_cost(z, l, side, n).unwrap();
                    assert!(cost <= c, "cost {cost} > c {c}");
                    let (cost2, _) = buy_cost(z, l, side, n + n / 10_000 + 10).unwrap();
                    assert!(cost2 > c, "not tight: n={n}");
                    assert!(close(z2, z3, 1e-12));
                    // more than 1 share per USDC because price < 1
                    assert!(n > c);
                }
            }
        }
    }

    #[test]
    fn round_trip_never_profits() {
        let l = initial_liquidity(5_000_000_000, 0.3);
        for &c in &[1_000_000u64, 100_000_000, 2_000_000_000] {
            for side in [Side::Yes, Side::No] {
                let (n, z2) = shares_for_cost(0.3, l, side, c).unwrap();
                let (back, z3) = sell_proceeds(z2, l, side, n).unwrap();
                assert!(back <= c, "free money {back} > {c}");
                assert!(close(z3, 0.3, 1e-9));
            }
        }
    }

    /// Random walk of buys and sells with integer accounting: the market's cash
    /// must always cover every outstanding side, and the pool's reserves must
    /// never exceed what the market actually holds for it.
    #[test]
    fn solvency_under_random_trading_and_decay() {
        let s0 = 2_000_000_000u64;
        let z0 = 0.4;
        let l0 = initial_liquidity(s0, z0);
        let (mut z, mut l) = (z0, l0);
        let mut s = s0;
        let (mut qy, mut qn) = (0u64, 0u64);
        let mut seed = 0x2545F4914F6CDD1Du64;
        let mut rnd = || {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            seed
        };
        for step in 0..4000 {
            let now = step as i64 * 20;
            let lt = liquidity_at(l0, 0, 100_000, now, 3000);
            if lt < l {
                l = lt;
            }
            let side = if rnd() % 2 == 0 { Side::Yes } else { Side::No };
            let held = if side == Side::Yes { qy } else { qn };
            if rnd() % 3 != 0 || held == 0 {
                let c = 1_000_000 + rnd() % 300_000_000;
                if let Some((n, z2)) = shares_for_cost(z, l, side, c) {
                    if price(z2, side) > 0.99 {
                        continue;
                    }
                    z = z2;
                    s += c;
                    if side == Side::Yes { qy += n } else { qn += n }
                }
            } else {
                let n = 1 + rnd() % held;
                let (p, z2) = sell_proceeds(z, l, side, n).unwrap();
                z = z2;
                s -= p;
                if side == Side::Yes { qy -= n } else { qn -= n }
            }
            assert!(s >= qy && s >= qn, "insolvent at {step}");
            let x = l * g(-z);
            let y = l * g(z);
            assert!(x <= (s - qy) as f64 + 2.0, "pool YES reserves exceed holdings");
            assert!(y <= (s - qn) as f64 + 2.0, "pool NO reserves exceed holdings");
        }
    }

    #[test]
    fn sells_clamp_instead_of_failing() {
        let l = 1_000.0;
        let (out, z2) = sell_proceeds(-7.9, l, Side::Yes, 1_000_000).unwrap();
        assert!(close(z2, -Z_LIMIT, 1e-12));
        assert!(out <= 1_000_000);
        let (out_no, _) = sell_proceeds(7.9, l, Side::No, 1_000_000).unwrap();
        assert!(out_no <= 1_000_000);
    }

    #[test]
    fn liquidity_decays_to_floor() {
        let l0 = 1000.0;
        assert!(close(liquidity_at(l0, 0, 100, 0, 3000), 1000.0, 1e-9));
        assert!(close(liquidity_at(l0, 0, 100, 75, 3000), 500.0, 1e-9));
        assert!(close(liquidity_at(l0, 0, 100, 99, 3000), 300.0, 1e-9));
        assert!(close(liquidity_at(l0, 0, 100, 500, 3000), 300.0, 1e-9));
    }

    #[test]
    fn leverage_caps() {
        assert_eq!(max_leverage_bps(50_000, 100_000, 86_400, 0.5, 3600), 50_000);
        assert_eq!(max_leverage_bps(50_000, 43_200, 86_400, 0.5, 3600), 30_000);
        assert_eq!(max_leverage_bps(50_000, 100_000, 86_400, 0.1, 3600), 18_000);
        assert_eq!(max_leverage_bps(50_000, 3_000, 86_400, 0.5, 3600), 10_000);
        assert_eq!(max_leverage_bps(50_000, 100_000, 86_400, 0.995, 3600), 10_400);
    }

    #[test]
    fn fee_helpers() {
        assert_eq!(borrow_fee(1_000_000_000, 2, 3600), 200_000);
        assert_eq!(bps_up(1_000_001, 50), 5001);
        assert_eq!(bps_down(1_000_001, 50), 5000);
    }
}
