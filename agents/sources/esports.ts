// Esports match markets from PandaScore (needs PANDASCORE_TOKEN). Without a
// token, esports coverage comes from the Polymarket mirror.

import { getJson } from "../http";
import { Candidate, DAY, HOUR, Resolution, ResolutionSpec, nowSec } from "../types";

interface PsTeam {
  opponent: { id: number; name: string; acronym?: string };
}
interface PsMatch {
  id: number;
  name: string;
  begin_at: string | null;
  scheduled_at: string | null;
  status: string;
  winner_id: number | null;
  opponents: PsTeam[];
  videogame: { slug: string; name: string };
  league: { name: string };
  tournament?: { tier?: string };
}

const token = () => (typeof process !== "undefined" ? process.env.PANDASCORE_TOKEN : undefined);

export async function esportsCandidates(max = 16): Promise<Candidate[]> {
  const t = token();
  if (!t) return [];
  const now = nowSec();
  const out: Candidate[] = [];
  for (const game of ["csgo", "lol", "valorant", "dota2"]) {
    try {
      const ms = await getJson<PsMatch[]>(
        `https://api.pandascore.co/${game}/matches/upcoming?per_page=25&sort=scheduled_at`,
        15_000,
        { authorization: `Bearer ${t}` },
      );
      for (const m of ms) {
        const at = Math.floor(Date.parse(m.scheduled_at ?? m.begin_at ?? "") / 1000);
        if (!at || at - now < 2 * HOUR || at - now > 7 * DAY || m.opponents.length !== 2) continue;
        if (m.tournament?.tier && !["s", "a", "b"].includes(m.tournament.tier)) continue;
        const [a, b] = m.opponents.map((o) => o.opponent);
        const spec: ResolutionSpec = { kind: "council", criteria: `pandascore:${m.id}:${a.id}`, sources: [`https://api.pandascore.co/matches/${m.id}`] };
        out.push({
          question: `Will ${a.name} beat ${b.name}?`,
          summary: `${m.videogame.name}, ${m.league.name}.`,
          category: "esports",
          closeTime: at,
          priceYes: 0.5,
          rules: [
            `Resolves YES if ${a.name} is the official winner of the match per PandaScore.`,
            "A forfeit counts as a loss for the forfeiting team. Cancelled or postponed beyond 72 hours resolves INVALID.",
          ],
          resolution: spec,
          sourceName: "PandaScore",
          sourceUrl: `https://pandascore.co`,
          dedupeKey: `ps:${m.id}`,
          tags: [m.videogame.name, m.league.name],
        });
        if (out.length >= max) return out;
      }
    } catch {
      // keep going with other titles
    }
  }
  return out;
}

/** PandaScore matches are encoded as council specs with a `pandascore:` criteria prefix. */
export async function resolvePandascore(criteria: string, closeTime: number): Promise<Resolution | null> {
  const m = criteria.match(/^pandascore:(\d+):(\d+)$/);
  const t = token();
  if (!m || !t) return null;
  const now = nowSec();
  const url = `https://api.pandascore.co/matches/${m[1]}`;
  const match = await getJson<PsMatch>(url, 15_000, { authorization: `Bearer ${t}` });
  const evidence = [{ source: "PandaScore", url, fetchedAt: now, excerpt: JSON.stringify({ status: match.status, winner_id: match.winner_id }) }];
  if (match.status === "finished" && match.winner_id) {
    return { verdict: String(match.winner_id) === m[2] ? "yes" : "no", confidence: 0.99, method: "pandascore", reasoning: `Winner id ${match.winner_id}`, evidence };
  }
  if (match.status === "canceled" || now > closeTime + 3 * DAY) {
    return { verdict: "invalid", confidence: 0.95, method: "pandascore", reasoning: `Status ${match.status}`, evidence };
  }
  return { verdict: "pending", confidence: 0, method: "pandascore", reasoning: `Status ${match.status}`, evidence };
}
