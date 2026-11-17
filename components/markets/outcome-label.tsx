import type { Market } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Status text for markets that no longer trade. Color carries the state, no dots. */
export function OutcomeLabel({ market, className }: { market: Pick<Market, "state" | "outcome">; className?: string }) {
  const base = cn("text-xs font-semibold", className);
  if (market.state === "resolved") {
    const o = market.outcome ?? "invalid";
    return (
      <span className={cn(base, o === "yes" ? "text-up" : o === "no" ? "text-down" : "text-acc")}>
        Resolved {o === "invalid" ? "invalid" : o.toUpperCase()}
      </span>
    );
  }
  if (market.state === "proposed") return <span className={cn(base, "text-acc")}>Proposed, dispute window</span>;
  if (market.state === "disputed") return <span className={cn(base, "text-acc")}>Disputed</span>;
  if (market.state === "closed") return <span className={cn(base, "text-muted")}>Awaiting oracle</span>;
  return <span className={cn(base, "text-online")}>Open</span>;
}
