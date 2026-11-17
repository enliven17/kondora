"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

import { WalletButton } from "@/components/app/wallet-button";
import { CategoryThumb } from "@/components/app/category-thumb";
import { CountUp } from "@/components/ui/count-up";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { useNow } from "@/hooks/use-now";
import type { HistoryItem } from "@/lib/data";
import { formatLeverage, formatTimeAgo, formatUsd, formatUsdSigned } from "@/lib/format";
import { valuePosition } from "@/lib/leverage";
import { claimPosition, closePosition } from "@/lib/trade";
import type { Market, Position } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type PositionRow, PositionsTable } from "./positions-table";

const DEMO_BALANCE = 1_000;
const noopSubscribe = () => () => {};

function toRow(position: Position, market: Market): PositionRow {
  const key = `${position.marketId}:${position.side}`;
  if (market.state === "resolved") {
    const o = market.outcome ?? "invalid";
    const mark = o === "invalid" ? (position.side === "yes" ? market.yesPrice : 1 - market.yesPrice) : o === position.side ? 1 : 0;
    const value = position.shares * mark;
    const pnl = value - position.margin;
    return {
      key,
      position,
      market,
      claimable: value,
      view: { mark, value, equity: value, pnl, pnlPct: position.margin > 0 ? pnl / position.margin : 0, health: 1, liqPrice: null },
    };
  }
  return { key, position, market, claimable: null, view: valuePosition(position, market) };
}

function BalanceStat({ label, value, tone, signed }: { label: string; value: number; tone?: string; signed?: boolean }) {
  return (
    <div className="min-w-0 py-4 xs:px-4 xs:first:pl-0 sm:px-6">
      <dt className="text-xs text-haze">{label}</dt>
      <dd>
        <CountUp value={value} format={signed ? formatUsdSigned : formatUsd} className={cn("num block truncate text-2xl sm:text-3xl", tone ?? "text-fg")} />
      </dd>
    </div>
  );
}

export function PortfolioView({
  positions,
  markets,
  history,
  serverNow,
}: {
  positions: Position[];
  markets: Market[];
  history: HistoryItem[];
  serverNow: number;
}) {
  const { publicKey } = useWallet();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const connected = mounted && Boolean(publicKey);
  const now = useNow(30_000) ?? serverNow;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [done, setDone] = useState<HistoryItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    const byId = new Map(markets.map((m) => [m.id, m]));
    return positions.flatMap((p) => {
      const m = byId.get(p.marketId);
      return m ? [toRow(p, m)] : [];
    });
  }, [positions, markets]);

  const doneIds = new Set(done.map((d) => d.id));
  const live = rows.filter((r) => !doneIds.has(r.key));
  const realizedSession = done.reduce((s, d) => s + d.pnl, 0);
  const balance = DEMO_BALANCE + done.reduce((s, d) => s + d.proceeds, 0);
  const inPositions = live.reduce((s, r) => s + Math.max(0, r.view.equity), 0);
  const realized = history.reduce((s, h) => s + h.pnl, 0) + realizedSession;
  const allHistory = [...done, ...history];

  const settle = async (row: PositionRow, kind: "close" | "claim") => {
    setBusyKey(row.key);
    setMessage(null);
    const owner = publicKey?.toBase58();
    const result =
      kind === "claim"
        ? await claimPosition({ marketId: row.market.id, side: row.position.side, owner })
        : await closePosition({
            marketId: row.market.id,
            side: row.position.side,
            fractionBps: 10_000,
            minOut: Math.max(0, row.view.value * 0.99),
            owner,
          });
    setBusyKey(null);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const proceeds = Math.max(0, kind === "claim" ? (row.claimable ?? 0) : row.view.equity);
    setDone((prev) => [
      {
        id: row.key,
        marketId: row.market.id,
        question: row.market.question,
        category: row.market.category,
        side: row.position.side,
        kind,
        leverage: row.position.leverage,
        pnl: proceeds - row.position.margin,
        proceeds,
        t: Date.now() / 1000,
      },
      ...prev,
    ]);
    setMessage(`${kind === "claim" ? "Claimed" : "Closed for"} ${formatUsd(proceeds)}.`);
  };

  return (
    <div className="space-y-4">
      {!connected && (
        <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-base font-bold text-fg">Wallet not connected</h2>
            <p className="mt-0.5 text-sm text-muted">This is a demo portfolio. Connect a wallet to see your own positions on devnet.</p>
          </div>
          <WalletButton className="shrink-0 self-start sm:self-auto" />
        </Panel>
      )}

      <Panel as="section" aria-labelledby="balance-title" className="p-4 sm:p-5">
        <h1 id="balance-title" className="text-sm font-semibold text-fg">
          Portfolio
        </h1>
        <dl className="mt-2 grid grid-cols-1 divide-y divide-line/10 xs:grid-cols-3 xs:divide-x xs:divide-y-0">
          <BalanceStat label="Balance" value={balance} />
          <BalanceStat label="In positions" value={inPositions} />
          <BalanceStat label="Realized PnL" value={realized} signed tone={realized >= 0 ? "text-up" : "text-down"} />
        </dl>
      </Panel>

      <Panel as="section" aria-labelledby="positions-title" className="overflow-hidden">
        <PanelHeader id="positions-title" title="Positions">
          <span className="num text-xs text-haze">{live.length} open</span>
        </PanelHeader>
        <p aria-live="polite" className={cn("px-5 pt-3 text-sm text-online", !message && "sr-only")}>
          {message}
        </p>
        {live.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-lg font-semibold text-fg">No open positions</p>
            <p className="mt-1 text-sm text-muted">Pick a market and take a side. Positions show up here with their health.</p>
            <Link href="/markets" className="mt-4 inline-flex h-10 items-center rounded bg-acc px-4 text-sm font-bold text-acc-ink hover:bg-acc-hover">
              Browse markets
            </Link>
          </div>
        ) : (
          <PositionsTable rows={live} busyKey={busyKey} onClose={(r) => settle(r, "close")} onClaim={(r) => settle(r, "claim")} />
        )}
      </Panel>

      <Panel as="section" aria-labelledby="history-title" className="overflow-hidden">
        <PanelHeader id="history-title" title="History" />
        {allHistory.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Closed and claimed positions appear here.</p>
        ) : (
          <ul className="divide-y divide-line/[0.07]">
            {allHistory.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <CategoryThumb category={h.category} className="size-9" />
                <div className="min-w-0 flex-1">
                  <Link href={`/markets/${h.marketId}`} className="line-clamp-1 text-sm font-semibold text-fg hover:underline">
                    {h.question}
                  </Link>
                  <p className="mt-0.5 text-xs">
                    <span className={cn("font-semibold", h.kind === "liquidation" ? "text-down" : h.kind === "claim" ? "text-acc" : "text-muted")}>
                      {h.kind === "liquidation" ? "Liquidated" : h.kind === "claim" ? "Claimed" : "Closed"}
                    </span>
                    <span className="num text-haze">
                      {" "}
                      {formatLeverage(h.leverage)} {h.side === "yes" ? "Yes" : "No"}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("num text-sm", h.pnl >= 0 ? "text-up" : "text-down")}>{formatUsdSigned(h.pnl)}</p>
                  <p className="num text-[11px] text-haze">{formatTimeAgo(h.t, now)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
