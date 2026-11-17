// Long soak run on devnet + the ER with all faucet wallets.
//   program/node_modules/.bin/tsx scripts/soak-devnet.mts [hours=12]
// Spreads every scenario over time: random bets, counter bets, partial and full
// closes, whale + crowd liquidation episodes, withdraw and re-deposit cycles,
// claims on resolved markets, and probes the program must refuse.
// Writes .soak/events.jsonl and .soak/summary.json; sessions persist in .soak/sessions.json.

import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync(".soak", { recursive: true });
const SESSIONS = ".soak/sessions.json";
const store = new Map<string, string>(existsSync(SESSIONS) ? Object.entries(JSON.parse(readFileSync(SESSIONS, "utf8"))) : []);
const persist = () => writeFileSync(SESSIONS, JSON.stringify(Object.fromEntries(store)));
Object.assign(globalThis, {
  document: { visibilityState: "visible" },
  window: Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => (store.set(k, v), persist()),
      removeItem: (k: string) => (store.delete(k), persist()),
    },
  }),
});

const { baseConnection, erConnection } = await import("../lib/chain");
const { readAccount } = await import("../lib/account");
const { subscribeMarket } = await import("../lib/live");
const trade = await import("../lib/trade");
const { leverageCap, maxFeasibleLeverage, maxFeasibleMargin } = await import("../lib/leverage");
const { DEVNET_USDC, DELEGATION_PROGRAM_ID, decodeUser, userPda, ix, configPda, decodeConfig, decodeMarket, marketPda, STATE, STATE_NAME, amm } = await import("../lib/kondora");

type Live = Parameters<Parameters<typeof subscribeMarket>[1]>[0];
type Snap = Awaited<ReturnType<typeof readAccount>>;
type Side = "yes" | "no";
type Result = { ok: boolean; error?: string };

const HOURS = Number(process.argv[2] ?? 12);
const END = Date.now() + HOURS * 3600_000;
const conn = baseConnection();
const er = erConnection();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(".keys/admin.json", "utf8"))));
const wallets = (JSON.parse(readFileSync(".keys/faucet/wallets.json", "utf8")) as number[][]).map((s) => Keypair.fromSecretKey(Uint8Array.from(s)));
const short = (k: Keypair) => k.publicKey.toBase58().slice(0, 6);
const sideNum = (s: Side) => (s === "yes" ? 0 : 1) as 0 | 1;
const other = (s: Side): Side => (s === "yes" ? "no" : "yes");
const asWallet = (k: Keypair) => ({
  publicKey: k.publicKey,
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof VersionedTransaction) tx.sign([k]);
    else tx.partialSign(k);
    return tx;
  },
});

// ── Logging ──────────────────────────────────────────────────────────────
const tally: Record<string, { pass: number; fail: number; infra: number }> = {};
const failures: { at: string; scenario: string; note: string }[] = [];
const INFRA = /timed out|fetch failed|blockhash|429|ECONN|socket|503|502|Too many|network/i;
function log(scenario: string, verdict: "pass" | "fail" | "infra", note = "") {
  const t = (tally[scenario] ??= { pass: 0, fail: 0, infra: 0 });
  t[verdict]++;
  const at = new Date().toISOString();
  if (verdict === "fail") failures.push({ at, scenario, note });
  appendFileSync(".soak/events.jsonl", JSON.stringify({ at, scenario, verdict, note }) + "\n");
  console.log(`${at.slice(11, 19)} ${verdict.toUpperCase().padEnd(5)} ${scenario}${note ? `  ${note}` : ""}`);
}
const ok = (scenario: string, r: Result, note = "") => {
  log(scenario, r.ok ? "pass" : INFRA.test(r.error ?? "") ? "infra" : "fail", r.ok ? note : `${note} ${r.error ?? ""}`.trim());
  return r.ok;
};
const refused = (scenario: string, r: Result, want: RegExp, note = "") =>
  log(scenario, !r.ok && want.test(r.error ?? "") ? "pass" : !r.ok && INFRA.test(r.error ?? "") ? "infra" : "fail", `${note} ${r.ok ? "was accepted" : (r.error ?? "").replace(/^.*Error Code: /, "").slice(0, 70)}`.trim());

