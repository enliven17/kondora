"use client";

import { formatCents } from "@/lib/format";
import type { Side } from "@/lib/types";
import { SIDE_EVENT } from "./bet-panel";

/** Sticky bottom bar on small screens. Picks a side and scrolls to the bet panel. */
export function MobileBetBar({ yesPrice }: { yesPrice: number }) {
  const choose = (side: Side) => {
    window.dispatchEvent(new CustomEvent<Side>(SIDE_EVENT, { detail: side }));
    document.getElementById("bet")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-night-950/95 p-3 backdrop-blur-md lg:hidden">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => choose("yes")} className="h-12 rounded-sm bg-yes font-semibold text-night-950">
          Yes {formatCents(yesPrice)}
        </button>
        <button type="button" onClick={() => choose("no")} className="h-12 rounded-sm bg-no font-semibold text-night-950">
          No {formatCents(1 - yesPrice)}
        </button>
      </div>
    </div>
  );
}
