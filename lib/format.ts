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

const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Whole dollars with grouping, e.g. 58045327 -> "$58,045,327". */
export const formatUsdWhole = (v: number) => usdWhole.format(v);

/** Signed dollars, e.g. "+$52.13" or "-$4.30". */
export function formatUsdSigned(v: number) {
  const s = usd.format(Math.abs(v));
  if (v > 0.004) return `+${s}`;
  if (v < -0.004) return `-${s}`;
  return s;
}

/** Probability as a whole percent, e.g. 0.624 -> "62%". */
export function formatChance(p: number) {
  const c = p * 100;
  if (c > 0 && c < 1) return "<1%";
  if (c < 100 && c > 99) return ">99%";
  return `${Math.round(c)}%`;
}

/** Compact relative time, e.g. "4m", "2h", "3d". */
export function formatTimeAgo(unix: number, now = Date.now() / 1000) {
  const s = Math.max(0, Math.floor(now - unix));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}
