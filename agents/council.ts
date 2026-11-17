// LLM council for questions with no deterministic feed. Follows the
// self-resolving market idea (Srinivasan, Karger, Chen, arXiv 2306.04305):
// panelists report probabilities in sequence, each seeing earlier reports; a
// seeded random stop picks the reference report; panelists are scored by
// cross-entropy against the reference. We only settle when the reference and
// the panel agree strongly; otherwise we wait, then resolve INVALID.

import { chatJson, fence, INJECTION_RULE, Provider } from "./llm";
import { getText, htmlToText, sha256Hex, canonical } from "./http";
import { isTrustedSource } from "./sources/trusted";
import { searchNews } from "./sources/news";
import { DAY, Evidence, Resolution, nowSec } from "./types";

export interface Panelist {
  name: string;
  provider: Provider;
  lens: string;
}

export const PANEL: Panelist[] = [
  { name: "Atlas", provider: "gemini", lens: "Strict reader of resolution criteria. Ignores vibes, reads the letter of the rules." },
  { name: "Vesta", provider: "harbor", lens: "Source skeptic. Weighs primary and official sources over commentary." },
  { name: "Orion", provider: "groq", lens: "Timeline checker. Verifies that events happened inside the stated window." },
  { name: "Lyra", provider: "gemini", lens: "Devil's advocate. Looks for the strongest case for the opposite outcome." },
  { name: "Kestrel", provider: "harbor", lens: "Base-rate analyst. Asks how such questions usually settle and what is missing." },
];

export async function gatherEvidence(question: string, sources: string[], at = nowSec()): Promise<Evidence[]> {
  const ev: Evidence[] = [];
  for (const url of sources.slice(0, 4)) {
    if (!isTrustedSource(url)) continue;
    try {
      ev.push({ source: new URL(url).hostname, url, fetchedAt: at, excerpt: htmlToText(await getText(url)).slice(0, 3000) });
    } catch {
      // unreachable source is simply absent from the bundle
    }
  }
  for (const n of await searchNews(question.replace(/\?$/, ""), 10)) {
    ev.push({ source: n.source, url: n.link, fetchedAt: at, excerpt: `${new Date(n.pubDate * 1000).toISOString().slice(0, 10)} ${n.title}` });
  }
  return ev;
}

export const evidenceHash = (ev: Evidence[]) => sha256Hex(canonical(ev));

function crossEntropy(p: number, ref: number): number {
  const c = (x: number) => Math.min(Math.max(x, 1e-6), 1 - 1e-6);
  return -(ref * Math.log(c(p)) + (1 - ref) * Math.log(1 - c(p)));
}

/** Stop index in [2, n] derived from a seed (hex). */
export function stopIndex(seedHex: string, n: number): number {
  return 2 + (parseInt(seedHex.slice(0, 8), 16) % (n - 1));
}

export async function runCouncil(opts: {
  marketKey: string;
  question: string;
  rules: string[];
  criteria: string;
  closeTime: number;
  sources: string[];
}): Promise<Resolution & { scores: { agent: string; loss: number }[]; seed: string }> {
  const evidence = await gatherEvidence(opts.question, opts.sources);
  const evHash = await evidenceHash(evidence);
  const seed = await sha256Hex(`${opts.marketKey}:${evHash}`);
  const stop = stopIndex(seed, PANEL.length);
  const bundle = evidence.map((e, i) => fence(`${i + 1} ${e.source} ${e.url}`, e.excerpt, 1500)).join("\n");

  const panel: NonNullable<Resolution["panel"]> = [];
  for (const p of PANEL.slice(0, stop)) {
    const prior = panel.map((r) => `${r.agent}: P(YES)=${r.probability.toFixed(3)}`).join("\n") || "none";
    try {
      const r = await chatJson<{ probability: number; reasoning: string }>({
        role: "council",
        providers: [p.provider, "gemini", "groq", "harbor"],
        system: `You are ${p.name}, a resolver on a prediction market council. ${p.lens}
You report the probability that the market resolved YES given the evidence. Today is ${new Date().toISOString().slice(0, 10)}.
The market closed at ${new Date(opts.closeTime * 1000).toISOString()}. Only events up to the close and its resolution window count.
If the evidence does not establish the outcome, report a probability near 0.5. Never use memory alone for facts after your training data.
${INJECTION_RULE}
Answer as JSON: {"probability": number between 0 and 1, "reasoning": "two to four sentences citing evidence numbers"}`,
        user: `${fence("question", opts.question, 400)}
${fence("rules", opts.rules.map((r) => `- ${r}`).join("\n"), 2000)}
${fence("criteria", opts.criteria, 800)}
Earlier council reports:
${prior}
Evidence:
${bundle || "(no evidence found)"}`,
      });
      const prob = Math.min(1, Math.max(0, Number(r.data.probability)));
      if (Number.isFinite(prob)) panel.push({ agent: p.name, model: `${r.provider}/${r.model}`, probability: prob, reasoning: String(r.data.reasoning ?? "").slice(0, 800) });
    } catch {
      // a panelist that cannot answer is skipped; the stop index still applies
    }
  }

  const ref = panel[panel.length - 1];
  const scores = panel.map((r) => ({ agent: r.agent, loss: ref ? crossEntropy(r.probability, ref.probability) : 0 }));
  const late = nowSec() > opts.closeTime + 7 * DAY;
  const base = { method: "council", evidence, panel, scores, seed };
  if (!ref || panel.length < 2) {
    return { ...base, verdict: late ? "invalid" : "pending", confidence: late ? 0.8 : 0, reasoning: "Council could not form a quorum" };
  }
  const agreeYes = panel.filter((r) => r.probability >= 0.8).length / panel.length;
  const agreeNo = panel.filter((r) => r.probability <= 0.2).length / panel.length;
  if (ref.probability >= 0.9 && agreeYes >= 0.66) {
    return { ...base, verdict: "yes", confidence: Math.min(ref.probability, 0.97), reasoning: ref.reasoning };
  }
  if (ref.probability <= 0.1 && agreeNo >= 0.66) {
    return { ...base, verdict: "no", confidence: Math.min(1 - ref.probability, 0.97), reasoning: ref.reasoning };
  }
  return {
    ...base,
    verdict: late ? "invalid" : "pending",
    confidence: late ? 0.8 : 0,
    reasoning: late ? "Council did not reach agreement within 7 days of close" : `Reference ${ref.agent} at ${ref.probability.toFixed(2)}; waiting for clearer evidence`,
  };
}
