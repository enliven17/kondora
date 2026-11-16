// Public Agent API: lets anyone's local agent read markets, quote, build
// unsigned transactions and register a name on the leaderboard.
// Docs: /docs/agents. Base path: <CONVEX_SITE_URL>/api/agent/v1

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();
const BASE = "/api/agent/v1";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors } });
const fail = (e: unknown, status = 400) => json({ ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 300) }, status);

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    throw new Error("invalid JSON body");
  }
}

for (const path of ["markets", "market", "activity", "account", "quote", "tx", "register", "agents"]) {
  http.route({ path: `${BASE}/${path}`, method: "OPTIONS", handler: httpAction(async () => new Response(null, { headers: cors })) });
}

http.route({
  path: `${BASE}/markets`,
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const u = new URL(req.url);
    const markets = await ctx.runQuery(api.markets.list, {
      category: u.searchParams.get("category") ?? undefined,
      state: u.searchParams.get("state") ?? "open",
      limit: Number(u.searchParams.get("limit") ?? 200),
    });
    return json({ ok: true, markets: markets.map(({ history, ...m }) => ({ ...m, history: history.slice(-12) })) });
  }),
});

http.route({
  path: `${BASE}/market`,
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("id required");
    const m = await ctx.runQuery(api.markets.get, { id });
    return m ? json({ ok: true, market: m }) : fail("not found", 404);
  }),
});

http.route({
  path: `${BASE}/activity`,
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const u = new URL(req.url);
    const rows = await ctx.runQuery(api.markets.activity, {
      marketId: u.searchParams.get("market") ?? undefined,
      owner: u.searchParams.get("owner") ?? undefined,
      limit: Number(u.searchParams.get("limit") ?? 50),
    });
    return json({ ok: true, activity: rows });
  }),
});

http.route({
  path: `${BASE}/account`,
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const owner = new URL(req.url).searchParams.get("owner");
    if (!owner) return fail("owner required");
    try {
      return json({ ok: true, account: await ctx.runAction(internal.agentApi.account, { owner }) });
    } catch (e) {
      return fail(e);
    }
  }),
});

http.route({
  path: `${BASE}/quote`,
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const b = await body(req);
      const q = await ctx.runAction(internal.agentApi.quote, {
        marketId: Number(b.marketId),
        side: String(b.side),
        margin: Number(b.margin),
        leverage: Number(b.leverage ?? 1),
      });
      return json({ ok: true, quote: q });
    } catch (e) {
      return fail(e);
    }
  }),
});

http.route({
  path: `${BASE}/tx`,
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const b = await body(req);
      const num = (k: string) => (b[k] === undefined ? undefined : Number(b[k]));
      const str = (k: string) => (b[k] === undefined ? undefined : String(b[k]));
      const tx = await ctx.runAction(internal.agentApi.buildTx, {
        action: String(b.action),
        owner: String(b.owner),
        signer: str("signer"),
        sessionToken: str("sessionToken"),
        marketId: num("marketId"),
        side: str("side"),
        margin: num("margin"),
        leverage: num("leverage"),
        fraction: num("fraction"),
        slippageBps: num("slippageBps"),
        amount: num("amount"),
      });
      if (str("agent")) await ctx.runMutation(internal.apiAgents.touch, { pubkey: String(b.agent) });
      return json({ ok: true, ...tx });
    } catch (e) {
      return fail(e);
    }
  }),
});

/**
 * Register a display name. Body: { pubkey, name, url?, ts, nonce, signature }
 * signature = base58 ed25519 over `kondora:register:<name>:<ts>:<nonce>`.
 */
http.route({
  path: `${BASE}/register`,
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const b = await body(req);
      const pubkey = String(b.pubkey ?? "");
      const name = String(b.name ?? "").trim();
      const ts = Number(b.ts);
      const nonce = String(b.nonce ?? "");
      if (!/^[A-Za-z0-9 _.-]{2,32}$/.test(name)) throw new Error("name must be 2 to 32 letters, digits, space, _ . -");
      if (!/^[A-Za-z0-9]{8,64}$/.test(nonce)) throw new Error("nonce must be 8 to 64 alphanumerics");
      if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) throw new Error("ts must be within 5 minutes");
      const message = `kondora:register:${name}:${ts}:${nonce}`;
      const okSig = await ctx.runAction(internal.agentApi.verifySignature, { pubkey, message, signature: String(b.signature ?? "") });
      if (!okSig) throw new Error("bad signature");
      const url = b.url ? String(b.url).slice(0, 200) : undefined;
      if (url && !/^https:\/\//.test(url)) throw new Error("url must be https");
      await ctx.runMutation(internal.apiAgents.register, { pubkey, name, url, nonce });
      return json({ ok: true });
    } catch (e) {
      return fail(e);
    }
  }),
});

http.route({
  path: `${BASE}/agents`,
  method: "GET",
  handler: httpAction(async (ctx) => json({ ok: true, ...(await ctx.runQuery(api.markets.agents, {})) })),
});

export default http;
