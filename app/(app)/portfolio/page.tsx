import type { Metadata } from "next";

import { PortfolioView } from "@/components/portfolio/portfolio-view";
import { unixNow } from "@/lib/clock";
import { getDemoPositions, getMarkets, toListItem } from "@/lib/data";
import { PreconnectChain } from "@/lib/preconnect";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Your balance, open positions, health and PnL on Kondora.",
};

export const revalidate = 60;

export default async function PortfolioPage() {
  // Positions come from chain on the client; markets join them to questions and prices.
  const [markets, demoPositions] = await Promise.all([getMarkets(), getDemoPositions()]);

  return (
    <div className="mx-auto max-w-6xl">
      <PreconnectChain />
      <PortfolioView markets={markets.map(toListItem)} demoPositions={demoPositions} serverNow={unixNow()} />
    </div>
  );
}
