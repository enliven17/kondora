#!/usr/bin/env node
// kondora-agent: run your own trading agent against Kondora from your machine.
// Your key never leaves this process. The API only returns unsigned transactions.
//
//   kondora-agent keygen
//   kondora-agent register --name "My Agent"
//   kondora-agent markets [--category crypto]
//   kondora-agent quote <marketId> <yes|no> <usdc> [--lev 3]
//   kondora-agent setup --deposit 20          (init account, deposit, enter the rollup)
//   kondora-agent bet <marketId> <yes|no> <usdc> [--lev 2] [--slippage 100]
//   kondora-agent close <marketId> <yes|no> [--fraction 1]
//   kondora-agent claim <marketId>
//   kondora-agent positions
//   kondora-agent withdraw <usdc>              (leaves the rollup first)
//   kondora-agent run --strategy strategy.md [--budget 50] [--max-bet 5] [--max-lev 3] [--interval 300] [--dry]
//
// Env: KONDORA_API (Convex site URL), KONDORA_KEY (path, default ~/.kondora/agent.json),
//      LLM_BASE_URL + LLM_API_KEY + LLM_MODEL (any OpenAI-compatible endpoint) or GEMINI_API_KEY.

import { Connection, Keypair, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const API = (process.env.KONDORA_API ?? "https://api.kondora.xyz").replace(/\/$/, "") + "/api/agent/v1";
const KEY_PATH = process.env.KONDORA_KEY ?? join(homedir(), ".kondora", "agent.json");

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const k = rest[i].slice(2);
    const next = rest[i + 1];
    flags[k] = next === undefined || next.startsWith("--") ? true : (i++, next);
  } else args.push(rest[i]);
}

const die = (msg) => {
  console.error(`error: ${msg}`);
  process.exit(1);
};

function loadKey() {
  if (!existsSync(KEY_PATH)) die(`no key at ${KEY_PATH}. Run: kondora-agent keygen`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(KEY_PATH, "utf8"))));
}

async function call(path, init) {
  const r = await fetch(`${API}${path}`, init);
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  if (!j.ok) die(j.error ?? `HTTP ${r.status}`);
  return j;
}
const get = (path) => call(path);
const post = (path, body) => call(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function signAndSend(built, kp) {
  const tx = Transaction.from(Buffer.from(built.transaction, "base64"));
  tx.partialSign(kp);
  const conn = new Connection(built.rpc, "confirmed");
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: built.layer === "er" });
  const res = await conn.confirmTransaction(sig, "confirmed");
  if (res.value.err) die(`transaction ${sig} failed: ${JSON.stringify(res.value.err)}`);
  return sig;
}

async function act(action, extra = {}) {
  const kp = loadKey();
  const built = await post("/tx", { action, owner: kp.publicKey.toBase58(), agent: kp.publicKey.toBase58(), ...extra });
  const sig = await signAndSend(built, kp);
  console.log(`${action} ok (${built.layer}) ${sig}`);
  return sig;
}

const pct = (p) => `${(p * 100).toFixed(1)}%`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function account() {
  return (await get(`/account?owner=${loadKey().publicKey.toBase58()}`)).account;
}

async function ensureDelegated() {
  const a = await account();
  if (!a.exists) die("no Kondora account. Run: kondora-agent setup --deposit <usdc>");
  if (!a.delegated) {
    await act("delegate");
    await sleep(3000);
  }
}

// ── Autonomous loop ──────────────────────────────────────────────────────

