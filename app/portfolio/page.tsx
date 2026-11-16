import type { Metadata } from "next";

import { PositionsTable } from "@/components/portfolio/positions-table";
import { getMarkets, getPositions, toListItem } from "@/lib/data";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Your open positions, health and PnL on Kondora.",
};

export const revalidate = 60;

export default async function PortfolioPage() {
  const [positions, markets] = await Promise.all([getPositions(), getMarkets()]);

  return (
    <div className="page-x mx-auto max-w-page pt-[calc(var(--header-h)+2.5rem)]">
      <header className="pb-8">
        <p className="micro">Portfolio</p>
        <h1 className="mt-3 font-display text-display-md text-marble-50">Your positions</h1>
        <p className="mt-3 max-w-xl text-marble-200">
          Health shows how far each leveraged position is from liquidation. Close any time at the AMM price.
        </p>
      </header>
      <PositionsTable positions={positions} markets={markets.map(toListItem)} />
    </div>
  );
}
