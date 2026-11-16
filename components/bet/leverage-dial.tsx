"use client";

import { motion, useReducedMotion } from "motion/react";
import { type KeyboardEvent, type PointerEvent, useId, useRef } from "react";

import { useFeedback } from "@/hooks/use-feedback";
import { formatLeverage } from "@/lib/format";
import { clamp, cn } from "@/lib/utils";

export interface LeverageDialProps {
  value: number;
  onChange: (value: number) => void;
  /** Highest leverage currently allowed by the market. */
  cap?: number;
  min?: number;
  max?: number;
  step?: number;
  /** Signal color for the filled arc. */
  tone?: "yes" | "no" | "neutral";
  /** Short reason shown when the cap is below max. */
  capNote?: string;
  /** Compact variant for the landing explainer. */
  size?: "md" | "sm";
  className?: string;
}

const CX = 120;
const CY = 118;
const R = 96;

function angleFor(v: number, min: number, max: number) {
  return Math.PI - ((v - min) / (max - min)) * Math.PI;
}

/** Rounded so server and client render identical SVG attributes. */
function point(angle: number, radius = R) {
  const round = (n: number) => Math.round(n * 100) / 100;
  return { x: round(CX + radius * Math.cos(angle)), y: round(CY - radius * Math.sin(angle)) };
}

function arc(from: number, to: number, radius = R) {
  const a = point(from, radius);
  const b = point(to, radius);
  return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} A${radius} ${radius} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

const TONES = {
  yes: "rgb(var(--yes))",
  no: "rgb(var(--no))",
  neutral: "rgb(var(--marble-50))",
} as const;

/** Semicircular leverage dial. Drag, tap, arrow keys, Page keys, Home and End. */
export function LeverageDial({
  value,
  onChange,
  cap,
  min = 1,
  max = 5,
  step = 0.1,
  tone = "neutral",
  capNote,
  size = "md",
  className,
}: LeverageDialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const labelId = useId();
  const reduce = useReducedMotion();
  const { tick } = useFeedback();
  const limit = clamp(cap ?? max, min, max);

  const commit = (raw: number) => {
    const next = clamp(Math.round(raw / step) * step, min, limit);
    const rounded = Number(next.toFixed(2));
    if (rounded === value) return;
    const crossedWhole = Math.floor(rounded) !== Math.floor(value) || Number.isInteger(rounded);
    const crossedHalf = Math.floor(rounded * 2) !== Math.floor(value * 2);
    if (crossedWhole) tick(true);
    else if (crossedHalf) tick(false);
    onChange(rounded);
  };

  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * 240;
    const py = ((e.clientY - rect.top) / rect.height) * 140;
    let angle = Math.atan2(CY - py, px - CX);
    if (angle < 0) angle = px < CX ? Math.PI : 0;
    commit(min + ((Math.PI - angle) / Math.PI) * (max - min));
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const map: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + 1,
      PageDown: value - 1,
      Home: min,
      End: limit,
    };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    commit(next);
  };

  const valueAngle = angleFor(value, min, max);
  const capAngle = angleFor(limit, min, max);
  const knob = point(valueAngle);
  const color = TONES[tone];
  const ticks = Array.from({ length: Math.round((max - min) / 0.5) + 1 }, (_, i) => min + i * 0.5);

  return (
    <div className={cn("select-none", className)}>
      <span id={labelId} className="sr-only">
        Leverage
      </span>
      <svg
        ref={svgRef}
        viewBox="0 0 240 140"
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={limit}
        aria-valuenow={value}
        aria-valuetext={`${formatLeverage(value)} leverage${limit < max ? `, capped at ${formatLeverage(limit)}` : ""}`}
        className={cn(
          "block w-full cursor-grab touch-none rounded-md outline-offset-4 active:cursor-grabbing",
          size === "sm" ? "max-w-[260px]" : "max-w-[340px]",
          "mx-auto",
        )}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e)}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        onKeyDown={onKeyDown}
      >
        {/* Track */}
        <path d={arc(Math.PI, 0)} fill="none" stroke="rgb(var(--night-700))" strokeWidth="14" />
        {/* Locked region beyond the cap */}
        {limit < max && (
          <path d={arc(capAngle, 0)} fill="none" stroke="rgb(var(--night-800))" strokeWidth="14" />
        )}
        {/* Filled value */}
        <motion.path
          d={arc(Math.PI, valueAngle - 0.0001)}
          fill="none"
          stroke={color}
          strokeWidth="14"
          initial={false}
          animate={{ d: arc(Math.PI, valueAngle - 0.0001) }}
          transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.25 }}
        />
        {/* Ticks */}
        {ticks.map((t) => {
          const a = angleFor(t, min, max);
          const whole = Number.isInteger(t);
          const p1 = point(a, R - 12);
          const p2 = point(a, R - (whole ? 20 : 16));
          const label = point(a, R - 32);
          return (
            <g key={t} opacity={t > limit + 1e-9 ? 0.35 : 1}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgb(var(--marble-400))" strokeWidth={whole ? 1.5 : 1} />
              {whole && (
                <text x={label.x} y={label.y + 4} textAnchor="middle" fontSize="11" className="fill-marble-400 font-mono">
                  {t}x
                </text>
              )}
            </g>
          );
        })}
        {/* Cap marker */}
        {limit < max && (
          <line
            x1={point(capAngle, R - 9).x}
            y1={point(capAngle, R - 9).y}
            x2={point(capAngle, R + 11).x}
            y2={point(capAngle, R + 11).y}
            stroke="rgb(var(--gold))"
            strokeWidth="2"
          />
        )}
        {/* Knob */}
        <motion.rect
          width="16"
          height="16"
          rx="2"
          fill="rgb(var(--marble-50))"
          stroke="rgb(var(--night-950))"
          strokeWidth="3"
          initial={false}
          animate={{ x: knob.x - 8, y: knob.y - 8, rotate: 45 - (valueAngle * 180) / Math.PI }}
          transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.25 }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
        {/* Readout */}
        <text x={CX} y={CY - 8} textAnchor="middle" className="num fill-marble-50" fontSize={size === "sm" ? 34 : 38}>
          {formatLeverage(value)}
        </text>
      </svg>
      {limit < max && capNote && (
        <p className="mt-2 text-center font-mono text-[0.6875rem] text-gold">
          Max {formatLeverage(limit)} now. {capNote}
        </p>
      )}
    </div>
  );
}
