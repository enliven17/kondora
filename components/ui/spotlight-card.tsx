"use client";

/* Adapted from the CankatUI registry (spotlight-card). */

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";

export interface SpotlightCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** The content rendered inside the card. */
  children: ReactNode;
  /** Additional CSS classes for the card. */
  className?: string;
  /**
   * The color of the spotlight glow. Accepts any CSS color value. The default
   * follows the theme so the glow stays visible on light and dark surfaces.
   * @default "rgb(var(--marble-50) / 0.07)"
   */
  spotlightColor?: string;
  /**
   * The radius of the spotlight in pixels.
   * @default 350
   */
  spotlightSize?: number;
  /**
   * Disables the spotlight effect.
   * @default false
   */
  disabled?: boolean;
}

export default function SpotlightCard({
  children,
  className,
  spotlightColor = "rgb(var(--marble-50) / 0.07)",
  spotlightSize = 350,
  disabled = false,
  onMouseMove,
  ...props
}: SpotlightCardProps) {
  const shouldReduceMotion = useReducedMotion();
  // Start off-canvas so the first hover doesn't flash the glow at (0,0).
  const mouseX = useMotionValue(-spotlightSize);
  const mouseY = useMotionValue(-spotlightSize);

  const [hasMoved, setHasMoved] = useState(false);
  const [prevDisabled, setPrevDisabled] = useState(disabled);
  if (prevDisabled !== disabled) {
    setPrevDisabled(disabled);
    if (!disabled) {
      mouseX.set(-spotlightSize);
      mouseY.set(-spotlightSize);
      setHasMoved(false);
    }
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
    if (disabled || shouldReduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(event.clientX - rect.left);
    mouseY.set(event.clientY - rect.top);
    if (!hasMoved) setHasMoved(true);
  };

  const background = useMotionTemplate`radial-gradient(${spotlightSize}px circle at ${mouseX}px ${mouseY}px, ${spotlightColor}, transparent 70%)`;

  return (
    <article
      onMouseMove={(event) => {
        handleMouseMove(event);
        onMouseMove?.(event as React.MouseEvent<HTMLDivElement>);
      }}
      className={cn(
        "group relative overflow-hidden rounded-md border border-line bg-night-900",
        className,
      )}
      {...props}
    >
      {/* Always rendered so SSR and client markup match; mousemove is ignored under reduced motion. */}
      {!disabled && (
        <motion.div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-200 ease-out",
            hasMoved && "group-hover:opacity-100",
          )}
          style={{ background }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </article>
  );
}
