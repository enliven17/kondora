// Market creator: collects candidates from every source, filters, lets the
// LLM review wording and categories, writes news-driven questions, and picks a
// category-balanced batch. Users never create markets.

import { chatJson, fence, hasAnyLlm, INJECTION_RULE } from "./llm";
import { cryptoCandidates } from "./sources/crypto";
import { sportsCandidates } from "./sources/sports";
import { polymarketCandidates } from "./sources/polymarket";
import { esportsCandidates } from "./sources/esports";
import { headlines } from "./sources/news";
import { Candidate, Category, DAY, nowSec } from "./types";

export const CATEGORIES: Category[] = ["crypto", "macro", "sports", "esports", "politics", "world", "tech", "culture"];

/** Desired number of open markets per category. Sum is the live market target. */
export const TARGETS: Record<Category, number> = {
  crypto: 20, macro: 10, sports: 22, esports: 8, politics: 12, world: 10, tech: 10, culture: 8,
};

const BANNED = /\b(die|dies|death|dead|killed|assassinat|suicide|shooting|terror attack|murder|overdose|kidnap)\b/i;
const MIN_LIFE = 45 * 60;
const MAX_LIFE = 45 * DAY;

export function acceptable(c: Candidate, now = nowSec()): boolean {
  const life = c.closeTime - now;
  return (
    life >= MIN_LIFE &&
    life <= MAX_LIFE &&
    c.question.length >= 12 &&
    c.question.length <= 200 &&
    c.question.trim().endsWith("?") &&
    !BANNED.test(c.question) &&
    c.priceYes > 0.03 &&
    c.priceYes < 0.97
  );
}

interface Review {
  i: number;
  keep: boolean;
  category: Category;
  summary: string;
  score: number;
  fairYes?: number;
}

async function review(cands: Candidate[]): Promise<Candidate[]> {
  if (!cands.length || !hasAnyLlm("creator")) return cands;
  const out: Candidate[] = [];
  for (let off = 0; off < cands.length; off += 40) {
    const batch = cands.slice(off, off + 40);
    try {
      const r = await chatJson<{ items: Review[] }>({
        role: "creator",
        system: `You curate questions for a YES/NO prediction market. For each item decide:
keep: false if the question is ambiguous, not objectively settleable, offensive, about death or violence against people, or trivial.
category: one of ${CATEGORIES.join(", ")}.
summary: one neutral sentence of context, max 140 characters, no em dashes, no hype words.
score: 0 to 100 for how interesting and clear the market is.
fairYes: your best estimate of the YES probability (0.05 to 0.95), or null if you have no informed view.
${INJECTION_RULE}
JSON: {"items":[{"i":number,"keep":boolean,"category":string,"summary":string,"score":number}]}`,
        user: batch.map((c, i) => `${i}. ${c.question} | source: ${c.sourceName} | ${fence("desc", c.summary, 300)}`).join("\n"),
      });
      for (const it of r.data.items ?? []) {
        const c = batch[it.i];
        if (!c || !it.keep || (it.score ?? 0) < 55) continue;
        // Mirrored markets keep their market price; only priors without a market get the model's view.
        const fair = Number(it.fairYes);
        const usesFair = c.resolution.kind === "espn" && Number.isFinite(fair) && fair >= 0.05 && fair <= 0.95;
        out.push({
          ...c,
          priceYes: usesFair ? (c.priceYes + fair) / 2 : c.priceYes,
          category: CATEGORIES.includes(it.category) ? it.category : c.category,
          summary: (it.summary || c.summary).slice(0, 180),
        });
      }
    } catch {
      out.push(...batch); // reviewer down: keep the deterministic filter result
    }
  }
  return out;
}

interface Generated {
  question: string;
  category: Category;
  closeTime: string;
  priceYes: number;
  criteria: string;
  rules: string[];
  sources: string[];
  summary: string;
}

