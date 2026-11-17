import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BetPanel } from "@/components/bet/bet-panel";
import { MobileBetBar } from "@/components/bet/mobile-bet-bar";
import { MarketHeader } from "@/components/markets/market-header";
import { LiveActivity } from "@/components/markets/live-activity";
import { OracleTrail, RelatedMarkets, RulesSection } from "@/components/markets/market-sections";
import { PriceChart } from "@/components/markets/price-chart";
import { PriceImpact } from "@/components/markets/price-impact";
import { unixNow } from "@/lib/clock";
import { getMarket, getMarketActivity, getRelatedMarkets, toListItem } from "@/lib/data";
import { PreconnectChain } from "@/lib/preconnect";
import type { Side } from "@/lib/types";

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/markets/[id]">): Promise<Metadata> {
  const { id } = await params;
  const market = await getMarket(id);
  if (!market) return { title: "Market not found" };
  return {
    title: market.question,
    description: `${market.summary} Trade YES or NO with up to 5x leverage on Kondora.`,
  };
}

function parseAmount(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(n) && n > 0 && n <= 100_000 ? Math.round(n * 100) / 100 : undefined;
}

export default async function MarketPage({ params, searchParams }: PageProps<"/markets/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const market = await getMarket(id);
  if (!market) notFound();

  const [activity, related] = await Promise.all([getMarketActivity(market), getRelatedMarkets(market)]);
  const initialSide: Side = query.side === "no" ? "no" : "yes";
  const initialAmount = parseAmount(query.amount);
  const serverNow = unixNow();
  const open = market.state === "open";

  return (
    <div className="grid grid-cols-1 gap-4 pb-20 lg:grid-cols-[minmax(0,1fr)_24rem] lg:pb-0">
      {/* Hoisted to <head>: the bet panel and chart read live chain state right after hydration. */}
      <PreconnectChain />
      <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
        <MarketHeader market={market} serverNow={serverNow} />
        <PriceChart marketId={market.id} history={market.history} live={open} />
      </div>

      <aside aria-label="Trade" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div
          id="bet"
          data-lenis-prevent
          className="scroll-mt-[calc(var(--app-header-h)+1rem)] lg:self-start lg:rounded-xl [@media(min-width:1024px)_and_(min-height:960px)]:sticky [@media(min-width:1024px)_and_(min-height:960px)]:top-[calc(var(--app-header-h)+1rem)]"
        >
          <BetPanel market={toListItem(market)} initialSide={initialSide} initialAmount={initialAmount} serverNow={serverNow} />
        </div>
      </aside>

      <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-2">
        <PriceImpact market={{ yesPrice: market.yesPrice, liquidity: market.liquidity }} />
        <RulesSection market={market} />
        <OracleTrail market={market} />
        <LiveActivity marketId={market.id} initial={activity} />
        <RelatedMarkets markets={related} />
      </div>

      {open && <MobileBetBar yesPrice={market.yesPrice} />}
    </div>
  );
}
