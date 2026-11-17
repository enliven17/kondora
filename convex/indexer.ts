"use node";
// Indexer helper (called from tick.ts): mirrors on-chain market state into
// Convex and turns ER program events into the activity feed.
// Budget: one query and one batched mutation per run, plus trade inserts only
// for markets whose on-chain trade count changed.

import { internal } from "./_generated/api";
import { ActionCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { Connection } from "@solana/web3.js";
import { DELEGATION_PROGRAM_ID, amm, decodeMarket, eventsFromLogs, marketPda } from "../lib/kondora";
import { baseConnection, erConnection } from "../lib/kondora/server";

const TICK_EVERY = 15 * 60;

async function newEvents(conn: Connection, chainId: number, cursor: string | null) {
  const sigs = await conn.getSignaturesForAddress(marketPda(BigInt(chainId)), { limit: 25, ...(cursor ? { until: cursor } : {}) });
  const out: { sig: string; events: ReturnType<typeof eventsFromLogs> }[] = [];
  for (const s of [...sigs].reverse()) {
    if (s.err) continue;
    const tx = await conn.getTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null);
    out.push({ sig: s.signature, events: eventsFromLogs(tx?.meta?.logMessages ?? []) });
  }
  return { out, head: sigs.length ? sigs[0].signature : cursor };
}

export async function runIndexer(ctx: ActionCtx): Promise<string> {
  const base = baseConnection();
  const er = erConnection();
  const rows = await ctx.runQuery(internal.markets.syncState, {});
  if (!rows.length) return "no markets";
  const now = Math.floor(Date.now() / 1000);
  const updates: {
    id: Id<"markets">;
    priceYes: number;
    volume: number;
    liquidity: number;
    trades: number;
    tick: boolean;
    tickVolume: number;
  }[] = [];
  const changed: { row: (typeof rows)[number]; delegated: boolean }[] = [];

  for (let i = 0; i < rows.length; i += 90) {
    const chunk = rows.slice(i, i + 90);
    const keys = chunk.map((m) => marketPda(BigInt(m.chainId)));
    const baseInfos = await base.getMultipleAccountsInfo(keys);
    const delegated = keys.filter((_, j) => baseInfos[j]?.owner.equals(DELEGATION_PROGRAM_ID));
    const erInfos = delegated.length ? await er.getMultipleAccountsInfo(delegated) : [];
    const erByKey = new Map(delegated.map((k, j) => [k.toBase58(), erInfos[j]]));
    chunk.forEach((m, j) => {
      const isDelegated = erByKey.has(keys[j].toBase58());
      const info = (isDelegated ? erByKey.get(keys[j].toBase58()) : null) ?? baseInfos[j];
      if (!info) return;
      const a = decodeMarket(info.data);
      const priceYes = amm.cdf(a.z);
      const volume = Number(a.volume) / 1e6;
      const trades = Number(a.trades);
      const moved = Math.abs(m.lastP - priceYes) > 0.001;
      const due = now - m.lastT >= TICK_EVERY;
      if (!moved && !due && trades === m.trades) return;
      updates.push({
        id: m.id,
        priceYes,
        volume,
        liquidity: Number(a.cash) / 1e6,
        trades,
        tick: moved || due,
        tickVolume: Math.max(0, volume - m.volume),
      });
      if (trades !== m.trades) changed.push({ row: m, delegated: isDelegated });
    });
  }
  if (updates.length) await ctx.runMutation(internal.markets.recordSyncBatch, { rows: updates });

  let traded = 0;
  for (const { row: m, delegated } of changed) {
    const cursorName = `sig:${m.chainId}`;
    const cursor = await ctx.runQuery(internal.markets.getCursor, { name: cursorName });
    const { out, head } = await newEvents(delegated ? er : base, m.chainId, cursor);
    const tradeRows = out.flatMap(({ sig, events }) =>
      events
        .filter((e) => (e.name === "PositionOpened" || e.name === "PositionClosed") && Number(e.data.market_id) === m.chainId)
        .map((e) => {
          const d = e.data as Record<string, unknown>;
          const opened = e.name === "PositionOpened";
          return {
            marketId: m.id,
            chainId: m.chainId,
            owner: (d.owner as { toBase58(): string }).toBase58(),
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
    if (tradeRows.length || head !== cursor) {
      traded += await ctx.runMutation(internal.markets.insertTradesAndCursor, { rows: tradeRows, cursorName, cursor: head ?? "" });
    }
  }
  return `synced ${updates.length}/${rows.length}, trades ${traded}`;
}
