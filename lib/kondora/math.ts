// Mirror of program/programs/kondora/src/math.rs and engine.rs for quotes.
// The program is authoritative; quotes here are used with slippage bounds.

export const BPS = 10_000;
export const Z_LIMIT = 8;
const SQRT_PI = Math.sqrt(Math.PI);

/** erfc with ~1e-14 relative accuracy: positive series below 3, continued fraction above. */
export function erfc(x: number): number {
  if (x < 0) return 2 - erfc(-x);
  if (x < 3) {
    // erf(x) = 2/sqrt(pi) e^{-x^2} sum 2^n x^{2n+1} / (1*3*...*(2n+1))
    let term = x;
    let sum = x;
    for (let n = 1; n < 200; n++) {
      term *= (2 * x * x) / (2 * n + 1);
      sum += term;
      if (term < sum * 1e-17) break;
    }
    return 1 - (2 / SQRT_PI) * Math.exp(-x * x) * sum;
  }
  // Lentz continued fraction: erfc(x) = e^{-x^2}/sqrt(pi) * 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + ...))))
  const tiny = 1e-300;
  let f = x;
  let c = x;
  let d = 0;
  for (let n = 1; n < 500; n++) {
    const a = n / 2;
    d = x + a * d;
    d = Math.abs(d) < tiny ? tiny : d;
    c = x + a / c;
    c = Math.abs(c) < tiny ? tiny : c;
    d = 1 / d;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / SQRT_PI / f;
}

export const cdf = (z: number) => 0.5 * erfc(-z * Math.SQRT1_2);
export const pdf = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
export const g = (z: number) => z * cdf(z) + pdf(z);

export type Side = 0 | 1; // 0 = YES, 1 = NO
const oriented = (z: number, side: Side) => (side === 0 ? z : -z);

export const priceOf = (z: number, side: Side) => cdf(oriented(z, side));

/** z for a YES price (inverse normal CDF by bisection). */
export function zForPrice(p: number): number {
  let lo = -Z_LIMIT;
  let hi = Z_LIMIT;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function buyCost(z: number, l: number, side: Side, n: number): { cost: number; z: number } | null {
  const zs = oriented(z, side);
  const zs2 = zs + n / l;
  if (!Number.isFinite(zs2) || zs2 > Z_LIMIT) return null;
  return { cost: Math.ceil(l * (g(zs2) - g(zs))) + 1, z: oriented(zs2, side) };
}

export function sellProceeds(z: number, l: number, side: Side, n: number): { out: number; z: number } | null {
  const zs = oriented(z, side);
  const zs2 = zs - n / l;
  if (!Number.isFinite(zs2) || zs2 < -Z_LIMIT) return null;
  const raw = l * (g(zs) - g(zs2));
  return { out: raw <= 1 ? 0 : Math.floor(raw) - 1, z: oriented(zs2, side) };
}

export function sharesForCost(z: number, l: number, side: Side, c: number): { shares: number; z: number } | null {
  if (c <= 0 || !(l > 0)) return null;
  const zs = oriented(z, side);
  const target = g(zs) + c / l;
  let w = zs + c / (l * cdf(zs));
  for (let i = 0; i < 100; i++) {
    const step = (g(w) - target) / cdf(w);
    w -= step;
    if (Math.abs(step) <= 1e-13 * (1 + Math.abs(w))) break;
  }
  if (!Number.isFinite(w) || w > Z_LIMIT) return null;
  const raw = (w - zs) * l;
  const pEnd = Math.max(cdf(w), 1e-12);
  let n = Math.floor(raw) - Math.ceil(2 / pEnd) - 1;
  for (let i = 0; i < 8 && n > 0; i++) {
    const q = buyCost(z, l, side, n);
    if (!q) return null;
    if (q.cost <= c) return { shares: n, z: q.z };
    n -= Math.ceil((q.cost - c + 1) / pEnd) + 1;
  }
  return null;
}

export function liquidityAt(l0: number, open: number, close: number, now: number, floorBps: number): number {
  const span = Math.max(close - open, 1);
  const rem = Math.min(Math.max((close - now) / span, 0), 1);
  const fl = floorBps / BPS;
  return l0 * Math.sqrt(Math.max(rem, fl * fl));
}

export function maxLeverageBps(maxLevBps: number, tau: number, tau0: number, p: number, reduceOnlySecs: number): number {
  if (tau <= reduceOnlySecs) return BPS;
  const extra = maxLevBps - BPS;
  const byTime = BPS + extra * Math.min(tau / Math.max(tau0, 1), 1);
  const byPrice = BPS + 8 * BPS * Math.max(Math.min(p, 1 - p), 0);
  return Math.max(Math.floor(Math.min(maxLevBps, byTime, byPrice)), BPS);
}

export interface PoolState {
  z: number;
  l: number;
  feeBps: number;
  mmBps: number;
}

export interface OpenQuote {
  notional: number;
  debt: number;
  fee: number;
  shares: number;
  avgPrice: number;
  priceAfter: number;
  /** Payout if the side wins and the position is held as 1x (debt repaid first). */
  maxPayout: number;
  /** YES-side price at which this position becomes liquidatable, or null for 1x. */
  liquidationPrice: number | null;
}

/** Quote an open exactly as engine::open computes it (amounts in micro USDC). */
export function quoteOpen(s: PoolState, side: Side, margin: number, levBps: number): OpenQuote | null {
  const notional = Math.floor((margin * levBps) / BPS);
  const debt = notional - margin;
  const fee = Math.ceil((notional * s.feeBps) / BPS);
  const spend = notional - fee;
  const r = sharesForCost(s.z, s.l, side, spend);
  if (!r) return null;
  return {
    notional,
    debt,
    fee,
    shares: r.shares,
    avgPrice: spend / r.shares,
    priceAfter: priceOf(r.z, side),
    maxPayout: r.shares - debt,
    liquidationPrice: debt > 0 ? liquidationPrice({ ...s, z: r.z }, side, r.shares, debt) : null,
  };
}

/** Exit value: AMM sell minus fee. */
export function exitValue(s: PoolState, side: Side, shares: number): number {
  const r = sellProceeds(s.z, s.l, side, shares);
  if (!r) return 0;
  return r.out - Math.ceil((r.out * s.feeBps) / BPS);
}

export function isLiquidatable(s: PoolState, side: Side, shares: number, debt: number, accrued = 0): boolean {
  if (debt <= 0) return false;
  const v = exitValue(s, side, shares);
  return v - debt - accrued <= Math.floor((v * s.mmBps) / BPS);
}

/**
 * Price of this position's side at which it becomes liquidatable, holding
 * liquidity constant. Bisection on z; returns the side's price.
 */
export function liquidationPrice(s: PoolState, side: Side, shares: number, debt: number): number | null {
  if (debt <= 0) return null;
  const zs0 = oriented(s.z, side);
  if (isLiquidatable(s, side, shares, debt)) return priceOf(s.z, side);
  let lo = -Z_LIMIT + 1;
  let hi = zs0;
  const liq = (zs: number) => isLiquidatable({ ...s, z: oriented(zs, side) }, side, shares, debt);
  if (!liq(lo)) return 0;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (liq(mid)) lo = mid;
    else hi = mid;
  }
  return cdf(lo);
}

export const usdc = (micro: number | bigint) => Number(micro) / 1_000_000;
export const micro = (usd: number) => Math.round(usd * 1_000_000);
