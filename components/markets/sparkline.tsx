import type { PricePoint } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Tiny decorative price line. The price itself is always shown as text next to it. */
export function Sparkline({ points, className, up }: { points: PricePoint[]; className?: string; up: boolean }) {
  const recent = points.slice(-96);
  if (recent.length < 2) return null;
  const w = 120;
  const h = 32;
  const ps = recent.map((p) => p.p);
  const min = Math.min(...ps);
  const max = Math.max(...ps);
  const span = Math.max(max - min, 0.02);
  const d = recent
    .map((pt, i) => {
      const x = (i / (recent.length - 1)) * w;
      const y = h - 2 - ((pt.p - min) / span) * (h - 4);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" className={cn("h-8 w-full", className)}>
      <path d={d} fill="none" stroke={up ? "rgb(var(--yes))" : "rgb(var(--no))"} strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
