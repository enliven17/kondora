"use client";

import { useEffect, useId, useRef } from "react";

import { WORDMARK_GLYPHS, WORDMARK_HEIGHT, WORDMARK_WIDTH } from "@/components/brand/logo-paths";

const STRIPES = 9;
const D = WORDMARK_GLYPHS.join(" ");
const FROM = 0.6;
const TO = 2.6;
/** Seconds for the spread to settle behind the scroll position (the old GSAP scrub: 0.6). */
const SCRUB = 0.6;

/**
 * Giant outlined "kondora": the glyph outline plus stacked copies clipped to the letters,
 * which read as layered stripes. The stack fans out as the footer scrolls into view.
 */
export function FooterWordmark() {
  const ref = useRef<SVGSVGElement>(null);
  const clip = useId().replace(/:/g, "");

  // Scroll-scrubbed spread without GSAP: the rAF loop only runs while the footer is on screen,
  // and only writes a CSS variable (the stripes move with transform).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--spread", "2.4");
      return;
    }

    let frame = 0;
    let last = 0;
    let value = FROM;
    let written = "";
    const write = () => {
      const next = value.toFixed(3);
      if (next === written) return; // settled: no style recalc while the page sits still
      written = next;
      el.style.setProperty("--spread", next);
    };
    // Progress from the wordmark's top meeting the viewport bottom to its bottom meeting it.
    const target = () => {
      const r = el.getBoundingClientRect();
      const p = r.height > 0 ? (window.innerHeight - r.top) / r.height : 0;
      return FROM + (TO - FROM) * Math.min(1, Math.max(0, p));
    };
    const tick = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1;
      last = now;
      const goal = target();
      value += (goal - value) * Math.min(1, (dt * 4) / SCRUB);
      if (Math.abs(goal - value) < 0.001) value = goal;
      write();
      frame = requestAnimationFrame(tick);
    };

    value = target();
    write();
    const io = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      if (entry?.isIntersecting) frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <svg
      ref={ref}
      viewBox={`-2 -2 ${WORDMARK_WIDTH + 4} ${WORDMARK_HEIGHT + 4}`}
      className="block h-auto w-full text-fg"
      style={{ ["--spread" as string]: 1.6 }}
      aria-hidden
      focusable="false"
    >
      <defs>
        <clipPath id={clip}>
          <path d={D} />
        </clipPath>
      </defs>
      <g fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke">
        <g clipPath={`url(#${clip})`}>
          {Array.from({ length: STRIPES }, (_, i) => (
            <path
              key={i}
              d={D}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeOpacity={0.34 - i * 0.03}
              style={{ transform: `translateY(calc(var(--spread) * ${i + 1}px))` }}
            />
          ))}
        </g>
        <path d={D} strokeWidth={1.2} strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
