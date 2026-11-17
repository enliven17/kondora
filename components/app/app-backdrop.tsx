"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { seeded } from "@/lib/utils";

const PETAL_COUNT = 12;
const PETAL_IMAGES = [1, 2, 3, 4].map((n) => `/art/petals/petal-${n}.png`);

/** Deterministic layout so server and client render the same petals. */
const PETALS = (() => {
  const rand = seeded(20251117);
  return Array.from({ length: PETAL_COUNT }, (_, i) => {
    const duration = 14 + rand() * 12;
    return {
      x: `${Math.round(rand() * 96)}%`,
      size: `${Math.round(10 + rand() * 16)}px`,
      duration: `${duration.toFixed(1)}s`,
      sway: `${(2.6 + rand() * 2.4).toFixed(1)}s`,
      // Negative delays put petals mid-fall on first paint.
      delay: `${(-rand() * duration).toFixed(1)}s`,
      drift: `${Math.round((rand() - 0.5) * 220)}px`,
      opacity: (0.45 + rand() * 0.45).toFixed(2),
      img: PETAL_IMAGES[i % PETAL_IMAGES.length] ?? "",
    };
  });
})();

/**
 * Fixed app background: the blurred scene under a plum veil, and falling petals.
 * Petals use the PNG renders once they load, CSS leaves before that. Hidden under reduced motion (app.css).
 */
export function AppBackdrop() {
  const [art, setArt] = useState<"css" | "png">("css");

  useEffect(() => {
    const probe = new Image();
    probe.onload = () => setArt("png");
    probe.src = PETAL_IMAGES[0] ?? "";
    return () => {
      probe.onload = null;
    };
  }, []);

  return (
    <div aria-hidden="true" className="app-backdrop">
      <div className="app-backdrop__art" />
      <div className="app-backdrop__veil" />
      <div className="petal-field absolute inset-0" data-art={art}>
        {PETALS.map((p, i) => (
          <span
            key={i}
            className="petal"
            style={
              {
                "--x": p.x,
                "--s": p.size,
                "--d": p.duration,
                "--sway": p.sway,
                "--delay": p.delay,
                "--drift": p.drift,
                "--o": p.opacity,
                "--img": `url("${p.img}")`,
              } as CSSProperties
            }
          >
            <span />
          </span>
        ))}
      </div>
    </div>
  );
}
