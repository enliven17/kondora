"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { KondoraMark } from "@/components/brand/logo";
import { CountUp } from "@/components/ui/count-up";
import { TornEdge } from "@/components/ui/torn-edge";
import { formatCents, formatLeverage, formatNumber, formatUsd, shortHash } from "@/lib/format";
import type { Side } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ConfirmedBet {
  side: Side;
  leverage: number;
  margin: number;
  shares: number;
  payout: number;
  liqPrice: number;
  signature: string;
}

/** The confirm moment: a ticket rises over the panel, the condor sweeps in, numbers count up. */
export function BetConfirmation({ bet, question, onDone }: { bet: ConfirmedBet; question: string; onDone: () => void }) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const tone = bet.side === "yes" ? "text-yes" : "text-no";

  return (
    <motion.div
      role="status"
      aria-live="assertive"
      className="absolute inset-0 z-20 flex flex-col justify-end bg-night-950/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative bg-marble-50 px-6 pb-6 pt-10 text-night-950"
        initial={reduce ? { opacity: 0 } : { y: "100%" }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0 } : { y: "100%" }}
        transition={{ type: "spring", bounce: 0.22, duration: 0.6 }}
      >
        <TornEdge position="top" className="text-marble-50" seed={bet.signature.length + 3} height={18} deckle={false} />
        <motion.div
          className="absolute -top-10 right-6"
          initial={reduce ? false : { x: -120, y: 30, rotate: -12, opacity: 0 }}
          animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
        >
          <KondoraMark className="h-16 w-16 text-night-950 drop-shadow-[0_6px_12px_rgba(0,0,0,0.35)]" title="" aria-hidden />
        </motion.div>

        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-night-700">Position open</p>
        <p className="mt-2 line-clamp-2 text-sm text-night-800">{question}</p>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-night-700">Pays if {bet.side}</div>
            <CountUp
              value={bet.payout}
              format={formatUsd}
              duration={1.1}
              className="num text-5xl leading-none text-night-950 tabular"
            />
          </div>
          <span className={cn("rounded-xs bg-night-950 px-2.5 py-1.5 font-mono text-sm uppercase", tone)}>
            {bet.side} {formatLeverage(bet.leverage)}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-night-950/15 pt-4 font-mono text-xs">
          <div>
            <dt className="text-night-700">Margin</dt>
            <dd className="mt-0.5 tabular">{formatUsd(bet.margin)}</dd>
          </div>
          <div>
            <dt className="text-night-700">Shares</dt>
            <dd className="mt-0.5 tabular">{formatNumber(bet.shares)}</dd>
          </div>
          <div>
            <dt className="text-night-700">Liquidation</dt>
            <dd className="mt-0.5 tabular">{bet.leverage > 1 ? formatCents(bet.liqPrice) : "None"}</dd>
          </div>
        </dl>
        <p className="mt-3 font-mono text-[0.6875rem] text-night-700">Tx {shortHash(bet.signature, 6)}</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onDone}
            className="h-11 rounded-sm bg-night-950 text-sm font-medium text-marble-50 hover:bg-night-800"
          >
            Bet again
          </button>
          <Link
            href="/portfolio"
            className="flex h-11 items-center justify-center rounded-sm border border-night-950/30 text-sm font-medium hover:border-night-950"
          >
            View portfolio
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
