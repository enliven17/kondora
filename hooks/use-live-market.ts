"use client";

import { useEffect, useState } from "react";

import { type LiveMarket, peekMarket, subscribeMarket } from "@/lib/live";

/** On-chain state of one market, or null until the first read (or for non-numeric ids). */
export function useLiveMarket(marketId: string | null): LiveMarket | null {
  const [state, setState] = useState<LiveMarket | null>(() => (marketId ? peekMarket(marketId) : null));
  useEffect(() => {
    if (!marketId) return;
    return subscribeMarket(marketId, setState);
  }, [marketId]);
  return marketId && state ? state : null;
}

/** On-chain state for several markets, keyed by id. */
export function useLiveMarkets(marketIds: string[]): Record<string, LiveMarket> {
  const [states, setStates] = useState<Record<string, LiveMarket>>({});
  const key = [...new Set(marketIds)].sort().join(",");
  useEffect(() => {
    if (!key) return;
    const stops = key.split(",").map((id) => subscribeMarket(id, (s) => setStates((prev) => ({ ...prev, [id]: s }))));
    return () => stops.forEach((stop) => stop());
  }, [key]);
  return states;
}
