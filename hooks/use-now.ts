"use client";

import { useEffect, useState } from "react";

/** Current unix seconds, refreshed on an interval. Null during SSR and first paint. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now() / 1000);
    update();
    const id = window.setInterval(update, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