function summary() {
  writeFileSync(".soak/summary.json", JSON.stringify({ updated: new Date().toISOString(), endsAt: new Date(END).toISOString(), tally, failures: failures.slice(-50) }, null, 2));
  const p = Object.values(tally).reduce((a, t) => a + t.pass, 0);
  const f = Object.values(tally).reduce((a, t) => a + t.fail, 0);
  const i = Object.values(tally).reduce((a, t) => a + t.infra, 0);
  console.log(`── summary: ${p} pass, ${f} fail, ${i} infra, ${ready.length} wallets, ${markets.length} markets`);
}

// ── Chain helpers ────────────────────────────────────────────────────────
const liveOf = (id: bigint) =>
  Promise.race([
    new Promise<Live>((resolve) => {
      const stop = subscribeMarket(String(id), (s) => {
        stop();
        resolve(s);
      });
    }),
    sleep(15_000).then(() => {
      throw new Error(`market ${id} read timed out`);
    }),
  ]);

async function marketState(id: bigint) {
  const base = await conn.getAccountInfo(marketPda(id));
  if (!base) return null;
  const data = base.owner.equals(DELEGATION_PROGRAM_ID) ? ((await er.getAccountInfo(marketPda(id)))?.data ?? base.data) : base.data;
  return decodeMarket(data);
}

async function erRaw(k: Keypair, ixs: Parameters<Transaction["add"]>): Promise<Result> {
  try {
    const tx = new Transaction().add(...ixs);
    const bh = await er.getLatestBlockhash("confirmed");
    tx.recentBlockhash = bh.blockhash;
    tx.feePayer = k.publicKey;
    tx.sign(k);
    const sig = await er.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    const res = await er.confirmTransaction({ signature: sig, ...bh }, "confirmed");
    if (!res.value.err) return { ok: true };
    const logs = (await er.getTransaction(sig, { maxSupportedTransactionVersion: 0 }).catch(() => null))?.meta?.logMessages ?? [];
    return { ok: false, error: logs.find((l) => l.includes("Error Code")) ?? JSON.stringify(res.value.err) };
  } catch (e) {
    return { ok: false, error: String((e as Error).message) };
  }
}

async function baseSend(signers: Keypair[], ixs: Parameters<Transaction["add"]>) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(admin, ...signers);
  await conn.confirmTransaction(await conn.sendRawTransaction(tx.serialize()), "confirmed");
}

const snapOf = (k: Keypair) => readAccount(k.publicKey);
const balanceOf = (s: Snap) => Number(s.user?.balance ?? 0n) / 1e6;
const feasibleArgs = (l: Live, s: Side) => [{ yesPrice: l.priceYes, liquidity: 0 }, s, l.pool, l.account.params.max_price_bps / 10_000, l.floorL] as const;
const capOf = (l: Live) => leverageCap(l.priceYes, Number(l.account.close_time)).cap;

// ── State ────────────────────────────────────────────────────────────────
const ready: Keypair[] = [];
let markets: bigint[] = [];
const lastTrade = new Map<bigint, { k: Keypair; side: Side; margin: number }>();
const busy = new Set<string>(); // wallets reserved by a liquidation episode
const episodes = new Set<bigint>();
const timers: { at: number; run: () => Promise<void> }[] = [];
const later = (ms: number, run: () => Promise<void>) => timers.push({ at: Date.now() + ms, run });
const freeWallets = () => ready.filter((k) => !busy.has(k.publicKey.toBase58()));

// ── Setup: spread USDC, top up SOL, enable trading ───────────────────────
/** Trading balance and open debt for every wallet, two batched reads per 100 wallets. */
async function accounts() {
  const out: { balance: number; debt: boolean }[] = [];
  for (let i = 0; i < wallets.length; i += 100) {
    const pdas = wallets.slice(i, i + 100).map((k) => userPda(k.publicKey));
    const base = await conn.getMultipleAccountsInfo(pdas);
    const onEr = await er.getMultipleAccountsInfo(pdas).catch(() => pdas.map(() => null));
    base.forEach((b, j) => {
      const data = b?.owner.equals(DELEGATION_PROGRAM_ID) ? (onEr[j]?.data ?? b.data) : b?.data;
      try {
        const u = data ? decodeUser(data) : null;
        out.push({ balance: u ? Number(u.balance) / 1e6 : 0, debt: !!u?.positions.some((p) => p.debt > 0n) });
      } catch {
        out.push({ balance: 0, debt: false });
      }
    });
  }
  return out;
}

