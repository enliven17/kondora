import type { FunctionReturnType } from "convex/server";

import { api } from "@/convex/_generated/api";
import { CATEGORIES, type Activity, type Category, type Market, type OracleEvent, type Outcome } from "./types";

/**
 * Convex boundary shared by the server (fetchQuery) and the client (useQuery).
 * With NEXT_PUBLIC_CONVEX_URL set the app only ever shows Convex data; without it
 * (local dev with no deployment) lib/data.ts falls back to generated mock markets.
 */
export const CONVEX_ENABLED = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

export { api };

export type ConvexMarket = FunctionReturnType<typeof api.markets.list>[number];
export type ConvexMarketDetail = NonNullable<FunctionReturnType<typeof api.markets.get>>;
export type ConvexActivity = FunctionReturnType<typeof api.markets.activity>[number];
export type ConvexStats = FunctionReturnType<typeof api.markets.stats>;
export type ConvexAgents = FunctionReturnType<typeof api.markets.agents>;

const OUTCOMES: readonly Outcome[] = ["yes", "no", "invalid"];
const TRAIL_KINDS: readonly OracleEvent["kind"][] = ["created", "closed", "proposed", "audited", "challenged", "finalized", "ruled"];
const ACTORS: readonly OracleEvent["actor"][] = ["creator", "oracle", "auditor", "admin", "crank"];

export const isCategory = (c: string): c is Category => (CATEGORIES as readonly string[]).includes(c);

function toOutcome(o: string | undefined): Outcome | undefined {
  return OUTCOMES.find((x) => x === o);
}

function toTrail(m: ConvexMarket | ConvexMarketDetail): OracleEvent[] {
  if (!("oracleTrail" in m)) return [];
  return m.oracleTrail.flatMap((e): OracleEvent[] => {
    const kind = TRAIL_KINDS.find((k) => k === e.kind);
    const actor = ACTORS.find((a) => a === e.actor);
    if (!kind || !actor) return [];
    return [{ t: e.t, kind, actor, agent: e.agent, note: e.note, evidenceHash: e.evidenceHash }];
  });
}

/** Convex market row to the UI Market. Returns null for categories the UI does not know. */
export function toMarket(m: ConvexMarket | ConvexMarketDetail): Market | null {
  if (!isCategory(m.category)) return null;
  return {
    id: m.id,
    question: m.question,
    category: m.category,
    summary: m.summary,
    openTime: m.openTime,
    closeTime: m.closeTime,
    state: m.state,
    outcome: toOutcome(m.outcome),
    yesPrice: m.yesPrice,
    change24h: m.change24h,
    volume: m.volume,
    liquidity: m.liquidity,
    traders: m.traders,
    resolution: m.resolution,
    rules: m.rules,
    history: m.history,
    oracleTrail: toTrail(m),
  };
}

export const toMarkets = (rows: ConvexMarket[]) => rows.flatMap((r) => toMarket(r) ?? []);

export function toActivity(a: ConvexActivity): Activity {
  return {
    id: a.id,
    marketId: a.marketId,
    kind: a.kind,
    side: a.side,
    leverage: a.leverage,
    amount: a.amount,
    price: a.price,
    t: a.t,
    trader: a.trader,
  };
}