async function llm(system, user) {
  if (process.env.LLM_BASE_URL && process.env.LLM_API_KEY) {
    const r = await fetch(`${process.env.LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL ?? "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    const j = await r.json();
    return JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
  }
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.LLM_MODEL ?? "gemini-2.5-flash";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      }),
    });
    const j = await r.json();
    return JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
  }
  die("set LLM_BASE_URL + LLM_API_KEY (OpenAI-compatible) or GEMINI_API_KEY");
}

async function runLoop() {
  const strategy = flags.strategy ? readFileSync(String(flags.strategy), "utf8") : "Bet only when you have a clear edge over the market price.";
  const budget = Number(flags.budget ?? 50);
  const maxBet = Number(flags["max-bet"] ?? 5);
  const maxLev = Math.min(Number(flags["max-lev"] ?? 2), 5);
  const interval = Number(flags.interval ?? 300) * 1000;
  const dry = !!flags.dry;
  let spent = 0;
  if (!dry) await ensureDelegated();
  console.log(`agent running: budget ${budget} USDC, max bet ${maxBet}, max leverage ${maxLev}x${dry ? ", dry run" : ""}`);
  for (;;) {
    try {
      const { markets } = await get(`/markets?state=open&limit=80`);
      const acct = dry ? { positions: [] } : await account();
      const held = new Set((acct.positions ?? []).map((p) => `${p.marketId}:${p.side}`));
      const list = markets
        .filter((m) => m.closeTime - Date.now() / 1000 > 3 * 3600)
        .map((m) => `#${m.id} [${m.category}] ${m.question} | YES ${pct(m.yesPrice)} | closes ${new Date(m.closeTime * 1000).toISOString()} | rules: ${m.rules[0]?.slice(0, 160)}`)
        .join("\n");
      const plan = await llm(
        `You are a prediction market trading agent. Strategy from your owner:\n${strategy}\n
Return JSON {"bets":[{"marketId":number,"side":"yes"|"no","usdc":number,"leverage":number,"probability":number,"reason":string}]}.
Only include bets where your probability differs from the price by at least 8 points. Max ${maxBet} USDC per bet, leverage 1 to ${maxLev}. Empty list is fine.`,
        `Open markets:\n${list}\nAlready holding: ${[...held].join(", ") || "none"}`,
      );
      for (const b of plan.bets ?? []) {
        const usdc = Math.min(Number(b.usdc) || 0, maxBet, budget - spent);
        if (usdc < 1 || held.has(`${b.marketId}:${b.side}`)) continue;
        const lev = Math.min(Math.max(Number(b.leverage) || 1, 1), maxLev);
        const { quote } = await post("/quote", { marketId: b.marketId, side: b.side, margin: usdc, leverage: lev });
        const levOk = Math.min(lev, quote.maxLeverage);
        console.log(`#${b.marketId} ${b.side.toUpperCase()} ${usdc} USDC x${levOk} at ${pct(b.side === "yes" ? quote.priceYes : 1 - quote.priceYes)} (model ${pct(b.probability)}): ${b.reason}`);
        if (dry) continue;
        await act("open", { marketId: b.marketId, side: b.side, margin: usdc, leverage: levOk, slippageBps: 150 });
        spent += usdc;
      }
    } catch (e) {
      console.error(`loop error: ${e.message ?? e}`);
    }
    if (spent >= budget) {
      console.log("budget used, stopping");
      return;
    }
    await sleep(interval);
  }
}

// ── Commands ─────────────────────────────────────────────────────────────

switch (cmd) {
  case "keygen": {
    if (existsSync(KEY_PATH) && !flags.force) die(`key exists at ${KEY_PATH} (use --force to replace)`);
    const kp = Keypair.generate();
    mkdirSync(dirname(KEY_PATH), { recursive: true });
    writeFileSync(KEY_PATH, JSON.stringify([...kp.secretKey]), { mode: 0o600 });
    console.log(`agent address: ${kp.publicKey.toBase58()}\nfund it with devnet SOL and Circle devnet USDC, then run setup`);
    break;
  }
  case "register": {
    const kp = loadKey();
    const name = String(flags.name ?? "").trim() || die("--name required");
    const ts = Math.floor(Date.now() / 1000);
    const nonce = randomBytes(12).toString("hex");
    const message = `kondora:register:${name}:${ts}:${nonce}`;
    const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey));
    await post("/register", { pubkey: kp.publicKey.toBase58(), name, url: flags.url, ts, nonce, signature });
    console.log(`registered ${name}`);
    break;
  }
  case "markets": {
    const q = flags.category ? `&category=${flags.category}` : "";
    const { markets } = await get(`/markets?state=open${q}`);
    for (const m of markets) console.log(`#${String(m.id).padEnd(5)} ${pct(m.yesPrice).padStart(6)}  [${m.category}] ${m.question}`);
    break;
  }
  case "quote": {
    const [id, side, usdc] = args;
    const { quote } = await post("/quote", { marketId: Number(id), side, margin: Number(usdc), leverage: Number(flags.lev ?? 1) });
    console.log(JSON.stringify(quote, null, 2));
    break;
  }
  case "setup": {
    const a = await account();
    if (!a.exists) await act("init");
    if (flags.deposit) {
      if (a.delegated) {
        await act("undelegate");
        await sleep(4000);
      }
      await act("deposit", { amount: Number(flags.deposit) });
    }
    await sleep(1500);
    if (!(await account()).delegated) await act("delegate");
    console.log("ready to trade");
    break;
  }
  case "bet": {
    const [id, side, usdc] = args;
    await ensureDelegated();
    await act("open", { marketId: Number(id), side, margin: Number(usdc), leverage: Number(flags.lev ?? 1), slippageBps: Number(flags.slippage ?? 100) });
    break;
  }
  case "close": {
    const [id, side] = args;
    await act("close", { marketId: Number(id), side, fraction: Number(flags.fraction ?? 1) });
    break;
  }
  case "claim":
    await act("claim", { marketId: Number(args[0]) });
    break;
  case "positions": {
    const a = await account();
    if (!a.exists) die("no account");
    console.log(`balance ${a.balance} USDC, realized PnL ${a.realizedPnl}, ${a.delegated ? "in rollup" : "on base layer"}`);
    for (const p of a.positions) console.log(`#${p.marketId} ${p.side.toUpperCase()} shares ${p.shares} margin ${p.margin} debt ${p.debt}`);
    break;
  }
  case "withdraw": {
    const a = await account();
    if (a.delegated) {
      await act("undelegate");
      await sleep(4000);
    }
    await act("withdraw", { amount: Number(args[0]) });
    break;
  }
  case "run":
    await runLoop();
    break;
  default:
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 19).join("\n").replace(/^\/\/ ?/gm, ""));
}
