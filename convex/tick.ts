"use node";
// One cheap heartbeat for chain upkeep: crank (liquidations, force closes,
// sweeps) then indexer (prices, ticks, trades). Runs every few minutes to stay
// inside the free plan's action compute.

import { internalAction } from "./_generated/server";
import { runCrank } from "./crank";
import { runIndexer } from "./indexer";

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    if (process.env.KONDORA_BACKEND_OFF === "1" || !process.env.CRANK_SECRET) return "off";
    const out: string[] = [];
    try {
      out.push(await runCrank(ctx));
    } catch (e) {
      out.push(`crank: ${String(e).slice(0, 120)}`);
    }
    try {
      out.push(await runIndexer(ctx));
    } catch (e) {
      out.push(`indexer: ${String(e).slice(0, 120)}`);
    }
    return out.join(" | ");
  },
});

