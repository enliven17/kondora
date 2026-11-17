"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { WalletButton } from "@/components/site/wallet-button";
import { formatCents, formatLeverage, formatNumber, formatPct, formatUsd } from "@/lib/format";
import { valuePosition } from "@/lib/leverage";
import { closePosition } from "@/lib/trade";
import type { Market, Position } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Row {
  key: string;
  position: Position;
  market: Market;
  view: ReturnType<typeof valuePosition>;
}

function HealthBar({ health }: { health: number }) {
  const pct = Math.round(health * 100);
  const color = health > 0.5 ? "bg-yes" : health > 0.2 ? "bg-gold" : "bg-no";
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label="Position health"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 w-20 overflow-hidden rounded-xs bg-night-700"
      >
        <div className={cn("h-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-marble-400 tabular">{pct}%</span>
    </div>
  );
}

export function PositionsTable({ positions, markets }: { positions: Position[]; markets: Market[] }) {
  const { publicKey } = useWallet();
  const [closing, setClosing] = useState<string | null>(null);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo<Row[]>(
    () =>
      positions.flatMap((position) => {
        const market = markets.find((m) => m.id === position.marketId);
        if (!market) return [];
        const key = `${position.marketId}:${position.side}`;
        return [{ key, position, market, view: valuePosition(position, market) }];
      }),
    [positions, markets],
  );

  const live = rows.filter((r) => !closed.has(r.key));
  const totals = live.reduce(
    (acc, r) => ({ margin: acc.margin + r.position.margin, equity: acc.equity + r.view.equity, pnl: acc.pnl + r.view.pnl }),
    { margin: 0, equity: 0, pnl: 0 },
  );

  const onClose = async (row: Row) => {
    setClosing(row.key);
    setMessage(null);
    const result = await closePosition({
      marketId: row.position.marketId,
      side: row.position.side,
      fractionBps: 10_000,
      minOut: Math.max(0, row.view.value * 0.99),
      owner: publicKey?.toBase58(),
    });
    setClosing(null);
    if (result.ok) {
      setClosed((prev) => new Set(prev).add(row.key));
      setMessage(`Closed ${row.position.side.toUpperCase()} on "${row.market.question}" for ${formatUsd(Math.max(0, row.view.equity))}.`);
    } else {
      setMessage(result.error);
    }
  };

  return (
    <div>
      {!publicKey && (
        <div className="mb-8 flex flex-col gap-4 rounded-md border border-line bg-night-900 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-marble-200">
            You are viewing demo positions. Connect a wallet to see your own on devnet.
          </p>
          <WalletButton variant="dark" size="md" />
        </div>
      )}

      <dl className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Summary label="Open positions" value={String(live.length)} />
        <Summary label="Margin" value={formatUsd(totals.margin)} />
        <Summary label="Equity" value={formatUsd(totals.equity)} />
        <Summary label="Unrealized PnL" value={formatUsd(totals.pnl)} tone={totals.pnl >= 0 ? "text-yes" : "text-no"} />
      </dl>

      <p aria-live="polite" className={cn("mb-4 text-sm text-marble-200", !message && "sr-only")}>
        {message}
      </p>

      {live.length === 0 ? (
        <div className="rounded-md border border-line p-10 text-center">
          <p className="text-xl font-semibold text-marble-50">No open positions.</p>
          <Link href="/markets" className="mt-3 inline-block text-sm text-marble-200 underline-offset-4 hover:underline">
            Browse markets
          </Link>
        </div>
      ) : (
        <>
          {/* Cards on small screens */}
          <ul className="space-y-3 md:hidden">
            {live.map((r) => (
              <li key={r.key} className="rounded-md border border-line bg-night-900 p-4">
                <Link href={`/markets/${r.market.id}`} className="text-sm font-medium text-marble-50">
                  {r.market.question}
                </Link>
                <div className="mt-2 flex items-center gap-3 font-mono text-xs">
                  <span className={r.position.side === "yes" ? "text-yes" : "text-no"}>{r.position.side.toUpperCase()}</span>
                  <span className="text-marble-400">{formatLeverage(r.position.leverage)}</span>
                  <span className="text-marble-400">
                    {formatCents(r.position.entryPrice)} to {formatCents(r.view.mark)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <HealthBar health={r.view.health} />
                  <span className={cn("font-mono text-sm tabular", r.view.pnl >= 0 ? "text-yes" : "text-no")}>
                    {formatUsd(r.view.pnl)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onClose(r)}
                  disabled={closing === r.key}
                  className="mt-4 h-10 w-full rounded-sm border border-line text-sm text-marble-50 hover:border-marble-400 disabled:opacity-50"
                >
                  {closing === r.key ? "Closing" : "Close position"}
                </button>
              </li>
            ))}
          </ul>

          {/* Table on md and up */}
          <div className="relative hidden overflow-x-auto rounded-md border border-line md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Open positions</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  {["Market", "Side", "Size", "Entry", "Mark", "Liq.", "Health", "PnL", ""].map((h, i) => (
                    <th key={h || i} scope="col" className={cn("micro px-4 py-3 font-normal", i >= 2 && i !== 6 && "text-right")}>
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {live.map((r) => (
                  <tr key={r.key}>
                    <td className="max-w-xs px-4 py-3">
                      <Link href={`/markets/${r.market.id}`} className="text-marble-50 hover:text-gold">
                        {r.market.question}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <span className={r.position.side === "yes" ? "text-yes" : "text-no"}>{r.position.side.toUpperCase()}</span>{" "}
                      <span className="text-marble-400">{formatLeverage(r.position.leverage)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-marble-200 tabular">{formatNumber(r.position.shares)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-marble-200 tabular">{formatCents(r.position.entryPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-marble-50 tabular">{formatCents(r.view.mark)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gold tabular">
                      {r.position.leverage > 1 ? formatCents(r.view.liqPrice) : "None"}
                    </td>
                    <td className="px-4 py-3">
                      <HealthBar health={r.view.health} />
                    </td>
                    <td className={cn("px-4 py-3 text-right font-mono text-xs tabular", r.view.pnl >= 0 ? "text-yes" : "text-no")}>
                      {formatUsd(r.view.pnl)}
                      <span className="block text-marble-400">{formatPct(r.view.pnlPct, true)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onClose(r)}
                        disabled={closing === r.key}
                        className="rounded-sm border border-line px-3 py-1.5 text-xs text-marble-50 hover:border-marble-400 disabled:opacity-50"
                      >
                        {closing === r.key ? "Closing" : "Close"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-line p-4">
      <dt className="micro">{label}</dt>
      <dd className={cn("mt-1 num text-2xl tabular", tone ?? "text-marble-50")}>{value}</dd>
    </div>
  );
}
