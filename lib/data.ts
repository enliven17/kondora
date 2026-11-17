import { buildMockActivity, buildMockMarkets, buildMockPositions } from "./mock-markets";
import type { Activity, Category, Market, Position, Side } from "./types";

/**
 * Data adapter. Every page and component reads markets through these functions.
 * To switch to Convex, replace the bodies (e.g. with fetchQuery from "convex/nextjs")
 * and keep the signatures. Components never import lib/mock-markets directly.
 */

const HOUR = 3600;
let cache: { anchor: number; markets: Market[] } | null = null;

function currentAnchor() {
  return Math.floor(Date.now() / 1000 / HOUR) * HOUR;
}

function markets(): Market[] {
  const anchor = currentAnchor();
  if (!cache || cache.anchor !== anchor) cache = { anchor, markets: buildMockMarkets(anchor) };
  return cache.markets;
}

export interface MarketQuery {
  category?: Category;
  state?: Market["state"];
}

export async function getMarkets(query: MarketQuery = {}): Promise<Market[]> {
  return markets().filter(
    (m) => (!query.category || m.category === query.category) && (!query.state || m.state === query.state),
  );
}

export async function getMarket(id: string): Promise<Market | null> {
  return markets().find((m) => m.id === id) ?? null;
}

export async function getRelatedMarkets(market: Market, limit = 3): Promise<Market[]> {
  return markets()
    .filter((m) => m.id !== market.id && m.state === "open")
    .sort((a, b) => Number(b.category === market.category) - Number(a.category === market.category) || b.volume - a.volume)
    .slice(0, limit);
}

export async function getMarketActivity(market: Market): Promise<Activity[]> {
  return buildMockActivity(market, currentAnchor());
}

/** Positions for a wallet. Mock data ignores the owner until the program is live. */
export async function getPositions(owner?: string): Promise<Position[]> {
  void owner;
  const anchor = currentAnchor();
  const list = markets();
  const open = buildMockPositions(list, anchor);
  // One settled 1x position so the claim flow has something to show.
  const settled = list.find((m) => m.state === "resolved" && m.outcome === "no");
  if (!settled) return open;
  const entryPrice = 0.88;
  return [
    ...open,
    {
      marketId: settled.id,
      side: "no",
      shares: (60 * (1 - 0.005)) / entryPrice,
      margin: 60,
      debt: 0,
      accrued: 0,
      entryPrice,
      leverage: 1,
      openedAt: settled.openTime + 6 * HOUR,
    },
  ];
}

export interface HistoryItem {
  id: string;
  marketId: string;
  question: string;
  category: Category;
  side: Side;
  kind: "close" | "liquidation" | "claim";
  leverage: number;
  /** Realized PnL, USDC. */
  pnl: number;
  /** USDC returned to the balance. */
  proceeds: number;
  t: number;
}

/** Closed trades for a wallet. Mock: derived from market activity, deterministic per hour. */
export async function getHistory(owner?: string, limit = 8): Promise<HistoryItem[]> {
  void owner;
  const anchor = currentAnchor();
  return markets()
    .filter((m) => m.state === "open")
    .slice(0, 6)
    .flatMap((m) =>
      buildMockActivity(m, anchor, 6)
        .filter((a) => a.kind !== "open")
        .slice(0, 1)
        .map((a): HistoryItem => {
          const margin = Math.max(5, a.amount / a.leverage);
          const kind = a.kind === "liquidation" ? "liquidation" : "close";
          return {
            id: `${a.id}-h`,
            marketId: m.id,
            question: m.question,
            category: m.category,
            side: a.side,
            kind,
            leverage: a.leverage,
            pnl: kind === "liquidation" ? -margin : a.amount - margin,
            proceeds: kind === "liquidation" ? 0 : a.amount,
            t: a.t,
          };
        }),
    )
    .sort((a, b) => b.t - a.t)
    .slice(0, limit);
}

export interface PlatformStats {
  totalVolume: number;
  openMarkets: number;
  /** Margin plus borrowed notional in open positions, USDC. */
  openInterest: number;
  settled: number;
}

export async function getStats(): Promise<PlatformStats> {
  const list = markets();
  const open = list.filter((m) => m.state === "open");
  return {
    totalVolume: list.reduce((sum, m) => sum + m.volume, 0),
    openMarkets: open.length,
    // Mock: a stable share of pool cash is held as leveraged positions.
    openInterest: open.reduce((sum, m) => sum + m.liquidity * 0.42, 0),
    settled: list.filter((m) => m.state === "resolved").length,
  };
}

export interface FeedItem {
  id: string;
  marketId: string;
  question: string;
  category: Category;
  side: Side;
  leverage: number;
  kind: Activity["kind"];
  /** Notional at entry, USDC. */
  size: number;
  margin: number;
  /** Mark-to-market for opens, realized for closes and liquidations. USDC. */
  pnl: number;
  t: number;
}

/** Recent positions across open markets, newest first. Mock: built from market activity. */
export async function getLiveFeed(limit = 18): Promise<FeedItem[]> {
  const anchor = currentAnchor();
  const items = markets()
    .filter((m) => m.state === "open")
    .flatMap((m) =>
      buildMockActivity(m, anchor, 4).map((a): FeedItem => {
        const mark = a.side === "yes" ? m.yesPrice : 1 - m.yesPrice;
        const size = a.amount * a.leverage;
        const pnl = a.kind === "liquidation" ? -a.amount : size * (mark / a.price - 1);
        return {
          id: a.id,
          marketId: m.id,
          question: m.question,
          category: m.category,
          side: a.side,
          leverage: a.leverage,
          kind: a.kind,
          size,
          margin: a.amount,
          pnl,
          t: a.t,
        };
      }),
    );
  return items.sort((a, b) => b.t - a.t).slice(0, limit);
}

export interface SearchItem {
  id: string;
  question: string;
  category: Category;
  yesPrice: number;
  state: Market["state"];
}

/** Minimal index for the header search. */
export async function getSearchIndex(): Promise<SearchItem[]> {
  return markets().map(({ id, question, category, yesPrice, state }) => ({ id, question, category, yesPrice, state }));
}

/** Light copy for client lists: recent history only, no trail. Keeps RSC payloads small. */
export function toListItem(market: Market): Market {
  return {
    ...market,
    history: downsample(market.history.filter((pt) => pt.t >= (market.history.at(-1)?.t ?? 0) - 3 * 86_400), 48),
    oracleTrail: [],
    rules: [],
  };
}

function downsample<T>(list: T[], target: number): T[] {
  if (list.length <= target) return list;
  const step = (list.length - 1) / (target - 1);
  return Array.from({ length: target }, (_, i) => list[Math.round(i * step)] as T);
}
