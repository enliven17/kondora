"use client";

import "./splash.css";

import { useEffect, useState } from "react";

import { MARK_BOTTOM, MARK_TOP, WORDMARK_GLYPHS, WORDMARK_HEIGHT, WORDMARK_WIDTH } from "@/components/brand/logo-paths";

const STORAGE_KEY = "kondora:splash";

/** Inline, runs before paint. Marks the splash as seen so CSS hides it without a flash. */
export const SPLASH_GATE_SCRIPT = `try{if(sessionStorage.getItem("${STORAGE_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.dataset.splash="seen"}}catch(e){}`;

/**
 * The two halves of the mark meet as one coin, then part again; the wordmark fades in.
 * Once per session, under 1.2s, any click or key skips it.
 */
export function Splash() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* storage blocked: the splash shows once per page load */
    }
    if (document.documentElement.dataset.splash === "seen") {
      const frame = requestAnimationFrame(() => setDone(true));
      return () => cancelAnimationFrame(frame);
    }
    const skip = () => setDone(true);
    window.addEventListener("keydown", skip, { once: true });
    return () => window.removeEventListener("keydown", skip);
  }, []);

  if (done) return null;

  return (
    <div
      data-splash-root
      className="splash fixed inset-0 z-[200] grid place-items-center bg-plum"
      onClick={() => setDone(true)}
      onAnimationEnd={(e) => e.target === e.currentTarget && setDone(true)}
      role="presentation"
    >
      <div className="flex flex-col items-center gap-5 text-paper">
        <svg viewBox="0 0 64 64" className="size-20 overflow-visible" fill="currentColor" aria-hidden>
          <path className="splash-top" d={MARK_TOP} />
          <path className="splash-bottom" d={MARK_BOTTOM} />
        </svg>
        <svg viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`} className="splash-word h-7 w-auto" fill="currentColor" role="img" aria-label="Kondora">
          <path d={WORDMARK_GLYPHS.join(" ")} />
        </svg>
      </div>
    </div>
  );
}
