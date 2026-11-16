"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { AnimatePresence } from "motion/react";
import { useEffect, useId, useMemo, useState } from "react";

import { OutcomeLabel } from "@/components/markets/market-card";
import { CountUp } from "@/components/ui/count-up";
import { useFeedback } from "@/hooks/use-feedback";
import { useNow } from "@/hooks/use-now";
import { formatCents, formatLeverage, formatNumber, formatPct, formatUsd } from "@/lib/format";
import { type CapReason, leverageCap, PROTOCOL, quoteBet, sidePrice } from "@/lib/leverage";
import { placeBet } from "@/lib/trade";
import type { Market, Side } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BetConfirmation, type ConfirmedBet } from "./bet-confirmation";
import { LeverageDial } from "./leverage-dial";

export const SIDE_EVENT = "kondora:side";

const DEMO_BALANCE = 1_000;
const QUICK = [10, 50, 100] as const;
const SLIPPAGE = 0.01;

const CAP_NOTES: Record<CapReason, string> = {
  max: "",
  time: "Leverage tapers in the last 24 hours.",
  price: "Leverage tightens near 0¢ and 100¢.",
  "reduce-only": "Only 1x opens in the final hour.",
};

export function BetPanel({ market, initialSide = "yes" }: { market: Market; initialSide?: Side }) {
  const [side, setSide] = useState<Side>(initialSide);
  const [amountText, setAmountText] = useState("50");
  const [leverage, setLeverage] = useState(2);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedBet | null>(null);
  const { publicKey } = useWallet();
  const { sound, setSound, success } = useFeedback();
  const now = useNow();
  const amountId = useId();

  useEffect(() => {
    const onSide = (e: Event) => {
      const next = (e as CustomEvent<Side>).detail;
      if (next === "yes" || next === "no") setSide(next);
    };
    window.addEventListener(SIDE_EVENT, onSide);
    return () => window.removeEventListener(SIDE_EVENT, onSide);
  }, []);

  const { cap, reason } = useMemo(
    () => (now === null ? { cap: PROTOCOL.maxLeverage as number, reason: "max" as CapReason } : leverageCap(market.yesPrice, market.closeTime, now)),
    [market.yesPrice, market.closeTime, now],
  );
  const lev = Math.min(leverage, cap);
  const margin = Number.parseFloat(amountText) || 0;
  const quote = useMemo(() => quoteBet(market, side, margin, lev), [market, side, margin, lev]);
  const price = sidePrice(market, side);
  const overBalance = margin > DEMO_BALANCE;
  const canBet = margin > 0 && !overBalance && !quote.priceLimitHit && !pending;

  if (market.state !== "open") {
    return (
      <section aria-labelledby="bet-title" className="rounded-md border border-line bg-night-900 p-5">
        <h2 id="bet-title" className="font-display text-3xl text-marble-50">
          Trading closed
        </h2>
        <div className="mt-3">
          <OutcomeLabel market={market} />
        </div>
        <p className="mt-3 text-sm text-marble-400">
          This market no longer accepts bets. See the oracle trail below for how it was settled.
        </p>
      </section>
    );
  }

  const submit = async () => {
    if (!canBet) return;
    setPending(true);
    setError(null);
    const minShares = quote.shares * (1 - SLIPPAGE);
    const result = await placeBet({
      marketId: market.id,
      side,
      margin,
      leverage: lev,
      minShares,
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

  const tone = side === "yes" ? "text-yes" : "text-no";

  return (
    <section aria-labelledby="bet-title" className="relative overflow-hidden rounded-md border border-line bg-night-900">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 id="bet-title" className="micro text-marble-200">
          Place a bet
        </h2>
        <button
          type="button"
          aria-pressed={sound}
          onClick={() => setSound(!sound)}
          className="micro rounded-xs px-2 py-1 hover:text-marble-50"
        >
          Sound {sound ? "on" : "off"}
        </button>
      </div>

      <div className="space-y-6 p-5">
        <div role="radiogroup" aria-label="Side" className="grid grid-cols-2 gap-2">
          {(["yes", "no"] as const).map((s) => {
            const active = side === s;
            const p = sidePrice(market, s);
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSide(s)}
                className={cn(
                  "flex items-baseline justify-between rounded-sm border px-4 py-3 text-left transition-colors duration-200",
                  active
                    ? s === "yes"
                      ? "border-yes bg-yes text-night-950"
                      : "border-no bg-no text-night-950"
                    : "border-line text-marble-200 hover:border-marble-400",
                )}
              >
                <span className="text-sm font-semibold uppercase tracking-wide">{s}</span>
                <span className="font-mono text-sm tabular">{formatCents(p)}</span>
              </button>
            );
          })}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor={amountId} className="micro">
              Margin
            </label>
            <span className="font-mono text-[0.6875rem] text-marble-400 tabular">
              Balance {formatNumber(DEMO_BALANCE)} USDC{publicKey ? "" : " (demo)"}
            </span>
          </div>
          <div
            className={cn(
              "mt-2 flex items-center rounded-sm border bg-night-950 focus-within:border-marble-400",
              overBalance ? "border-no" : "border-line",
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
              className="h-12 w-full min-w-0 bg-transparent px-3 font-mono text-xl text-marble-50 tabular focus:outline-none"
              aria-describedby={overBalance ? `${amountId}-err` : undefined}
            />
            <span className="pr-3 font-mono text-sm text-marble-400">USDC</span>
          </div>
          {overBalance && (
            <p id={`${amountId}-err`} className="mt-1 text-xs text-no">
              Above your balance.
            </p>
          )}
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmountText(String(Math.min(DEMO_BALANCE, margin + q)))}
                className="rounded-xs border border-line py-1.5 font-mono text-xs text-marble-200 hover:border-marble-400"
              >
                +{q}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmountText(String(DEMO_BALANCE))}
              className="rounded-xs border border-line py-1.5 font-mono text-xs text-marble-200 hover:border-marble-400"
            >
              Max
            </button>
          </div>
        </div>

        <div>
          <div className="micro mb-1">Leverage</div>
          <LeverageDial value={lev} onChange={setLeverage} cap={cap} tone={side} capNote={CAP_NOTES[reason]} />
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((l) => (
              <button
                key={l}
                type="button"
                disabled={l > cap}
                onClick={() => setLeverage(l)}
                aria-pressed={lev === l}
                className={cn(
                  "rounded-xs border py-1.5 font-mono text-xs transition-colors",
                  lev === l ? "border-marble-50 text-marble-50" : "border-line text-marble-400 hover:border-marble-400",
                  "disabled:opacity-30",
                )}
              >
                {l}x
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-sm bg-night-950/70 p-4">
          <div className="flex items-end justify-between gap-3" aria-live="polite">
            <div>
              <div className="micro">Payout if {side}</div>
              <CountUp value={quote.payoutIfWin} format={formatUsd} className={cn("num text-4xl leading-none tabular", tone)} />
            </div>
            <div className="text-right">
              <div className="micro">Profit</div>
              <div className="font-mono text-sm text-marble-50 tabular">
                {formatUsd(quote.profitIfWin)}{" "}
                <span className="text-marble-400">{margin > 0 ? formatPct(quote.profitIfWin / margin, true) : ""}</span>
              </div>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 border-t border-line/70 pt-4 text-sm xs:grid-cols-2">
            <Row label="Avg price" value={formatCents(quote.avgPrice)} />
            <Row label="Est. shares" value={formatNumber(quote.shares)} />
            <Row label="Position" value={formatUsd(quote.notional)} />
            <Row label="Borrowed" value={formatUsd(quote.debt)} />
            <Row label={`Fee ${formatPct(PROTOCOL.feeRate)}`} value={formatUsd(quote.fee)} />
            <Row label="Price after" value={formatCents(quote.priceAfter)} />
            <Row
              label="Liquidation"
              value={lev <= 1 ? "None at 1x" : `${side.toUpperCase()} ${formatCents(quote.liqPrice)}`}
              emphasis={lev > 1}
              wide
            />
          </dl>
          {lev > 1 && (
            <p className="mt-3 text-xs leading-relaxed text-marble-400">
              If {side.toUpperCase()} falls from {formatCents(price)} to about {formatCents(quote.liqPrice)}, the position is
              closed and the margin is lost. Borrow fee accrues hourly.
            </p>
          )}
        </div>

        {quote.priceLimitHit && <p className="text-xs text-no">This size would push the price above 99¢. Lower the amount or leverage.</p>}
        {error && (
          <p role="alert" className="text-xs text-no">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canBet}
          className={cn(
            "flex h-14 w-full items-center justify-center gap-2 rounded-sm text-base font-semibold text-night-950 transition-[transform,background-color] duration-150 active:scale-[0.98] disabled:opacity-40",
            side === "yes" ? "bg-yes hover:bg-yes/90" : "bg-no hover:bg-no/90",
          )}
        >
          {pending ? "Placing" : `Buy ${side.toUpperCase()} at ${formatCents(quote.avgPrice)}, ${formatLeverage(lev)}`}
        </button>
        <p className="text-center text-[0.6875rem] text-marble-600">
          {publicKey ? "Signed by your session key. No wallet popup." : "Demo mode. Connect a wallet to trade on devnet."}
        </p>
      </div>

      <AnimatePresence>
        {confirmed && (
          <BetConfirmation
            key={confirmed.signature}
            bet={confirmed}
            question={market.question}
            onDone={() => setConfirmed(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function Row({ label, value, emphasis, wide }: { label: string; value: string; emphasis?: boolean; wide?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", wide && "xs:col-span-2")}>
      <dt className="text-marble-400">{label}</dt>
      <dd className={cn("font-mono tabular", emphasis ? "text-gold" : "text-marble-50")}>{value}</dd>
    </div>
  );
}
