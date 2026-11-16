"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

const TAGS = { div: motion.div, li: motion.li, section: motion.section } as const;

/** Fade-up on first view. Under reduced motion MotionConfig drops the movement and keeps the fade. */
export function Reveal({
  children,
  as = "div",
  delay = 0,
  className,
}: {
  children: ReactNode;
  as?: keyof typeof TAGS;
  delay?: number;
  className?: string;
}) {
  const Tag = TAGS[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.8, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </Tag>
  );
}
