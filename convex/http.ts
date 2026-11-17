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

/** Caller key for rate limiting: first hop of x-forwarded-for, else a shared bucket. */
const callerOf = (req: Request) => (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "anon").split(",")[0].trim().slice(0, 64);

type MutCtx = { runMutation: (m: typeof internal.apiAgents.hit, a: { caller: string; perMinute: number; globalPerMinute: number }) => Promise<boolean> };
/** Expensive routes (Node actions + RPC): 20 per minute per caller, 200 per minute overall. */
const allowed = (ctx: MutCtx, req: Request) => ctx.runMutation(internal.apiAgents.hit, { caller: callerOf(req), perMinute: 20, globalPerMinute: 200 });
const tooMany = () => json({ ok: false, error: "rate limited, try again in a minute" }, 429);
const LIMITS = [25, 50, 100, 200];
const clampLimit = (raw: string | null, dflt: number) => {
  const n = Number(raw ?? dflt);
  return LIMITS.find((l) => n <= l) ?? LIMITS[LIMITS.length - 1];
};

async function body(req: Request): Promise<Record<string, unknown>> {
  const maxBytes = 8192;
  if (Number(req.headers.get("content-length")) > maxBytes || !req.body) throw new Error("invalid body size");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("body too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
    return parsed as Record<string, unknown>;
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
      limit: clampLimit(u.searchParams.get("limit"), 200),
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
      limit: clampLimit(u.searchParams.get("limit"), 50),
    });
    return json({ ok: true, activity: rows });
  }),
});

http.route({
  path: `${BASE}/account`,
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const owner = new URL(req.url).searchParams.get("owner");
    if (!owner || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(owner)) return fail("owner must be a base58 public key");
    if (!(await allowed(ctx, req))) return tooMany();
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
      if (!(await allowed(ctx, req))) return tooMany();
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
      if (!(await allowed(ctx, req))) return tooMany();
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
      return json({ ok: true, ...tx });
    } catch (e) {
      return fail(e);
    }
  }),
});

/**
 * Register a display name. Body: { pubkey, name, url?, ts, nonce, signature }
 * signature = base58 ed25519 over `kondora:register:<name>:<ts>:<nonce>:<url or empty>`.
 */
http.route({
  path: `${BASE}/register`,
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      if (!(await allowed(ctx, req))) return tooMany();
      const b = await body(req);
      const pubkey = String(b.pubkey ?? "");
      const name = String(b.name ?? "").trim();
      const ts = Number(b.ts);
      const nonce = String(b.nonce ?? "");
      if (!/^[A-Za-z0-9 _.-]{2,32}$/.test(name)) throw new Error("name must be 2 to 32 letters, digits, space, _ . -");
      if (!/^[A-Za-z0-9]{8,64}$/.test(nonce)) throw new Error("nonce must be 8 to 64 alphanumerics");
      if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) throw new Error("ts must be within 5 minutes");
      if (/kondora|oracle|creator|auditor|admin|arbiter|council/i.test(name)) throw new Error("that name is reserved");
      const message = `kondora:register:${name}:${ts}:${nonce}:${b.url ? String(b.url) : ""}`;
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
