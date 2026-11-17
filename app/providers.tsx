"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Motion settings for the trees that animate with motion (landing tabs and FAQ, the trading app).
 * Not in the root layout: docs, stats, agents and brand ship no motion at all. Route fades are
 * CSS (app/template.tsx), Convex and the wallet live in components/app/app-providers.tsx.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  // "user": transform and layout animations are skipped under prefers-reduced-motion.
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
