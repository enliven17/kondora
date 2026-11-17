import type { Metadata } from "next";

import { PortfolioView } from "@/components/portfolio/portfolio-view";
import { getHistory, getMarkets, getPositions, toListItem } from "@/lib/data";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Your balance, open positions, health and PnL on Kondora.",
};

export const revalidate = 60;

export default async function PortfolioPage() {
  const [positions, markets, history] = await Promise.all([getPositions(), getMarkets(), getHistory()]);
  const ids = new Set(positions.map((p) => p.marketId));

  return (
    <div className="mx-auto max-w-6xl">
      <PortfolioView
        positions={positions}
        markets={markets.filter((m) => ids.has(m.id)).map(toListItem)}
        history={history}
        serverNow={Math.floor(Date.now() / 1000)}
      />
    </div>
  );
}
