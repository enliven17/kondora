"use client";

import Link from "next/link";

import { CategoryThumb } from "@/components/app/category-thumb";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { useLiveActivity, useLiveMarketList } from "@/hooks/use-convex-live";
import { useNow } from "@/hooks/use-now";
import { formatLeverage, formatPct, formatTimeAgo, formatUsd, formatUsdSigned } from "@/lib/format";
import type { Activity, Market } from "@/lib/types";
import { cn } from "@/lib/utils";
import { buildFeed, type FeedItem } from "@/lib/views";

function FeedLabel({ item }: { item: FeedItem }) {
  if (item.kind === "liquidation") return <span className="font-semibold text-down">Liquidated</span>;
  const side = item.side === "yes" ? "Yes" : "No";
  if (item.kind === "close") return <span className="font-semibold text-muted">Closed {side}</span>;
  return <span className={cn("font-semibold", item.side === "yes" ? "text-up" : "text-down")}>{`${formatLeverage(item.leverage)} ${side}`}</span>;
}

function FeedRow({ item, now }: { item: FeedItem; now: number }) {
  const pct = item.pnl !== null && item.margin > 0 ? item.pnl / item.margin : null;
  return (
    <li>
      <Link href={`/markets/${item.marketId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-fg/[0.035]">
        <CategoryThumb category={item.category} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold text-fg">{item.question}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            <FeedLabel item={item} />
            <span className="num text-fg/85">{formatUsd(item.size)}</span>
            {item.margin > 0 && <span className="num text-haze">{formatUsd(item.margin)} margin</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {item.pnl !== null ? (
            <p className={cn("num text-sm", item.pnl >= 0 ? "text-up" : "text-down")}>
              {formatUsdSigned(item.pnl)} {pct !== null && <span className="hidden sm:inline">({formatPct(pct, true)})</span>}
            </p>
          ) : (
            <p className="num text-sm text-muted">{item.kind === "close" ? "Paid out" : "Settled"}</p>
          )}
          <p className="num mt-0.5 text-[11px] text-haze">{formatTimeAgo(item.t, now)}</p>
        </div>
      </Link>
    </li>
  );
}

/** Recent trades across markets, like a tape. Live from Convex, seeded by the server render. */
export function LiveFeed({
  activity,
  markets,
  serverNow,
  className,
}: {
  activity: Activity[];
  markets: Market[];
  serverNow: number;
  className?: string;
}) {
  const now = useNow(30_000) ?? serverNow;
  const liveActivity = useLiveActivity({ limit: 60 }, activity);
  const liveMarkets = useLiveMarketList(markets);
  const items = buildFeed(liveActivity, liveMarkets);
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
        <p className="px-4 py-10 text-center text-sm text-muted">No bets yet. New positions show up here as they land.</p>
      )}
    </Panel>
  );
}
