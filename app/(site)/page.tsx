import { MotionProvider } from "@/app/providers";
import { ClosingCta } from "@/components/landing/cta";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { Primitives } from "@/components/landing/primitives";
import { ScrollSync } from "@/components/landing/scroll-sync";
import { Statement } from "@/components/landing/statement";
import { StatsBand } from "@/components/landing/stats-band";
import { getStats } from "@/lib/data";

export const revalidate = 60;

export default async function HomePage() {
  const s = await getStats();
  const stats = { openMarkets: s.openMarkets, volume: Math.round(s.totalVolume), settled: s.settled };

  return (
    <MotionProvider>
      <ScrollSync />
      <Hero />
      <Statement />
      <Features />
      <StatsBand stats={stats} />
      <Primitives />
      <Faq />
      <ClosingCta />
    </MotionProvider>
  );
}
