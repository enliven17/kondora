// Scenario run on devnet + the ER with the faucet wallets (.keys/faucet).
//   program/node_modules/.bin/tsx scripts/scenarios-devnet.mts [wallets=5] [usdcEach=4]
// Uses the faucet wallets holding the most USDC; admin tops up SOL (and USDC if short), then every open market gets small
// leveraged bets plus edge cases that must be rejected. Bets are left open on purpose.

import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { readFileSync } from "node:fs";

const store = new Map<string, string>();
Object.assign(globalThis, {
  document: { visibilityState: "visible" },
  window: Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  }),
});

const { baseConnection, erConnection } = await import("../lib/chain");
const { readAccount } = await import("../lib/account");
const { subscribeMarket } = await import("../lib/live");
const trade = await import("../lib/trade");
const { leverageCap, maxFeasibleLeverage } = await import("../lib/leverage");
const { DEVNET_USDC, ix, configPda, decodeConfig, STATE } = await import("../lib/kondora/client");

type Live = Parameters<Parameters<typeof subscribeMarket>[1]>[0];
type Snap = Awaited<ReturnType<typeof readAccount>>;

const N = Number(process.argv[2] ?? 5);
const EACH = Number(process.argv[3] ?? 4);
// Optional "3:yes,4:no": only retry these bets, skip the lifecycle cases.
const ONLY = process.argv[4]?.split(",").map((x) => x.split(":")) ?? null;
const conn = baseConnection();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(".keys/admin.json", "utf8"))));
const all = (JSON.parse(readFileSync(".keys/faucet/wallets.json", "utf8")) as number[][]).map((s) => Keypair.fromSecretKey(Uint8Array.from(s)));
const usdcOf = async (k: Keypair) => {
  const info = await conn.getAccountInfo(getAssociatedTokenAddressSync(DEVNET_USDC, k.publicKey));
  return info ? Number(info.data.readBigUInt64LE(64)) / 1e6 : 0;
};
const held = await Promise.all(all.map(async (k) => ({ k, usdc: await usdcOf(k) })));
const wallets = held.sort((x, y) => y.usdc - x.usdc).slice(0, N).map((x) => x.k);

const asWallet = (k: Keypair) => ({
  publicKey: k.publicKey,
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof VersionedTransaction) tx.sign([k]);
    else tx.partialSign(k);
    return tx;
  },
});

