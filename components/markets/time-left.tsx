"use client";

import { useEffect, useState } from "react";
import { formatDateTime, formatTimeLeft } from "@/lib/format";

/** Live countdown. Renders the absolute UTC time on the server to avoid hydration drift. */
export function TimeLeft({ closeTime, className }: { closeTime: number; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now() / 1000);
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time dateTime={new Date(closeTime * 1000).toISOString()} title={formatDateTime(closeTime)} className={className}>
      {now === null ? formatDateTime(closeTime) : formatTimeLeft(closeTime, now)}
    </time>
  );
}