const TARGET = 2.5;

/**
 * Keeps USDC moving across all wallets: accounts that grew fat withdraw the
 * surplus, the surplus goes to wallets with nothing, enrol() deposits it again.
 */
async function spreadFunds() {
  const atasOf = async () => (await conn.getMultipleAccountsInfo(wallets.map((k) => getAssociatedTokenAddressSync(DEVNET_USDC, k.publicKey)))).map((a) => (a ? Number(a.data.readBigUInt64LE(64)) / 1e6 : 0));
  const acc = await accounts();
  let usdc = await atasOf();
  const needy = wallets.filter((_, i) => usdc[i] < 0.5 && acc[i].balance < 0.3);
  const need = needy.length * TARGET;
  let free = wallets.reduce((a, _, i) => a + Math.max(0, usdc[i] - (acc[i].balance < 0.3 ? TARGET : 0.2)), 0);

  // SOL first: withdrawing and delegating again pay rent and fees from the wallet.
  const sols = await conn.getMultipleAccountsInfo(wallets.map((k) => k.publicKey));
  const lowSol = wallets.filter((_, i) => (sols[i]?.lamports ?? 0) < 0.015 * LAMPORTS_PER_SOL && (usdc[i] >= 0.5 || acc[i].balance >= 0.3 || needy.includes(wallets[i])));
  for (let i = 0; i < lowSol.length; i += 10) {
    await baseSend([], lowSol.slice(i, i + 10).map((k) => SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: k.publicKey, lamports: 0.025 * LAMPORTS_PER_SOL })));
  }
  // Withdraw surplus from the richest debt free accounts until it covers the needy.
  const rich = wallets.map((k, i) => ({ k, i, extra: acc[i].balance - 4 })).filter((x) => x.extra > 1 && !acc[x.i].debt).sort((a, b) => b.extra - a.extra);
  for (const r of rich) {
    if (free >= need) break;
    const s = await snapOf(r.k);
    const amount = Math.floor(r.extra * 100) / 100;
    if (ok("rotate: withdraw surplus", await trade.withdraw({ wallet: asWallet(r.k), snap: s, amount }), `${short(r.k)} ${amount}`)) free += amount;
  }

  usdc = await atasOf();

  const donors = wallets.map((k, i) => ({ k, spare: usdc[i] - (needy.includes(k) ? TARGET : 0.2) })).filter((d) => d.spare >= TARGET);
  let moved = 0;
  for (const to of needy) {
    const d = donors.find((x) => x.spare >= TARGET);
    if (!d) break;
    const toAta = getAssociatedTokenAddressSync(DEVNET_USDC, to.publicKey);
    try {
      await baseSend([d.k], [
        createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, toAta, to.publicKey, DEVNET_USDC),
        createTransferCheckedInstruction(getAssociatedTokenAddressSync(DEVNET_USDC, d.k.publicKey), DEVNET_USDC, toAta, d.k.publicKey, BigInt(TARGET * 1e6), 6),
      ]);
      d.spare -= TARGET;
      moved++;
    } catch (e) {
      log("rotate: send to empty wallet", "infra", String((e as Error).message).slice(0, 80));
    }
  }
  log("rotate: funds spread", "pass", `${moved}/${needy.length} empty wallets got ${TARGET} USDC, ${lowSol.length} got SOL`);
}

