"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useId, useRef } from "react";

import { WORDMARK_GLYPHS, WORDMARK_HEIGHT, WORDMARK_WIDTH } from "@/components/brand/logo-paths";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STRIPES = 9;
const D = WORDMARK_GLYPHS.join(" ");

/**
 * Giant outlined "kondora": the glyph outline plus stacked copies clipped to the letters,
 * which read as layered stripes. The stack fans out as the footer scrolls into view.
 */
export function FooterWordmark() {
  const ref = useRef<SVGSVGElement>(null);
  const clip = useId().replace(/:/g, "");

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        el.style.setProperty("--spread", "2.4");
        return;
      }
      gsap.fromTo(
        el,
        { "--spread": 0.6 },
        {
          "--spread": 2.6,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom bottom", scrub: 0.6 },
        },
      );
    },
    { scope: ref },
  );

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
