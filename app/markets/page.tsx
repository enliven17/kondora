import type { Metadata } from "next";

import { MarketsBrowser } from "@/components/markets/markets-browser";
import { getMarkets, toListItem } from "@/lib/data";
import { formatUsdCompact } from "@/lib/format";
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
  const [markets, params] = await Promise.all([getMarkets(), searchParams]);
  const open = markets.filter((m) => m.state === "open");
  const volume = open.reduce((sum, m) => sum + m.volume, 0);
  const category = parseCategory(params.category);

  return (
    <div className="page-x mx-auto max-w-page pt-[calc(var(--header-h)+2.5rem)]">
      <header className="flex flex-col gap-6 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="micro">Markets</p>
          <h1 className="mt-3 font-display text-display-md text-marble-50">
            Pick a side. <em className="text-marble-200">Size it.</em>
          </h1>
        </div>
        <dl className="flex gap-10 md:text-right">
          <div>
            <dt className="micro">Open markets</dt>
            <dd className="mt-1 font-mono text-lg text-marble-50 tabular">{open.length}</dd>
          </div>
          <div>
            <dt className="micro">Open volume</dt>
            <dd className="mt-1 font-mono text-lg text-marble-50 tabular">{formatUsdCompact(volume)}</dd>
          </div>
        </dl>
      </header>
      <MarketsBrowser key={category ?? "all"} markets={markets.map(toListItem)} initialCategory={category} />
    </div>
  );
}
