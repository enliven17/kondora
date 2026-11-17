"use client";

import { useMemo, useRef, useState } from "react";

import { Panel, PanelHeader } from "@/components/ui/panel";
import { formatCents, formatUsdCompact } from "@/lib/format";
import { priceImpact } from "@/lib/leverage";
import type { Market, Side } from "@/lib/types";
import { cn } from "@/lib/utils";

const W = 360;
const H = 170;
const PAD = { l: 8, r: 8, t: 12, b: 22 };
const MIN = 10;
const MAX = 50_000;
const STEPS = 48;

const round = (n: number) => Math.round(n * 100) / 100;
const lx = (size: number) => round(PAD.l + (Math.log10(size / MIN) / Math.log10(MAX / MIN)) * (W - PAD.l - PAD.r));

/** pm-AMM slippage: average fill and price after for a 1x buy, versus size (log scale). Program math. */
export function PriceImpact({ market, className }: { market: Pick<Market, "yesPrice" | "liquidity">; className?: string }) {
  const [side, setSide] = useState<Side>("yes");
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const { yesPrice, liquidity } = market;

  const curve = useMemo(() => {
    const out: Array<{ size: number; avg: number; after: number }> = [];
    for (let i = 0; i < STEPS; i++) {
      const size = MIN * (MAX / MIN) ** (i / (STEPS - 1));
      const r = priceImpact({ yesPrice, liquidity }, side, size);
      if (r) out.push({ size, ...r });
    }
    return out;
  }, [yesPrice, liquidity, side]);

  if (curve.length < 2) return null;

  const start = curve[0]?.avg ?? 0.5;
  const end = curve[curve.length - 1];
  const top = Math.min(1, Math.max(...curve.map((c) => c.after)) + 0.02);
  const bottom = Math.max(0, start - 0.02);
  const y = (p: number) => round(PAD.t + (1 - (p - bottom) / Math.max(top - bottom, 0.01)) * (H - PAD.t - PAD.b));
  const path = (key: "avg" | "after") => curve.map((c, i) => `${i ? "L" : "M"}${lx(c.size).toFixed(1)} ${y(c[key]).toFixed(1)}`).join(" ");
  const color = side === "yes" ? "rgb(var(--up))" : "rgb(var(--down))";
  const active = hover !== null ? curve[Math.min(hover, curve.length - 1)] : curve[Math.round(curve.length * 0.6)];
  const lastX = lx(end?.size ?? MAX);

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return;
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((vx - PAD.l) / (W - PAD.l - PAD.r)) * (STEPS - 1));
    setHover(Math.min(curve.length - 1, Math.max(0, idx)));
  };

  return (
    <Panel as="section" aria-labelledby="impact-title" className={cn("overflow-hidden", className)}>
      <PanelHeader id="impact-title" title="Price impact">
        <div role="radiogroup" aria-label="Price impact side" className="flex rounded bg-panel-deep p-0.5">
          {(["yes", "no"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={side === s}
              onClick={() => setSide(s)}
              className={cn(
                "h-6 rounded-sm px-2 text-[11px] font-semibold transition-colors",
                side === s ? (s === "yes" ? "bg-up text-ink" : "bg-down text-fg") : "text-muted hover:text-fg",
              )}
            >
              {s === "yes" ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </PanelHeader>
      <div className="p-4">
        {active && (
          <dl className="grid grid-cols-3 gap-2 text-xs" aria-live="polite">
            <div>
              <dt className="text-haze">Buy size</dt>
              <dd className="num text-sm text-fg">{formatUsdCompact(active.size)}</dd>
            </div>
            <div>
              <dt className="text-haze">Avg fill</dt>
              <dd className="num text-sm text-fg">{formatCents(active.avg)}</dd>
            </div>
            <div>
              <dt className="text-haze">Price after</dt>
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
          aria-label={`Buying ${side.toUpperCase()}: ${formatUsdCompact(MIN)} fills near ${formatCents(start)}, ${formatUsdCompact(end?.size ?? MAX)} moves the price to ${formatCents(end?.after ?? start)}.`}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setHover(null)}
        >
          {[100, 1_000, 10_000].map((s) => (
            <text key={s} x={lx(s)} y={H - 6} textAnchor="middle" fontSize="10" className="num fill-haze">
              {formatUsdCompact(s)}
            </text>
          ))}
          <path d={`${path("after")} L${lastX} ${H - PAD.b} L${lx(MIN)} ${H - PAD.b} Z`} fill={color} fillOpacity="0.1" />
          <path d={path("avg")} fill="none" stroke="rgb(var(--muted))" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d={path("after")} fill="none" stroke={color} strokeWidth="2" />
          {active && (
            <g>
              <line x1={lx(active.size)} x2={lx(active.size)} y1={PAD.t} y2={H - PAD.b} stroke="rgb(var(--fg))" strokeOpacity="0.3" />
              <rect x={lx(active.size) - 3.5} y={y(active.after) - 3.5} width="7" height="7" rx="1.5" fill={color} />
            </g>
          )}
        </svg>
        <div className="mt-2 flex gap-4 text-[11px] text-haze">
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden="true">
              <path d="M0 2 H16" stroke={color} strokeWidth="2" />
            </svg>
            Price after
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden="true">
              <path d="M0 2 H16" stroke="rgb(var(--muted))" strokeWidth="1.5" strokeDasharray="4 3" />
            </svg>
            Avg fill
          </span>
        </div>
      </div>
    </Panel>
  );
}
