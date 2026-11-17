"use client";

import { CountUp } from "@/components/ui/count-up";
import { ButtonLink } from "@/components/ui/button";

export interface LandingStats {
  openMarkets: number;
  volume: number;
  settled: number;
}

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function StatsBand({ stats }: { stats: LandingStats }) {
  const items = [
    { label: "Open markets", value: stats.openMarkets, format: (v: number) => int.format(v) },
    { label: "Volume traded", value: stats.volume, format: (v: number) => usd.format(v) },
    { label: "Markets settled", value: stats.settled, format: (v: number) => int.format(v) },
  ];

  return (
    <section aria-labelledby="stats-title" className="page-x mx-auto max-w-[72rem] pb-24 text-center sm:pb-32">
      <h2 id="stats-title" className="text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.035em] text-cocoa">
        Markets in motion
      </h2>
      <dl className="mt-12 grid divide-y divide-cocoa/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col-reverse gap-3 py-8 sm:py-12">
            <dd className="num text-[clamp(2rem,4.5vw,3rem)] font-medium text-cocoa">
              <CountUp value={item.value} from={0} startOnView duration={1.4} format={item.format} />
            </dd>
            <dt className="text-sm text-mauve">{item.label}</dt>
          </div>
        ))}
      </dl>
      <ButtonLink href="/stats" variant="dark" size="sm" arrow className="mt-6">
        Full stats
      </ButtonLink>
    </section>
  );
}
