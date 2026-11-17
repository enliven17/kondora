"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * Lenis smooth scroll on its own rAF, so no route pays for GSAP just to scroll.
 * Pages with ScrollTrigger scrubs (the landing page) sync through onSmoothScroll.
 */
let current: Lenis | null = null;
const listeners = new Set<() => void>();

/** Run `fn` on every Lenis scroll frame while smooth scroll is active. Returns an unsubscribe. */
export function onSmoothScroll(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function SmoothScroll() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, anchors: { offset: -64 }, autoRaf: true });
    lenis.on("scroll", () => listeners.forEach((fn) => fn()));
    current = lenis;

    const onMotionChange = () => {
      if (media.matches) lenis.destroy();
    };
    media.addEventListener("change", onMotionChange);

    return () => {
      media.removeEventListener("change", onMotionChange);
      lenis.destroy();
      if (current === lenis) current = null;
    };
  }, []);

  return null;
}
