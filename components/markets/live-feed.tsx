"use client";

import Link from "next/link";

import { CategoryThumb } from "@/components/app/category-thumb";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { useNow } from "@/hooks/use-now";
import type { FeedItem } from "@/lib/data";
import { formatLeverage, formatPct, formatTimeAgo, formatUsd, formatUsdSigned } from "@/lib/format";
import { cn } from "@/lib/utils";

function FeedRow({ item, now }: { item: FeedItem; now: number }) {
  const liquidated = item.kind === "liquidation";
  const gain = item.pnl >= 0;
  const pct = item.margin > 0 ? item.pnl / item.margin : 0;
  return (
    <li>
      <Link href={`/markets/${item.marketId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-fg/[0.035]">
        <CategoryThumb category={item.category} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold text-fg">{item.question}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            <span className={cn("font-semibold", liquidated ? "text-down" : item.side === "yes" ? "text-up" : "text-down")}>
              {liquidated ? "Liquidated" : `${formatLeverage(item.leverage)} ${item.side === "yes" ? "Yes" : "No"}`}
            </span>
            <span className="num text-fg/85">{formatUsd(item.size)}</span>
            <span className="num text-haze">{formatUsd(item.margin)} margin</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("num text-sm", gain ? "text-up" : "text-down")}>
            {formatUsdSigned(item.pnl)} <span className="hidden sm:inline">({formatPct(pct, true)})</span>
          </p>
          <p className="num mt-0.5 text-[11px] text-haze">{formatTimeAgo(item.t, now)}</p>
        </div>
      </Link>
    </li>
  );
}

/** Recent positions across markets, like a trade tape. */
export function LiveFeed({ items, serverNow, className }: { items: FeedItem[]; serverNow: number; className?: string }) {
  const now = useNow(30_000) ?? serverNow;
  return (
    <Panel as="section" aria-labelledby="live-title" className={cn("flex flex-col overflow-hidden", className)}>
      <PanelHeader id="live-title" title="Live positions">
        <span className="text-xs font-semibold text-online">Live</span>
      </PanelHeader>
      {items.length > 0 ? (
        <ul className="thin-scrollbar min-h-0 flex-1 divide-y divide-line/[0.07] overflow-y-auto" data-lenis-prevent>
          {items.map((item) => (
            <FeedRow key={item.id} item={item} now={now} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-muted">No positions opened in the last hour.</p>
      )}
    </Panel>
  );
}
