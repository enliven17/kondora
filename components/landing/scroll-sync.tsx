"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";

import { onSmoothScroll } from "@/components/ui/smooth-scroll";

gsap.registerPlugin(ScrollTrigger);

/**
 * Landing page only: keeps ScrollTrigger scrubs (hero parallax, statement, reveals) in step with
 * Lenis. GSAP loads on this page alone; the rest of the site scrolls without it.
 */
export function ScrollSync() {
  useEffect(() => {
    gsap.ticker.lagSmoothing(0);
    return onSmoothScroll(ScrollTrigger.update);
  }, []);
  return null;
}
