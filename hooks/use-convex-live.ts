"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api, CONVEX_ENABLED, toActivity, toMarkets } from "@/lib/convex";
import type { Activity, Market } from "@/lib/types";
import { type PlatformStats, toListItem } from "@/lib/views";

// Live Convex subscriptions seeded with the server render. CONVEX_ENABLED is a build-time
// constant: without a deployment there is no ConvexProvider, so the query hook is swapped
// for a no-op once at module load. Each component still calls the same hook every render.
const useLiveQuery: typeof useQuery = CONVEX_ENABLED ? useQuery : ((() => undefined) as unknown as typeof useQuery);

/** All listed markets, light copies for client lists. */
export function useLiveMarketList(initial: Market[]): Market[] {
  const rows = useLiveQuery(api.markets.list, {});
  return useMemo(() => (rows ? toMarkets(rows).map(toListItem) : initial), [rows, initial]);
}

export function useLiveActivity(args: { marketId?: string; owner?: string; limit?: number } | "skip", initial: Activity[]): Activity[] {
  const rows = useLiveQuery(api.markets.activity, args);
  return useMemo(() => (rows ? rows.map(toActivity) : initial), [rows, initial]);
}

export function useLiveStats(initial: PlatformStats): PlatformStats {
  const s = useLiveQuery(api.markets.stats, {});
  return useMemo(
    () => (s ? { totalVolume: s.volume, openMarkets: s.openMarkets, liquidity: s.liquidity, settled: s.resolvedMarkets, byCategory: s.byCategory } : initial),
    [s, initial],
  );
}
