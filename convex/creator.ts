"use node";
// Creator agent: plans a balanced batch of markets and opens them on-chain.

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { planMarkets } from "../agents/creator";
import { canonical, sha256Hex } from "../agents/http";
import { CATEGORY_INDEX, Candidate, Category } from "../agents/types";
import { amm, ix } from "../lib/kondora";
import { baseConnection, fetchConfig, hexToBytes, keypairFromEnv, sendIxs } from "../lib/kondora/server";

const off = () => process.env.KONDORA_BACKEND_OFF === "1";
const usdc = (name: string, dflt: number) => BigInt(Math.round(Number(process.env[name] ?? dflt) * 1_000_000));

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    if (off()) return "backend off";
    if (!(await ctx.runMutation(internal.markets.acquireLock, { name: "creator", ttlMs: 10 * 60_000 }))) return "locked";
    let opened = 0;
    let note = "";
    try {
      const creator = keypairFromEnv("CREATOR_SECRET");
      const conn = baseConnection();
      const subsidy = usdc("MARKET_SUBSIDY_USDC", 50);
      const lend = usdc("MARKET_LEND_USDC", 100);
      const maxNew = Number(process.env.CREATOR_MAX_PER_RUN ?? 20);

      const { keys, openByCategory } = await ctx.runQuery(internal.markets.keysAndCounts, {});
      const plan = await planMarkets({
        existingKeys: new Set(keys),
        openByCategory: openByCategory as Partial<Record<Category, number>>,
        maxNew,
      });

      for (const c of plan) {
        const cfg = await fetchConfig(conn);
        if (!cfg) throw new Error("program not initialized");
        if (cfg.house_free < subsidy + lend) {
          note = "house liquidity exhausted";
          break;
        }
        const id = await ctx.runMutation(internal.markets.insertPending, {
          key: c.dedupeKey,
          question: c.question,
          summary: c.summary,
          category: c.category,
          rules: c.rules,
          resolution: c.resolution,
          sourceName: c.sourceName,
          sourceUrl: c.sourceUrl,
          tags: c.tags ?? [],
          closeTime: c.closeTime,
          priceYes: c.priceYes,
        });
        if (!id) continue;
        try {
          const chainId = cfg.next_market_id;
          const z0 = Math.max(-2, Math.min(2, amm.zForPrice(c.priceYes)));
          await sendIxs(conn, creator, [
            ix.createMarket({
              creator: creator.publicKey,
              marketId: chainId,
              category: CATEGORY_INDEX[c.category],
              questionHash: hexToBytes(await sha256Hex(c.question)),
              rulesHash: hexToBytes(await sha256Hex(canonical({ rules: c.rules, resolution: c.resolution }))),
              closeTime: BigInt(c.closeTime),
              z0,
              subsidy,
              lend,
            }),
            ix.delegateMarket(creator.publicKey, chainId),
          ]);
          await ctx.runMutation(internal.markets.patch, {
            id,
            fields: {
              chainId: Number(chainId),
              status: "open",
              delegated: true,
              priceYes: amm.cdf(z0),
              initialPriceYes: amm.cdf(z0),
              liquidity: Number(subsidy) / 1e6,
            },
          });
          await ctx.runMutation(internal.markets.addTrail, {
            marketId: id,
            kind: "created",
            actor: "creator",
            agent: "Creator",
            note: `Opened from ${c.sourceName} at ${(amm.cdf(z0) * 100).toFixed(1)}% YES`,
          });
          opened++;
        } catch (e) {
          await ctx.runMutation(internal.markets.patch, { id, fields: { status: "failed", lastError: String(e).slice(0, 500) } });
          note = String(e).slice(0, 200);
        }
      }
      note = `opened ${opened}/${plan.length}${note ? `; ${note}` : ""}`;
      await ctx.runMutation(internal.markets.agentRun, { agent: "Creator", role: "creator", ok: true, note });
      return note;
    } catch (e) {
      await ctx.runMutation(internal.markets.agentRun, { agent: "Creator", role: "creator", ok: false, note: String(e) });
      throw e;
    } finally {
      await ctx.runMutation(internal.markets.releaseLock, { name: "creator" });
    }
  },
});

export type { Candidate };