const results: { name: string; ok: boolean; note: string }[] = [];
function record(name: string, ok: boolean, note = "") {
  results.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${note ? `  ${note}` : ""}`);
}
const expectOk = (name: string, r: { ok: boolean; error?: string }) => (record(name, r.ok, r.ok ? "" : r.error), r.ok);
const expectReject = (name: string, r: { ok: boolean; error?: string }, want?: RegExp) =>
  record(name, !r.ok && (!want || want.test(r.error ?? "")), r.ok ? "was accepted" : `rejected: ${(r.error ?? "").slice(0, 90)}`);

const liveOf = (id: string) =>
  new Promise<Live>((resolve) => {
    const stop = subscribeMarket(id, (s) => {
      stop();
      resolve(s);
    });
  });

async function settle(owner: Keypair, pred: (s: Snap) => boolean, tries = 20): Promise<Snap> {
  let s = await readAccount(owner.publicKey);
  for (let i = 0; i < tries && !pred(s); i++) {
    await sleep(1500);
    s = await readAccount(owner.publicKey);
  }
  return s;
}

/** Raw ER send that bypasses the client checks, to prove the program rejects it. */
async function rawOpen(k: Keypair, snap: Snap, live: Live, side: 0 | 1, margin: bigint, levBps: bigint, minShares = 0n, authority = k.publicKey) {
  try {
    const er = erConnection();
    const tx = new Transaction().add(
      ix.openPosition({ signer: snap.session!.keypair.publicKey, authority, marketId: live.account.id, side, margin, levBps, minShares, sessionToken: snap.session!.token }),
    );
    const bh = await er.getLatestBlockhash("confirmed");
    tx.recentBlockhash = bh.blockhash;
    tx.feePayer = snap.session!.keypair.publicKey;
    tx.sign(snap.session!.keypair);
    const sig = await er.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    const res = await er.confirmTransaction({ signature: sig, ...bh }, "confirmed");
    if (!res.value.err) return { ok: true };
    const logs = (await er.getTransaction(sig, { maxSupportedTransactionVersion: 0 }).catch(() => null))?.meta?.logMessages ?? [];
    return { ok: false, error: logs.find((l) => l.includes("Error Code")) ?? JSON.stringify(res.value.err) };
  } catch (e) {
    return { ok: false, error: String((e as Error).message) };
  }
}

// ── 1. Fund wallets (one tx per 4 wallets) ────────────────────────────────
const adminAta = getAssociatedTokenAddressSync(DEVNET_USDC, admin.publicKey);
for (let i = 0; i < wallets.length; i += 4) {
  const tx = new Transaction();
  for (const w of wallets.slice(i, i + 4)) {
    const ata = getAssociatedTokenAddressSync(DEVNET_USDC, w.publicKey);
    const sol = await conn.getBalance(w.publicKey);
    if (sol < 0.03 * LAMPORTS_PER_SOL) tx.add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: w.publicKey, lamports: 0.04 * LAMPORTS_PER_SOL - sol }));
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, ata, w.publicKey, DEVNET_USDC),
    );
    const short = EACH - (await usdcOf(w));
    if (short > 0) tx.add(createTransferCheckedInstruction(adminAta, DEVNET_USDC, ata, admin.publicKey, BigInt(Math.round(short * 1e6)), 6));
  }
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(admin);
  await conn.confirmTransaction(await conn.sendRawTransaction(tx.serialize()), "confirmed");
}
console.log(`wallets ready: ${wallets.map((w) => w.publicKey.toBase58().slice(0, 6)).join(" ")}`);

// ── 2. Enable trading for each wallet (deposit all but 0.2) ───────────────
const snaps = new Map<string, Snap>();
for (const w of wallets) {
  const pk = w.publicKey.toBase58();
  let s = await readAccount(w.publicKey);
  const inAccount = Number(s.user?.balance ?? 0n) / 1e6;
  const deposit = Math.max(0, Math.round((EACH - inAccount) * 100) / 100);
  if (!s.delegated || !s.session || deposit > 0) {
    if (!expectOk(`enable trading ${pk.slice(0, 6)}`, await trade.enableTrading({ wallet: asWallet(w), snap: s, deposit: Math.max(0, deposit) }))) continue;
  }
  s = await settle(w, (x) => x.delegated && !!x.user);
  snaps.set(pk, s);
}
const ready = wallets.filter((w) => snaps.get(w.publicKey.toBase58())?.delegated);
if (ready.length < 2) throw new Error("not enough wallets ready");

// ── 3. Open markets ───────────────────────────────────────────────────────
const cfg = decodeConfig((await conn.getAccountInfo(configPda()))!.data);
const markets: Live[] = [];
for (let id = 1n; id < cfg.next_market_id; id++) {
  const l = await Promise.race([liveOf(String(id)), sleep(8000).then(() => null)]);
  if (l && l.account.state === STATE.OPEN && l.delegated && Number(l.account.close_time) - Date.now() / 1000 > 1800) markets.push(l);
}
console.log(`open markets: ${markets.map((m) => m.account.id).join(", ")}`);

const refresh = async (w: Keypair) => {
  const s = await readAccount(w.publicKey);
  snaps.set(w.publicKey.toBase58(), s);
  return s;
};
const walletAt = (i: number) => ready[i % ready.length];
const LEVS = [1, 2, 3, 4, 5];

// ── 4. Two opposing leveraged bets per market, left open ──────────────────
for (const [mi, m0] of markets.entries()) {
  for (const [k, side] of (["yes", "no"] as const).entries()) {
    const w = walletAt(mi * 2 + k);
    const live = await liveOf(String(m0.account.id));
    const { cap } = leverageCap(live.priceYes, Number(live.account.close_time));
    if (ONLY && !ONLY.some(([i, sd]) => i === String(m0.account.id) && sd === side)) continue;
    const margin = 0.2 + ((mi + k) % 3) * 0.1;
    // Same limit the bet panel puts on its slider: the most this pool fills for this margin.
    const maxSide = live.account.params.max_price_bps / 10_000;
    const feasible = maxFeasibleLeverage([{ yesPrice: live.priceYes, liquidity: 0 }, side, live.pool, maxSide, live.floorL], margin, cap);
    const lev = Math.min(cap, feasible, LEVS[(mi + k) % LEVS.length]);
    const r = await trade.placeBet({ wallet: asWallet(w), snap: await refresh(w), live, side, margin, leverage: lev });
    expectOk(`#${m0.account.id} ${side.toUpperCase()} ${margin.toFixed(1)} USDC @ ${lev}x (cap ${cap}x, pool ${feasible}x)`, r);
  }
}

