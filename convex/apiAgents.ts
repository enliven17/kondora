import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const register = internalMutation({
  args: { pubkey: v.string(), name: v.string(), url: v.optional(v.string()), nonce: v.string() },
  handler: async (ctx, { pubkey, name, url, nonce }) => {
    const used = await ctx.db.query("nonces").withIndex("by_pubkey_nonce", (q) => q.eq("pubkey", pubkey).eq("nonce", nonce)).first();
    if (used) throw new Error("nonce already used");
    await ctx.db.insert("nonces", { pubkey, nonce, t: Date.now() });
    const row = await ctx.db.query("apiAgents").withIndex("by_pubkey", (q) => q.eq("pubkey", pubkey)).first();
    const now = Date.now();
    if (row) await ctx.db.patch(row._id, { name, url, lastSeenAt: now });
    else await ctx.db.insert("apiAgents", { pubkey, name, url, createdAt: now, lastSeenAt: now, requests: 0 });
  },
});

/**
 * Fixed-window rate limit for the public API: per caller and one global bucket,
 * so a loop cannot burn the free plan's action compute.
 */
export const hit = internalMutation({
  args: { caller: v.string(), perMinute: v.number(), globalPerMinute: v.number() },
  handler: async (ctx, { caller, perMinute, globalPerMinute }) => {
    const now = Date.now();
    const windowStart = now - (now % 60_000);
    for (const [key, max] of [[`ip:${caller}`, perMinute], ["global", globalPerMinute]] as const) {
      const row = await ctx.db.query("rateLimits").withIndex("by_key", (q) => q.eq("key", key)).first();
      if (!row || row.windowStart !== windowStart) {
        if (row) await ctx.db.patch(row._id, { windowStart, count: 1 });
        else await ctx.db.insert("rateLimits", { key, windowStart, count: 1 });
      } else if (row.count >= max) {
        return false;
      } else {
        await ctx.db.patch(row._id, { count: row.count + 1 });
      }
    }
    return true;
  },
});
