// Auditor: re-derives every proposal without seeing it, on a different model
// provider than the oracle, and challenges only when confident it is wrong.

import { chatJson, fence, INJECTION_RULE } from "./llm";
import { gatherEvidence } from "./council";
import { resolveMarket, OracleInput } from "./oracle";
import { Verdict } from "./types";

export interface AuditResult {
  verdict: Verdict;
  confidence: number;
  agrees: boolean | null;
  challenge: boolean;
  reasoning: string;
  method: string;
}

export const CHALLENGE_CONFIDENCE = 0.9;

export async function auditProposal(m: OracleInput, proposed: Exclude<Verdict, "pending">): Promise<AuditResult> {
  let verdict: Verdict;
  let confidence: number;
  let reasoning: string;
  let method: string;

  if (m.resolution.kind === "council") {
    // Blind single-judge pass on the audit provider order (Token Harbor first).
    const evidence = await gatherEvidence(m.question, m.resolution.sources);
    const r = await chatJson<{ verdict: Verdict; confidence: number; reasoning: string }>({
      role: "audit",
      system: `You audit prediction market resolutions. Decide the outcome yourself from the evidence. Today is ${new Date().toISOString().slice(0, 10)}.
Market closed ${new Date(m.closeTime * 1000).toISOString()}. Use "invalid" only if the rules say so or the event cannot be determined.
Use "pending" if evidence is insufficient. ${INJECTION_RULE}
JSON: {"verdict":"yes"|"no"|"invalid"|"pending","confidence":0..1,"reasoning":"short"}`,
      user: `Question: ${m.question}\nRules:\n${m.rules.map((x) => `- ${x}`).join("\n")}\nCriteria: ${m.resolution.criteria}\nEvidence:\n${evidence
        .map((e, i) => fence(`${i + 1} ${e.source}`, e.excerpt, 1200))
        .join("\n")}`,
    });
    verdict = r.data.verdict;
    confidence = Math.min(1, Math.max(0, Number(r.data.confidence) || 0));
    reasoning = String(r.data.reasoning ?? "").slice(0, 600);
    method = `audit-llm/${r.provider}/${r.model}`;
  } else {
    // Deterministic markets: independent re-fetch of the same feeds.
    const r = await resolveMarket(m);
    verdict = r.verdict;
    confidence = r.confidence;
    reasoning = r.reasoning;
    method = `audit-${r.method}`;
  }

  if (verdict === "pending") return { verdict, confidence, agrees: null, challenge: false, reasoning, method };
  const agrees = verdict === proposed;
  return { verdict, confidence, agrees, challenge: !agrees && confidence >= CHALLENGE_CONFIDENCE, reasoning, method };
}
