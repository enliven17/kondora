"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { OutcomeLabel } from "@/components/markets/outcome-label";
import { CountUp } from "@/components/ui/count-up";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { useFeedback } from "@/hooks/use-feedback";
import { useNow } from "@/hooks/use-now";
import { formatCents, formatLeverage, formatNumber, formatPct, formatUsd, formatUsdSigned } from "@/lib/format";
import { type CapReason, leverageCap, PROTOCOL, quoteBet, sidePrice } from "@/lib/leverage";
import { placeBet } from "@/lib/trade";
import type { Market, Side } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BetConfirmation, type ConfirmedBet } from "./bet-confirmation";
import { LeverageSlider } from "./leverage-slider";

export const SIDE_EVENT = "kondora:side";

const DEMO_BALANCE = 1_000;
const PRESETS = [10, 25, 50, 100] as const;
const SLIPPAGE = 0.01;

const CAP_NOTES: Record<CapReason, string> = {
  max: "",
  time: "Leverage tapers in the last 24 hours.",
  price: "Leverage tightens near 0¢ and 100¢.",
  "reduce-only": "Only 1x opens in the final hour.",
};

export interface BetPanelProps {
  market: Market;
  initialSide?: Side;
  initialAmount?: number;
  /** Clock for the first render so server and client agree on the cap. */
  serverNow: number;
}

function blockReason(margin: number, overBalance: boolean, priceLimitHit: boolean): string | null {
  if (!(margin > 0)) return "Enter an amount";
  if (overBalance) return "Above your balance";
  if (priceLimitHit) return "Too large for this pool";
  return null;
}

