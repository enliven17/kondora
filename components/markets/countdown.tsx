"use client";

import { useNow } from "@/hooks/use-now";
import { formatDateTime } from "@/lib/format";

const pad = (n: number) => String(n).padStart(2, "0");

/** Live countdown to close with seconds. Shows the absolute UTC time until the client clock is known. */
export function Countdown({ closeTime, className }: { closeTime: number; className?: string }) {
  const now = useNow(1_000);
  let text = formatDateTime(closeTime);
  if (now !== null) {
    const s = Math.max(0, Math.floor(closeTime - now));
    const d = Math.floor(s / 86_400);
    const h = Math.floor((s % 86_400) / 3_600);
    const m = Math.floor((s % 3_600) / 60);
    text = s === 0 ? "Closed" : `${d > 0 ? `${d}d ` : ""}${pad(h)}:${pad(m)}:${pad(s % 60)}`;
  }
  return (
    <time dateTime={new Date(closeTime * 1000).toISOString()} title={formatDateTime(closeTime)} className={className}>
      {text}
    </time>
  );
}
