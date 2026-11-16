import { cn, seeded } from "@/lib/utils";

export interface TornEdgeProps {
  /** Which side of the parent the tear sits on. The fill faces inward. */
  position?: "top" | "bottom";
  /** Tailwind text color class; the paper uses currentColor. */
  className?: string;
  seed?: number;
  /** Height of the tear in px. */
  height?: number;
  /** Faint deckle highlight along the tear. */
  deckle?: boolean;
}

function buildPath(seed: number, width: number, height: number) {
  const rand = seeded(seed);
  const points: Array<[number, number]> = [];
  let x = 0;
  while (x < width) {
    const big = rand() < 0.18;
    const y = height * (0.25 + rand() * (big ? 0.75 : 0.4));
    points.push([x, y]);
    x += 6 + rand() * (big ? 26 : 14);
  }
  points.push([width, height * 0.45]);
  const edge = points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  return { edge, fill: `${edge} L${width} ${height} L0 ${height} Z` };
}

/** Deterministic torn-paper edge used for section transitions. Decorative. */
export function TornEdge({ position = "bottom", className, seed = 7, height = 28, deckle = true }: TornEdgeProps) {
  const width = 1440;
  const { edge, fill } = buildPath(seed, width, height);
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-torn={position}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 block w-full",
        position === "bottom" ? "bottom-[-1px]" : "top-[-1px]",
        className,
      )}
      style={{ height }}
    >
      <g transform={position === "top" ? `matrix(1 0 0 -1 0 ${height})` : undefined}>
        <path d={fill} fill="currentColor" />
        {deckle && <path d={edge} fill="none" stroke="rgb(var(--gold) / 0.35)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </g>
    </svg>
  );
}
