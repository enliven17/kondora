"use client";

import {
  AreaSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  LastPriceAnimationMode,
  LineType,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

import { Panel } from "@/components/ui/panel";
import { formatCents, formatDateTime, formatSignedPts, formatUsdCompact } from "@/lib/format";
import { subscribePrice } from "@/lib/live";
import type { PricePoint, Side } from "@/lib/types";
import { cn } from "@/lib/utils";

type Range = "1h" | "6h" | "1d" | "1w" | "all";
const RANGES: Array<{ value: Range; label: string; secs: number }> = [
  { value: "1h", label: "1H", secs: 3_600 },
  { value: "6h", label: "6H", secs: 6 * 3_600 },
  { value: "1d", label: "1D", secs: 86_400 },
  { value: "1w", label: "1W", secs: 7 * 86_400 },
  { value: "all", label: "All", secs: Number.POSITIVE_INFINITY },
];

const centsFormatter = (p: number) => `${(p * 100).toFixed(1)}¢`;

/** Canvas needs concrete colors: read the RGB channel tokens from :root. */
function tokenColor(name: string, alpha = 1) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const [r = "255", g = "255", b = "255"] = raw.split(/\s+/);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Hover {
  x: number;
  p: number;
  v: number;
  t: number;
}

function toSide(points: PricePoint[], side: Side) {
  return side === "yes" ? points : points.map((pt) => ({ ...pt, p: 1 - pt.p }));
}

export interface PriceChartProps {
  marketId: string;
  history: PricePoint[];
  /** Subscribe to live ticks (lib/live.ts). Off for settled markets. */
  live?: boolean;
  className?: string;
}

const segment = "h-7 rounded-sm px-2.5 text-xs font-semibold transition-colors";

/** Market price chart: area line, volume bars, crosshair tooltip, ranges, side toggle, live ticks. */
export function PriceChart({ marketId, history, live = true, className }: PriceChartProps) {
  const [range, setRange] = useState<Range>("1d");
  const [side, setSide] = useState<Side>("yes");
  const [ticks, setTicks] = useState<PricePoint[]>([]);
  const [hover, setHover] = useState<Hover | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const [width, setWidth] = useState(0);

  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const area = useRef<ISeriesApi<"Area"> | null>(null);
  const volume = useRef<ISeriesApi<"Histogram"> | null>(null);

  const points = useMemo(() => [...history, ...ticks], [history, ticks]);

  const visible = useMemo(() => {
    const last = points[points.length - 1];
    if (!last) return [];
    const secs = RANGES.find((r) => r.value === range)?.secs ?? Number.POSITIVE_INFINITY;
    const slice = points.filter((pt) => pt.t >= last.t - secs);
    return toSide(slice.length >= 2 ? slice : points.slice(-2), side);
  }, [points, range, side]);

  // Create the chart once.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const c = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: tokenColor("haze"),
        fontFamily: getComputedStyle(document.body).fontFamily,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: tokenColor("line", 0.05) } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.26 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: tokenColor("fg", 0.3), width: 1, style: 0, labelVisible: false },
        horzLine: { color: tokenColor("fg", 0.18), width: 1, style: 2, labelBackgroundColor: tokenColor("plum") },
      },
      handleScroll: { vertTouchDrag: false, horzTouchDrag: true, mouseWheel: false, pressedMouseMove: true },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: false },
      localization: { priceFormatter: centsFormatter },
    });
    const a = c.addSeries(AreaSeries, {
      lineWidth: 2,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastValueVisible: true,
      lastPriceAnimation: LastPriceAnimationMode.Disabled,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: tokenColor("panel"),
      priceFormat: { type: "custom", formatter: centsFormatter, minMove: 0.001 },
    });
    const v = c.addSeries(HistogramSeries, {
      priceScaleId: "",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    v.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const onMove = (param: MouseEventParams) => {
      const datum = param.seriesData.get(a) as { value?: number } | undefined;
      const vol = param.seriesData.get(v) as { value?: number } | undefined;
      if (!param.point || param.time === undefined || datum?.value === undefined) {
        setHover(null);
        return;
      }
      setHover({ x: param.point.x, p: datum.value, v: vol?.value ?? 0, t: Number(param.time) });
    };
    c.subscribeCrosshairMove(onMove);

    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);

    chart.current = c;
    area.current = a;
    volume.current = v;
    return () => {
      ro.disconnect();
      c.unsubscribeCrosshairMove(onMove);
      c.remove();
      chart.current = null;
      area.current = null;
      volume.current = null;
    };
  }, []);

  // Push data on range, side or tick changes.
  useEffect(() => {
    const a = area.current;
    const v = volume.current;
    if (!a || !v) return;
    const tone = side === "yes" ? "up" : "down";
    const rising = tokenColor(tone, 0.4);
    const falling = tokenColor(side === "yes" ? "down" : "up", 0.3);
    a.applyOptions({
      lineColor: tokenColor(tone),
      topColor: tokenColor(tone, 0.28),
      bottomColor: tokenColor(tone, 0),
      crosshairMarkerBackgroundColor: tokenColor(tone),
    });
    a.setData(visible.map((pt) => ({ time: pt.t as UTCTimestamp, value: pt.p })));
    v.setData(
      visible.map((pt, i) => ({
        time: pt.t as UTCTimestamp,
        value: pt.v,
        color: i > 0 && pt.p < (visible[i - 1]?.p ?? pt.p) ? falling : rising,
      })),
    );
    chart.current?.timeScale().fitContent();
  }, [visible, side]);

  // Live ticks.
  useEffect(() => {
    if (!live) return;
    const last = history[history.length - 1];
    if (!last) return;
    let timer = 0;
    let prevP = last.p;
    const stop = subscribePrice(marketId, last, (tick) => {
      setFlash(tick.p >= prevP ? "up" : "down");
      prevP = tick.p;
      setTicks((prev) => [...prev.slice(-500), tick]);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setFlash(null), 700);
    });
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, [marketId, history, live]);

  const first = visible[0];
  const last = visible[visible.length - 1];
  const change = first && last ? last.p - first.p : 0;
  const up = change >= 0;
  const rangeVolume = visible.reduce((sum, pt) => sum + pt.v, 0);

  return (
    <Panel as="section" aria-label="Price chart" className={cn("p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-muted">{side === "yes" ? "Yes" : "No"} price</span>
            {live && <span className="font-semibold text-online">Live</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              aria-live="polite"
              className={cn(
                "num text-4xl leading-none transition-colors duration-500 sm:text-5xl",
                flash === "up" ? "text-up" : flash === "down" ? "text-down" : "text-fg",
              )}
            >
              {last ? formatCents(last.p) : "..."}
            </span>
            <span className={cn("num text-sm", up ? "text-up" : "text-down")}>{formatSignedPts(change)} pts</span>
            <span className="num text-xs text-haze">Vol {formatUsdCompact(rangeVolume)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Chart side" className="flex rounded bg-panel-deep p-0.5">
            {(["yes", "no"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={side === s}
                onClick={() => setSide(s)}
                className={cn(
                  segment,
                  side === s ? (s === "yes" ? "bg-up text-ink" : "bg-down text-fg") : "text-muted hover:text-fg",
                )}
              >
                {s === "yes" ? "Yes" : "No"}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Chart range" className="flex rounded bg-panel-deep p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={range === r.value}
                onClick={() => setRange(r.value)}
                className={cn(segment, "num", range === r.value ? "bg-fg/10 text-fg" : "text-muted hover:text-fg")}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-4 h-60 sm:h-80">
        <div
          ref={host}
          className="absolute inset-0"
          role="img"
          aria-label={
            first && last
              ? `${side.toUpperCase()} price from ${formatCents(first.p)} to ${formatCents(last.p)} over the selected range.`
              : "Price chart"
          }
        />
        {hover && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-40 rounded-md border border-line/10 bg-panel-deep/95 px-3 py-2 shadow-xl"
            style={{ left: Math.min(Math.max(hover.x + 14, 0), Math.max(width - 172, 0)) }}
          >
            <div className="num text-[11px] text-haze">{formatDateTime(hover.t)}</div>
            <div className="mt-1 flex items-baseline justify-between gap-4">
              <span className={cn("text-xs font-semibold", side === "yes" ? "text-up" : "text-down")}>{side === "yes" ? "Yes" : "No"}</span>
              <span className="num text-base text-fg">{formatCents(hover.p)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-[11px] text-haze">
              <span>Vol</span>
              <span className="num">{formatUsdCompact(hover.v)}</span>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
