import Link from "next/link";

import { CategoryThumb } from "@/components/app/category-thumb";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { CATEGORY_META } from "@/lib/categories";
import { formatCents, formatChance, formatDateTime, formatLeverage, formatUsd, shortHash } from "@/lib/format";
import type { Activity, AgentRole, Market, OracleEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RulesSection({ market }: { market: Market }) {
  return (
    <Panel as="section" aria-labelledby="rules-title" className="overflow-hidden">
      <PanelHeader id="rules-title" title="Rules" />
      <div className="p-4 sm:p-5">
        <ol className="space-y-3 text-[15px] leading-relaxed text-fg/85">
          {market.rules.map((rule, i) => (
            <li key={rule} className="grid grid-cols-[2rem_1fr]">
              <span className="num text-sm leading-7 text-haze">{String(i + 1).padStart(2, "0")}</span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
        <dl className="mt-5 grid gap-4 rounded-lg bg-panel-deep/80 p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="app-label">Resolution source</dt>
            <dd className="mt-1">
              <a
                href={market.resolution.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-fg underline decoration-line/30 underline-offset-4 hover:decoration-fg"
              >
                {market.resolution.name}
              </a>
            </dd>
          </div>
          <div>
            <dt className="app-label">Reads</dt>
            <dd className="mt-1 text-fg/85">{market.resolution.field}</dd>
          </div>
          <div>
            <dt className="app-label">Closes</dt>
            <dd className="num mt-1 text-fg/85">{formatDateTime(market.closeTime)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-haze">
          Invalid outcomes pay the final mark: a YES share pays the last YES price, a NO share the last NO price.
        </p>
      </div>
    </Panel>
  );
}

const ROLE_LABEL: Record<AgentRole, string> = {
  creator: "Creator",
  oracle: "Oracle",
  auditor: "Auditor",
  admin: "Admin",
  crank: "Crank",
};

const KIND_LABEL: Record<OracleEvent["kind"], string> = {
  created: "Opened",
  closed: "Trading closed",
  proposed: "Proposed",
  audited: "Audited",
  challenged: "Challenged",
  ruled: "Ruled",
  finalized: "Finalized",
};

const KIND_TONE: Partial<Record<OracleEvent["kind"], string>> = {
  challenged: "text-down",
  finalized: "text-up",
  ruled: "text-acc",
};

function Step({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "num grid size-7 place-items-center rounded-sm text-xs",
          done ? "bg-fg/10 text-fg" : "border border-dashed border-line/20 text-haze",
        )}
      >
        {n}
      </span>
      <div className="min-w-0 pb-5">{children}</div>
    </li>
  );
}

/** Oracle and audit trail as numbered steps. */
export function OracleTrail({ market }: { market: Market }) {
  const pending = market.state === "open" || market.state === "closed";
  const events = market.oracleTrail;
  return (
    <Panel as="section" aria-labelledby="trail-title" className="overflow-hidden">
      <PanelHeader id="trail-title" title="Oracle and audit trail" />
      <ol className="p-4 pb-0 sm:p-5 sm:pb-0">
        {events.map((e, i) => (
          <Step key={`${e.kind}-${e.t}`} n={i + 1} done>
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className={cn("font-semibold", KIND_TONE[e.kind] ?? "text-fg")}>{KIND_LABEL[e.kind]}</span>
              <span className="num text-xs text-haze">{formatDateTime(e.t)}</span>
            </p>
            <p className="mt-1 text-sm leading-relaxed text-fg/85">
              <span className="text-muted">
                {ROLE_LABEL[e.actor]}, {e.agent}.
              </span>{" "}
              {e.note}
            </p>
            {e.evidenceHash && (
              <p className="mt-1 truncate font-mono text-[11px] text-haze" title={e.evidenceHash}>
                sha256 {shortHash(e.evidenceHash, 8)}
              </p>
            )}
          </Step>
        ))}
        {pending && (
          <Step n={events.length + 1} done={false}>
            <p className="text-sm font-semibold text-muted">Next: proposal and audit</p>
            <p className="mt-1 text-sm leading-relaxed text-haze">
              After close, an oracle agent proposes the outcome with a sealed evidence bundle. An independent auditor
              re-derives it and can challenge within the dispute window.
            </p>
          </Step>
        )}
      </ol>
    </Panel>
  );
}

function actionLabel(a: Activity) {
  if (a.kind === "liquidation") return "Liquidated";
  const side = a.side === "yes" ? "Yes" : "No";
  return a.kind === "open" ? `Buy ${side}` : `Sell ${side}`;
}

export function ActivityList({ activity }: { activity: Activity[] }) {
  return (
    <Panel as="section" aria-labelledby="activity-title" className="overflow-hidden">
      <PanelHeader id="activity-title" title="Activity" />
      <div className="thin-scrollbar overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <caption className="sr-only">Recent trades</caption>
          <thead>
            <tr className="border-b border-line/10 text-left text-xs text-haze">
              <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Trader</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Action</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Price</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/[0.07]">
            {activity.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                  No trades yet. The first bet on this market shows up here.
                </td>
              </tr>
            )}
            {activity.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5 font-mono text-xs text-muted sm:px-5">{a.trader}</td>
                <td className="px-4 py-2.5 text-xs">
                  <span className={cn("font-semibold", a.kind === "liquidation" || a.side === "no" ? "text-down" : "text-up")}>
                    {actionLabel(a)}
                  </span>
                  {a.kind === "open" && (
                    <span className="num ml-2 rounded-xs bg-acc/10 px-1.5 py-0.5 text-[11px] text-acc">{formatLeverage(a.leverage)}</span>
                  )}
                </td>
                <td className="num px-4 py-2.5 text-right text-xs text-fg">{formatUsd(a.amount)}</td>
                <td className="num px-4 py-2.5 text-right text-xs text-fg/85">{formatCents(a.price)}</td>
                <td className="num px-4 py-2.5 text-right text-xs text-haze sm:px-5">{formatDateTime(a.t).split(", ")[1] ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function RelatedMarkets({ markets }: { markets: Market[] }) {
  if (markets.length === 0) return null;
  return (
    <Panel as="section" aria-labelledby="related-title" className="overflow-hidden">
      <PanelHeader id="related-title" title="Related markets" />
      <ul className="divide-y divide-line/[0.07]">
        {markets.map((m) => (
          <li key={m.id}>
            <Link href={`/markets/${m.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-fg/[0.035] sm:px-5">
              <CategoryThumb category={m.category} className="size-10" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-semibold text-fg">{m.question}</span>
                <span className="text-xs text-haze">{CATEGORY_META[m.category].label}</span>
              </span>
              <span className="num shrink-0 text-lg text-fg">{formatChance(m.yesPrice)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
