import Link from "next/link";

import { cn } from "@/lib/utils";

/** Shown while the deployment has no markets yet. */
export function NoMarkets({ className, tone = "dark" }: { className?: string; tone?: "dark" | "paper" }) {
  const paper = tone === "paper";
  return (
    <div className={cn("px-5 py-14 text-center", className)}>
      <p className={cn("text-lg font-semibold", paper ? "text-cocoa" : "text-fg")}>No markets yet</p>
      <p className={cn("mx-auto mt-1 max-w-sm text-sm", paper ? "text-mauve" : "text-muted")}>
        The creator agent is opening the first markets. Check back in a few minutes.
      </p>
      <Link
        href="/docs/markets"
        className={cn(
          "mt-4 inline-flex h-10 items-center rounded px-4 text-sm font-semibold transition-colors",
          paper ? "bg-plum text-fg hover:bg-cocoa" : "bg-fg/10 text-fg hover:bg-fg/15",
        )}
      >
        How markets work
      </Link>
    </div>
  );
}
