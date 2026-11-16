// Match markets from ESPN scoreboards, settled from the final score.

import { getJson } from "../http";
import { Candidate, DAY, HOUR, Resolution, ResolutionSpec, nowSec } from "../types";

const LEAGUES: { sport: string; league: string; name: string; draws: boolean }[] = [
  { sport: "soccer", league: "eng.1", name: "Premier League", draws: true },
  { sport: "soccer", league: "esp.1", name: "LaLiga", draws: true },
  { sport: "soccer", league: "ita.1", name: "Serie A", draws: true },
  { sport: "soccer", league: "ger.1", name: "Bundesliga", draws: true },
  { sport: "soccer", league: "fra.1", name: "Ligue 1", draws: true },
  { sport: "soccer", league: "tur.1", name: "Super Lig", draws: true },
  { sport: "soccer", league: "uefa.champions", name: "Champions League", draws: true },
  { sport: "soccer", league: "uefa.europa", name: "Europa League", draws: true },
  { sport: "soccer", league: "usa.1", name: "MLS", draws: true },
  { sport: "basketball", league: "nba", name: "NBA", draws: false },
  { sport: "football", league: "nfl", name: "NFL", draws: false },
  { sport: "hockey", league: "nhl", name: "NHL", draws: false },
  { sport: "football", league: "college-football", name: "College Football", draws: false },
];

interface EspnCompetitor {
  id: string;
  records?: { summary?: string }[];
  homeAway: "home" | "away";
  winner?: boolean;
  score?: string;
  team: { id: string; displayName: string; shortDisplayName?: string; abbreviation?: string };
}
interface EspnEvent {
  id: string;
  date: string;
  name: string;
  status: { type: { state: "pre" | "in" | "post"; completed: boolean; name: string } };
  competitions: { competitors: EspnCompetitor[]; odds?: { homeTeamOdds?: { moneyLine?: number }; awayTeamOdds?: { moneyLine?: number } }[] }[];
}

const ymd = (t: number) => new Date(t * 1000).toISOString().slice(0, 10).replace(/-/g, "");

/** Points per game from an ESPN record summary ("W-D-L" with draws, else "W-L"). */
function ppg(summary: string | undefined, draws: boolean): number | null {
  const n = (summary ?? "").split("-").map(Number);
  if (n.some((x) => !Number.isFinite(x)) || n.length < 2) return null;
  const games = n.reduce((a, b) => a + b, 0);
  if (games < 3) return null;
  return draws && n.length === 3 ? (3 * n[0] + n[1]) / games / 3 : n[0] / games;
}

/** Home win probability from form when no odds are published. */
export function formPrior(home: number | null, away: number | null, draws: boolean): number {
  const base = draws ? 0.44 : 0.56;
  if (home === null || away === null) return base;
  return base + (draws ? 0.32 : 0.4) * Math.tanh((home - away) * 2.2);
}

/** American moneyline to implied probability. */
function implied(ml?: number): number | null {
  if (!ml) return null;
  return ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100);
}

