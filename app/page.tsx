import { AgentsSection } from "@/components/landing/agents-section";
import { Categories } from "@/components/landing/categories";
import { ClosingCta } from "@/components/landing/cta";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LeverageExplainer } from "@/components/landing/leverage-explainer";
import { LiveMarquee, type TickerItem } from "@/components/landing/live-marquee";
import { ScrollStory } from "@/components/landing/scroll-story";
import { CATEGORY_META } from "@/lib/categories";
import { getMarkets } from "@/lib/data";
import { CATEGORIES, type Category } from "@/lib/types";

export const revalidate = 60;

function shortLabel(question: string) {
  return question.replace(/^(Will|Did)\s+/, "").replace(/\?$/, "");
}

export default async function HomePage() {
  const markets = await getMarkets({ state: "open" });

  const ticker: TickerItem[] = [...markets]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 14)
    .map((m) => ({
      id: m.id,
      label: shortLabel(m.question),
      category: CATEGORY_META[m.category].label,
      yesPrice: m.yesPrice,
      change24h: m.change24h,
    }));

  const counts = Object.fromEntries(
    CATEGORIES.map((c) => [c, markets.filter((m) => m.category === c).length]),
  ) as Record<Category, number>;

  const volume = markets.reduce((sum, m) => sum + m.volume, 0);

  return (
    <>
      <Hero stats={{ openMarkets: markets.length, volume }} />
      <LiveMarquee items={ticker} />
      <HowItWorks />
      <LeverageExplainer />
      <Categories counts={counts} />
      <AgentsSection />
      <ClosingCta />
      <ScrollStory />
    </>
  );
}
