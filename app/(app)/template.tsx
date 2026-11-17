"use client";

import { motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

/** Subtle fade between app routes. Static on first render so SSR content is never hidden. */
let hasNavigated = false;

export default function AppTemplate({ children }: { children: ReactNode }) {
  const [animateIn] = useState(() => hasNavigated);

  useEffect(() => {
    hasNavigated = true;
  }, []);

  return (
    <motion.div
      initial={animateIn ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
