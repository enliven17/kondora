"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { KondoraWordmark, MARK_PATH } from "@/components/brand/logo";

const STORAGE_KEY = "kondora:splash";
const DURATION_MS = 2000;

/** Inline, runs before paint. Marks the splash as seen so CSS hides it without a flash. */
export const SPLASH_GATE_SCRIPT = `try{if(sessionStorage.getItem("${STORAGE_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.dataset.splash="seen"}}catch(e){}`;

type Phase = "pending" | "playing" | "done";

export function Splash() {
  const [phase, setPhase] = useState<Phase>("pending");

  const finish = useCallback(() => setPhase("done"), []);

  useEffect(() => {
    const seen = document.documentElement.dataset.splash === "seen";
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* storage blocked: splash simply shows once per page load */
    }
    // Start on the next frame so the first paint matches the server render.
    const frame = window.requestAnimationFrame(() => setPhase(seen ? "done" : "playing"));
    if (seen) return () => window.cancelAnimationFrame(frame);
    const timer = window.setTimeout(finish, DURATION_MS);
    const onKey = () => finish();
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [finish]);

  useEffect(() => {
    if (phase === "done") {
      document.documentElement.style.overflow = "";
      document.documentElement.dataset.splash = "seen";
    }
  }, [phase]);

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          data-splash-root
          key="splash"
          role="dialog"
          aria-modal="true"
          aria-label="Kondora"
          className="fixed inset-0 z-[90] flex cursor-pointer flex-col items-center justify-center bg-night-950"
          onClick={finish}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: [0.4, 0, 1, 1] } }}
        >
          <div className="flex flex-col items-center gap-8">
            <svg viewBox="0 0 64 64" className="h-24 w-24 text-marble-50 sm:h-28 sm:w-28" aria-hidden="true">
              <motion.path
                d={MARK_PATH}
                transform="translate(0 2.5)"
                fillRule="evenodd"
                stroke="currentColor"
                strokeWidth={0.6}
                initial={{ pathLength: 0, fillOpacity: 0 }}
                animate={phase === "playing" ? { pathLength: 1, fillOpacity: 1 } : undefined}
                transition={{
                  pathLength: { duration: 1, ease: [0.65, 0, 0.35, 1] },
                  fillOpacity: { duration: 0.5, delay: 0.85, ease: [0.23, 1, 0.32, 1] },
                }}
                style={{ fill: "currentColor" }}
              />
            </svg>
            <motion.div
              initial={{ opacity: 0, y: 8, letterSpacing: "0.4em" }}
              animate={phase === "playing" ? { opacity: 1, y: 0, letterSpacing: "0em" } : undefined}
              transition={{ duration: 0.8, delay: 0.9, ease: [0.23, 1, 0.32, 1] }}
              className="text-marble-50"
            >
              <KondoraWordmark className="h-4 sm:h-5" title="Kondora" />
            </motion.div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              finish();
            }}
            className="micro absolute bottom-6 right-6 rounded-sm px-3 py-2 hover:text-marble-50"
          >
            Skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
