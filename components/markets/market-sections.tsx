import Link from "next/link";

import { formatCents, formatDateTime, formatLeverage, formatUsd, shortHash } from "@/lib/format";
import { PROTOCOL } from "@/lib/leverage";
import { estimateBuy, poolFor } from "@/lib/pm-amm";
import type { Activity, AgentRole, Market, OracleEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SectionTitle({ id, kicker, title }: { id: string; kicker: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="micro">{kicker}</p>
      <h2 id={id} className="mt-1 text-xl font-semibold tracking-tight text-marble-50">
        {title}
      </h2>
    </div>
  );
}

export function RulesSection({ market }: { market: Market }) {
  return (
    <section aria-labelledby="rules">
      <SectionTitle id="rules" kicker="Resolution" title="Rules" />
      <ol className="space-y-3 text-[0.9375rem] leading-relaxed text-marble-200">
        {market.rules.map((rule, i) => (
          <li key={rule} className="grid grid-cols-[2rem_1fr]">
            <span className="font-mono text-xs leading-7 text-marble-600">{String(i + 1).padStart(2, "0")}</span>
            <span>{rule}</span>
          </li>
        ))}
      </ol>
      <dl className="mt-6 grid gap-4 rounded-md border border-line p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="micro">Source</dt>
          <dd className="mt-1">
            <a href={market.resolution.url} target="_blank" rel="noopener noreferrer" className="text-marble-50 hover:text-gold">
              {market.resolution.name}
            </a>
          </dd>
        </div>
        <div>
          <dt className="micro">Reads</dt>
          <dd className="mt-1 text-marble-200">{market.resolution.field}</dd>
        </div>
        <div>
          <dt className="micro">Closes</dt>
          <dd className="mt-1 font-mono text-marble-200">{formatDateTime(market.closeTime)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-marble-400">
        Invalid outcomes pay the final mark: a YES share pays the last YES price, a NO share the last NO price.
      </p>
    </section>
  );
}

const ROLE_LABEL: Record<AgentRole, string> = {
  creator: "Creator",
  oracle: "Oracle",
  auditor: "Auditor",
  admin: "Admin",
};

const KIND_LABEL: Record<OracleEvent["kind"], string> = {
  created: "Opened",
  proposed: "Proposed",
  challenged: "Challenged",
  ruled: "Ruled",
  finalized: "Finalized",
};

export function OracleTrail({ market }: { market: Market }) {
  const pending = market.state === "open" || market.state === "closed";
  return (
    <section aria-labelledby="trail">
      <SectionTitle id="trail" kicker="Oracle and audit" title="Evidence trail" />
      <ol className="divide-y divide-line/70 rounded-md border border-line">
        {market.oracleTrail.map((e) => (
          <li key={`${e.kind}-${e.t}`} className="grid gap-2 p-4 sm:grid-cols-[9rem_1fr]">
            <div>
              <p className={cn("font-mono text-xs uppercase tracking-wide", e.kind === "challenged" ? "text-no" : e.kind === "finalized" ? "text-yes" : "text-marble-50")}>
                {KIND_LABEL[e.kind]}
              </p>
              <p className="mt-0.5 font-mono text-[0.6875rem] text-marble-600">{formatDateTime(e.t)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-marble-200">
                <span className="text-marble-400">
                  {ROLE_LABEL[e.actor]}, {e.agent}.
                </span>{" "}
                {e.note}
              </p>
              {e.evidenceHash && (
                <p className="mt-1 truncate font-mono text-[0.6875rem] text-marble-600" title={e.evidenceHash}>
                  sha256 {shortHash(e.evidenceHash, 8)}
                </p>
              )}
            </div>
          </li>
        ))}
        {pending && (
          <li className="grid gap-2 p-4 text-marble-600 sm:grid-cols-[9rem_1fr]">
            <p className="font-mono text-xs uppercase tracking-wide">Next</p>
            <p className="text-sm">
              After close, an oracle agent proposes the outcome with a sealed evidence bundle. An independent auditor
              re-derives it and can challenge within the dispute window.
            </p>
          </li>
        )}
      </ol>
    </section>
  );
}

export function ActivityList({ activity }: { activity: Activity[] }) {
  return (
    <section aria-labelledby="activity">
      <SectionTitle id="activity" kicker="Live" title="Activity" />
      <div className="relative overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[30rem] text-sm">
          <caption className="sr-only">Recent trades</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="micro px-4 py-3 font-normal">Trader</th>
              <th scope="col" className="micro px-4 py-3 font-normal">Action</th>
              <th scope="col" className="micro px-4 py-3 text-right font-normal">Amount</th>
              <th scope="col" className="micro px-4 py-3 text-right font-normal">Price</th>
              <th scope="col" className="micro px-4 py-3 text-right font-normal">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {activity.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5 font-mono text-xs text-marble-200">{a.trader}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("font-mono text-xs uppercase", a.kind === "liquidation" ? "text-gold" : a.side === "yes" ? "text-yes" : "text-no")}>
                    {a.kind === "open" ? "Buy" : a.kind === "close" ? "Sell" : "Liquidated"} {a.side}
                  </span>
                  {a.kind === "open" && <span className="ml-2 font-mono text-xs text-marble-400">{formatLeverage(a.leverage)}</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-marble-50 tabular">{formatUsd(a.amount)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-marble-200 tabular">{formatCents(a.price)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-marble-400 tabular">{formatDateTime(a.t).split(", ")[1] ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** pm-AMM depth: price after buying N USDC of each side. */
export function DepthTable({ market }: { market: Market }) {
  const sizes = [100, 1_000, 10_000];
  return (
    <section aria-labelledby="depth">
      <SectionTitle id="depth" kicker="pm-AMM" title="Depth" />
      <div className="relative overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[22rem] text-sm">
          <caption className="sr-only">Estimated price after a buy of each size</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="micro px-4 py-3 font-normal">Buy size</th>
              <th scope="col" className="micro px-4 py-3 text-right font-normal">Yes after</th>
              <th scope="col" className="micro px-4 py-3 text-right font-normal">No after</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {sizes.map((s) => {
              const spend = s * (1 - PROTOCOL.feeRate);
              const yes = estimateBuy(poolFor(market.yesPrice, market.liquidity, "yes"), spend).priceAfter;
              const no = estimateBuy(poolFor(market.yesPrice, market.liquidity, "no"), spend).priceAfter;
              return (
                <tr key={s}>
                  <td className="px-4 py-2.5 font-mono text-xs text-marble-200">{formatUsd(s)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-yes tabular">{formatCents(yes)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-no tabular">{formatCents(no)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-marble-400">
        Liquidity thins toward the close, so the same size moves the price more late in the market.
      </p>
    </section>
  );
}

export function RelatedMarkets({ markets }: { markets: Market[] }) {
  if (markets.length === 0) return null;
  return (
    <section aria-labelledby="related">
      <SectionTitle id="related" kicker="Keep going" title="Related markets" />
      <ul className="divide-y divide-line/70 rounded-md border border-line">
        {markets.map((m) => (
          <li key={m.id}>
            <Link href={`/markets/${m.id}`} className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-night-900">
              <span className="text-sm text-marble-50">{m.question}</span>
              <span className="shrink-0 num text-lg text-marble-50 tabular">{formatCents(m.yesPrice)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
