import type { Metadata } from "next";

import { LiveFeed } from "@/components/markets/live-feed";
import { MarketsBanner } from "@/components/markets/markets-banner";
import { MarketsTable } from "@/components/markets/markets-table";
import { unixNow } from "@/lib/clock";
import { getMarkets, getRecentActivity, toListItem } from "@/lib/data";
import { CATEGORIES, type Category } from "@/lib/types";

export const metadata: Metadata = {
  title: "Markets",
  description: "Live YES/NO markets across crypto, macro, sports, esports, politics, world, tech and culture. Up to 5x leverage.",
};

export const revalidate = 60;

function parseCategory(value: string | string[] | undefined): Category | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return CATEGORIES.find((c) => c === v);
}

export default async function MarketsPage({ searchParams }: PageProps<"/markets">) {
  const [markets, activity, params] = await Promise.all([getMarkets(), getRecentActivity(60), searchParams]);
  const list = markets.map(toListItem);
  const category = parseCategory(params.category);
  const serverNow = unixNow();

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="min-w-0 space-y-4">
        <MarketsBanner />
        <MarketsTable key={category ?? "all"} markets={list} initialCategory={category} serverNow={serverNow} />
      </div>
      <aside aria-label="Live positions" className="min-w-0">
        <LiveFeed
          activity={activity}
          markets={list}
          serverNow={serverNow}
          className="max-h-[32rem] xl:sticky xl:top-[calc(var(--app-header-h)+1rem)] xl:max-h-[calc(100dvh-var(--app-header-h)-var(--app-status-h)-2rem)]"
        />
      </aside>
    </div>
  );
}
