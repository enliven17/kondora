"use node";
// Manual check: role keys decode, LLM providers answer, chain config is readable.
// Run with: npx convex run health:check

import { internalAction } from "./_generated/server";
import { chatJson } from "../agents/llm";
import { fetchConfig, keypairFromEnv } from "../lib/kondora/server";

export const check = internalAction({
  args: {},
  handler: async () => {
    const roles: Record<string, string> = {};
    for (const r of ["CREATOR", "ORACLE", "AUDITOR", "CRANK"]) {
      try {
        roles[r] = keypairFromEnv(`${r}_SECRET`).publicKey.toBase58();
      } catch (e) {
        roles[r] = `error: ${String(e).slice(0, 80)}`;
      }
    }
    const llm: Record<string, string> = {};
    for (const p of ["gemini", "groq", "harbor"] as const) {
      try {
        const r = await chatJson<{ ok: boolean }>({ role: "creator", providers: [p], system: 'Reply as JSON {"ok": true}.', user: "ping", maxTokens: 400 });
        llm[p] = `${r.model}: ${JSON.stringify(r.data)}`;
      } catch (e) {
        llm[p] = String(e).slice(0, 160);
      }
    }
    const cfg = await fetchConfig();
    return {
      roles,
      llm,
      config: cfg && { creator: cfg.creator.toBase58(), houseFree: Number(cfg.house_free) / 1e6, nextMarket: Number(cfg.next_market_id), minTrade: Number(cfg.params.min_trade) / 1e6 },
    };
  },
});
