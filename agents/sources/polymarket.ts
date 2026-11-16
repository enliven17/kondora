// Mirrors liquid, settleable Polymarket questions. Settles from the UMA result
// Polymarket publishes. Covers macro, politics, world, tech, culture, esports.

import { getJson } from "../http";
import { Candidate, Category, DAY, HOUR, Resolution, ResolutionSpec, nowSec } from "../types";

interface GammaMarket {
  id: string;
  slug: string;
  question: string;
  description?: string;
  endDate?: string;
  outcomes?: string;
  outcomePrices?: string;
  liquidityNum?: number;
  volume24hr?: number;
  closed?: boolean;
  active?: boolean;
  umaResolutionStatus?: string;
  category?: string;
  events?: { slug?: string; title?: string; tags?: { slug?: string; label?: string }[] }[];
}

const GAMMA = "https://gamma-api.polymarket.com";

const KEYWORDS: [Category, RegExp][] = [
  ["esports", /\b(cs2|counter-strike|valorant|league of legends|lol worlds|dota|esports|iem|blast|vct|lck|lec)\b/i],
  ["crypto", /\b(bitcoin|btc|ethereum|eth|solana|sol|xrp|doge|crypto|token|stablecoin|etf flows?|memecoin|airdrop|fdv)\b/i],
  ["macro", /\b(fed|fomc|interest rate|rate cut|rate hike|cpi|inflation|gdp|recession|unemployment|jobs report|nonfarm|treasury|yield|s&p|nasdaq|dow|oil|gold|tariff|ecb|boe)\b/i],
  ["politics", /\b(election|president|senate|congress|house|governor|prime minister|parliament|vote|poll|nominee|primary|cabinet|impeach|trump|biden|democrat|republican|party)\b/i],
  ["world", /\b(war|ceasefire|ukraine|russia|israel|gaza|iran|china|taiwan|nato|un |summit|sanction|earthquake|hurricane|military|treaty|pope)\b/i],
  ["tech", /\b(ai|openai|gpt|gemini|claude|anthropic|apple|google|microsoft|nvidia|tesla|spacex|launch|iphone|model|chip|starship|meta|x\.com|twitter)\b/i],
  ["sports", /\b(nba|nfl|nhl|mlb|ufc|f1|formula 1|grand prix|premier league|champions league|super bowl|world cup|tennis|open|match|game \d|win the)\b/i],
  ["culture", /\b(movie|film|box office|album|song|spotify|billboard|grammy|oscar|emmy|netflix|youtube|tiktok|celebrity|taylor swift|mrbeast|album|tv|show|award)\b/i],
];

export function categorize(text: string, tags: string[] = []): Category {
  const hay = `${text} ${tags.join(" ")}`;
  for (const [cat, re] of KEYWORDS) if (re.test(hay)) return cat;
  return "world";
}

const parseArr = (s?: string): string[] => {
  try {
    return s ? (JSON.parse(s) as string[]) : [];
  } catch {
    return [];
  }
};

export async function polymarketCandidates(maxDays = 40, limit = 400): Promise<Candidate[]> {
  const now = nowSec();
  const min = new Date((now + 6 * HOUR) * 1000).toISOString();
  const max = new Date((now + maxDays * DAY) * 1000).toISOString();
  const markets = await getJson<GammaMarket[]>(
    `${GAMMA}/markets?active=true&closed=false&limit=${limit}&order=volume24hr&ascending=false&end_date_min=${min}&end_date_max=${max}`,
    20_000,
  );
  const out: Candidate[] = [];
  for (const m of markets) {
    const outcomes = parseArr(m.outcomes);
    const prices = parseArr(m.outcomePrices).map(Number);
    if (outcomes.length !== 2) continue;
    const yesIndex = outcomes.findIndex((o) => o.toLowerCase() === "yes");
    if (yesIndex < 0) continue;
    const p = prices[yesIndex];
    if (!(p >= 0.06 && p <= 0.94)) continue;
    if ((m.liquidityNum ?? 0) < 5_000) continue;
    const end = Math.floor(Date.parse(m.endDate ?? "") / 1000);
    if (!end) continue;
    const tags = (m.events?.[0]?.tags ?? []).map((t) => t.label ?? t.slug ?? "").filter(Boolean);
    const spec: ResolutionSpec = { kind: "polymarket", id: m.id, slug: m.slug, yesIndex };
    const desc = (m.description ?? "").replace(/\s+/g, " ").trim();
    out.push({
      question: m.question.trim(),
      summary: desc.slice(0, 180),
      category: categorize(m.question, tags),
      closeTime: end,
      priceYes: p,
      rules: [
        desc.slice(0, 600) || "Resolves per the stated question.",
        "Kondora settles to the same outcome as the matching Polymarket market once its UMA resolution is final.",
        "If that market is voided, split or not resolved within 14 days of close, Kondora resolves INVALID and pays the final mark.",
      ],
      resolution: spec,
      sourceName: "Polymarket (UMA)",
      sourceUrl: `https://polymarket.com/event/${m.events?.[0]?.slug ?? m.slug}`,
      dedupeKey: `pm:${m.id}`,
      tags,
    });
  }
  return out;
}

export async function resolvePolymarket(spec: Extract<ResolutionSpec, { kind: "polymarket" }>, closeTime: number): Promise<Resolution> {
  const now = nowSec();
  const url = `${GAMMA}/markets/${spec.id}`;
  const m = await getJson<GammaMarket>(url);
  const prices = parseArr(m.outcomePrices).map(Number);
  const evidence = [{ source: "Polymarket Gamma", url, fetchedAt: now, excerpt: JSON.stringify({ closed: m.closed, uma: m.umaResolutionStatus, prices }) }];
  const final = m.closed && /resolved/i.test(m.umaResolutionStatus ?? "resolved");
  const pYes = prices[spec.yesIndex];
  if (final && (pYes === 1 || pYes === 0)) {
    return { verdict: pYes === 1 ? "yes" : "no", confidence: 0.99, method: "polymarket", reasoning: `Polymarket resolved ${pYes === 1 ? "Yes" : "No"}`, evidence };
  }
  if (final && pYes > 0 && pYes < 1) {
    return { verdict: "invalid", confidence: 0.95, method: "polymarket", reasoning: `Polymarket settled at ${pYes} (split or void)`, evidence };
  }
  if (now > closeTime + 14 * DAY) {
    return { verdict: "invalid", confidence: 0.9, method: "polymarket", reasoning: "Not resolved within 14 days of close", evidence };
  }
  return { verdict: "pending", confidence: 0, method: "polymarket", reasoning: "Waiting for UMA resolution", evidence };
}
