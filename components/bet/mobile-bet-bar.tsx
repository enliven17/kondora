"use client";

import { formatCents } from "@/lib/format";
import type { Side } from "@/lib/types";
import { SIDE_EVENT } from "./bet-panel";

/** Sticky bar above the status bar on small screens. Picks a side and scrolls to the bet panel. */
export function MobileBetBar({ yesPrice }: { yesPrice: number }) {
  const choose = (side: Side) => {
    window.dispatchEvent(new CustomEvent<Side>(SIDE_EVENT, { detail: side }));
    document.getElementById("bet")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="fixed inset-x-0 bottom-[var(--app-status-h)] z-30 border-t border-line/10 bg-plum/85 px-3 py-2.5 backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => choose("yes")}
          className="flex h-12 items-center justify-between rounded bg-up px-4 text-sm font-bold text-ink transition-transform active:scale-[0.97]"
        >
          <span>Yes</span>
          <span className="num">{formatCents(yesPrice)}</span>
        </button>
        <button
          type="button"
          onClick={() => choose("no")}
          className="flex h-12 items-center justify-between rounded bg-down px-4 text-sm font-bold text-fg transition-transform active:scale-[0.97]"
        >
          <span>No</span>
          <span className="num">{formatCents(1 - yesPrice)}</span>
        </button>
      </div>
    </div>
  );
}
