import {
  BPS,
  exitValue,
  liquidationPrice as programLiquidationPrice,
  maxLeverageBps,
  micro,
  type PoolState,
  priceOf,
  quoteOpen,
  sharesForCost,
  g,
  usdc,
  zForPrice,
  type Side as ProgramSide,
} from "./kondora/math";
import type { Market, Position, Side } from "./types";

/**
 * UI adapter over lib/kondora/math.ts, the TypeScript mirror of the on-chain engine.
 * Components pass whole USDC and probabilities; conversion to micro USDC, basis points
 * and the pool's z/L state happens here and nowhere else.
 */

/** Protocol defaults from PLAN.md section 4. */
export const PROTOCOL = {
  feeBps: 50,
  mmBps: 500,
  maxLevBps: 50_000,
  feeRate: 0.005,
  maintenanceMargin: 0.05,
  maxLeverage: 5,
  tau0: 86_400,
  reduceOnlySecs: 3_600,
  haltSecs: 600,
  borrowRatePerHour: 0.0002,
  maxSidePrice: 0.99,
} as const;

const toProgramSide = (side: Side): ProgramSide => (side === "yes" ? 0 : 1);

export function sidePrice(market: Pick<Market, "yesPrice">, side: Side) {
  return side === "yes" ? market.yesPrice : 1 - market.yesPrice;
}

/**
 * Pool state for a market. z comes from the YES price; L is chosen so the pool's
 * value at z matches the cash on hand (S = L * g(|z|)), in micro USDC.
 */
export function poolFor(market: Pick<Market, "yesPrice" | "liquidity">): PoolState {
  const z = zForPrice(Math.min(Math.max(market.yesPrice, 1e-4), 1 - 1e-4));
  const l = Math.max(micro(market.liquidity) / g(Math.abs(z)), 1);
  return { z, l, feeBps: PROTOCOL.feeBps, mmBps: PROTOCOL.mmBps };
}

export type CapReason = "max" | "time" | "price" | "reduce-only";

/** Live leverage cap from the program's maxLeverageBps, floored to 0.1x. */
export function leverageCap(yesPrice: number, closeTime: number, now = Date.now() / 1000): { cap: number; reason: CapReason } {
  const tau = closeTime - now;
  if (tau <= PROTOCOL.reduceOnlySecs) return { cap: 1, reason: "reduce-only" };
  const bps = maxLeverageBps(PROTOCOL.maxLevBps, tau, PROTOCOL.tau0, yesPrice, PROTOCOL.reduceOnlySecs);
  const cap = Math.max(1, Math.floor((bps / BPS) * 10) / 10);
  if (cap >= PROTOCOL.maxLeverage) return { cap: PROTOCOL.maxLeverage, reason: "max" };
  const byTime = 1 + 4 * Math.min(tau / PROTOCOL.tau0, 1);
  const byPrice = 1 + 8 * Math.min(yesPrice, 1 - yesPrice);
  return { cap, reason: byTime <= byPrice ? "time" : "price" };
}

export interface BetQuote {
  margin: number;
  leverage: number;
  notional: number;
  fee: number;
  debt: number;
  shares: number;
  avgPrice: number;
  priceAfter: number;
  /** Side price at which the position is liquidated, null at 1x. */
  liqPrice: number | null;
  /** USDC paid out if the side wins, after repaying debt. */
  payoutIfWin: number;
  profitIfWin: number;
  /** The pool cannot fill this size (curve limit or price above 99¢). */
  priceLimitHit: boolean;
}

export function quoteBet(market: Pick<Market, "yesPrice" | "liquidity">, side: Side, margin: number, leverage: number): BetQuote {
  const m = Math.max(0, margin);
  const price = sidePrice(market, side);
  const empty: BetQuote = {
    margin: m,
    leverage,
    notional: m * leverage,
    fee: 0,
    debt: m * (leverage - 1),
    shares: 0,
    avgPrice: price,
    priceAfter: price,
    liqPrice: null,
    payoutIfWin: 0,
    profitIfWin: 0,
    priceLimitHit: false,
  };
  if (m <= 0) return empty;
  const q = quoteOpen(poolFor(market), toProgramSide(side), micro(m), Math.round(leverage * BPS));
  if (!q) return { ...empty, priceLimitHit: true };
  const payoutIfWin = Math.max(0, usdc(q.maxPayout));
  return {
    margin: m,
    leverage,
    notional: usdc(q.notional),
    fee: usdc(q.fee),
    debt: usdc(q.debt),
    shares: usdc(q.shares),
    avgPrice: q.avgPrice,
    priceAfter: q.priceAfter,
    liqPrice: q.liquidationPrice,
    payoutIfWin,
    profitIfWin: payoutIfWin - m,
    priceLimitHit: q.priceAfter > PROTOCOL.maxSidePrice,
  };
}

/** Average fill and price after for a plain 1x buy of `size` USDC. Used by the price impact chart. */
export function priceImpact(market: Pick<Market, "yesPrice" | "liquidity">, side: Side, size: number) {
  const pool = poolFor(market);
  const spend = micro(size * (1 - PROTOCOL.feeRate));
  const r = sharesForCost(pool.z, pool.l, toProgramSide(side), spend);
  if (!r || r.shares <= 0) return null;
  return { avg: spend / r.shares, after: priceOf(r.z, toProgramSide(side)) };
}

export interface PositionView {
  /** Current side price. */
  mark: number;
  /** Exit value: AMM sell proceeds minus fee. */
  value: number;
  equity: number;
  pnl: number;
  pnlPct: number;
  /** 0 at liquidation, 1 with no debt. */
  health: number;
  /** Side price at which the position is liquidated, null without debt. */
  liqPrice: number | null;
}

export function valuePosition(position: Position, market: Pick<Market, "yesPrice" | "liquidity">): PositionView {
  const pool = poolFor(market);
  const side = toProgramSide(position.side);
  const mark = sidePrice(market, position.side);
  const value = usdc(exitValue(pool, side, micro(position.shares)));
  const equity = value - position.debt - position.accrued;
  const pnl = equity - position.margin;
  const liqPrice = programLiquidationPrice(pool, side, micro(position.shares), micro(position.debt + position.accrued));
  // Health is the share of the way from the liquidation price up to the current mark, against the entry.
  let health = 1;
  if (liqPrice !== null) {
    const span = Math.max(position.entryPrice - liqPrice, 1e-6);
    health = Math.min(1, Math.max(0, (mark - liqPrice) / span));
  }
  return {
    mark,
    value,
    equity,
    pnl,
    pnlPct: position.margin > 0 ? pnl / position.margin : 0,
    health,
    liqPrice,
  };
}