/** Enables trading (or tops it up) for every wallet holding USDC in its token account. */
async function enrol() {
  for (const k of wallets) {
    try {
      const s = await snapOf(k);
      const free = Math.floor((Number(s.usdc) / 1e6 - 0.05) * 100) / 100;
      const isReady = s.delegated && !!s.session;
      // Topping up needs an undelegate, which open debt blocks: only add a session key then.
      if (s.delegated && s.user?.positions.some((p) => p.debt > 0n)) {
        if (!s.session && !ok("session key only (debt open)", await trade.enableTrading({ wallet: asWallet(k), snap: s, deposit: 0 }), short(k))) continue;
        if (!ready.some((r) => r.publicKey.equals(k.publicKey))) ready.push(k);
        continue;
      }
      if (!isReady || free >= 0.5) {
        if (!isReady && free < 0.5 && balanceOf(s) < 0.1) continue;
        if (!ok(isReady ? "deposit more" : "enable trading", await trade.enableTrading({ wallet: asWallet(k), snap: s, deposit: free >= 0.5 ? free : 0 }), `${short(k)} +${Math.max(0, free).toFixed(2)}`)) continue;
        await sleep(2_000);
      }
      if (!ready.some((r) => r.publicKey.equals(k.publicKey))) ready.push(k);
    } catch (e) {
      log("enable trading", "infra", String((e as Error).message).slice(0, 80));
    }
  }
}

async function refreshMarkets() {
  const cfg = decodeConfig((await conn.getAccountInfo(configPda()))!.data);
  const open: bigint[] = [];
  for (let id = 1n; id < cfg.next_market_id; id++) {
    const m = await marketState(id).catch(() => null);
    if (m && m.state === STATE.OPEN && Number(m.close_time) - Date.now() / 1000 > 1800) open.push(id);
  }
  markets = open;
}

// ── Scenarios ────────────────────────────────────────────────────────────
async function randomBet(counter = false) {
  const id = pick(markets);
  const prev = lastTrade.get(id);
  const pool = freeWallets().filter((k) => !counter || !prev || !k.publicKey.equals(prev.k.publicKey));
  const k = pick(pool);
  const s = await snapOf(k);
  const bal = balanceOf(s);
  if (bal < 0.15) return;
  const live = await liveOf(id);
  const side: Side = counter && prev ? other(prev.side) : Math.random() < 0.5 ? "yes" : "no";
  let margin = counter && prev ? prev.margin : pick([0.1, 0.2, 0.3, 0.5, 1, 1.5, 2]);
  margin = Math.min(margin, Math.floor((bal - 0.05) * 100) / 100);
  if (margin < 0.1) return;
  const cap = capOf(live);
  const want = Math.round(rand(1, Math.max(1, cap)) * 10) / 10;
  const feasible = maxFeasibleLeverage([...feasibleArgs(live, side)], margin, cap);
  if (feasible === 0) {
    // Pool cannot take this size even at 1x: the program must agree.
    return refused("oversized bet refused", await rawOpen(k, s, id, side, margin, 1), /Unhealthy|PriceLimit|Liquidity|Error/, `#${id}`);
  }
  const lev = Math.min(want, feasible);
  const r = await trade.placeBet({ wallet: asWallet(k), snap: s, live, side, margin, leverage: lev });
  if (ok(counter ? "counter bet" : "bet", r, `#${id} ${short(k)} ${side} ${margin} @ ${lev}x`)) lastTrade.set(id, { k, side, margin });
}

async function rawOpen(k: Keypair, s: Snap, id: bigint, side: Side, margin: number, lev: number, minShares = 0n) {
  if (!s.session) return { ok: false, error: "no session" };
  return erRaw(s.session.keypair, [
    ix.openPosition({
      signer: s.session.keypair.publicKey,
      authority: k.publicKey,
      marketId: id,
      side: sideNum(side),
      margin: BigInt(Math.round(margin * 1e6)),
      levBps: BigInt(Math.round(lev * 10_000)),
      minShares,
      sessionToken: s.session.token,
    }),
  ]);
}

async function closeSome() {
  const k = pick(freeWallets());
  const s = await snapOf(k);
  const open = s.user?.positions.filter((p) => p.shares > 0n && markets.includes(p.market_id)) ?? [];
  if (!open.length) return;
  const p = pick(open);
  const live = await liveOf(p.market_id);
  const fraction = pick([2_500, 5_000, 10_000, 10_000]);
  const out = trade.expectedCloseOut(live, p, fraction);
  const r = await trade.closePosition({ wallet: asWallet(k), snap: s, live, position: p, fractionBps: fraction });
  if (out <= 0 && p.debt > 0n) return refused("underwater self close refused", r, /underwater/i, `#${p.market_id}`);
  ok(fraction === 10_000 ? "close" : "partial close", r, `#${p.market_id} ${short(k)} ${fraction / 100}%`);
}

