"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Page-level scroll choreography for the landing page:
 * torn-paper edges tear open as their section enters (transform only).
 * Renders nothing; skipped under prefers-reduced-motion.
 */
export function ScrollStory() {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray<SVGElement>("main [data-torn]").forEach((edge) => {
        const top = edge.dataset.torn === "top";
        gsap.fromTo(
          edge,
          { scaleY: 3.2, transformOrigin: top ? "50% 0%" : "50% 100%" },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: { trigger: edge, start: "top bottom", end: "top 45%", scrub: 0.5 },
          },
        );
      });
    });
    return () => mm.revert();
  });
  return null;
}
