import { buildMockActivity, buildMockMarkets, buildMockPositions } from "./mock-markets";
import type { Activity, Category, Market, Position } from "./types";

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
  return buildMockPositions(markets(), currentAnchor());
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
