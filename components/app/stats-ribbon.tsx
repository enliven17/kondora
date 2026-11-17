import type { PlatformStats } from "@/lib/data";
import { formatUsdWhole } from "@/lib/format";

/** Platform totals under the header. Scrolls sideways on small screens. */
export function StatsRibbon({ stats }: { stats: PlatformStats }) {
  const items = [
    { label: "Total volume", value: formatUsdWhole(stats.totalVolume) },
    { label: "Open markets", value: String(stats.openMarkets) },
    { label: "Open interest", value: formatUsdWhole(stats.openInterest) },
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