/** Turns fresh headlines into short-dated questions settled by the council. */
async function newsQuestions(max: number): Promise<Candidate[]> {
  if (max <= 0 || !hasAnyLlm("creator")) return [];
  const items = await headlines();
  if (!items.length) return [];
  const now = nowSec();
  const r = await chatJson<{ markets: Generated[] }>({
    role: "creator",
    temperature: 0.5,
    system: `You write prediction market questions from news headlines. Today is ${new Date().toISOString()}.
Write up to ${max} questions. Each must:
- be a forward-looking YES/NO question that is genuinely uncertain (probability between 0.1 and 0.9),
- settle objectively from public reporting between 1 and 14 days from now, with an explicit deadline in the question,
- name what counts as YES in "criteria" and list 1 to 3 https source URLs to check (official sites or major outlets),
- avoid death, violence against people, health of individuals, or anything defamatory,
- use plain neutral wording, no em dashes.
Categories: ${CATEGORIES.join(", ")}.
${INJECTION_RULE}
JSON: {"markets":[{"question":string,"category":string,"closeTime":"ISO 8601","priceYes":number,"criteria":string,"rules":[string],"sources":[string],"summary":string}]}`,
    user: items.map((h) => fence(h.source, `${h.title} (${h.link})`, 300)).join("\n"),
  });
  const out: Candidate[] = [];
  for (const g of r.data.markets ?? []) {
    const close = Math.floor(Date.parse(g.closeTime) / 1000);
    if (!close || !g.question || !g.criteria) continue;
    const sources = (g.sources ?? []).filter((s) => /^https:\/\//.test(s)).slice(0, 3);
    out.push({
      question: g.question.trim(),
      summary: (g.summary ?? "").slice(0, 180),
      category: CATEGORIES.includes(g.category) ? g.category : "world",
      closeTime: Math.min(close, now + 14 * DAY),
      priceYes: Math.min(0.9, Math.max(0.1, Number(g.priceYes) || 0.5)),
      rules: [...(g.rules ?? []).slice(0, 4), `YES criteria: ${g.criteria}`, "Settled by the Kondora council from public reporting. Unclear outcomes resolve INVALID and pay the final mark."],
      resolution: { kind: "council", criteria: g.criteria, sources },
      sourceName: "Kondora council",
      sourceUrl: sources[0] ?? "https://kondora.xyz/docs/oracle",
      dedupeKey: `news:${g.question.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 120)}`,
    });
  }
  return out;
}

export interface PlanInput {
  existingKeys: Set<string>;
  openByCategory: Partial<Record<Category, number>>;
  maxNew: number;
}

export async function planMarkets({ existingKeys, openByCategory, maxNew }: PlanInput): Promise<Candidate[]> {
  const need = (c: Category) => Math.max(0, TARGETS[c] - (openByCategory[c] ?? 0));
  const settled = await Promise.allSettled([
    cryptoCandidates(),
    sportsCandidates(),
    polymarketCandidates(),
    esportsCandidates(),
  ]);
  const deterministic: Candidate[] = [];
  const mirrored: Candidate[] = [];
  settled.forEach((s, i) => {
    if (s.status !== "fulfilled") return;
    (i === 2 ? mirrored : deterministic).push(...s.value);
  });

  const now = nowSec();
  const fresh = (c: Candidate) => !existingKeys.has(c.dedupeKey) && acceptable(c, now);
  const sportsPool = deterministic.filter((c) => c.resolution.kind === "espn" && fresh(c));
  const reviewed = await review([...mirrored.filter(fresh).slice(0, 120), ...sportsPool.slice(0, 60)]);
  const reviewedKeys = new Set(reviewed.map((c) => c.dedupeKey));
  const newsNeed = need("politics") + need("world") + need("tech") + need("culture") + need("macro");
  const generated = (await newsQuestions(Math.min(12, Math.ceil(newsNeed / 2))).catch(() => [])).filter(fresh);

  // Sports that the reviewer rejected stay out; if the reviewer is offline every sports candidate came back.
  const nonSports = deterministic.filter((c) => c.resolution.kind !== "espn" && fresh(c));
  const pool = [...nonSports, ...reviewed.filter((c) => reviewedKeys.has(c.dedupeKey)), ...generated];
  // Round-robin across categories, most-needed first, so no category floods.
  const byCat = new Map<Category, Candidate[]>();
  for (const c of pool) byCat.set(c.category, [...(byCat.get(c.category) ?? []), c]);
  const picked: Candidate[] = [];
  const taken = new Set<string>();
  const left = new Map(CATEGORIES.map((c) => [c, need(c)]));
  while (picked.length < maxNew) {
    let progressed = false;
    for (const cat of [...CATEGORIES].sort((a, b) => (left.get(b) ?? 0) - (left.get(a) ?? 0))) {
      if ((left.get(cat) ?? 0) <= 0) continue;
      const next = byCat.get(cat)?.find((c) => !taken.has(c.dedupeKey));
      if (!next) continue;
      picked.push(next);
      taken.add(next.dedupeKey);
      left.set(cat, (left.get(cat) ?? 0) - 1);
      progressed = true;
      if (picked.length >= maxNew) break;
    }
    if (!progressed) break;
  }
  return picked.map(clean);
}

/** House style: no em or en dashes in anything users read. */
const dash = (t: string) => t.replace(/\s*[20132014]\s*/g, ", ").replace(/,\s*,/g, ",");
export const clean = (c: Candidate): Candidate => ({ ...c, question: dash(c.question), summary: dash(c.summary), rules: c.rules.map(dash) });
