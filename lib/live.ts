import type { PricePoint } from "./types";

/**
 * Live price feed boundary (client only).
 * Mock: a gentle random walk from the last known price every few seconds.
 * Replace with a Convex subscription (useQuery on the market price) and keep the callback shape.
 */
export function subscribePrice(
  marketId: string,
  last: PricePoint,
  onTick: (point: PricePoint) => void,
  intervalMs = 4_000,
): () => void {
  void marketId;
  let p = last.p;
  const id = window.setInterval(() => {
    const move = (Math.random() - 0.5) * 0.012;
    p = Math.min(0.99, Math.max(0.01, p + move));
    onTick({ t: Math.floor(Date.now() / 1000), p, v: Math.round(Math.random() * 400 * 100) / 100 });
  }, intervalMs);
  return () => window.clearInterval(id);
}