async function probes() {
  const id = pick(markets);
  const k = pick(freeWallets());
  const s = await snapOf(k);
  if (!s.session || balanceOf(s) < 0.3) return;
  const live = await liveOf(id);
  const which = pick(["min", "lev", "balance", "slippage", "foreign", "early-liq"]);
  if (which === "min") refused("below minimum refused", await rawOpen(k, s, id, "yes", 0.05, 1), /TooSmall/, `#${id}`);
  if (which === "lev") refused("leverage above 5x refused", await rawOpen(k, s, id, "yes", 0.2, 6), /Leverage/, `#${id}`);
  if (which === "balance") refused("margin above balance refused", await rawOpen(k, s, id, "no", balanceOf(s) + 1, 1), /Insufficient/, `#${id}`);
  if (which === "slippage") refused("slippage bound refused", await rawOpen(k, s, id, "yes", 0.2, 1, 10_000_000_000n), /Slippage/, `#${id}`);
  if (which === "foreign") {
    const victim = pick(ready.filter((x) => !x.publicKey.equals(k.publicKey)));
    refused("session key for another owner refused", await erRaw(s.session.keypair, [
      ix.openPosition({ signer: s.session.keypair.publicKey, authority: victim.publicKey, marketId: id, side: 0, margin: 200_000n, levBps: 10_000n, minShares: 0n, sessionToken: s.session.token }),
    ]), /InvalidToken|Constraint|seeds/i, `#${id}`);
  }
  if (which === "early-liq") {
    // A healthy leveraged position somewhere: liquidation must be refused.
    for (const w of ready) {
      const ws = await snapOf(w);
      const p = ws.user?.positions.find((x) => x.debt > 0n && x.market_id === id);
      if (!p) continue;
      const markZ = amm.markAt(live.account.mark_z, Number(live.account.mark_t), live.account.z, Date.now() / 1000);
      if (amm.isLiquidatableAtMark(markZ, live.account.params.mm_bps, p.side as 0 | 1, Number(p.shares), Number(p.debt), Number(p.accrued))) return;
      return refused("healthy position liquidation refused", await erRaw(k, [ix.liquidate({ payer: k.publicKey, owner: w.publicKey, marketId: id, side: p.side })]), /Healthy/, `#${id}`);
    }
  }
}

