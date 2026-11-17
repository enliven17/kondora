"use client";

import { useLiveStats } from "@/hooks/use-convex-live";
import { formatUsdWhole } from "@/lib/format";
import type { PlatformStats } from "@/lib/views";

/** Platform totals under the header, live from Convex. Scrolls sideways on small screens. */
export function StatsRibbon({ stats: initial }: { stats: PlatformStats }) {
  const stats = useLiveStats(initial);
  const items = [
    { label: "Total volume", value: formatUsdWhole(stats.totalVolume) },
    { label: "Open markets", value: String(stats.openMarkets) },
    { label: "Pool liquidity", value: formatUsdWhole(stats.liquidity) },
    { label: "Settled", value: String(stats.settled) },
  ];
  return (
    <div className="border-b border-line/10 bg-ink/35 backdrop-blur-md">
      <dl className="no-scrollbar mx-auto flex h-10 max-w-[100rem] items-center gap-8 overflow-x-auto px-3 sm:px-5 lg:justify-between">
        {items.map((s) => (
          <div key={s.label} className="flex shrink-0 items-baseline gap-2 text-sm">
            <dt className="text-muted">{s.label}</dt>
            <dd className="num text-fg">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
