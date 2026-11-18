import { fetchQuery } from "convex/nextjs";
import { getFunctionName, type FunctionReference } from "convex/server";
import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { api, CONVEX_ENABLED, type ConvexAgents, toActivity, toMarket, toMarkets } from "./convex";
import type { Activity, Category, Market, Position } from "./types";
import type { PlatformStats, SearchItem } from "./views";

/**
 * Server reads are cached for 60s so page views do not each hit Convex
 * (free plan). Live updates still arrive on the client through useQuery.
 */
function cachedQuery<Q extends FunctionReference<"query">>(query: Q, args: Q["_args"]): Promise<Q["_returnType"]> {
  const name = getFunctionName(query);
  return unstable_cache(() => fetchQuery(query, args), ["convex", name, JSON.stringify(args)], { revalidate: 60, tags: ["convex"] })();
}

export type { FeedItem, HistoryItem, PlatformStats, SearchItem } from "./views";
export { toListItem } from "./views";

/**
 * Server data adapter. Every page reads markets through these functions.
 * With NEXT_PUBLIC_CONVEX_URL set, everything comes from Convex and an empty
 * deployment renders empty states. Without it, generated mocks keep local dev usable.
 */

export const USING_MOCKS = !CONVEX_ENABLED;

const HOUR = 3600;
const currentAnchor = () => Math.floor(Date.now() / 1000 / HOUR) * HOUR;

async function mocks() {
  const mod = await import("./mock-markets");
  const anchor = currentAnchor();
  return { mod, anchor, markets: mod.buildMockMarkets(anchor) };
}

/** A failed Convex read renders the empty state instead of a 500. */
async function safe<T>(label: string, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    // Let Next see its own control-flow errors (dynamic rendering bailout, notFound).
    unstable_rethrow(error);
    console.error(`Convex read failed: ${label}`, error);
    return fallback;
  }
}

export interface MarketQuery {
  category?: Category;
  state?: Market["state"];
}

export async function getMarkets(query: MarketQuery = {}): Promise<Market[]> {
  if (CONVEX_ENABLED) {
    return safe("markets.list", async () => toMarkets(await cachedQuery(api.markets.list, { category: query.category, state: query.state })), []);
  }
  const { markets } = await mocks();
  return markets.filter((m) => (!query.category || m.category === query.category) && (!query.state || m.state === query.state));
}

export async function getMarket(id: string): Promise<Market | null> {
  if (CONVEX_ENABLED) {
    return safe("markets.get", async () => {
      const m = await cachedQuery(api.markets.get, { id });
      return m ? toMarket(m) : null;
    }, null);
  }
  const { markets } = await mocks();
  return markets.find((m) => m.id === id) ?? null;
}

export async function getRelatedMarkets(market: Market, limit = 3): Promise<Market[]> {
  const open = await getMarkets({ state: "open" });
  return open
    .filter((m) => m.id !== market.id)
    .sort((a, b) => Number(b.category === market.category) - Number(a.category === market.category) || b.volume - a.volume)
    .slice(0, limit);
}

export async function getMarketActivity(market: Market, limit = 40): Promise<Activity[]> {
  if (CONVEX_ENABLED) {
    return safe("markets.activity", async () => (await cachedQuery(api.markets.activity, { marketId: market.id, limit })).map(toActivity), []);
  }
  const { mod, anchor } = await mocks();
  return mod.buildMockActivity(market, anchor);
}

/** Demo positions for the portfolio when running without Convex. Real positions are read from chain on the client. */
export async function getDemoPositions(): Promise<Position[]> {
  if (CONVEX_ENABLED) return [];
  const { mod, anchor, markets } = await mocks();
  return mod.buildMockPositions(markets, anchor);
}

const EMPTY_STATS: PlatformStats = { totalVolume: 0, openMarkets: 0, liquidity: 0, settled: 0, byCategory: {} };

export async function getStats(): Promise<PlatformStats> {
  if (CONVEX_ENABLED) {
    return safe(
      "markets.stats",
      async () => {
        const s = await cachedQuery(api.markets.stats, {});
        return { totalVolume: s.volume, openMarkets: s.openMarkets, liquidity: s.liquidity, settled: s.resolvedMarkets, byCategory: s.byCategory };
      },
      EMPTY_STATS,
    );
  }
  const { markets } = await mocks();
  const open = markets.filter((m) => m.state === "open");
  return {
    totalVolume: markets.reduce((sum, m) => sum + m.volume, 0),
    openMarkets: open.length,
    liquidity: open.reduce((sum, m) => sum + m.liquidity, 0),
    settled: markets.filter((m) => m.state === "resolved").length,
    byCategory: open.reduce<Record<string, number>>((a, m) => ((a[m.category] = (a[m.category] ?? 0) + 1), a), {}),
  };
}

export async function getRecentActivity(limit = 60): Promise<Activity[]> {
  if (CONVEX_ENABLED) {
    return safe("markets.activity", async () => (await cachedQuery(api.markets.activity, { limit })).map(toActivity), []);
  }
  const { mod, anchor, markets } = await mocks();
  return markets
    .filter((m) => m.state === "open")
    .flatMap((m) => mod.buildMockActivity(m, anchor, 4))
    .sort((a, b) => b.t - a.t)
    .slice(0, limit);
}


/** Traded notional per UTC day, oldest first (unix seconds of each day start). */
export async function getDailyVolume(days = 14): Promise<{ day: number; volume: number }[]> {
  const DAY = 86_400, today = Math.floor(Date.now() / 1000 / DAY) * DAY;
  const empty = Array.from({ length: days }, (_, i) => ({ day: today - (days - 1 - i) * DAY, volume: 0 }));
  if (CONVEX_ENABLED) return safe("stats.daily", async () => (await cachedQuery(api.stats.daily, { days })).map(({ day, volume }) => ({ day, volume })), empty);
  const trades = await getRecentActivity(500);
  return empty.map(({ day }) => ({ day, volume: trades.reduce((a, t) => (t.t >= day && t.t < day + DAY ? a + (t.kind === "open" ? t.amount * Math.max(1, t.leverage) : t.amount) : a), 0) }));
}

/** Minimal index for the header search. */
export async function getSearchIndex(): Promise<SearchItem[]> {
  return (await getMarkets()).map(({ id, question, category, yesPrice, state }) => ({ id, question, category, yesPrice, state }));
}

export type AgentsBoard = ConvexAgents;

export async function getAgents(): Promise<AgentsBoard | null> {
  if (!CONVEX_ENABLED) return null;
  return safe("markets.agents", () => cachedQuery(api.markets.agents, {}), null);
}

