import { ClosingCta } from "@/components/landing/cta";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { Primitives } from "@/components/landing/primitives";
import { Statement } from "@/components/landing/statement";
import { StatsBand } from "@/components/landing/stats-band";
import { getMarkets } from "@/lib/data";

export const revalidate = 60;

export default async function HomePage() {
  const markets = await getMarkets();
  const stats = {
    openMarkets: markets.filter((m) => m.state === "open").length,
    volume: Math.round(markets.reduce((sum, m) => sum + m.volume, 0)),
    settled: markets.filter((m) => m.state === "resolved").length,
  };

  return (
    <>
      <Hero />
      <Statement />
      <Features />
      <StatsBand stats={stats} />
      <Primitives />
      <Faq />
      <ClosingCta />
    </>
  );
}
