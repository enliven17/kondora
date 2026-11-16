"use client";

import Link from "next/link";

import { useNow } from "@/hooks/use-now";
import { CATEGORY_META } from "@/lib/categories";
import { formatCents, formatLeverage, formatSignedPts, formatUsdCompact } from "@/lib/format";
import { leverageCap, PROTOCOL } from "@/lib/leverage";
import type { Market } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";
import { TimeLeft } from "./time-left";

export function OutcomeLabel({ market }: { market: Market }) {
  if (market.state === "resolved") {
    const o = market.outcome ?? "invalid";
    return <span className={cn("micro", o === "yes" ? "text-yes" : o === "no" ? "text-no" : "text-gold")}>Resolved {o}</span>;
  }
  if (market.state === "proposed") return <span className="micro text-gold">Proposed, in dispute window</span>;
  if (market.state === "disputed") return <span className="micro text-gold">Disputed</span>;
  if (market.state === "closed") return <span className="micro">Awaiting oracle</span>;
  return null;
}

/** Current leverage cap for the market. Shows the protocol max until the client clock is known. */
function LeverageBadge({ market }: { market: Market }) {
  const now = useNow(60_000);
  const cap = now === null ? PROTOCOL.maxLeverage : leverageCap(market.yesPrice, market.closeTime, now).cap;
  return (
    <span
      className="rounded-xs border border-gold/40 px-1.5 py-0.5 font-mono text-[0.625rem] font-medium uppercase tracking-wider text-gold"
      title="Maximum leverage available right now"
    >
      Up to {formatLeverage(cap)}
    </span>
  );
}

export function MarketCard({ market }: { market: Market }) {
  const up = market.change24h >= 0;
  const open = market.state === "open";
  const href = `/markets/${market.id}`;
  const yes = market.yesPrice;

  return (
    <article className="group relative flex h-full flex-col rounded-md border border-line bg-night-900 p-4 shadow-[0_1px_0_rgb(255_255_255/0.03)_inset] transition-[transform,border-color,box-shadow,background-color] duration-200 ease-enter hover:-translate-y-0.5 hover:border-marble-50/20 hover:bg-night-800/70 hover:shadow-[0_18px_40px_-18px_rgb(0_0_0/0.9)] sm:p-5">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-medium text-marble-400">{CATEGORY_META[market.category].label}</span>
          {open && <LeverageBadge market={market} />}
        </div>
        {open ? (
          <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-marble-400">
            <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
              <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M6 3.5 V6 L7.8 7.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="sr-only">Closes in</span>
            <TimeLeft closeTime={market.closeTime} className="tabular" />
          </span>
        ) : (
          <OutcomeLabel market={market} />
        )}
      </header>

      <h3 className="mt-3 line-clamp-2 min-h-[2.75rem] text-[0.9375rem] font-semibold leading-snug text-marble-50">
        <Link href={href} className="outline-none after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-gold">
          {market.question}
        </Link>
      </h3>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="num text-3xl leading-none text-marble-50">{Math.round(yes * 100)}%</span>
            <span className="text-xs text-marble-400">chance</span>
          </div>
          {open && (
            <span className={cn("mt-1 inline-flex items-center gap-1 font-mono text-xs tabular", up ? "text-yes" : "text-no")}>
              <svg viewBox="0 0 8 8" aria-hidden="true" className={cn("h-2 w-2", !up && "rotate-180")}>
                <path d="M4 1 L7 6 H1 Z" fill="currentColor" />
              </svg>
              {formatSignedPts(market.change24h).replace(/^[+-]/, "")} pts 24h
              <span className="sr-only">{up ? "up" : "down"}</span>
            </span>
          )}
        </div>
        <Sparkline points={market.history} up={up} className="h-10 max-w-[45%]" />
      </div>

      {open ? (
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
          <Link
            href={`${href}?side=yes`}
            className="flex h-11 items-center justify-between rounded-sm border border-yes/25 bg-yes-soft px-3 text-sm font-semibold text-yes transition-colors hover:border-yes hover:bg-yes hover:text-night-950"
          >
            <span>Yes</span>
            <span className="num">{formatCents(yes)}</span>
          </Link>
          <Link
            href={`${href}?side=no`}
            className="flex h-11 items-center justify-between rounded-sm border border-no/25 bg-no-soft px-3 text-sm font-semibold text-no transition-colors hover:border-no hover:bg-no hover:text-night-950"
          >
            <span>No</span>
            <span className="num">{formatCents(1 - yes)}</span>
          </Link>
        </div>
      ) : (
        <div className="mt-4 h-11" />
      )}

      <footer className="mt-4 flex items-center justify-between gap-3 border-t border-line/70 pt-3 font-mono text-[0.6875rem] text-marble-400 tabular">
        <span>
          <span className="text-marble-600">Vol </span>
          {formatUsdCompact(market.volume)}
        </span>
        <span>
          <span className="text-marble-600">Liq </span>
          {formatUsdCompact(market.liquidity)}
        </span>
        <span>
          {market.traders.toLocaleString("en-US")}
          <span className="text-marble-600"> traders</span>
        </span>
      </footer>
    </article>
  );
}
