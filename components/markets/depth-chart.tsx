"use client";

import { useMemo, useRef, useState } from "react";

import { formatCents, formatUsdCompact } from "@/lib/format";
import { PROTOCOL } from "@/lib/leverage";
import { estimateBuy, poolFor } from "@/lib/pm-amm";
import type { Side } from "@/lib/types";
import { cn } from "@/lib/utils";

const W = 360;
const H = 180;
const PAD = { l: 8, r: 8, t: 12, b: 22 };
const MIN = 10;
const MAX = 50_000;
const STEPS = 60;

const round = (n: number) => Math.round(n * 100) / 100;
const lx = (size: number) => round(PAD.l + (Math.log10(size / MIN) / Math.log10(MAX / MIN)) * (W - PAD.l - PAD.r));

/** pm-AMM slippage curve: average fill and price after, versus trade size (log scale). */
export function DepthChart({ yesPrice, liquidity, className }: { yesPrice: number; liquidity: number; className?: string }) {
  const [side, setSide] = useState<Side>("yes");
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const curve = useMemo(() => {
    const pool = poolFor(yesPrice, liquidity, side);
    return Array.from({ length: STEPS }, (_, i) => {
      const size = MIN * (MAX / MIN) ** (i / (STEPS - 1));
      const est = estimateBuy(pool, size * (1 - PROTOCOL.feeRate));
      return { size, avg: est.avgPrice, after: est.priceAfter };
    });
  }, [yesPrice, liquidity, side]);

  const start = curve[0]?.avg ?? 0.5;
  const top = Math.min(1, Math.max(...curve.map((c) => c.after)) + 0.02);
  const bottom = Math.max(0, start - 0.02);
  const y = (p: number) => round(PAD.t + (1 - (p - bottom) / Math.max(top - bottom, 0.01)) * (H - PAD.t - PAD.b));
  const path = (key: "avg" | "after") => curve.map((c, i) => `${i ? "L" : "M"}${lx(c.size).toFixed(1)} ${y(c[key]).toFixed(1)}`).join(" ");
  const color = side === "yes" ? "rgb(var(--yes))" : "rgb(var(--no))";
  const active = hover !== null ? curve[hover] : curve[Math.round(STEPS * 0.6)];

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return;
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((vx - PAD.l) / (W - PAD.l - PAD.r)) * (STEPS - 1));
    setHover(Math.min(STEPS - 1, Math.max(0, idx)));
  };

  return (
    <section aria-labelledby="depth-title" className={cn("rounded-md border border-line bg-night-900/70 p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="depth-title" className="text-sm font-semibold text-marble-50">
            Price impact
          </h2>
          <p className="text-xs text-marble-400">pm-AMM, by trade size</p>
        </div>
        <div role="radiogroup" aria-label="Depth side" className="flex rounded-sm border border-line p-0.5">
          {(["yes", "no"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={side === s}
              onClick={() => setSide(s)}
              className={cn(
                "rounded-xs px-2 py-0.5 font-mono text-[0.6875rem] uppercase",
                side === s ? (s === "yes" ? "bg-yes text-night-950" : "bg-no text-night-950") : "text-marble-400 hover:text-marble-50",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {active && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs" aria-live="polite">
          <div>
            <dt className="text-marble-400">Size</dt>
            <dd className="num text-sm text-marble-50">{formatUsdCompact(active.size)}</dd>
          </div>
          <div>
            <dt className="text-marble-400">Avg fill</dt>
            <dd className="num text-sm text-marble-50">{formatCents(active.avg)}</dd>
          </div>
          <div>
            <dt className="text-marble-400">Price after</dt>
            <dd className="num text-sm" style={{ color }}>
              {formatCents(active.after)}
            </dd>
          </div>
        </dl>
      )}

      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 block h-auto w-full touch-pan-y"
        role="img"
        aria-label={`Buying ${side.toUpperCase()}: ${formatUsdCompact(MIN)} fills near ${formatCents(start)}, ${formatUsdCompact(MAX)} moves the price to ${formatCents(curve[curve.length - 1]?.after ?? start)}.`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
      >
        {[100, 1_000, 10_000].map((s) => (
          <g key={s}>
            <line x1={lx(s)} x2={lx(s)} y1={PAD.t} y2={H - PAD.b} stroke="rgb(var(--line))" strokeDasharray="2 5" />
            <text x={lx(s)} y={H - 6} textAnchor="middle" fontSize="10" className="fill-marble-600 font-mono">
              {formatUsdCompact(s)}
            </text>
          </g>
        ))}
        <path d={`${path("after")} L${lx(MAX)} ${H - PAD.b} L${lx(MIN)} ${H - PAD.b} Z`} fill={color} fillOpacity="0.08" />
        <path d={path("avg")} fill="none" stroke="rgb(var(--marble-200))" strokeWidth="1.5" strokeDasharray="4 4" />
        <path d={path("after")} fill="none" stroke={color} strokeWidth="2" />
        {active && (
          <g>
            <line x1={lx(active.size)} x2={lx(active.size)} y1={PAD.t} y2={H - PAD.b} stroke="rgb(var(--marble-50))" strokeOpacity="0.35" />
            <rect x={lx(active.size) - 3} y={y(active.after) - 3} width="6" height="6" fill={color} />
          </g>
        )}
      </svg>
      <div className="mt-2 flex gap-4 font-mono text-[0.6875rem] text-marble-400">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden="true">
            <path d="M0 2 H16" stroke={color} strokeWidth="2" />
          </svg>
          Price after
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden="true">
            <path d="M0 2 H16" stroke="rgb(var(--marble-200))" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          Avg fill
        </span>
      </div>
    </section>
  );
}
