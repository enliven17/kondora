import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shimmering placeholder block. Size it with className to match the final layout. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton rounded-sm", className)} />;
}

/** Wraps a loading region so assistive tech hears one status message. */
export function LoadingRegion({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
