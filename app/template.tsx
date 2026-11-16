"use client";

import { motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

/**
 * Route transition: fade and lift on client navigations (transform clears at rest, so fixed and sticky children behave).
 * The very first render (SSR and hydration) is static so content is never hidden before JS.
 * Under prefers-reduced-motion, MotionConfig keeps only the fade.
 */
let hasNavigated = false;

export default function Template({ children }: { children: ReactNode }) {
  const [animateIn] = useState(() => hasNavigated);

  useEffect(() => {
    hasNavigated = true;
  }, []);

  return (
    <motion.div
      initial={animateIn ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
