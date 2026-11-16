"use node";
// Oracle lifecycle: close markets after their close time, resolve them from
// sources or the council, propose on-chain, finalize after the dispute window,
// and let the arbiter rule on disputes.

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { resolveMarket } from "../agents/oracle";
import { auditProposal } from "../agents/audit";
import { canonical, sha256Hex } from "../agents/http";
import { PROPOSE_CONFIDENCE } from "../agents/oracle";
import { OUTCOME, STATE, ix } from "../lib/kondora";
import { baseConnection, erConnection, fetchMarket, hexToBytes, keypairFromEnv, sendIxs } from "../lib/kondora/server";

const off = () => process.env.KONDORA_BACKEND_OFF === "1";
const nowSec = () => Math.floor(Date.now() / 1000);
const OUT: Record<string, number> = { yes: OUTCOME.YES, no: OUTCOME.NO, invalid: OUTCOME.INVALID };
const OUT_NAME = ["none", "yes", "no", "invalid"];

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    if (off()) return "backend off";
    if (!(await ctx.runMutation(internal.markets.acquireLock, { name: "oracle", ttlMs: 8 * 60_000 }))) return "locked";
    const log: string[] = [];
    try {
      const base = baseConnection();
      const er = erConnection();
      const crank = keypairFromEnv("CRANK_SECRET");
      const oracle = keypairFromEnv("ORACLE_SECRET");

      // 1. Close markets whose time is up.
      for (const m of await ctx.runQuery(internal.markets.byStatus, { status: "open", before: nowSec() })) {
        if (m.chainId === undefined) continue;
        try {
          const live = await fetchMarket(BigInt(m.chainId), base, er);
          if (!live) continue;
          const a = live.account;
          if (a.state === STATE.OPEN && a.debt_positions === 0) {
            if (live.delegated) await sendIxs(er, crank, [ix.undelegateMarket(crank.publicKey, BigInt(m.chainId))], { er: true });
            else await sendIxs(base, crank, [ix.closeMarket({ payer: crank.publicKey, marketId: BigInt(m.chainId) })]);
            log.push(`closing #${m.chainId}`);
          } else if (a.state === STATE.CLOSED && !live.delegated) {
            await ctx.runMutation(internal.markets.patch, { id: m._id, fields: { status: "closed", delegated: false, priceYes: a.final_price_yes } });
            await ctx.runMutation(internal.markets.addTrail, {
              marketId: m._id, kind: "closed", actor: "crank", agent: "Crank", note: `Trading closed at ${(a.final_price_yes * 100).toFixed(1)}% YES`,
            });
          }
        } catch (e) {
          log.push(`close #${m.chainId}: ${String(e).slice(0, 120)}`);
        }
      }

      // 2. Resolve closed markets.
      for (const m of await ctx.runQuery(internal.markets.byStatus, { status: "closed" })) {
        if (m.chainId === undefined) continue;
        try {
          const r = await resolveMarket({ marketKey: m.key, question: m.question, rules: m.rules, closeTime: m.closeTime, resolution: m.resolution });
          const evidenceHash = await sha256Hex(canonical({ market: m.key, verdict: r.verdict, evidence: r.evidence, panel: r.panel ?? null }));
          if (r.verdict === "pending" || r.confidence < PROPOSE_CONFIDENCE) {
            log.push(`#${m.chainId} pending: ${r.reasoning.slice(0, 80)}`);
            continue;
          }
          await sendIxs(base, oracle, [
            ix.proposeResolution({ oracle: oracle.publicKey, marketId: BigInt(m.chainId), outcome: OUT[r.verdict], evidenceHash: hexToBytes(evidenceHash) }),
          ]);
          await ctx.runMutation(internal.markets.addVerdict, {
            marketId: m._id, role: "oracle", method: r.method, verdict: r.verdict, confidence: r.confidence,
            reasoning: r.reasoning, evidence: r.evidence, evidenceHash, panel: r.panel, scores: r.scores,
          });
          await ctx.runMutation(internal.markets.patch, { id: m._id, fields: { status: "proposed", outcome: r.verdict, evidenceHash, proposedAt: nowSec() } });
          await ctx.runMutation(internal.markets.addTrail, {
            marketId: m._id, kind: "proposed", actor: "oracle", agent: r.method === "council" ? "Council" : "Oracle",
            note: `Proposed ${r.verdict.toUpperCase()} (${Math.round(r.confidence * 100)}%): ${r.reasoning.slice(0, 160)}`, evidenceHash,
          });
          log.push(`#${m.chainId} proposed ${r.verdict}`);
        } catch (e) {
          log.push(`resolve #${m.chainId}: ${String(e).slice(0, 120)}`);
        }
      }

      // 3. Finalize proposals whose window passed.
      for (const m of await ctx.runQuery(internal.markets.byStatus, { status: "proposed" })) {
        if (m.chainId === undefined) continue;
        try {
          const live = await fetchMarket(BigInt(m.chainId), base, er);
          if (!live) continue;
          const a = live.account;
          if (a.state === STATE.PROPOSED && nowSec() >= Number(a.proposed_at + a.params.dispute_secs) + 5) {
            await sendIxs(base, crank, [ix.finalize({ payer: crank.publicKey, marketId: BigInt(m.chainId) })]);
            await markResolved(ctx, m, OUT_NAME[a.outcome], "finalized", "Oracle", "Dispute window passed without challenge");
            log.push(`#${m.chainId} finalized`);
          } else if (a.state === STATE.DISPUTED) {
            await ctx.runMutation(internal.markets.patch, { id: m._id, fields: { status: "disputed" } });
          }
        } catch (e) {
          log.push(`finalize #${m.chainId}: ${String(e).slice(0, 120)}`);
        }
      }

      // 4. Arbiter: rule on disputes using a second independent pass.
      for (const m of await ctx.runQuery(internal.markets.byStatus, { status: "disputed" })) {
        if (m.chainId === undefined) continue;
        try {
          await arbitrate(ctx, m);
        } catch (e) {
          log.push(`arbiter #${m.chainId}: ${String(e).slice(0, 120)}`);
        }
      }

      const note = log.join("; ").slice(0, 280) || "idle";
      await ctx.runMutation(internal.markets.agentRun, { agent: "Oracle", role: "oracle", ok: true, note });
      return note;
    } catch (e) {
      await ctx.runMutation(internal.markets.agentRun, { agent: "Oracle", role: "oracle", ok: false, note: String(e) });
      throw e;
    } finally {
      await ctx.runMutation(internal.markets.releaseLock, { name: "oracle" });
    }
  },
});

