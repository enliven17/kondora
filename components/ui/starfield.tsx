"use client";

import { useEffect, useRef } from "react";
import { cn, seeded } from "@/lib/utils";

export interface StarfieldProps {
  className?: string;
  /** Stars per 10,000 px². */
  density?: number;
  seed?: number;
}

/**
 * Canvas starfield with slow twinkle. Static under prefers-reduced-motion,
 * paused while offscreen. Decorative only.
 */
export function Starfield({ className, density = 1.1, seed = 42 }: StarfieldProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars: Array<{ x: number; y: number; r: number; a: number; s: number; o: number }> = [];
    let raf = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rand = seeded(seed);
      const count = Math.floor(((width * height) / 10_000) * density);
      stars = Array.from({ length: count }, () => ({
        x: rand() * width,
        y: rand() * height,
        r: rand() < 0.92 ? 0.4 + rand() * 0.6 : 1 + rand() * 0.7,
        a: 0.25 + rand() * 0.7,
        s: 0.4 + rand() * 1.4,
        o: rand() * Math.PI * 2,
      }));
      draw(0);
    };

    const draw = (time: number) => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        const twinkle = reduce ? 1 : 0.65 + 0.35 * Math.sin(star.o + (time / 1000) * star.s);
        ctx.globalAlpha = star.a * twinkle;
        ctx.fillStyle = "#F3EEE4";
        ctx.fillRect(star.x, star.y, star.r, star.r);
      }
    };

    const loop = (time: number) => {
      if (visible) draw(time);
      raf = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    io.observe(canvas);
    if (!reduce) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [density, seed]);

  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} />;
}
