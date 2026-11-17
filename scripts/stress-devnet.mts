// Heavy multi-wallet run on devnet + the ER, every open market.
//   program/node_modules/.bin/tsx scripts/stress-devnet.mts [deposit=15] [waitSecs=480]
// Per market: a whale opens a big leveraged bet, a crowd pushes the price the other
// way, sellers and buyers trade at the same moment, the underwater whale is refused a
// self close, an early liquidation is refused (the mark lags), and after the mark
// catches up a third wallet liquidates (or the crank already did).

import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
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
const { leverageCap, maxFeasibleLeverage, maxFeasibleMargin } = await import("../lib/leverage");
const { DEVNET_USDC, ix, configPda, decodeConfig, decodeMarket, marketPda, STATE, amm } = await import("../lib/kondora");

type Live = Parameters<Parameters<typeof subscribeMarket>[1]>[0];
type Snap = Awaited<ReturnType<typeof readAccount>>;
type Side = "yes" | "no";

const DEPOSIT = Number(process.argv[2] ?? 15);
const WAIT = Number(process.argv[3] ?? 480);
const conn = baseConnection();
const er = erConnection();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(".keys/admin.json", "utf8"))));
const all = (JSON.parse(readFileSync(".keys/faucet/wallets.json", "utf8")) as number[][]).map((s) => Keypair.fromSecretKey(Uint8Array.from(s)));
const short = (k: Keypair) => k.publicKey.toBase58().slice(0, 6);
const sideNum = (s: Side) => (s === "yes" ? 0 : 1);
const other = (s: Side): Side => (s === "yes" ? "no" : "yes");

const asWallet = (k: Keypair) => ({
  publicKey: k.publicKey,
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof VersionedTransaction) tx.sign([k]);
    else tx.partialSign(k);
    return tx;
  },
});

const results: { name: string; ok: boolean; note: string }[] = [];
const stats = { opens: 0, closes: 0, liquidations: 0, crankLiquidations: 0, volume: 0 };
function record(name: string, ok: boolean, note = "") {
  results.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${note ? `  ${note}` : ""}`);
}
const expectOk = (name: string, r: { ok: boolean; error?: string }) => (record(name, r.ok, r.ok ? "" : r.error), r.ok);
const expectReject = (name: string, r: { ok: boolean; error?: string }, want?: RegExp) =>
  record(name, !r.ok && (!want || want.test(r.error ?? "")), r.ok ? "was accepted" : `rejected: ${(r.error ?? "").replace(/^.*Error Code: /, "").slice(0, 60)}`);

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

/** Signs on the ER with `k` (any key works as a fee payer there). */
async function erRaw(k: Keypair, ixs: Parameters<Transaction["add"]>) {
  try {
    const tx = new Transaction().add(...ixs);
    const bh = await er.getLatestBlockhash("confirmed");
    tx.recentBlockhash = bh.blockhash;
    tx.feePayer = k.publicKey;
    tx.sign(k);
    const sig = await er.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    const res = await er.confirmTransaction({ signature: sig, ...bh }, "confirmed");
    if (!res.value.err) return { ok: true as const };
    const logs = (await er.getTransaction(sig, { maxSupportedTransactionVersion: 0 }).catch(() => null))?.meta?.logMessages ?? [];
    return { ok: false as const, error: logs.find((l) => l.includes("Error Code")) ?? JSON.stringify(res.value.err) };
  } catch (e) {
    return { ok: false as const, error: String((e as Error).message) };
  }
}

const snapOf = (k: Keypair) => readAccount(k.publicKey);
const posOf = (s: Snap, id: bigint, side: Side) => s.user?.positions.find((p) => p.market_id === id && p.side === sideNum(side) && p.shares > 0n);

async function open(k: Keypair, id: bigint, side: Side, margin: number, leverage: number, label: string) {
  const live = await liveOf(id);
  const r = await trade.placeBet({ wallet: asWallet(k), snap: await snapOf(k), live, side, margin, leverage });
  if (r.ok) {
    stats.opens++;
    stats.volume += margin * leverage;
  }
  return expectOk(`#${id} ${label} ${short(k)} ${side.toUpperCase()} ${margin.toFixed(2)} @ ${leverage.toFixed(1)}x`, r);
}

async function close(k: Keypair, id: bigint, side: Side, fractionBps: number, label: string) {
  const s = await snapOf(k);
  const p = posOf(s, id, side);
  if (!p) return record(`#${id} ${label} ${short(k)}`, false, "no position to close");
  const r = await trade.closePosition({ wallet: asWallet(k), snap: s, live: await liveOf(id), position: p, fractionBps });
  if (r.ok) stats.closes++;
  return expectOk(`#${id} ${label} ${short(k)} ${(fractionBps / 100).toFixed(0)}%`, r);
}

