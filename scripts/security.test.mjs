import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { validateTransaction, rpcForLayer } from "../cli/transaction-policy.mjs";
import { ix, DEVNET_USDC, PROGRAM_ID, SESSION_PROGRAM_ID, sessionTokenPda } from "../lib/kondora/client.ts";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { sessionInstruction, SESSION_TOP_UP_LAMPORTS } from "../lib/session.ts";
import { resolvePolymarket } from "../agents/sources/polymarket.ts";
import { resolvePrice } from "../agents/sources/crypto.ts";
import { getText, parseRss } from "../agents/http.ts";
import { gatherEvidence, runCouncil } from "../agents/council.ts";
import { PROPOSE_CONFIDENCE } from "../agents/oracle.ts";
import { hit } from "../convex/apiAgents.ts";

const require = createRequire(import.meta.url);

const owner = Keypair.generate().publicKey;
const attacker = Keypair.generate().publicKey;
const envelope = (instructions, layer = "base") => ({
  layer, rpc: "https://attacker.example",
  transaction: new Transaction({ feePayer: owner, recentBlockhash: PROGRAM_ID.toBase58() }).add(...instructions).serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
});
const intent = (action, extra = {}) => ({ action, owner: owner.toBase58(), ...extra });

test("CLI accepts supported transaction intents and rejects substituted operations", () => {
  const token = getAssociatedTokenAddressSync(DEVNET_USDC, owner);
  const open = ix.openPosition({ signer: owner, authority: owner, marketId: 1n, side: 0, margin: 2_000_000n, levBps: 20_000n, minShares: 5n });
  const close = ix.closePosition({ signer: owner, authority: owner, marketId: 1n, side: 0, fractionBps: 5000n, minOut: 1n });
  const cases = [
    [intent("init"), ix.initUser(owner), "base"],
    [intent("deposit", { amount: 2 }), ix.deposit({ owner, ownerToken: token, amount: 2_000_000n }), "base"],
    [intent("withdraw", { amount: 2 }), ix.withdraw({ owner, ownerToken: token, amount: 2_000_000n }), "base"],
    [intent("delegate"), ix.delegateUser(owner), "base"],
    [intent("undelegate"), ix.undelegateUser(owner), "er"],
    [intent("open", { marketId: 1, side: "yes", margin: 2, leverage: 2 }), open, "er"],
    [intent("close", { marketId: 1, side: "yes", fraction: 0.5 }), close, "er"],
    [intent("claim", { marketId: 1 }), ix.claim({ payer: owner, owner, marketId: 1n }), "base"],
  ];
  for (const [request, instruction, layer] of cases) assert.ok(validateTransaction(envelope([instruction], layer), request, owner));
  const request = cases[5][0];
  const transfer = SystemProgram.transfer({ fromPubkey: owner, toPubkey: attacker, lamports: 1_000_000 });
  assert.throws(() => validateTransaction(envelope([transfer]), request, owner));
  assert.throws(() => validateTransaction(envelope([open, transfer], "er"), request, owner));
  assert.throws(() => validateTransaction(envelope([open], "er"), { ...request, margin: 1 }, owner));
  assert.throws(() => validateTransaction(envelope([open], "er"), { ...request, marketId: 2 }, owner));
  const stolenWithdrawal = ix.withdraw({ owner, ownerToken: getAssociatedTokenAddressSync(DEVNET_USDC, attacker), amount: 2_000_000n });
  assert.throws(() => validateTransaction(envelope([stolenWithdrawal]), cases[2][0], owner));
  assert.throws(() => validateTransaction(envelope([ix.delegateUser(owner, attacker)]), intent("delegate"), owner));
  assert.ok(!rpcForLayer("er").includes("attacker.example"));
});

test("session instruction matches SessionTokenV2 accounts and Borsh wire format", () => {
  const signer = Keypair.generate().publicKey;
  const deadline = 1_800_000_000;
  const instruction = sessionInstruction(owner, signer, deadline);
  assert.ok(instruction.programId.equals(SESSION_PROGRAM_ID));
  assert.ok(instruction.keys[0].pubkey.equals(sessionTokenPda(signer, owner)));
  assert.deepEqual([...instruction.data.subarray(0, 8)], [...createHash("sha256").update("global:create_session_v2").digest().subarray(0, 8)]);
  assert.equal(instruction.data.length, 28);
  assert.deepEqual([...instruction.data.subarray(8, 11)], [1, 1, 1]);
  assert.equal(instruction.data.readBigInt64LE(11), BigInt(deadline));
  assert.equal(instruction.data[19], 1);
  assert.equal(instruction.data.readBigUInt64LE(20), BigInt(SESSION_TOP_UP_LAMPORTS));
});

