"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { seeded } from "@/lib/utils";

const PETAL_COUNT = 12;
const PETAL_IMAGES = [1, 2, 3, 4].map((n) => `/art/petals/petal-${n}.webp`);

/** Deterministic layout so server and client render the same petals. */
const PETALS = (() => {
  const rand = seeded(20251117);
  return Array.from({ length: PETAL_COUNT }, (_, i) => {
    const duration = 14 + rand() * 12;
    return {
      x: `${Math.round(rand() * 96)}%`,
      size: `${Math.round(8 + rand() * 12)}px`,
      duration: `${duration.toFixed(1)}s`,
      sway: `${(2.6 + rand() * 2.4).toFixed(1)}s`,
      // Negative delays put petals mid-fall on first paint.
      delay: `${(-rand() * duration).toFixed(1)}s`,
      drift: `${Math.round((rand() - 0.5) * 220)}px`,
      // Drawn over the panels now, so kept light enough that text under a petal stays readable.
      opacity: (0.5 + rand() * 0.3).toFixed(2),
      img: PETAL_IMAGES[i % PETAL_IMAGES.length] ?? "",
    };
  });
})();

/**
 * Fixed app background (blurred scene under a plum veil) plus falling petals in their own overlay above the page.
* Petals use the WebP renders once they load, CSS leaves before that. Hidden under reduced motion (app.css).
 */
export function AppBackdrop() {
  const [art, setArt] = useState<"css" | "png">("css");
  const [hidden, setHidden] = useState(false);

  // Hidden tab: pause the 24 petal animations outright instead of trusting every browser to throttle them.
  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    const probe = new Image();
    probe.onload = () => setArt("png");
    probe.src = PETAL_IMAGES[0] ?? "";
    return () => {
      probe.onload = null;
    };
  }, []);

  return (
    <>
      <div aria-hidden="true" className="app-backdrop">
        <div className="app-backdrop__art" />
        <div className="app-backdrop__veil" />
      </div>
      {/* Own fixed layer above page content and panels, below the header, menus, bet bar, toasts and wallet modal (app.css). */}
      <div aria-hidden="true" className="petal-field petal-overlay" data-art={art} data-paused={hidden || undefined}>
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
    </>
  );
}
