const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export const formatUsdCompact = (v: number) => usdCompact.format(v);
export const formatUsd = (v: number) => usd.format(v);
export const formatNumber = (v: number) => num.format(v);

/** Probability (0..1) as cents, e.g. 0.624 -> "62¢". */
export function formatCents(p: number) {
  const c = p * 100;
  return `${c < 1 ? c.toFixed(1) : Math.round(c)}¢`;
}

export function formatPct(v: number, signed = false) {
  const s = (v * 100).toFixed(1);
  return signed && v > 0 ? `+${s}%` : `${s}%`;
}

export function formatSignedPts(v: number) {
  const pts = v * 100;
  const s = Math.abs(pts).toFixed(1);
  if (pts > 0.05) return `+${s}`;
  if (pts < -0.05) return `-${s}`;
  return "0.0";
}

export function formatLeverage(lev: number) {
  return `${lev.toFixed(lev % 1 === 0 ? 0 : 1)}x`;
}

/** Compact time left until a unix-seconds deadline. */
export function formatTimeLeft(closeTime: number, now = Date.now() / 1000) {
  const s = Math.max(0, Math.floor(closeTime - now));
  if (s === 0) return "Closed";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDateTime(unix: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(unix * 1000)) + " UTC";
}

export function shortHash(hash: string, size = 4) {
  return hash.length <= size * 2 + 3 ? hash : `${hash.slice(0, size + 2)}...${hash.slice(-size)}`;
}
