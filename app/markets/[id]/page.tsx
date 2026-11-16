import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BetPanel } from "@/components/bet/bet-panel";
import { MobileBetBar } from "@/components/bet/mobile-bet-bar";
import { OutcomeLabel } from "@/components/markets/market-card";
import { DepthChart } from "@/components/markets/depth-chart";
import { ActivityList, DepthTable, OracleTrail, RelatedMarkets, RulesSection } from "@/components/markets/market-sections";
import { PriceChart } from "@/components/markets/price-chart";
import { TimeLeft } from "@/components/markets/time-left";
import { CATEGORY_META } from "@/lib/categories";
import { getMarket, getMarketActivity, getMarkets, getRelatedMarkets, toListItem } from "@/lib/data";
import { formatDateTime, formatUsdCompact } from "@/lib/format";
import type { Side } from "@/lib/types";

export const revalidate = 60;

export async function generateStaticParams() {
  const markets = await getMarkets();
  return markets.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: PageProps<"/markets/[id]">): Promise<Metadata> {
  const { id } = await params;
  const market = await getMarket(id);
  if (!market) return { title: "Market not found" };
  return {
    title: market.question,
    description: `${market.summary} Trade YES or NO with up to 5x leverage on Kondora.`,
  };
}

export default async function MarketPage({ params, searchParams }: PageProps<"/markets/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const market = await getMarket(id);
  if (!market) notFound();

  const [activity, related] = await Promise.all([getMarketActivity(market), getRelatedMarkets(market)]);
  const initialSide: Side = query.side === "no" ? "no" : "yes";
  const meta = CATEGORY_META[market.category];
  const betMarket = toListItem(market);

  return (
    <div className="pb-24 lg:pb-0">
      <div className="relative overflow-hidden border-b border-line">
        <Image src={meta.cover} alt="" fill sizes="100vw" className="object-cover object-center opacity-25" priority quality={70} />
        <div className="absolute inset-0 bg-gradient-to-b from-night-950/60 via-night-950/70 to-night-950" />
        <div className="page-x relative mx-auto max-w-page pb-10 pt-[calc(var(--header-h)+2rem)]">
          <nav aria-label="Breadcrumb" className="micro">
            <ol className="flex flex-wrap gap-2">
              <li>
                <Link href="/markets" className="hover:text-marble-50">
                  Markets
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/markets?category=${market.category}`} className="hover:text-marble-50">
                  {meta.label}
                </Link>
              </li>
            </ol>
          </nav>
          <h1 className="mt-4 max-w-4xl text-[clamp(1.625rem,4vw,2.75rem)] font-semibold leading-tight tracking-tight text-marble-50">{market.question}</h1>
          <p className="mt-3 max-w-2xl text-marble-200">{market.summary}</p>
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
            <Stat label={market.state === "open" ? "Closes in" : "Status"}>
              {market.state === "open" ? <TimeLeft closeTime={market.closeTime} /> : <OutcomeLabel market={market} />}
            </Stat>
            <Stat label="Close">{formatDateTime(market.closeTime)}</Stat>
            <Stat label="Volume">{formatUsdCompact(market.volume)}</Stat>
            <Stat label="Liquidity">{formatUsdCompact(market.liquidity)}</Stat>
            <Stat label="Traders">{market.traders.toLocaleString("en-US")}</Stat>
          </dl>
        </div>
      </div>

      <div className="page-x mx-auto grid max-w-page grid-cols-1 gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
        <div className="min-w-0 space-y-14">
          <PriceChart marketId={market.id} history={market.history} live={market.state === "open"} />
          <div className="space-y-4 lg:hidden" id="bet">
            <BetPanel market={betMarket} initialSide={initialSide} />
            <DepthChart yesPrice={market.yesPrice} liquidity={market.liquidity} />
          </div>
          <RulesSection market={market} />
          <OracleTrail market={market} />
          <DepthTable market={market} />
          <ActivityList activity={activity} />
          <RelatedMarkets markets={related} />
        </div>
        <aside className="hidden lg:block">
          <div className="space-y-4">
            <BetPanel market={betMarket} initialSide={initialSide} />
            <DepthChart yesPrice={market.yesPrice} liquidity={market.liquidity} />
          </div>
        </aside>
      </div>

      {market.state === "open" && <MobileBetBar yesPrice={market.yesPrice} />}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="micro">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-marble-50 tabular">{children}</dd>
    </div>
  );
}
