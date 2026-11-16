/**
 * pm-AMM estimate for the UI (see PLAN.md section 3).
 * Display-side approximation in float USDC. The authoritative math lives on-chain
 * and in the TS client mirror (lib/kondora). Swap callers to that mirror when ready.
 */

const SQRT2PI = Math.sqrt(2 * Math.PI);

/** Complementary error function, fractional error below 1.2e-7. */
export function erfc(x: number) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const poly =
    -1.26551223 +
    t *
      (1.00002368 +
        t *
          (0.37409196 +
            t *
              (0.09678418 +
                t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))));
  const r = t * Math.exp(-z * z + poly);
  return x >= 0 ? r : 2 - r;
}

export const Phi = (z: number) => 0.5 * erfc(-z / Math.SQRT2);
export const phi = (z: number) => Math.exp(-0.5 * z * z) / SQRT2PI;
export const g = (z: number) => z * Phi(z) + phi(z);

const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239] as const;
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1] as const;
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783] as const;
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416] as const;

function tail(q: number) {
  return ((((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
    ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1));
}

/** Inverse standard normal CDF (Acklam). */
export function invPhi(p: number) {
  const x = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
  const low = 0.02425;
  if (x < low) return tail(Math.sqrt(-2 * Math.log(x)));
  if (x > 1 - low) return -tail(Math.sqrt(-2 * Math.log(1 - x)));
  const q = x - 0.5;
  const r = q * q;
  return (
    ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q) /
    (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1)
  );
}

export interface PoolState {
  /** Side-oriented z (z for YES, -z for NO). */
  zs: number;
  /** Liquidity parameter in USDC. */
  L: number;
}

/** Derive a pool state from a displayed YES price and pool cash. */
export function poolFor(yesPrice: number, liquidity: number, side: "yes" | "no"): PoolState {
  const z = invPhi(yesPrice);
  const L = Math.max(1, liquidity / g(Math.abs(z)));
  return { zs: side === "yes" ? z : -z, L };
}

export interface BuyEstimate {
  shares: number;
  avgPrice: number;
  priceAfter: number;
}

/** Shares received for spending `cost` USDC on a side. Newton from the right, as on-chain. */
export function estimateBuy(pool: PoolState, cost: number): BuyEstimate {
  const { zs, L } = pool;
  const price = Phi(zs);
  if (cost <= 0) return { shares: 0, avgPrice: price, priceAfter: price };
  const target = g(zs) + cost / L;
  let w = zs + cost / L / Math.max(price, 1e-9);
  for (let i = 0; i < 50; i++) {
    const step = (g(w) - target) / Math.max(Phi(w), 1e-12);
    w -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  const shares = Math.max(0, (w - zs) * L);
  return { shares, avgPrice: shares > 0 ? cost / shares : price, priceAfter: Phi(w) };
}

/** USDC received for selling `shares` of a side. */
export function estimateSell(pool: PoolState, shares: number) {
  const { zs, L } = pool;
  return Math.max(0, L * (g(zs) - g(zs - shares / L)));
}
