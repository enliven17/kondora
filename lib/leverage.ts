import { estimateBuy, estimateSell, poolFor } from "./pm-amm";
import type { Market, Position, Side } from "./types";

/** Protocol defaults from PLAN.md section 4. */
export const PROTOCOL = {
  feeRate: 0.005,
  maintenanceMargin: 0.05,
  maxLeverage: 5,
  tau0: 86_400,
  reduceOnlySecs: 3_600,
  borrowRatePerHour: 0.0002,
  maxSidePrice: 0.99,
} as const;

export function sidePrice(market: Pick<Market, "yesPrice">, side: Side) {
  return side === "yes" ? market.yesPrice : 1 - market.yesPrice;
}

export type CapReason = "max" | "time" | "price" | "reduce-only";

/** Leverage cap: min(max, 1 + 4*min(1, tau/tau0), 1 + 8*min(p, 1-p)), floored to 0.1x. */
export function leverageCap(
  yesPrice: number,
  closeTime: number,
  now = Date.now() / 1000,
): { cap: number; reason: CapReason } {
  const tau = closeTime - now;
  if (tau <= PROTOCOL.reduceOnlySecs) return { cap: 1, reason: "reduce-only" };
  const byTime = 1 + 4 * Math.min(1, tau / PROTOCOL.tau0);
  const byPrice = 1 + 8 * Math.min(yesPrice, 1 - yesPrice);
  const cap = Math.min(PROTOCOL.maxLeverage, byTime, byPrice);
  const reason: CapReason = cap >= PROTOCOL.maxLeverage ? "max" : byTime <= byPrice ? "time" : "price";
  return { cap: Math.max(1, Math.floor(cap * 10) / 10), reason };
}

/** UI liquidation estimate on the side price: p0 * (1 - 1/lev) / (1 - mm). Exact check is on-chain. */
export function liquidationPrice(entry: number, leverage: number, mm: number = PROTOCOL.maintenanceMargin) {
  if (leverage <= 1) return 0;
  return (entry * (1 - 1 / leverage)) / (1 - mm);
}

export interface BetQuote {
  margin: number;
  leverage: number;
  notional: number;
  fee: number;
  spend: number;
  debt: number;
  shares: number;
  avgPrice: number;
  priceAfter: number;
  liqPrice: number;
  /** USDC paid out if the side wins, after repaying debt. */
  payoutIfWin: number;
  profitIfWin: number;
  /** Bought side would move above 0.99, which the program rejects. */
  priceLimitHit: boolean;
}

export function quoteBet(
  market: Pick<Market, "yesPrice" | "liquidity">,
  side: Side,
  margin: number,
  leverage: number,
): BetQuote {
  const m = Math.max(0, margin);
  const notional = m * leverage;
  const fee = notional * PROTOCOL.feeRate;
  const spend = notional - fee;
  const debt = notional - m;
  const est = estimateBuy(poolFor(market.yesPrice, market.liquidity, side), spend);
  const payoutIfWin = Math.max(0, est.shares - debt);
  return {
    margin: m,
    leverage,
    notional,
    fee,
    spend,
    debt,
    shares: est.shares,
    avgPrice: est.avgPrice,
    priceAfter: est.priceAfter,
    liqPrice: liquidationPrice(est.avgPrice, leverage),
    payoutIfWin,
    profitIfWin: payoutIfWin - m,
    priceLimitHit: est.priceAfter > PROTOCOL.maxSidePrice,
  };
}

export interface PositionView {
  /** Current side price. */
  mark: number;
  /** Sell proceeds minus trade fee. */
  value: number;
  equity: number;
  pnl: number;
  pnlPct: number;
  /** 0 at liquidation, 1 with no debt. */
  health: number;
  liqPrice: number;
}

export function valuePosition(position: Position, market: Pick<Market, "yesPrice" | "liquidity">): PositionView {
  const mark = sidePrice(market, position.side);
  const proceeds = estimateSell(poolFor(market.yesPrice, market.liquidity, position.side), position.shares);
  const value = proceeds * (1 - PROTOCOL.feeRate);
  const equity = value - position.debt - position.accrued;
  const pnl = equity - position.margin;
  const mmValue = PROTOCOL.maintenanceMargin * value;
  const health =
    position.debt <= 0 ? 1 : Math.min(1, Math.max(0, (equity - mmValue) / Math.max(position.margin, 1e-9)));
  return {
    mark,
    value,
    equity,
    pnl,
    pnlPct: position.margin > 0 ? pnl / position.margin : 0,
    health,
    liqPrice: liquidationPrice(position.entryPrice, position.leverage),
  };
}