export function BetPanel({ market, initialSide = "yes", initialAmount = 25, serverNow }: BetPanelProps) {
  const [side, setSide] = useState<Side>(initialSide);
  const [amountText, setAmountText] = useState(String(initialAmount));
  const [leverage, setLeverage] = useState(2);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedBet | null>(null);
  const { publicKey } = useWallet();
  const { sound, setSound, success } = useFeedback();
  const now = useNow(15_000) ?? serverNow;
  const amountId = useId();

  useEffect(() => {
    const onSide = (e: Event) => {
      const next = (e as CustomEvent<Side>).detail;
      if (next === "yes" || next === "no") setSide(next);
    };
    window.addEventListener(SIDE_EVENT, onSide);
    return () => window.removeEventListener(SIDE_EVENT, onSide);
  }, []);

  const { cap, reason } = useMemo(() => leverageCap(market.yesPrice, market.closeTime, now), [market.yesPrice, market.closeTime, now]);
  const lev = Math.min(leverage, cap);
  const margin = Number.parseFloat(amountText) || 0;
  const quote = useMemo(() => quoteBet(market, side, margin, lev), [market, side, margin, lev]);
  const price = sidePrice(market, side);
  const overBalance = margin > DEMO_BALANCE;
  const closed = market.state !== "open" || now >= market.closeTime;
  const blocked = blockReason(margin, overBalance, quote.priceLimitHit);
  const dismiss = useCallback(() => setConfirmed(null), []);

  if (closed) {
    return (
      <Panel as="section" aria-labelledby="bet-title" className="p-5">
        <h2 id="bet-title" className="text-xl font-bold tracking-tight text-fg">
          Trading closed
        </h2>
        <div className="mt-2">
          <OutcomeLabel market={market.state === "open" ? { ...market, state: "closed" } : market} />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This market no longer takes bets. The oracle and audit trail shows how it settles.
        </p>
      </Panel>
    );
  }

  const submit = async () => {
    if (blocked || pending) return;
    setPending(true);
    setError(null);
    const result = await placeBet({
      marketId: market.id,
      side,
      margin,
      leverage: lev,
      minShares: quote.shares * (1 - SLIPPAGE),
      owner: publicKey?.toBase58(),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    success();
    setConfirmed({ side, leverage: lev, margin, shares: quote.shares, payout: quote.payoutIfWin, liqPrice: quote.liqPrice, signature: result.signature });
  };

  const yes = side === "yes";
  const sideWord = yes ? "YES" : "NO";

  return (
    <Panel as="section" aria-labelledby="bet-title" className="relative overflow-hidden">
      <PanelHeader id="bet-title" title="Place a bet">
        <button
          type="button"
          aria-pressed={sound}
          onClick={() => setSound(!sound)}
          className="rounded-sm px-2 py-1 text-xs text-muted transition-colors hover:bg-fg/5 hover:text-fg"
        >
          Sound {sound ? "on" : "off"}
        </button>
      </PanelHeader>

      <div className="space-y-4 p-4 sm:p-5">
        <div role="radiogroup" aria-label="Side" className="grid grid-cols-2 gap-1 rounded bg-panel-deep p-1">
          {(["yes", "no"] as const).map((s) => {
            const active = side === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSide(s)}
                className={cn(
                  "flex h-11 items-center justify-between rounded-sm px-3 text-sm font-bold transition-[background-color,color] duration-200",
                  active ? (s === "yes" ? "bg-up text-ink" : "bg-down text-fg") : "text-muted hover:bg-fg/5 hover:text-fg",
                )}
              >
                <span>{s === "yes" ? "Yes" : "No"}</span>
                <span className="num">{formatCents(sidePrice(market, s))}</span>
              </button>
            );
          })}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={amountId} className="app-label">
              Amount
            </label>
            <span className="text-xs text-haze">
              Balance <span className="num text-muted">{formatNumber(DEMO_BALANCE)}</span> USDC{publicKey ? "" : " (demo)"}
            </span>
          </div>
          <div
            className={cn(
              "mt-2 flex items-center rounded border bg-panel-deep transition-colors focus-within:border-line/30",
              overBalance ? "border-down/70" : "border-line/10",
            )}
          >
            <input
              id={amountId}
              inputMode="decimal"
              type="number"
              min={0}
              step="1"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className="num h-12 w-full min-w-0 bg-transparent px-3 text-xl text-fg focus:outline-none"
              aria-describedby={overBalance ? `${amountId}-err` : undefined}
              aria-invalid={overBalance || undefined}
            />
            <span className="pr-3 text-sm font-medium text-haze">USDC</span>
          </div>
          {overBalance && (
            <p id={`${amountId}-err`} className="mt-1 text-xs text-down">
              Above your balance.
            </p>
          )}
          <div className="mt-2 grid grid-cols-5 gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmountText(String(p))}
                aria-pressed={margin === p}
                className={cn(
                  "num h-8 rounded-sm text-xs transition-colors",
                  margin === p ? "bg-acc text-acc-ink" : "bg-fg/5 text-muted hover:bg-fg/10 hover:text-fg",
                )}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmountText(String(DEMO_BALANCE))}
              aria-pressed={margin === DEMO_BALANCE}
              className={cn(
                "h-8 rounded-sm text-xs font-semibold transition-colors",
                margin === DEMO_BALANCE ? "bg-acc text-acc-ink" : "bg-fg/5 text-muted hover:bg-fg/10 hover:text-fg",
              )}
            >
              Max
            </button>
          </div>
        </div>

        <LeverageSlider value={lev} onChange={setLeverage} cap={cap} disabled={reason === "reduce-only"} note={CAP_NOTES[reason]} />

        <div className="rounded-lg bg-panel-deep/80 p-4">
          <div className="flex items-end justify-between gap-3" aria-live="polite">
            <div className="min-w-0">
              <div className="text-xs text-haze">Payout if {sideWord} wins</div>
              <CountUp value={quote.payoutIfWin} format={formatUsd} className={cn("num block truncate text-[2rem] leading-tight", yes ? "text-up" : "text-down")} />
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-haze">Profit</div>
              <div className="num text-sm text-fg">
                {formatUsdSigned(quote.profitIfWin)}{" "}
                <span className="text-haze">{margin > 0 ? formatPct(quote.profitIfWin / margin, true) : ""}</span>
              </div>
            </div>
          </div>
          <dl className="mt-3 space-y-1.5 border-t border-line/10 pt-3 text-sm">
            <Row label="Avg price" value={formatCents(quote.avgPrice)} />
            <Row label="Shares" value={formatNumber(quote.shares)} />
            <Row label="Position size" value={formatUsd(quote.notional)} />
            <Row label="Borrowed" value={formatUsd(quote.debt)} />
            <Row label={`Fee ${formatPct(PROTOCOL.feeRate)}`} value={formatUsd(quote.fee)} />
            <Row label="Price after" value={formatCents(quote.priceAfter)} />
            <Row
              label="Liquidation price"
              value={quote.liqPrice === null ? "None at 1x" : `${sideWord} ${formatCents(quote.liqPrice)}`}
              tone={quote.liqPrice === null ? undefined : "text-acc"}
            />
          </dl>
          {quote.liqPrice !== null && (
            <p className="mt-3 text-xs leading-relaxed text-haze">
              If {sideWord} falls from {formatCents(price)} to {formatCents(quote.liqPrice)}, the position closes and the margin is
              lost. Borrow fee accrues hourly.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-down">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={Boolean(blocked) || pending}
          className={cn(
            "group/bet relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded text-base font-bold",
            "transition-[transform,box-shadow,background-color] duration-150 ease-enter active:translate-y-px active:scale-[0.97]",
            "disabled:cursor-not-allowed disabled:bg-fg/10 disabled:text-muted disabled:shadow-none",
            yes
              ? "bg-up text-ink shadow-[0_12px_32px_-12px_rgb(var(--up)/0.7)] hover:bg-up/90"
              : "bg-down text-fg shadow-[0_12px_32px_-12px_rgb(var(--down)/0.7)] hover:bg-down/90",
          )}
        >
          {pending ? (
            "Placing"
          ) : blocked ? (
            blocked
          ) : (
            <>
              Buy {sideWord} <span className="num opacity-80">{formatLeverage(lev)}</span>
            </>
          )}
        </button>
        <p className="text-center text-[11px] text-haze">
          {publicKey ? "Signed by your session key. No wallet popup." : "Demo mode. Connect a wallet to trade on devnet."}
        </p>
      </div>

      <AnimatePresence>
        {confirmed && <BetConfirmation key={confirmed.signature} bet={confirmed} question={market.question} onDone={dismiss} />}
      </AnimatePresence>
    </Panel>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("num", tone ?? "text-fg")}>{value}</dd>
    </div>
  );
}
