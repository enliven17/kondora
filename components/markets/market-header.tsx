import Link from "next/link";
import type { ReactNode } from "react";

import { CategoryThumb } from "@/components/app/category-thumb";
import { Panel } from "@/components/ui/panel";
import { CATEGORY_META } from "@/lib/categories";
import { formatDateTime, formatUsdCompact } from "@/lib/format";
import type { Market } from "@/lib/types";
import { Countdown } from "./countdown";
import { LeverageTag } from "./leverage-tag";
import { OutcomeLabel } from "./outcome-label";

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-haze">{label}</dt>
      <dd className="num mt-0.5 truncate text-base text-fg">{children}</dd>
    </div>
  );
}

export function MarketHeader({ market, serverNow }: { market: Market; serverNow: number }) {
  const meta = CATEGORY_META[market.category];
  const open = market.state === "open";
  return (
    <Panel className="p-4 sm:p-5">
      <nav aria-label="Breadcrumb" className="text-xs text-haze">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/markets" className="hover:text-fg">
              Markets
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/markets?category=${market.category}`} className="hover:text-fg">
              {meta.label}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="mt-3 flex gap-3 sm:gap-4">
        <CategoryThumb category={market.category} className="size-14 rounded-lg sm:size-20" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <OutcomeLabel market={market} />
            {open && <LeverageTag market={market} serverNow={serverNow} />}
          </div>
          <h1 className="mt-1.5 text-[clamp(1.375rem,3vw,2rem)] font-bold leading-tight tracking-[-0.03em] text-fg">{market.question}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{market.summary}</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line/10 pt-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label={open ? "Closes in" : "Closed"}>
          {open ? <Countdown closeTime={market.closeTime} /> : formatDateTime(market.closeTime)}
        </Stat>
        <Stat label="Volume">{formatUsdCompact(market.volume)}</Stat>
        <Stat label="Liquidity">{formatUsdCompact(market.liquidity)}</Stat>
        <Stat label="Traders">{market.traders.toLocaleString("en-US")}</Stat>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className="text-xs text-haze">Source</dt>
          <dd className="mt-0.5 truncate text-base">
            <a
              href={market.resolution.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-fg underline decoration-line/30 underline-offset-4 hover:decoration-fg"
            >
              {market.resolution.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </dd>
        </div>
      </dl>
    </Panel>
  );
}