/** Whale opens big and leveraged, a crowd pushes the price the other way, liquidation follows. */
async function liquidationEpisode() {
  const candidates = markets.filter((id) => !episodes.has(id));
  if (!candidates.length) return;
  const id = pick(candidates);
  const rich = freeWallets().filter((k) => !busy.has(k.publicKey.toBase58()));
  if (rich.length < 5) return;
  const shuffled = [...rich].sort(() => Math.random() - 0.5);
  const whale = (await Promise.all(shuffled.slice(0, 10).map(async (k) => ({ k, b: balanceOf(await snapOf(k)) })))).sort((a, b) => b.b - a.b)[0];
  if (whale.b < 1) return;
  const crowd = shuffled.filter((k) => !k.publicKey.equals(whale.k.publicKey)).slice(0, 3);
  const liquidator = shuffled.filter((k) => k !== whale.k && !crowd.includes(k))[0];
  let live = await liveOf(id);
  const side: Side = live.priceYes <= 0.5 ? "yes" : "no";
  const cap = capOf(live);
  let margin = Math.min(3, whale.b - 0.1);
  let lev = Math.min(cap, maxFeasibleLeverage([...feasibleArgs(live, side)], margin, cap));
  if (lev < 2) {
    lev = Math.min(cap, 2.5);
    margin = Math.min(margin, maxFeasibleMargin([...feasibleArgs(live, side)], lev, margin));
  }
  if (margin < 0.2 || lev < 1.5) return;
  const ws = await snapOf(whale.k);
  if (!ok("episode: whale opens", await trade.placeBet({ wallet: asWallet(whale.k), snap: ws, live, side, margin, leverage: lev }), `#${id} ${short(whale.k)} ${side} ${margin.toFixed(2)} @ ${lev}x`)) return;
  episodes.add(id);
  [whale.k, ...crowd].forEach((k) => busy.add(k.publicKey.toBase58()));
  for (const c of crowd) {
    live = await liveOf(id);
    const cs = await snapOf(c);
    const room = maxFeasibleMargin([...feasibleArgs(live, other(side))], 1, Math.min(4, balanceOf(cs) - 0.1));
    if (room >= 0.1) ok("episode: crowd pushes", await trade.placeBet({ wallet: asWallet(c), snap: cs, live, side: other(side), margin: Math.floor(room * 100) / 100, leverage: 1 }), `#${id} ${short(c)}`);
  }
  live = await liveOf(id);
  const after = await snapOf(whale.k);
  const p = after.user?.positions.find((x) => x.market_id === id && x.side === sideNum(side) && x.shares > 0n);
  if (p && trade.expectedCloseOut(live, p) <= 0) {
    refused("episode: underwater whale self close refused", await trade.closePosition({ wallet: asWallet(whale.k), snap: after, live, position: p }), /underwater/i, `#${id}`);
  }
  const markZ = amm.markAt(live.account.mark_z, Number(live.account.mark_t), live.account.z, Date.now() / 1000);
  if (p && !amm.isLiquidatableAtMark(markZ, live.account.params.mm_bps, sideNum(side), Number(p.shares), Number(p.debt), Number(p.accrued))) {
    refused("episode: early liquidation refused (mark lags)", await erRaw(liquidator, [ix.liquidate({ payer: liquidator.publicKey, owner: whale.k.publicKey, marketId: id, side: sideNum(side) })]), /Healthy/, `#${id}`);
  }

  later(9 * 60_000, async () => {
    try {
      const s = await snapOf(whale.k);
      const q = s.user?.positions.find((x) => x.market_id === id && x.side === sideNum(side) && (x.shares > 0n || x.debt > 0n));
      if (!q) return log("episode: whale liquidated by the crank", "pass", `#${id}`);
      const l = await liveOf(id);
      const mz = amm.markAt(l.account.mark_z, Number(l.account.mark_t), l.account.z, Date.now() / 1000);
      const should = amm.isLiquidatableAtMark(mz, l.account.params.mm_bps, sideNum(side), Number(q.shares), Number(q.debt), Number(q.accrued));
      const r = await erRaw(liquidator, [ix.liquidate({ payer: liquidator.publicKey, owner: whale.k.publicKey, marketId: id, side: sideNum(side) })]);
      if (should) {
        if (!r.ok && /NoPosition/.test(r.error ?? "")) return log("episode: whale liquidated by the crank", "pass", `#${id} (raced)`);
        ok("episode: third wallet liquidates", r, `#${id}`);
      } else {
        refused("episode: still healthy, liquidation refused", r, /Healthy/, `#${id}`);
        // Unwind it so the whale is not stuck with debt.
        const l2 = await liveOf(id);
        const s2 = await snapOf(whale.k);
        const q2 = s2.user?.positions.find((x) => x.market_id === id && x.side === sideNum(side) && x.shares > 0n);
        if (q2 && trade.expectedCloseOut(l2, q2) > 0) ok("episode: whale unwinds", await trade.closePosition({ wallet: asWallet(whale.k), snap: s2, live: l2, position: q2 }), `#${id}`);
      }
      // The crowd takes profit.
      for (const c of crowd) {
        const cs = await snapOf(c);
        const cp = cs.user?.positions.find((x) => x.market_id === id && x.side === sideNum(other(side)) && x.shares > 0n);
        if (cp) ok("episode: crowd closes", await trade.closePosition({ wallet: asWallet(c), snap: cs, live: await liveOf(id), position: cp }), `#${id} ${short(c)}`);
      }
    } finally {
      episodes.delete(id);
      [whale.k, ...crowd].forEach((k) => busy.delete(k.publicKey.toBase58()));
    }
  });
}