async function pool<T>(items: T[], n: number, fn: (t: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i).catch((e) => record(`worker ${i}`, false, String((e as Error).message).slice(0, 120)));
      }
    }),
  );
}

// ── 1. Wallets: SOL top up, enable trading ───────────────────────────────
const usdc = await conn.getMultipleAccountsInfo(all.map((k) => getAssociatedTokenAddressSync(DEVNET_USDC, k.publicKey)));
const sols = await conn.getMultipleAccountsInfo(all.map((k) => k.publicKey));
const funded = all.filter((_, i) => usdc[i] && Number(usdc[i]!.data.readBigUInt64LE(64)) / 1e6 >= 5);
const needSol = funded.filter((k) => (sols[all.indexOf(k)]?.lamports ?? 0) < 0.02 * LAMPORTS_PER_SOL);
for (let i = 0; i < needSol.length; i += 10) {
  const tx = new Transaction().add(...needSol.slice(i, i + 10).map((k) => SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: k.publicKey, lamports: 0.03 * LAMPORTS_PER_SOL })));
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(admin);
  await conn.confirmTransaction(await conn.sendRawTransaction(tx.serialize()), "confirmed");
}
console.log(`${funded.length} wallets with USDC, ${needSol.length} topped up with SOL`);

const ready: Keypair[] = [];
await pool(funded, 6, async (k) => {
  let s = await snapOf(k);
  const have = Number(s.user?.balance ?? 0n) / 1e6;
  const deposit = Math.min(Number(s.usdc) / 1e6, Math.max(0, DEPOSIT - have));
  if (!s.delegated || !s.session || deposit >= 0.5) {
    const r = await trade.enableTrading({ wallet: asWallet(k), snap: s, deposit: deposit >= 0.5 ? Math.floor(deposit * 100) / 100 : 0 });
    if (!expectOk(`enable ${short(k)} +${deposit.toFixed(2)}`, r)) return;
  }
  for (let i = 0; i < 20; i++) {
    s = await snapOf(k);
    if (s.delegated && s.user && s.session) break;
    await sleep(1500);
  }
  if (s.delegated && s.session) ready.push(k);
});
console.log(`${ready.length} wallets trading`);

// ── 2. Markets ───────────────────────────────────────────────────────────
const cfg = decodeConfig((await conn.getAccountInfo(configPda()))!.data);
const markets: bigint[] = [];
for (let id = 1n; id < cfg.next_market_id; id++) {
  const l = await liveOf(id).catch(() => null);
  if (l && l.account.state === STATE.OPEN && l.delegated && Number(l.account.close_time) - Date.now() / 1000 > 2 * 3600) markets.push(id);
}
console.log(`markets: ${markets.join(", ")}`);

// ── 3. Whale, crowd, crossing trades ─────────────────────────────────────
interface Whale {
  id: bigint;
  k: Keypair;
  side: Side;
  liquidator: Keypair;
}
const whales: Whale[] = [];
const role = (m: number, r: number) => ready[(m * 5 + r) % ready.length];