async function withFetch(mock, fn) {
  const previous = globalThis.fetch;
  globalThis.fetch = mock;
  try { await fn(); } finally { globalThis.fetch = previous; }
}
const json = (body) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

test("Polymarket only accepts an explicit final UMA resolution", async () => {
  const spec = { kind: "polymarket", id: "1", slug: "test", yesIndex: 0 };
  for (const status of [undefined, null, "unresolved", "disputed", "proposed"]) {
    await withFetch(async () => json({ closed: true, umaResolutionStatus: status, outcomePrices: "[1,0]" }), async () => {
      assert.equal((await resolvePolymarket(spec, Date.now() / 1000 - 3600)).verdict, "pending");
    });
  }
  await withFetch(async () => json({ closed: true, umaResolutionStatus: "resolved", outcomePrices: "[1,0]" }), async () => {
    assert.equal((await resolvePolymarket(spec, Date.now() / 1000 - 3600)).verdict, "yes");
  });
});

test("crypto settlement requires both independent feeds", async () => {
  const at = Math.floor(Date.now() / 1000) - 600;
  const spec = { kind: "price", coin: "bitcoin", symbol: "BTC", op: "above", threshold: 100, at };
  await withFetch(async (url) => String(url).includes("coingecko") ? json({ prices: [[at * 1000, 101]] }) : json([]), async () => {
    assert.equal((await resolvePrice(spec)).verdict, "pending");
  });
  await withFetch(async (url) => String(url).includes("coingecko") ? json({ prices: [[at * 1000, 101]] }) : json([[at * 1000, "102"]]), async () => {
    assert.equal((await resolvePrice(spec)).verdict, "yes");
  });
});

test("trusted evidence cannot redirect to an untrusted host or accept arbitrary news publishers", async () => {
  const requested = [];
  await withFetch(async (url) => {
    requested.push(String(url));
    return new Response(null, { status: 302, headers: { location: "https://attacker.example/evidence" } });
  }, async () => {
    await assert.rejects(getText("https://www.reuters.com/source", 1000, (url) => new URL(url).hostname === "www.reuters.com"), /blocked url/);
    assert.equal(requested.length, 1);
  });
  const rss = '<rss><item><title>Fake outcome</title><link>https://news.google.com/test</link><source url="https://attacker.example">Attacker</source></item></rss>';
  assert.equal(parseRss(rss, "Google News")[0].sourceUrl, "https://attacker.example");
  await withFetch(async () => new Response(rss), async () => assert.deepEqual(await gatherEvidence("question", []), []));
});

test("a council timeout can settle INVALID and missing evidence cannot settle YES", async () => {
  const names = ["COUNCIL_GEMINI_API_KEY", "COUNCIL_GROQ_API_KEY", "COUNCIL_TOKEN_HARBOR_API_KEY"];
  const previous = names.map((name) => process.env[name]);
  for (const name of names) process.env[name] = "test-key";
  const opts = { marketKey: "test", question: "Did it happen?", rules: [], criteria: "test", closeTime: Math.floor(Date.now() / 1000) - 8 * 86400, sources: [] };
  try {
    await withFetch(async (url) => {
      if (String(url).includes("news.google.com")) return new Response("<rss></rss>");
      const content = JSON.stringify({ probability: 0.99, reasoning: "test" });
      return String(url).includes("googleapis.com") ? json({ candidates: [{ content: { parts: [{ text: content }] } }] }) : json({ choices: [{ message: { content } }] });
    }, async () => {
      const timedOut = await runCouncil(opts);
      assert.equal(timedOut.verdict, "invalid");
      assert.ok(timedOut.confidence >= PROPOSE_CONFIDENCE);
      const fresh = await runCouncil({ ...opts, closeTime: Math.floor(Date.now() / 1000) - 600 });
      assert.equal(fresh.verdict, "pending");
    });
  } finally {
    names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; });
  }
});