/** Withdraw a little (undelegate, withdraw, delegate again) and put it back. */
async function withdrawCycle() {
  const k = pick(freeWallets());
  let s = await snapOf(k);
  if (balanceOf(s) < 1 || s.user?.positions.some((p) => p.debt > 0n)) return;
  if (!ok("withdraw", await trade.withdraw({ wallet: asWallet(k), snap: s, amount: 0.5 }), short(k))) return;
  for (let i = 0; i < 20; i++) {
    s = await snapOf(k);
    if (s.delegated) break;
    await sleep(1_500);
  }
  ok("re-deposit", await trade.enableTrading({ wallet: asWallet(k), snap: s, deposit: Math.min(0.5, Number(s.usdc) / 1e6) }), short(k));
}

async function withdrawWithDebtRefused() {
  for (const k of [...freeWallets()].sort(() => Math.random() - 0.5).slice(0, 8)) {
    const s = await snapOf(k);
    if (!s.user?.positions.some((p) => p.debt > 0n)) continue;
    return refused("withdraw with open debt refused", await trade.withdraw({ wallet: asWallet(k), snap: s, amount: 0.1 }), /Leveraged|debt|Debt/, short(k));
  }
}

/** Claims on resolved markets and refuses bets on closed ones. */
async function lifecycleSweep() {
  const states = new Map<bigint, number>();
  for (const k of ready) {
    const s = await snapOf(k);
    for (const p of s.user?.positions ?? []) {
      if (p.shares === 0n && p.margin === 0n) continue;
      if (!states.has(p.market_id)) states.set(p.market_id, (await marketState(p.market_id))?.state ?? -1);
      const st = states.get(p.market_id)!;
      if (st === STATE.RESOLVED) ok("claim on resolved market", await trade.claimPosition({ wallet: asWallet(k), snap: s, marketId: p.market_id }), `#${p.market_id} ${short(k)}`);
    }
  }
  const closed = [...states].find(([, st]) => st === STATE.CLOSED || st === STATE.PROPOSED);
  if (closed) {
    const k = pick(ready);
    const s = await snapOf(k);
    refused("bet on a closed market refused", await rawOpen(k, s, closed[0], "yes", 0.2, 1), /MarketNotOpen|WrongState|Error/, `#${closed[0]} ${STATE_NAME[closed[1]]}`);
  }
}

// ── Main loop ────────────────────────────────────────────────────────────
console.log(`soak run for ${HOURS}h, until ${new Date(END).toISOString()}`);
await spreadFunds();
await enrol();
await refreshMarkets();
summary();

const WEIGHTS: [number, () => Promise<void>][] = [
  [34, () => randomBet(false)],
  [18, () => randomBet(true)],
  [22, closeSome],
  [8, probes],
  [3, withdrawCycle],
  [2, withdrawWithDebtRefused],
];
const total = WEIGHTS.reduce((a, [w]) => a + w, 0);
const nextAction = () => {
  let r = Math.random() * total;
  for (const [w, f] of WEIGHTS) if ((r -= w) < 0) return f;
  return WEIGHTS[0][1];
};

let nextEpisode = Date.now() + 5 * 60_000;
let nextHousekeeping = Date.now() + 30 * 60_000;
while (Date.now() < END || timers.length) {
  try {
    const due = timers.filter((t) => t.at <= Date.now());
    for (const t of due) {
      timers.splice(timers.indexOf(t), 1);
      await t.run();
    }
    if (Date.now() >= END) {
      await sleep(15_000);
      continue;
    }
    if (Date.now() >= nextHousekeeping) {
      nextHousekeeping = Date.now() + 30 * 60_000;
      await refreshMarkets();
      await spreadFunds();
      await enrol();
      await lifecycleSweep();
      summary();
    } else if (Date.now() >= nextEpisode) {
      nextEpisode = Date.now() + rand(15, 30) * 60_000;
      await liquidationEpisode();
    } else if (markets.length && ready.length) {
      await nextAction()();
    }
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 120);
    log("loop", INFRA.test(msg) ? "infra" : "fail", msg);
  }
  await sleep(rand(12, 35) * 1000);
}
summary();
console.log("soak run finished");
process.exit(0);
