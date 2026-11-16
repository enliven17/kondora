// Oracle: deterministic sources first, council last.

import { runCouncil } from "./council";
import { resolvePrice } from "./sources/crypto";
import { resolveEspn } from "./sources/sports";
import { resolvePolymarket } from "./sources/polymarket";
import { resolvePandascore } from "./sources/esports";
import { Resolution, ResolutionSpec } from "./types";

export interface OracleInput {
  marketKey: string;
  question: string;
  rules: string[];
  closeTime: number;
  resolution: ResolutionSpec;
}

export type OracleResult = Resolution & { scores?: { agent: string; loss: number }[]; seed?: string };

export async function resolveMarket(m: OracleInput): Promise<OracleResult> {
  const spec = m.resolution;
  switch (spec.kind) {
    case "price":
      return resolvePrice(spec);
    case "espn":
      return resolveEspn(spec, m.closeTime);
    case "polymarket":
      return resolvePolymarket(spec, m.closeTime);
    case "github_stars":
      return { verdict: "invalid", confidence: 0.9, method: "github", reasoning: "Unsupported source", evidence: [] };
    case "council": {
      const ps = await resolvePandascore(spec.criteria, m.closeTime);
      if (ps) return ps;
      return runCouncil({ marketKey: m.marketKey, question: m.question, rules: m.rules, criteria: spec.criteria, closeTime: m.closeTime, sources: spec.sources });
    }
  }
}

/** Confidence needed before the oracle proposes on-chain. */
export const PROPOSE_CONFIDENCE = 0.85;