type Ctx = Parameters<Parameters<typeof internalAction>[0]["handler"]>[0];

async function markResolved(ctx: Ctx, m: Doc<"markets">, outcome: string, kind: "finalized" | "ruled", agent: string, note: string) {
  await ctx.runMutation(internal.markets.patch, { id: m._id, fields: { status: "resolved", outcome, resolvedAt: nowSec() } });
  await ctx.runMutation(internal.markets.addTrail, { marketId: m._id, kind, actor: kind === "ruled" ? "admin" : "oracle", agent, note: `${note}. Outcome ${outcome.toUpperCase()}.` });
}

/** Settles a dispute: the auditor's view and a fresh oracle pass must agree, else INVALID after 24h. */
async function arbitrate(ctx: Ctx, m: Doc<"markets">) {
  const admin = keypairFromEnv("ADMIN_SECRET");
  const base = baseConnection();
  const audit = await ctx.runQuery(internal.markets.lastVerdict, { marketId: m._id, role: "audit" });
  const fresh = await resolveMarket({ marketKey: `${m.key}:arbiter`, question: m.question, rules: m.rules, closeTime: m.closeTime, resolution: m.resolution });
  const evidenceHash = await sha256Hex(canonical({ market: m.key, arbiter: fresh.verdict, evidence: fresh.evidence }));
  await ctx.runMutation(internal.markets.addVerdict, {
    marketId: m._id, role: "arbiter", method: fresh.method, verdict: fresh.verdict, confidence: fresh.confidence,
    reasoning: fresh.reasoning, evidence: fresh.evidence, evidenceHash, panel: fresh.panel,
  });
  let outcome: string | null = null;
  if (fresh.verdict !== "pending" && fresh.confidence >= 0.9 && audit && fresh.verdict === audit.verdict) outcome = fresh.verdict;
  else if (nowSec() > (m.proposedAt ?? m.closeTime) + 86_400) outcome = "invalid";
  if (!outcome) return;
  const sig = await sendIxs(base, admin, [
    ix.rule({ admin: admin.publicKey, marketId: BigInt(m.chainId!), outcome: OUT[outcome], evidenceHash: hexToBytes(evidenceHash) }),
  ]);
  await markResolved(ctx, m, outcome, "ruled", "Arbiter", `Dispute settled (${sig.slice(0, 8)})`);
}