export async function sportsCandidates(daysAhead = 4, perLeague = 6): Promise<Candidate[]> {
  const now = nowSec();
  const out: Candidate[] = [];
  await Promise.all(
    LEAGUES.map(async (lg) => {
      try {
        // ESPN rejects date ranges now: fetch the default window plus single days.
        const base = `https://site.api.espn.com/apis/site/v2/sports/${lg.sport}/${lg.league}/scoreboard`;
        const urls = [base, ...Array.from({ length: daysAhead }, (_, d) => `${base}?dates=${ymd(now + (d + 1) * DAY)}`)];
        const pages = await Promise.all(urls.map((u) => getJson<{ events?: EspnEvent[] }>(u).catch(() => ({ events: [] }))));
        const events = [...new Map(pages.flatMap((p) => p.events ?? []).map((e) => [e.id, e])).values()].sort(
          (a, b) => Date.parse(a.date) - Date.parse(b.date),
        );
        let n = 0;
        for (const ev of events) {
          if (n >= perLeague) break;
          const kickoff = Math.floor(Date.parse(ev.date) / 1000);
          if (ev.status.type.state !== "pre" || kickoff - now < 2 * HOUR) continue;
          const comp = ev.competitions[0];
          const home = comp.competitors.find((c) => c.homeAway === "home");
          const away = comp.competitors.find((c) => c.homeAway === "away");
          if (!home || !away) continue;
          const odds = comp.odds?.[0];
          const pHome = implied(odds?.homeTeamOdds?.moneyLine);
          const pAway = implied(odds?.awayTeamOdds?.moneyLine);
          let p = formPrior(ppg(home.records?.[0]?.summary, lg.draws), ppg(away.records?.[0]?.summary, lg.draws), lg.draws);
          if (pHome && pAway) p = pHome / (pHome + pAway + (lg.draws ? 0.28 : 0));
          const spec: ResolutionSpec = {
            kind: "espn",
            sport: lg.sport,
            league: lg.league,
            eventId: ev.id,
            teamId: home.team.id,
            teamName: home.team.displayName,
          };
          out.push({
            question: `Will ${home.team.displayName} beat ${away.team.displayName}?`,
            summary: `${lg.name}. Kickoff ${new Date(kickoff * 1000).toUTCString().slice(0, 22)} UTC.`,
            category: "sports",
            closeTime: kickoff,
            priceYes: Math.min(0.9, Math.max(0.1, p)),
            rules: [
              `Resolves YES if ${home.team.displayName} wins the match per the official final result on ESPN.`,
              lg.draws ? "A draw resolves NO." : "Overtime counts.",
              "If the match is postponed beyond 72 hours or cancelled, the market resolves INVALID and pays the final mark.",
            ],
            resolution: spec,
            sourceName: `ESPN ${lg.name}`,
            sourceUrl: `https://www.espn.com/${lg.sport}/match/_/gameId/${ev.id}`,
            dedupeKey: `espn:${lg.league}:${ev.id}`,
            tags: [lg.name, home.team.abbreviation ?? "", away.team.abbreviation ?? ""].filter(Boolean),
          });
          n++;
        }
      } catch {
        // one league failing must not stop the rest
      }
    }),
  );
  return out;
}

export async function resolveEspn(spec: Extract<ResolutionSpec, { kind: "espn" }>, closeTime: number): Promise<Resolution> {
  const now = nowSec();
  const url = `https://site.api.espn.com/apis/site/v2/sports/${spec.sport}/${spec.league}/summary?event=${spec.eventId}`;
  const s = await getJson<{ header?: { competitions?: { status?: EspnEvent["status"]; competitors?: EspnCompetitor[] }[] } }>(url);
  const comp = s.header?.competitions?.[0];
  const status = comp?.status?.type;
  const ev = [{ source: "ESPN", url, fetchedAt: now, excerpt: JSON.stringify({ status, competitors: comp?.competitors?.map((c) => ({ team: c.team.displayName, score: c.score, winner: c.winner })) }) }];
  if (!status || !status.completed) {
    const cancelled = /CANCELED|POSTPONED|ABANDONED/i.test(status?.name ?? "");
    if ((cancelled && now > closeTime + 3 * DAY) || now > closeTime + 5 * DAY) {
      return { verdict: "invalid", confidence: 0.95, method: "espn", reasoning: `Match not completed: ${status?.name ?? "unknown"}`, evidence: ev };
    }
    return { verdict: "pending", confidence: 0, method: "espn", reasoning: `Match status ${status?.name ?? "unknown"}`, evidence: ev };
  }
  const team = comp?.competitors?.find((c) => c.team.id === spec.teamId);
  if (!team) return { verdict: "pending", confidence: 0, method: "espn", reasoning: "Team not found in result", evidence: ev };
  return {
    verdict: team.winner ? "yes" : "no",
    confidence: 0.99,
    method: "espn",
    reasoning: `${spec.teamName} ${team.winner ? "won" : "did not win"} (final ${comp?.competitors?.map((c) => `${c.team.abbreviation ?? c.team.displayName} ${c.score}`).join(" - ")})`,
    evidence: ev,
  };
}