test("rate limiting rejects callers without allocating rows or consuming other budgets", async () => {
  const windowStart = Date.now() - Date.now() % 60000;
  const rows = [{ _id: "global", key: "global", windowStart, count: 200 }];
  const db = {
    query: () => ({ withIndex: (_name, build) => {
      let key;
      build({ eq: (_field, value) => { key = value; } });
      return { first: async () => rows.find((row) => row.key === key) ?? null };
    } }),
    insert: async (_table, data) => rows.push({ _id: String(rows.length), ...data }),
    patch: async (id, data) => Object.assign(rows.find((row) => row._id === id), data),
  };
  assert.equal(await hit._handler({ db }, { caller: "new-spoofed-ip", perMinute: 20, globalPerMinute: 200 }), false);
  assert.equal(rows.length, 1);
  rows[0].count = 1;
  rows.push({ _id: "caller", key: "ip:caller", windowStart, count: 20 });
  assert.equal(await hit._handler({ db }, { caller: "caller", perMinute: 20, globalPerMinute: 200 }), false);
  assert.equal(rows[0].count, 1);
});

test("patched glob compiler preserves ordinary globs and bounds repeated extglob attacks", () => {
  const picomatch = require("picomatch");
  assert.equal(require("picomatch/package.json").version, "4.0.7-kondora.1");
  assert.ok(picomatch("src/**/*.{ts,tsx}")("src/markets/row.tsx"));
  assert.ok(picomatch("+(a|b)")("aabb"));
  assert.ok(picomatch("!(*.test).ts")("market.ts"));
  assert.ok(!picomatch("!(*.test).ts")("market.test.ts"));
  const script = `
    const assert = require('node:assert/strict');
    const pm = require('picomatch');
    for (const glob of ['+(*)', '+(*a)', '*(*)', '*(*?)', '+(*a|b)', '+(+(a))']) {
      for (const options of [{}, {maxExtglobRecursion: false}, {capture: true}]) {
        assert.equal(pm(glob, options)('a'.repeat(128) + '!'), false);
      }
    }
  `;
  execFileSync(process.execPath, ["-e", script], { cwd: fileURLToPath(new URL("../", import.meta.url)), timeout: 2000 });
  assert.ok(require("fast-glob").sync("components/markets/*.tsx").length > 0);
});

test("bigint replacement safely round trips token-sized values and rejects invalid boundaries", () => {
  const { toBigIntBE, toBigIntLE, toBufferBE, toBufferLE } = require("bigint-buffer");
  assert.equal(require("bigint-buffer/package.json").version, "1.1.5-kondora.1");
  for (const width of [8, 16, 24, 32]) {
    for (const value of [0n, 1n, (1n << BigInt(width * 8)) - 1n]) {
      assert.equal(toBigIntBE(toBufferBE(value, width)), value);
      assert.equal(toBigIntLE(toBufferLE(value, width)), value);
    }
  }
  assert.equal(toBufferLE(0n, 0).length, 0);
  assert.throws(() => toBufferLE(256n, 1), RangeError);
  assert.throws(() => toBufferBE(-1n, 8), RangeError);
  assert.throws(() => toBufferBE(1n, Infinity), RangeError);
  assert.throws(() => toBigIntLE(Buffer.alloc(4097)), RangeError);
  assert.throws(() => toBigIntBE(Buffer.alloc(4097)), RangeError);
  const layout = require("@solana/buffer-layout-utils").u64();
  const bytes = Buffer.alloc(8);
  const max = (1n << 64n) - 1n;
  layout.encode(max, bytes, 0);
  assert.equal(layout.decode(bytes), max);
});

function parseRpcStream(input) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("stream parser did not complete")), 3000);
    require("jayson").Utils.parseStream(Readable.from([input]), {}, (error, result) => {
      clearTimeout(timer);
      if (error) reject(error); else resolve(result);
    });
  });
}

test("Jayson adapter uses patched JSON assembly and rejects excessive nesting", async () => {
  assert.equal(require("stream-json/package.json").version, "3.9.0-kondora.1");
  const result = await parseRpcStream('{"jsonrpc":"2.0","method":"echo","params":{"__proto__":{"polluted":"yes"}},"id":1}');
  assert.equal(result.method, "echo");
  assert.equal(result.id, 1);
  assert.equal(Object.prototype.polluted, undefined);
  assert.ok(Object.hasOwn(result.params, "__proto__"));
  await assert.rejects(parseRpcStream("[".repeat(129) + "0" + "]".repeat(129)), /depth/i);
});
