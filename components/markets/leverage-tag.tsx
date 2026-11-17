"use client";

import { useNow } from "@/hooks/use-now";
import { formatLeverage } from "@/lib/format";
import { leverageCap } from "@/lib/leverage";
import type { Market } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "Up to 4x": the program's live leverage cap for this market (maxLeverageBps). */
export function LeverageTag({
  market,
  serverNow,
  className,
}: {
  market: Pick<Market, "yesPrice" | "closeTime">;
  /** Clock used for the first render so server and client agree. */
  serverNow: number;
  className?: string;
}) {
  const now = useNow(60_000) ?? serverNow;
  const { cap } = leverageCap(market.yesPrice, market.closeTime, now);
  return (
    <span
      title="Highest leverage you can open right now"
      className={cn("num inline-flex h-5 items-center rounded-xs bg-acc/10 px-1.5 text-[11px] font-semibold tracking-normal text-acc", className)}
    >
      {cap <= 1 ? "1x only" : `Up to ${formatLeverage(cap)}`}
    </span>
  );
}
