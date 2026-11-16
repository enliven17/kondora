"use client";

import { animate, useInView, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

export interface CountUpProps {
  value: number;
  format: (value: number) => string;
  /** Start value. Defaults to `value` (only later changes animate). */
  from?: number;
  /** Wait until the number scrolls into view before counting. */
  startOnView?: boolean;
  /** Seconds. */
  duration?: number;
  className?: string;
}

/**
 * Animates a number toward `value`, writing straight to the DOM (no re-render per frame).
 * Screen readers get the final value through aria-live on the parent, not every frame.
 */
export function CountUp({ value, format, from, startOnView = false, duration = 0.6, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const initial = from ?? value;
  const mv = useMotionValue(initial);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const formatRef = useRef(format);

  useEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const unsubscribe = mv.on("change", (v) => {
      if (ref.current) ref.current.textContent = formatRef.current(v);
    });
    return unsubscribe;
  }, [mv]);

  useEffect(() => {
    if (startOnView && !inView) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: [0.23, 1, 0.32, 1] });
    return () => controls.stop();
  }, [value, duration, reduce, mv, startOnView, inView]);

  return (
    <span ref={ref} className={className}>
      {format(initial)}
    </span>
  );
}
