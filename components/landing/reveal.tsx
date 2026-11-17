"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ReactNode, useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Fade and lift children marked `data-reveal` as they enter the viewport.
 * Content renders visible on the server; GSAP only animates when motion is allowed.
 */
export function Reveal({ children, className, stagger = 0.08 }: { children: ReactNode; className?: string; stagger?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", ref.current);
      const targets = items.length ? items : [ref.current];
      gsap.from(targets, {
        y: 28,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger,
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
