// Daily traded notional for the stats page. Buckets live in volumeDays: the indexer bumps them as trades
// arrive (markets.insertTradesAndCursor), and backfill fills them from trades indexed before that switch.
//   npx convex run stats:backfill   (once, then it is a no-op)

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, query } from "./_generated/server";
import { bumpDay, VOLUME_DAYS_FROM } from "./markets";

const DAY = 86_400;

/** The last `days` UTC days, oldest first, zero filled. */
export const daily = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 14 }) => {
    const n = Math.max(1, Math.min(60, Math.floor(days)));
    const today = Math.floor(Date.now() / 1000 / DAY) * DAY, from = today - (n - 1) * DAY;
    const rows = await ctx.db.query("volumeDays").withIndex("by_day", (q) => q.gte("day", from)).collect();
    const by = new Map(rows.map((r) => [r.day, r]));
    return Array.from({ length: n }, (_, i) => { const day = from + i * DAY, r = by.get(day); return { day, volume: r?.volume ?? 0, trades: r?.trades ?? 0 }; });
  },
});

/** Starts live bucketing and returns the creation-time cutoff: trades created before it belong to the backfill. */
export const start = internalMutation({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("cursors").withIndex("by_name", (q) => q.eq("name", VOLUME_DAYS_FROM)).first();
    if (row) return { cutoff: Number(row.value), started: false };
    const cutoff = Date.now();
    await ctx.db.insert("cursors", { name: VOLUME_DAYS_FROM, value: String(cutoff) });
    return { cutoff, started: true };
  },
});

/** One page of trades in creation order; only rows created before the cutoff are counted. */
export const page = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), cutoff: v.number() },
  handler: async (ctx, { cursor, cutoff }) => {
    const res = await ctx.db.query("trades").order("asc").paginate({ cursor, numItems: 400 });
    let counted = 0;
    for (const t of res.page) if (t._creationTime < cutoff) { await bumpDay(ctx, t); counted++; }
    const passed = res.page.length > 0 && res.page[res.page.length - 1]._creationTime >= cutoff;
    return { cursor: res.continueCursor, done: res.isDone || passed, counted };
  },
});

export const backfill = internalAction({
  args: {},
  handler: async (ctx): Promise<{ counted: number; skipped?: boolean }> => {
    const { cutoff, started } = await ctx.runMutation(internal.stats.start, {});
    if (!started) return { counted: 0, skipped: true };
    let cursor: string | null = null, counted = 0;
    for (;;) {
      const r: { cursor: string; done: boolean; counted: number } = await ctx.runMutation(internal.stats.page, { cursor, cutoff });
      counted += r.counted; cursor = r.cursor;
      if (r.done) break;
    }
    return { counted };
  },
});
