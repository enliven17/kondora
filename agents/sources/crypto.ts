// Crypto price markets from CoinGecko, settled by two independent price feeds.

import { getJson } from "../http";
import { Candidate, DAY, HOUR, Resolution, ResolutionSpec, nowSec } from "../types";

interface CgCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  market_cap_rank: number;
}

const STABLES = new Set(["usdt", "usdc", "dai", "fdusd", "usde", "tusd", "usds", "pyusd", "usd1", "busd", "susde", "wbtc", "steth", "wsteth", "weth", "weeth", "cbbtc", "wbeth"]);

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 via erf), fine for opening prices. */
function phi(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Lognormal probability that price ends above `k` after `tau` seconds. */
export function probAbove(spot: number, k: number, tau: number, annualVol: number): number {
  const s = annualVol * Math.sqrt(tau / (365 * DAY));
  if (s <= 0) return spot > k ? 0.99 : 0.01;
  return phi((Math.log(spot / k) - (s * s) / 2) / s);
}

/** Rounds to a human threshold: 2 significant-ish steps. */
export function niceThreshold(v: number): number {
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = v / mag >= 5 ? mag / 10 : mag / 20;
  return Math.round(v / step) * step;
}

const fmtUsd = (v: number) =>
  v >= 1000 ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${v.toLocaleString("en-US", { maximumSignificantDigits: 4 })}`;
const fmtDate = (t: number) =>
  new Date(t * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }) + " UTC";

const nextUtcMidnight = (t: number) => Math.ceil((t + 1) / DAY) * DAY;

export async function cryptoCandidates(limit = 18): Promise<Candidate[]> {
  const coins = await getJson<CgCoin[]>(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=60&page=1",
  );
  const now = nowSec();
  const out: Candidate[] = [];
  const picks = coins.filter((c) => !STABLES.has(c.symbol.toLowerCase()) && c.current_price > 0).slice(0, limit);
  for (const c of picks) {
    const sym = c.symbol.toUpperCase();
    const vol = c.market_cap_rank <= 2 ? 0.55 : c.market_cap_rank <= 10 ? 0.75 : 0.95;
    let daily = nextUtcMidnight(now);
    if (daily - now < 3 * HOUR) daily += DAY;
    const weekly = daily + 6 * DAY;
    const horizons: [number, number, string][] = [
      [daily, 0.02, "daily"],
      [weekly, 0.08, "weekly"],
    ];
    for (const [at, move, label] of horizons) {
      // Alternate above/below thresholds on each side of spot.
      for (const dir of [1, -1] as const) {
        const threshold = niceThreshold(c.current_price * (1 + dir * move));
        if (!(threshold > 0)) continue;
        const p = probAbove(c.current_price, threshold, at - now, vol);
        if (p < 0.08 || p > 0.92) continue;
        const spec: ResolutionSpec = { kind: "price", coin: c.id, symbol: sym, op: "above", threshold, at };
        out.push({
          question: `Will ${sym} be above ${fmtUsd(threshold)} on ${fmtDate(at)}?`,
          summary: `${c.name} trades at ${fmtUsd(c.current_price)}. ${label === "daily" ? "Settles at the next daily close." : "One week out."}`,
          category: "crypto",
          closeTime: at - (label === "daily" ? 15 * 60 : HOUR),
          priceYes: Math.min(0.95, Math.max(0.05, p)),
          rules: [
            `Resolves YES if the ${sym}/USD price at ${fmtDate(at)} is strictly above ${fmtUsd(threshold)}.`,
            "Price is read from CoinGecko and cross-checked against the Binance 1 minute candle for the same minute.",
            "If the two sources disagree on the side of the threshold, the market resolves INVALID and pays the final mark.",
          ],
          resolution: spec,
          sourceName: "CoinGecko + Binance",
          sourceUrl: `https://www.coingecko.com/en/coins/${c.id}`,
          dedupeKey: `price:${c.id}:above:${threshold}:${at}`,
          tags: [sym, label],
        });
      }
    }
  }
  return [...new Map(out.map((c) => [c.dedupeKey, c])).values()];
}

async function coingeckoAt(coin: string, at: number): Promise<number | null> {
  const r = await getJson<{ prices: [number, number][] }>(
    `https://api.coingecko.com/api/v3/coins/${coin}/market_chart/range?vs_currency=usd&from=${at - 1800}&to=${at + 1800}`,
  );
  if (!r.prices?.length) return null;
  let best = r.prices[0];
  for (const p of r.prices) if (Math.abs(p[0] / 1000 - at) < Math.abs(best[0] / 1000 - at)) best = p;
  return Math.abs(best[0] / 1000 - at) <= 1800 ? best[1] : null;
}

async function binanceAt(symbol: string, at: number): Promise<number | null> {
  try {
    const k = await getJson<[number, string, string, string, string][]>(
      `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}USDT&interval=1m&startTime=${at * 1000}&limit=1`,
    );
    return k.length ? Number(k[0][1]) : null;
  } catch {
    return null;
  }
}

export async function resolvePrice(spec: Extract<ResolutionSpec, { kind: "price" }>): Promise<Resolution> {
  const now = nowSec();
  if (now < spec.at + 300) return { verdict: "pending", confidence: 0, method: "price", reasoning: "Settlement time not reached", evidence: [] };
  const [cg, bn] = await Promise.all([coingeckoAt(spec.coin, spec.at).catch(() => null), binanceAt(spec.symbol, spec.at)]);
  const evidence = [
    { source: "CoinGecko", url: `https://www.coingecko.com/en/coins/${spec.coin}`, fetchedAt: now, excerpt: `price@${spec.at}=${cg}` },
    { source: "Binance", url: `https://www.binance.com/en/trade/${spec.symbol}_USDT`, fetchedAt: now, excerpt: `open@${spec.at}=${bn}` },
  ];
  const side = (p: number) => (spec.op === "above" ? p > spec.threshold : p < spec.threshold);
  const prices = [cg, bn].filter((p): p is number => p !== null && p > 0);
  if (!prices.length) {
    return now > spec.at + 2 * DAY
      ? { verdict: "invalid", confidence: 0.9, method: "price", reasoning: "No price source available after 48h", evidence }
      : { verdict: "pending", confidence: 0, method: "price", reasoning: "Waiting for price data", evidence };
  }
  const sides = prices.map(side);
  if (sides.every((s) => s === sides[0])) {
    const verdict = sides[0] ? "yes" : "no";
    return {
      verdict,
      confidence: prices.length === 2 ? 0.99 : 0.9,
      method: "price",
      reasoning: `${spec.symbol} at settlement: ${prices.map((p) => p.toFixed(6)).join(" / ")} vs threshold ${spec.threshold}`,
      evidence,
    };
  }
  return { verdict: "invalid", confidence: 0.9, method: "price", reasoning: "Price sources disagree on the side of the threshold", evidence };
}
