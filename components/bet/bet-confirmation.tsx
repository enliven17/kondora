"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { KondoraMark } from "@/components/brand/logo";
import { CountUp } from "@/components/ui/count-up";
import { formatCents, formatLeverage, formatNumber, formatUsd, shortHash } from "@/lib/format";
import type { Side } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ConfirmedBet {
  side: Side;
  leverage: number;
  margin: number;
  shares: number;
  payout: number;
  liqPrice: number | null;
  signature: string;
  /** Explorer link for the transaction. */
  explorer?: string;
}

/** The confirm moment: a ticket rises over the panel, the coin halves snap together, the payout counts up. */
export function BetConfirmation({ bet, question, onDone }: { bet: ConfirmedBet; question: string; onDone: () => void }) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const yes = bet.side === "yes";

  return (
    <motion.div
      role="status"
      aria-live="assertive"
      className="absolute inset-0 z-20 flex flex-col justify-end bg-ink/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative m-2 rounded-xl bg-paper px-5 pb-5 pt-6 text-cocoa"
        initial={reduce ? { opacity: 0 } : { y: "105%" }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0 } : { y: "105%" }}
        transition={{ type: "spring", bounce: 0.22, duration: 0.55 }}
      >
        <motion.div
          className="absolute right-5 top-5 text-plum"
          initial={reduce ? false : { scale: 0.4, rotate: -30, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", bounce: 0.5, duration: 0.6 }}
        >
          <KondoraMark title="" className="size-10" />
        </motion.div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mauve">Position open</p>
        <p className="mt-1.5 line-clamp-2 pr-12 text-sm text-mauve">{question}</p>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs text-mauve">Pays if {yes ? "YES" : "NO"}</div>
            <CountUp value={bet.payout} from={0} format={formatUsd} duration={1.1} className="num text-5xl leading-none text-cocoa" />
          </div>
          <span className={cn("num rounded-sm px-2.5 py-1.5 text-sm font-bold", yes ? "bg-up text-ink" : "bg-down text-fg")}>
            {yes ? "YES" : "NO"} {formatLeverage(bet.leverage)}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-cocoa/10 pt-4 text-xs">
          <div>
            <dt className="text-mauve">Margin</dt>
            <dd className="num mt-0.5 text-sm">{formatUsd(bet.margin)}</dd>
          </div>
          <div>
            <dt className="text-mauve">Shares</dt>
            <dd className="num mt-0.5 text-sm">{formatNumber(bet.shares)}</dd>
          </div>
          <div>
            <dt className="text-mauve">Liquidation</dt>
            <dd className="num mt-0.5 text-sm">{bet.liqPrice === null ? "None" : formatCents(bet.liqPrice)}</dd>
          </div>
        </dl>
        {bet.explorer ? (
          <a
            href={bet.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block font-mono text-[11px] text-mauve underline decoration-cocoa/20 underline-offset-4 hover:text-cocoa"
          >
            Tx {shortHash(bet.signature, 6)}
          </a>
        ) : (
          <p className="mt-3 font-mono text-[11px] text-mauve">Tx {shortHash(bet.signature, 6)}</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onDone}
            className="h-11 rounded bg-plum text-sm font-semibold text-fg transition-[background-color,transform] hover:bg-cocoa active:scale-[0.98]"
          >
            Bet again
          </button>
          <Link
            href="/portfolio"
            className="flex h-11 items-center justify-center rounded border border-cocoa/20 text-sm font-semibold transition-colors hover:border-cocoa/50"
          >
            View portfolio
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
