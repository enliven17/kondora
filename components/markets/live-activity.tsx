"use client";

import { useLiveActivity } from "@/hooks/use-convex-live";
import type { Activity } from "@/lib/types";
import { ActivityList } from "./market-sections";

/** Trades on one market, live from Convex. */
export function LiveActivity({ marketId, initial }: { marketId: string; initial: Activity[] }) {
  const activity = useLiveActivity({ marketId, limit: 40 }, initial);
  return <ActivityList activity={activity} />;
}
