"use node";
// Indexer: mirrors on-chain market state into Convex (prices, volume, ticks)
// and turns program events from the ER into the activity feed.

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { Connection } from "@solana/web3.js";
import { DELEGATION_PROGRAM_ID, amm, decodeMarket, eventsFromLogs, marketPda } from "../lib/kondora";
import { baseConnection, erConnection } from "../lib/kondora/server";

const off = () => process.env.KONDORA_BACKEND_OFF === "1";
const TICK_EVERY = 10 * 60;

async function newEvents(er: Connection, chainId: number, cursor: string | null) {
  const sigs = await er.getSignaturesForAddress(marketPda(BigInt(chainId)), { limit: 50, ...(cursor ? { until: cursor } : {}) });
  const out: { sig: string; events: ReturnType<typeof eventsFromLogs> }[] = [];
  for (const s of sigs.reverse()) {
    if (s.err) continue;
    const tx = await er.getTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null);
    out.push({ sig: s.signature, events: eventsFromLogs(tx?.meta?.logMessages ?? []) });
  }
  return { out, head: sigs.length ? sigs[sigs.length - 1].signature : cursor };
}

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    if (off()) return "backend off";
    if (!(await ctx.runMutation(internal.markets.acquireLock, { name: "indexer", ttlMs: 2 * 60_000 }))) return "locked";
    try {
      const base = baseConnection();
      const er = erConnection();
      const rows = [
        ...(await ctx.runQuery(internal.markets.byStatus, { status: "open" })),
        ...(await ctx.runQuery(internal.markets.byStatus, { status: "closed" })),
      ].filter((m) => m.chainId !== undefined);
      let synced = 0;
      let traded = 0;
      for (let i = 0; i < rows.length; i += 90) {
        const chunk = rows.slice(i, i + 90);
        const keys = chunk.map((m) => marketPda(BigInt(m.chainId!)));
        const baseInfos = await base.getMultipleAccountsInfo(keys);
        const delegatedKeys = keys.filter((_, j) => baseInfos[j]?.owner.equals(DELEGATION_PROGRAM_ID));
        const erInfos = delegatedKeys.length ? await er.getMultipleAccountsInfo(delegatedKeys) : [];
        const erByKey = new Map(delegatedKeys.map((k, j) => [k.toBase58(), erInfos[j]]));
        for (let j = 0; j < chunk.length; j++) {
          const m = chunk[j];
          const info = erByKey.get(keys[j].toBase58()) ?? baseInfos[j];
          if (!info) continue;
          const a = decodeMarket(info.data);
          const priceYes = amm.cdf(a.z);
          const trades = Number(a.trades);
          const last = await ctx.runQuery(internal.markets.lastTick, { id: m._id });
          const now = Math.floor(Date.now() / 1000);
          const volume = Number(a.volume) / 1e6;
          const moved = !last || Math.abs(last.p - priceYes) > 0.0005 || now - last.t >= TICK_EVERY;
          await ctx.runMutation(internal.markets.recordSync, {
            id: m._id,
            priceYes,
            volume,
            liquidity: Number(a.cash) / 1e6,
            trades,
            tick: moved,
            tickVolume: Math.max(0, volume - m.volume),
          });
          synced++;
          if (trades === m.trades) continue;
          const cursorName = `sig:${m.chainId}`;
          const cursor = await ctx.runQuery(internal.markets.getCursor, { name: cursorName });
          const { out, head } = await newEvents(erByKey.has(keys[j].toBase58()) ? er : base, m.chainId!, cursor);
          const tradeRows = out.flatMap(({ sig, events }) =>
            events
              .filter((e) => e.name === "PositionOpened" || e.name === "PositionClosed")
              .map((e) => {
                const d = e.data as Record<string, unknown>;
                const opened = e.name === "PositionOpened";
                return {
                  marketId: m._id as Id<"markets">,
                  chainId: m.chainId!,
                  owner: String((d.owner as { toBase58(): string }).toBase58()),
                  side: Number(d.side) === 0 ? "yes" : "no",
                  kind: opened ? "open" : d.liquidation ? "liquidation" : "close",
                  leverage: opened ? Number(d.lev_bps) / 10_000 : 0,
                  amount: Number(opened ? d.margin : d.to_user) / 1e6,
                  shares: Number(d.shares) / 1e6,
                  priceYes: Number(d.price_yes),
                  t: Number(d.ts),
                  sig,
                };
              }),
          );
          if (tradeRows.length) traded += await ctx.runMutation(internal.markets.insertTrades, { rows: tradeRows });
          if (head) await ctx.runMutation(internal.markets.setCursor, { name: cursorName, value: head });
        }
      }
      return `synced ${synced}, new trades ${traded}`;
    } finally {
      await ctx.runMutation(internal.markets.releaseLock, { name: "indexer" });
    }
  },
});
