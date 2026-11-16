export type Category = "crypto" | "macro" | "sports" | "esports" | "politics" | "world" | "tech" | "culture";

export const CATEGORY_INDEX: Record<Category, number> = {
  crypto: 0, macro: 1, sports: 2, esports: 3, politics: 4, world: 5, tech: 6, culture: 7,
};

/** How a market settles. Everything except `council` is deterministic. */
export type ResolutionSpec =
  | { kind: "price"; coin: string; symbol: string; op: "above" | "below"; threshold: number; at: number }
  | { kind: "espn"; sport: string; league: string; eventId: string; teamId: string; teamName: string }
  | { kind: "polymarket"; id: string; slug: string; yesIndex: number }
  | { kind: "github_stars"; repo: string; threshold: number; at: number }
  | { kind: "council"; criteria: string; sources: string[] };

export interface Candidate {
  question: string;
  summary: string;
  category: Category;
  /** Unix seconds. Trading stops here. */
  closeTime: number;
  /** Starting YES probability. */
  priceYes: number;
  rules: string[];
  resolution: ResolutionSpec;
  sourceName: string;
  sourceUrl: string;
  /** Stable key so the same question is never opened twice. */
  dedupeKey: string;
  tags?: string[];
}

export interface Evidence {
  source: string;
  url: string;
  fetchedAt: number;
  excerpt: string;
}

export type Verdict = "yes" | "no" | "invalid" | "pending";

export interface Resolution {
  verdict: Verdict;
  confidence: number;
  method: string;
  reasoning: string;
  evidence: Evidence[];
  /** Panel transcript for council resolutions. */
  panel?: { agent: string; model: string; probability: number; reasoning: string }[];
}

export const HOUR = 3600;
export const DAY = 86_400;
export const nowSec = () => Math.floor(Date.now() / 1000);
