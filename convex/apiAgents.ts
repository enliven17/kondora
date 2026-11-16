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

export const touch = internalMutation({
  args: { pubkey: v.string() },
  handler: async (ctx, { pubkey }) => {
    const row = await ctx.db.query("apiAgents").withIndex("by_pubkey", (q) => q.eq("pubkey", pubkey)).first();
    if (row) await ctx.db.patch(row._id, { lastSeenAt: Date.now(), requests: row.requests + 1 });
  },
});
