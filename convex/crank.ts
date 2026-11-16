"use node";
// Crank: liquidations and pre-close force closes inside the ER, sweeps of
// resolved markets on the base layer. Permissionless instructions, any key works.

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { DELEGATION_PROGRAM_ID, STATE, amm, decodeMarket, ix, marketPda, MarketAccount } from "../lib/kondora";
import { baseConnection, erConnection, erUserAccounts, keypairFromEnv, sendIxs } from "../lib/kondora/server";

const off = () => process.env.KONDORA_BACKEND_OFF === "1";
const nowSec = () => Math.floor(Date.now() / 1000);

function borrowFee(debt: bigint, bpsPerHour: number, dt: number): bigint {
  if (dt <= 0 || debt === 0n) return 0n;
  return (debt * BigInt(bpsPerHour) * BigInt(dt)) / 36_000_000n;
}

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    if (off()) return "backend off";
    if (!(await ctx.runMutation(internal.markets.acquireLock, { name: "crank", ttlMs: 2 * 60_000 }))) return "locked";
    const log: string[] = [];
    try {
      const crank = keypairFromEnv("CRANK_SECRET");
      const er = erConnection();
      const base = baseConnection();
      const now = nowSec();
      const markets = new Map<bigint, MarketAccount | null>();
      const market = async (id: bigint) => {
        if (!markets.has(id)) {
          const info = await er.getAccountInfo(marketPda(id));
          markets.set(id, info ? decodeMarket(info.data) : null);
        }
        return markets.get(id)!;
      };

      for (const { account: u } of await erUserAccounts(er)) {
        for (const p of u.positions) {
          if (p.debt === 0n || p.market_id === 0n) continue;
          const m = await market(p.market_id);
          if (!m || m.state !== STATE.OPEN) continue;
          const accrued = p.accrued + borrowFee(p.debt, m.params.borrow_bps_per_hour, now - Number(p.last_accrual));
          const halted = now >= Number(m.close_time - m.params.halt_secs);
          const mark = amm.markAt(m.mark_z, Number(m.mark_t), m.z, now);
          const liq = amm.isLiquidatableAtMark(mark, m.params.mm_bps, p.side as 0 | 1, Number(p.shares), Number(p.debt), Number(accrued));
          if (!liq && !halted) continue;
          try {
            await sendIxs(er, crank, [ix.liquidate({ payer: crank.publicKey, owner: u.owner, marketId: p.market_id, side: p.side })], { er: true });
            markets.delete(p.market_id);
            log.push(`${liq ? "liquidated" : "force closed"} ${u.owner.toBase58().slice(0, 4)} on #${p.market_id}`);
          } catch (e) {
            log.push(`liq #${p.market_id}: ${String(e).slice(0, 100)}`);
          }
        }
      }

      // Return the House's share of resolved markets.
      for (const m of await ctx.runQuery(internal.markets.byStatus, { status: "resolved" })) {
        if (m.swept || m.chainId === undefined) continue;
        try {
          const info = await base.getAccountInfo(marketPda(BigInt(m.chainId)));
          if (!info || info.owner.equals(DELEGATION_PROGRAM_ID)) continue;
          const a = decodeMarket(info.data);
          if (a.state !== STATE.RESOLVED) continue;
          if (!a.swept) await sendIxs(base, crank, [ix.sweep({ payer: crank.publicKey, marketId: BigInt(m.chainId) })]);
          await ctx.runMutation(internal.markets.patch, { id: m._id, fields: { swept: true } });
          log.push(`swept #${m.chainId}`);
        } catch (e) {
          log.push(`sweep #${m.chainId}: ${String(e).slice(0, 100)}`);
        }
      }

      const note = log.join("; ").slice(0, 280) || "idle";
      if (log.length) await ctx.runMutation(internal.markets.agentRun, { agent: "Crank", role: "crank", ok: true, note });
      return note;
    } catch (e) {
      await ctx.runMutation(internal.markets.agentRun, { agent: "Crank", role: "crank", ok: false, note: String(e) });
      throw e;
    } finally {
      await ctx.runMutation(internal.markets.releaseLock, { name: "crank" });
    }
  },
});

