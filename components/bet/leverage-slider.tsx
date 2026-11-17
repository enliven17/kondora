"use client";

import { type CSSProperties, useId } from "react";

import { useFeedback } from "@/hooks/use-feedback";
import { formatLeverage } from "@/lib/format";
import { clamp, cn } from "@/lib/utils";

export interface LeverageSliderProps {
  value: number;
  onChange: (value: number) => void;
  /** Highest leverage the program allows right now. */
  cap: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Why the cap is below max, shown under the track. */
  note?: string;
}

const THUMB = 22;

/** Position along the track, matching where the native thumb centre lands. */
const at = (pct: number) => `calc(${pct}% + ${(THUMB / 2) * (1 - (2 * pct) / 100)}px)`;

/** Native range input (keyboard, screen reader) with an acc thumb, cap shading and tick labels. */
export function LeverageSlider({ value, onChange, cap, min = 1, max = 5, step = 0.1, disabled = false, note }: LeverageSliderProps) {
  const id = useId();
  const { tick } = useFeedback();
  const limit = clamp(cap, min, max);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const commit = (raw: number) => {
    const next = Number(clamp(Math.round(raw / step) * step, min, limit).toFixed(1));
    if (next === value) return;
    if (Math.floor(next) !== Math.floor(value) || Number.isInteger(next)) tick(true);
    onChange(next);
  };

  const whole = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="app-label">
          Leverage
        </label>
        <span className="num text-2xl leading-none text-fg" aria-hidden="true">
          {formatLeverage(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => commit(Number(e.target.value))}
        aria-valuetext={`${formatLeverage(value)}${limit < max ? `, max ${formatLeverage(limit)} right now` : ""}`}
        className="lev-slider mt-2"
        style={{ "--fill": `${pct(value)}%`, "--cap": `${pct(limit)}%` } as CSSProperties}
      />
      <div className="relative mt-1 h-6" aria-hidden="true">
        {whole.map((w) => (
          <button
            key={w}
            type="button"
            tabIndex={-1}
            disabled={disabled || w > limit + 1e-9}
            onClick={() => commit(w)}
            className={cn(
              "num absolute top-0 -translate-x-1/2 rounded-xs px-1 text-xs transition-colors",
              w > limit + 1e-9 ? "text-haze/40" : value === w ? "text-fg" : "text-muted hover:text-fg",
            )}
            style={{ left: at(pct(w)) }}
          >
            {w}x
          </button>
        ))}
      </div>
      {limit < max && note && (
        <p className="mt-1 text-xs text-acc">
          Max <span className="num">{formatLeverage(limit)}</span> right now. {note}
        </p>
      )}
    </div>
  );
}