await pool(markets, 4, async (id, m) => {
  const [whale, c1, c2, c3, liq] = [0, 1, 2, 3, 4].map((r) => role(m, r));
  let live = await liveOf(id);
  // Whale takes the side priced under 50% so the crowd has room to push it down.
  const side: Side = live.priceYes <= 0.5 ? "yes" : "no";
  const { cap } = leverageCap(live.priceYes, Number(live.account.close_time));
  const args = (l: Live, s: Side) => [{ yesPrice: l.priceYes, liquidity: 0 }, s, l.pool, l.account.params.max_price_bps / 10_000, l.floorL] as const;
  let margin = 3;
  let lev = Math.min(cap, maxFeasibleLeverage([...args(live, side)], margin, cap));
  if (lev < 2) {
    lev = Math.min(cap, 2.5);
    margin = Math.min(3, maxFeasibleMargin([...args(live, side)], lev, 3));
  }
  if (margin < 0.2 || lev < 1.5) return record(`#${id} whale`, false, `pool too thin (margin ${margin}, lev ${lev})`);
  if (!(await open(whale, id, side, margin, lev, "whale"))) return;
  whales.push({ id, k: whale, side, liquidator: liq });

  // Crowd buys the other side hard, at 1x, one after another.
  for (const c of [c1, c2, c3]) {
    live = await liveOf(id);
    const room = maxFeasibleMargin([...args(live, other(side))], 1, Math.min(4, Number((await snapOf(c)).user?.balance ?? 0n) / 1e6 - 0.5));
    if (room >= 0.1) await open(c, id, other(side), Math.floor(room * 100) / 100, 1, "crowd");
  }

  // One wallet sells while another buys, at the same moment.
  const [sell, buy] = await Promise.all([close(c1, id, other(side), 5_000, "cross sell"), open(liq, id, side, 0.3, 1, "cross buy")]);
  record(`#${id} simultaneous sell + buy both landed`, sell && buy);
  const [s2, b2] = await Promise.all([close(c2, id, other(side), 10_000, "cross sell all"), open(c3, id, other(side), 0.2, 1, "cross buy more")]);
  record(`#${id} second crossing both landed`, s2 && b2);

  // Underwater whale cannot close itself; nobody can liquidate before the mark moves.
  live = await liveOf(id);
  const ws = await snapOf(whale);
  const wp = posOf(ws, id, side);
  if (!wp) return record(`#${id} whale still open`, false, "position vanished");
  const out = trade.expectedCloseOut(live, wp);
  if (out <= 0) {
    expectReject(`#${id} underwater whale self close (client)`, await trade.closePosition({ wallet: asWallet(whale), snap: ws, live, position: wp }), /underwater/);
    expectReject(
      `#${id} underwater whale self close (program)`,
      await erRaw(ws.session!.keypair, [
        ix.closePosition({ signer: ws.session!.keypair.publicKey, authority: whale.publicKey, marketId: id, side: sideNum(side), fractionBps: 10_000n, minOut: 1n, sessionToken: ws.session!.token }),
      ]),
    );
  }
  const markZ = amm.markAt(live.account.mark_z, Number(live.account.mark_t), live.account.z, Date.now() / 1000);
  const liqNow = amm.isLiquidatableAtMark(markZ, live.account.params.mm_bps, sideNum(side) as 0 | 1, Number(wp.shares), Number(wp.debt), Number(wp.accrued));
  if (!liqNow) expectReject(`#${id} early liquidation refused (mark lags)`, await erRaw(liq, [ix.liquidate({ payer: liq.publicKey, owner: whale.publicKey, marketId: id, side: sideNum(side) })]), /Healthy/);
  console.log(`     #${id} whale ${side} spot ${(amm.priceOf(live.account.z, sideNum(side) as 0 | 1) * 100).toFixed(1)}% mark ${(amm.priceOf(markZ, sideNum(side) as 0 | 1) * 100).toFixed(1)}% exit ${(out / 1e6).toFixed(3)}`);
});

// ── 4. Let the mark catch up, then liquidate ─────────────────────────────
console.log(`\nwaiting ${WAIT}s for the 5 minute mark to follow the price`);
await sleep(WAIT * 1000);

await pool(whales, 4, async ({ id, k, side, liquidator }) => {
  const s = await snapOf(k);
  const p = s.user?.positions.find((x) => x.market_id === id && x.side === sideNum(side) && (x.shares > 0n || x.debt > 0n));
  if (!p) {
    stats.crankLiquidations++;
    return record(`#${id} whale closed by the crank`, true);
  }
  const live = await liveOf(id);
  const markZ = amm.markAt(live.account.mark_z, Number(live.account.mark_t), live.account.z, Date.now() / 1000);
  const should = amm.isLiquidatableAtMark(markZ, live.account.params.mm_bps, sideNum(side) as 0 | 1, Number(p.shares), Number(p.debt), Number(p.accrued));
  const r = await erRaw(liquidator, [ix.liquidate({ payer: liquidator.publicKey, owner: k.publicKey, marketId: id, side: sideNum(side) })]);
  if (should) {
    if (r.ok) stats.liquidations++;
    // The crank may win the race between our read and our send.
    const raced = !r.ok && /NoPosition/.test(r.error ?? "");
    if (raced) stats.crankLiquidations++;
    record(`#${id} liquidation by a third wallet`, r.ok || raced, r.ok ? "" : raced ? "crank got there first" : r.error);
  } else {
    expectReject(`#${id} healthy whale cannot be liquidated`, r, /Healthy/);
  }
});

// ── 5. Withdraw while 1x positions stay open, then trade again ───────────
for (const k of ready.slice(0, 3)) {
  const s = await snapOf(k);
  if (s.user?.positions.some((p) => p.debt > 0n)) continue;
  if (!expectOk(`withdraw 1 USDC with positions open ${short(k)}`, await trade.withdraw({ wallet: asWallet(k), snap: s, amount: 1 }))) continue;
  for (let i = 0; i < 20 && !(await snapOf(k)).delegated; i++) await sleep(1500);
  await open(k, markets[0], "yes", 0.2, 1, "after withdraw");
}

// ── Summary ──────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
const after = await Promise.all(markets.map(async (id) => decodeMarket((await er.getAccountInfo(marketPda(id)))!.data)));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(`opens ${stats.opens}, closes ${stats.closes}, liquidations by us ${stats.liquidations}, by crank ${stats.crankLiquidations}, notional ${stats.volume.toFixed(1)} USDC`);
console.log(`markets still open: ${after.filter((m) => m.state === STATE.OPEN).length}/${markets.length}`);
for (const f of failed) console.log(`  FAIL ${f.name}  ${f.note}`);
process.exit(failed.length ? 1 : 0);