// ── 5. Lifecycle and edge cases on the first market ──────────────────────
if (ONLY) {
  const failed = results.filter((r) => !r.ok);
  console.log(`
${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
const m = markets[0];
const a = walletAt(0);
const b = walletAt(1);
const id = String(m.account.id);

{
  // Add to an existing position, then partial close, then full close.
  let s = await refresh(a);
  let live = await liveOf(id);
  expectOk("add to existing position", await trade.placeBet({ wallet: asWallet(a), snap: s, live, side: "yes", margin: 0.2, leverage: 1 }));
  await sleep(1500);
  s = await refresh(a);
  live = await liveOf(id);
  const extra = await trade.placeBet({ wallet: asWallet(a), snap: s, live, side: "no", margin: 0.2, leverage: 1 });
  expectOk("hedge: hold YES and NO on one market", extra);
  await sleep(1500);
  s = await refresh(a);
  const pos = s.user!.positions.find((p) => p.market_id === m.account.id && p.side === 1 && p.shares > 0n)!;
  live = await liveOf(id);
  expectOk("partial close 50%", await trade.closePosition({ wallet: asWallet(a), snap: s, live, position: pos, fractionBps: 5000 }));
  await sleep(1500);
  s = await refresh(a);
  const rest = s.user!.positions.find((p) => p.market_id === m.account.id && p.side === 1 && p.shares > 0n)!;
  record("partial close leaves half", !!rest && rest.shares < pos.shares, rest ? `${Number(pos.shares) / 1e6} -> ${Number(rest.shares) / 1e6} shares` : "gone");
  live = await liveOf(id);
  expectOk("close the rest", await trade.closePosition({ wallet: asWallet(a), snap: s, live, position: rest }));
}

{
  // Leveraged round trip: open 2x, close at once.
  let s = await refresh(b);
  let live = await liveOf(id);
  const { cap } = leverageCap(live.priceYes, Number(live.account.close_time));
  expectOk(`leveraged round trip open ${Math.min(2, cap)}x`, await trade.placeBet({ wallet: asWallet(b), snap: s, live, side: "yes", margin: 0.3, leverage: Math.min(2, cap) }));
  await sleep(1500);
  s = await refresh(b);
  const pos = s.user!.positions.filter((p) => p.market_id === m.account.id && p.side === 0 && p.debt > 0n).at(-1);
  live = await liveOf(id);
  if (pos) expectOk("leveraged round trip close (repays debt)", await trade.closePosition({ wallet: asWallet(b), snap: s, live, position: pos }));
  else record("leveraged round trip close (repays debt)", false, "no leveraged position found");
}

{
  // Rejections.
  const s = await refresh(b);
  const live = await liveOf(id);
  expectReject("client: below min trade", await trade.placeBet({ wallet: asWallet(b), snap: s, live, side: "yes", margin: 0.05, leverage: 1 }), /minimum/);
  expectReject("program: below min trade", await rawOpen(b, s, live, 0, 50_000n, 10_000n), /TooSmall|Error/);
  expectReject("program: leverage above 5x", await rawOpen(b, s, live, 0, 200_000n, 60_000n), /Error/);
  expectReject("program: margin above balance", await rawOpen(b, s, live, 0, s.user!.balance + 1_000_000n, 10_000n), /Error/);
  expectReject("program: slippage bound", await rawOpen(b, s, live, 0, 200_000n, 10_000n, 10_000_000_000n), /Slippage|Error/);
  expectReject("program: session key used for another owner", await rawOpen(b, s, live, 0, 200_000n, 10_000n, 0n, a.publicKey), /Error|Constraint|seeds/);
  // Withdrawing with leveraged debt open must fail (undelegate requires no debt).
  const withDebt = s.user!.positions.some((p) => p.debt > 0n);
  if (withDebt) expectReject("withdraw blocked while debt is open", await trade.withdraw({ wallet: asWallet(b), snap: s, amount: 0.1 }));
  expectReject("client: withdraw above balance", await trade.withdraw({ wallet: asWallet(b), snap: s, amount: Number(s.user!.balance) / 1e6 + 1 }), /balance/);
}

// ── Summary ──────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
for (const f of failed) console.log(`  FAIL ${f.name}  ${f.note}`);
for (const w of ready) {
  const s = await readAccount(w.publicKey);
  const open = s.user?.positions.filter((p) => p.shares > 0n).length ?? 0;
  console.log(`${w.publicKey.toBase58().slice(0, 8)} balance ${Number(s.user?.balance ?? 0n) / 1e6} open positions ${open}`);
}
process.exit(failed.length ? 1 : 0);