/** Auditor: blind re-derivation of each fresh proposal, challenges when confident. */
export const audit = internalAction({
  args: {},
  handler: async (ctx) => {
    if (off()) return "backend off";
    if (!(await ctx.runMutation(internal.markets.acquireLock, { name: "audit", ttlMs: 8 * 60_000 }))) return "locked";
    const log: string[] = [];
    try {
      const auditor = keypairFromEnv("AUDITOR_SECRET");
      const base = baseConnection();
      for (const m of await ctx.runQuery(internal.markets.byStatus, { status: "proposed" })) {
        if (m.chainId === undefined || !m.outcome) continue;
        if (await ctx.runQuery(internal.markets.lastVerdict, { marketId: m._id, role: "audit" })) continue;
        const live = await fetchMarket(BigInt(m.chainId), base);
        if (!live || live.account.state !== STATE.PROPOSED) continue;
        const deadline = Number(live.account.proposed_at + live.account.params.dispute_secs);
        if (nowSec() >= deadline - 20) continue;
        const r = await auditProposal(
          { marketKey: m.key, question: m.question, rules: m.rules, closeTime: m.closeTime, resolution: m.resolution },
          m.outcome as "yes" | "no" | "invalid",
        );
        const evidenceHash = await sha256Hex(canonical({ market: m.key, audit: r }));
        await ctx.runMutation(internal.markets.addVerdict, {
          marketId: m._id, role: "audit", method: r.method, verdict: r.verdict, confidence: r.confidence, reasoning: r.reasoning, evidence: [], evidenceHash,
        });
        if (r.challenge) {
          const sig = await sendIxs(base, auditor, [ix.challenge({ auditor: auditor.publicKey, marketId: BigInt(m.chainId) })]);
          await ctx.runMutation(internal.markets.patch, { id: m._id, fields: { status: "disputed" } });
          await ctx.runMutation(internal.markets.addTrail, {
            marketId: m._id, kind: "challenged", actor: "auditor", agent: "Auditor",
            note: `Challenged: auditor reads ${r.verdict.toUpperCase()} (${Math.round(r.confidence * 100)}%). ${r.reasoning.slice(0, 140)}`, sig,
          });
          log.push(`#${m.chainId} challenged`);
        } else {
          await ctx.runMutation(internal.markets.addTrail, {
            marketId: m._id, kind: "audited", actor: "auditor", agent: "Auditor",
            note: r.agrees === null ? "Audit inconclusive, no challenge" : r.agrees ? "Audit agrees with the proposal" : "Audit disagrees but below challenge confidence",
          });
          log.push(`#${m.chainId} audited`);
        }
      }
      const note = log.join("; ").slice(0, 280) || "idle";
      await ctx.runMutation(internal.markets.agentRun, { agent: "Auditor", role: "audit", ok: true, note });
      return note;
    } catch (e) {
      await ctx.runMutation(internal.markets.agentRun, { agent: "Auditor", role: "audit", ok: false, note: String(e) });
      throw e;
    } finally {
      await ctx.runMutation(internal.markets.releaseLock, { name: "audit" });
    }
  },
});
