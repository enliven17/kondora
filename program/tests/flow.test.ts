// End-to-end flow against the compiled program in LiteSVM (base layer, no ER).
// Run: npm test (from program/). Requires target/deploy/kondora.so.

import { strict as assert } from "node:assert";
import { Svm } from "./svm";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  AccountLayout,
  MINT_SIZE,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  OUTCOME,
  PROGRAM_ID,
  SIDE,
  STATE,
  configPda,
  decodeConfig,
  decodeMarket,
  decodeUser,
  activePositions,
  ix,
  marketPda,
  userPda,
  vaultPda,
} from "../../lib/kondora/client";
import * as amm from "../../lib/kondora/math";

const USDC = 1_000_000n;
const svm = new Svm();
await svm.addProgram(PROGRAM_ID, "../target/deploy/kondora.so");

const [admin, creator, oracle, auditor, alice, bob, keeper, mintKp] = Array.from({ length: 8 }, () => Keypair.generate());
for (const k of [admin, creator, oracle, auditor, alice, bob, keeper]) await svm.airdrop(k.publicKey, 10 * LAMPORTS_PER_SOL);

let passed = 0;
const send = (payer: Keypair, ixs: TransactionInstruction[], signers: Keypair[] = []) => svm.send(payer, ixs, signers);
async function fails(label: string, f: () => Promise<unknown>, needle?: string) {
  try {
    await f();
  } catch (e) {
    if (needle) assert.ok(String(e).includes(needle), `${label}: expected "${needle}" in ${String(e).slice(0, 600)}`);
    passed++;
    return;
  }
  assert.fail(`${label}: expected failure`);
}
function ok(label: string, cond: boolean, detail = "") {
  assert.ok(cond, `${label} ${detail}`);
  passed++;
}

const config = async () => decodeConfig(await svm.account(configPda()));
const market = async (id: bigint) => decodeMarket(await svm.account(marketPda(id)));
const user = async (k: Keypair) => decodeUser(await svm.account(userPda(k.publicKey)));
const tokenBal = async (pk: PublicKey) => AccountLayout.decode(Buffer.from(await svm.account(pk))).amount;
const now = () => svm.now();
const setTime = (t: bigint) => svm.setTime(t);

// ── USDC mint and token accounts ─────────────────────────────────────────
const mint = mintKp.publicKey;
await send(
  admin,
  [
    SystemProgram.createAccount({
      fromPubkey: admin.publicKey,
      newAccountPubkey: mint,
      lamports: await svm.rent(MINT_SIZE),
      space: MINT_SIZE,
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    }),
    createInitializeMint2Instruction(mint, 6, admin.publicKey, null),
  ],
  [mintKp],
);
const ata = (k: Keypair) => getAssociatedTokenAddressSync(mint, k.publicKey);
for (const k of [admin, alice, bob]) {
  await send(admin, [
    createAssociatedTokenAccountInstruction(admin.publicKey, ata(k), k.publicKey, mint),
    createMintToInstruction(mint, ata(k), admin.publicKey, 1_000_000n * USDC),
  ]);
}

// ── Protocol setup ───────────────────────────────────────────────────────
await send(admin, [
  ix.initialize({ admin: admin.publicKey, usdcMint: mint, creator: creator.publicKey, oracle: oracle.publicKey, auditor: auditor.publicKey }),
]);
await send(admin, [ix.houseDeposit({ admin: admin.publicKey, adminToken: ata(admin), amount: 100_000n * USDC })]);
ok("house funded", (await config()).house_free === 100_000n * USDC);
await fails("non-admin cannot fund house", async () =>
  send(alice, [ix.houseDeposit({ admin: alice.publicKey, adminToken: ata(alice), amount: USDC })]),
);

for (const k of [alice, bob]) {
  await send(k, [ix.initUser(k.publicKey), ix.deposit({ owner: k.publicKey, ownerToken: ata(k), amount: 1_000n * USDC })]);
}
ok("deposits credited", (await user(alice)).balance === 1_000n * USDC);

// ── Market creation (creator agent only) ─────────────────────────────────
const t0 = (await now());
const close1 = t0 + 2n * 86_400n;
const qh = new Uint8Array(32).fill(7);
await fails("users cannot create markets", async () =>
  send(alice, [
    ix.createMarket({ creator: alice.publicKey, marketId: 1n, category: 0, questionHash: qh, rulesHash: qh, closeTime: close1, z0: 0, subsidy: 10_000n * USDC, lend: 20_000n * USDC }),
  ]),
);
await send(creator, [
  ix.createMarket({ creator: creator.publicKey, marketId: 1n, category: 0, questionHash: qh, rulesHash: qh, closeTime: close1, z0: 0, subsidy: 10_000n * USDC, lend: 20_000n * USDC }),
]);
let m = (await market(1n));
ok("market open at 50%", m.state === STATE.OPEN && Math.abs(amm.cdf(m.z) - 0.5) < 1e-12);
ok("house allocated", (await config()).house_free === 70_000n * USDC);

// ── Trading ──────────────────────────────────────────────────────────────
const pool = async () => {
  const mm = (await market(1n));
  return { z: mm.z, l: mm.l, feeBps: mm.params.fee_bps, mmBps: mm.params.mm_bps };
};
const quote = amm.quoteOpen(await pool(), 0, 100_000_000, 50_000)!;
await send(alice, [
  ix.openPosition({ signer: alice.publicKey, authority: alice.publicKey, marketId: 1n, side: SIDE.YES, margin: 100n * USDC, levBps: 50_000n, minShares: BigInt(Math.floor(quote.shares * 0.999)) }),
]);
let pa = activePositions((await user(alice)))[0];
ok("alice 5x YES", pa.debt === 400n * USDC && pa.margin === 100n * USDC);
ok("JS quote matches program shares", Math.abs(Number(pa.shares) - quote.shares) <= 2, `${pa.shares} vs ${quote.shares}`);
ok("debt counter", (await market(1n)).debt_positions === 1);

await fails("bob cannot trade alice's account", async () =>
  send(bob, [ix.openPosition({ signer: bob.publicKey, authority: alice.publicKey, marketId: 1n, side: SIDE.YES, margin: USDC, levBps: 10_000n, minShares: 0n })]),
);
await fails("leverage above cap", async () =>
  send(bob, [ix.openPosition({ signer: bob.publicKey, authority: bob.publicKey, marketId: 1n, side: SIDE.NO, margin: 10n * USDC, levBps: 60_000n, minShares: 0n })]),
);
await fails("slippage guard", async () =>
  send(bob, [ix.openPosition({ signer: bob.publicKey, authority: bob.publicKey, marketId: 1n, side: SIDE.NO, margin: 10n * USDC, levBps: 10_000n, minShares: 10n ** 12n })]),
);

await send(bob, [ix.openPosition({ signer: bob.publicKey, authority: bob.publicKey, marketId: 1n, side: SIDE.NO, margin: 300n * USDC, levBps: 10_000n, minShares: 0n })]);
ok("bob 1x NO has no debt", activePositions((await user(bob)))[0].debt === 0n && (await market(1n)).debt_positions === 1);

await fails("healthy position cannot be liquidated", async () =>
  send(keeper, [ix.liquidate({ payer: keeper.publicKey, owner: alice.publicKey, marketId: 1n, side: SIDE.YES })]),
);

await setTime(t0 + 3600n);
await send(alice, [ix.closePosition({ signer: alice.publicKey, authority: alice.publicKey, marketId: 1n, side: SIDE.YES, fractionBps: 5_000n, minOut: 0n })]);
pa = activePositions((await user(alice)))[0];
ok("half closed keeps half the debt", pa.debt === 200n * USDC);

// ── Pause stops trading ──────────────────────────────────────────────────
const cfgNow = await config();
const upd = (paused: boolean) =>
  ix.updateConfig({ admin: admin.publicKey, creator: creator.publicKey, oracle: oracle.publicKey, auditor: auditor.publicKey, validator: cfgNow.validator, params: cfgNow.params, paused });
await send(admin, [upd(true)]);
await fails("paused blocks opens", async () =>
  send(bob, [ix.openPosition({ signer: bob.publicKey, authority: bob.publicKey, marketId: 1n, side: SIDE.NO, margin: 10n * USDC, levBps: 10_000n, minShares: 0n })]),
);
await send(admin, [upd(false)]);

// ── Pre-close force close ────────────────────────────────────────────────
await setTime(close1 - 3_000n);
await fails("reduce-only window blocks leverage", async () =>
  send(alice, [ix.openPosition({ signer: alice.publicKey, authority: alice.publicKey, marketId: 1n, side: SIDE.YES, margin: 10n * USDC, levBps: 20_000n, minShares: 0n })]),
);
await fails("force close not yet allowed", async () =>
  send(keeper, [ix.liquidate({ payer: keeper.publicKey, owner: alice.publicKey, marketId: 1n, side: SIDE.YES })]),
);
await setTime(close1 - 300n);
await send(keeper, [ix.liquidate({ payer: keeper.publicKey, owner: alice.publicKey, marketId: 1n, side: SIDE.YES })]);
m = (await market(1n));
ok("force closed, no debt left", m.debt_positions === 0 && m.open_debt === 0n && activePositions((await user(alice))).length === 0);
await fails("1x is never force closed", async () =>
  send(keeper, [ix.liquidate({ payer: keeper.publicKey, owner: bob.publicKey, marketId: 1n, side: SIDE.NO })]),
);

// ── Close, propose, dispute, rule ────────────────────────────────────────
await fails("cannot close before close time", async () => send(keeper, [ix.closeMarket({ payer: keeper.publicKey, marketId: 1n })]));
await setTime(close1);
await fails("trading after close", async () =>
  send(bob, [ix.openPosition({ signer: bob.publicKey, authority: bob.publicKey, marketId: 1n, side: SIDE.NO, margin: 10n * USDC, levBps: 10_000n, minShares: 0n })]),
);
await send(keeper, [ix.closeMarket({ payer: keeper.publicKey, marketId: 1n })]);
ok("closed with final mark", (await market(1n)).state === STATE.CLOSED && (await market(1n)).final_price_yes > 0);

const ev = new Uint8Array(32).fill(9);
await fails("only oracle proposes", async () =>
  send(alice, [ix.proposeResolution({ oracle: alice.publicKey, marketId: 1n, outcome: OUTCOME.YES, evidenceHash: ev })]),
);
await send(oracle, [ix.proposeResolution({ oracle: oracle.publicKey, marketId: 1n, outcome: OUTCOME.YES, evidenceHash: ev })]);
await fails("finalize inside dispute window", async () => send(keeper, [ix.finalize({ payer: keeper.publicKey, marketId: 1n })]));
await fails("claim before resolution", async () => send(bob, [ix.claim({ payer: bob.publicKey, owner: bob.publicKey, marketId: 1n })]));
await send(auditor, [ix.challenge({ auditor: auditor.publicKey, marketId: 1n })]);
ok("disputed", (await market(1n)).state === STATE.DISPUTED);
await send(admin, [ix.rule({ admin: admin.publicKey, marketId: 1n, outcome: OUTCOME.NO, evidenceHash: ev })]);
ok("ruled NO", (await market(1n)).state === STATE.RESOLVED && (await market(1n)).outcome === OUTCOME.NO);

// ── Sweep, claim, withdraw ───────────────────────────────────────────────
const bobShares = activePositions((await user(bob)))[0].shares;
const bobBefore = (await user(bob)).balance;
await send(keeper, [ix.sweep({ payer: keeper.publicKey, marketId: 1n })]);
await fails("double sweep", async () => send(keeper, [ix.sweep({ payer: keeper.publicKey, marketId: 1n })]));
await send(keeper, [ix.claim({ payer: keeper.publicKey, owner: bob.publicKey, marketId: 1n })]);
ok("bob paid 1 USDC per NO share", (await user(bob)).balance - bobBefore === bobShares);
await fails("double claim", async () => send(bob, [ix.claim({ payer: bob.publicKey, owner: bob.publicKey, marketId: 1n })]));

await send(bob, [ix.withdraw({ owner: bob.publicKey, ownerToken: ata(bob), amount: (await user(bob)).balance })]);
ok("bob withdrew everything", (await user(bob)).balance === 0n);
await fails("withdraw more than balance", async () =>
  send(alice, [ix.withdraw({ owner: alice.publicKey, ownerToken: ata(alice), amount: (await user(alice)).balance + 1n })]),
);

// ── Market 2: liquidation by price, finalize path ────────────────────────
const t2 = (await now());
await send(creator, [
  ix.createMarket({ creator: creator.publicKey, marketId: 2n, category: 3, questionHash: qh, rulesHash: qh, closeTime: t2 + 86_400n * 3n, z0: 0.3, subsidy: 2_000n * USDC, lend: 5_000n * USDC }),
]);
await send(alice, [ix.openPosition({ signer: alice.publicKey, authority: alice.publicKey, marketId: 2n, side: SIDE.YES, margin: 50n * USDC, levBps: 40_000n, minShares: 0n })]);
// whale pushes YES down by buying NO
await send(admin, [ix.initUser(admin.publicKey), ix.deposit({ owner: admin.publicKey, ownerToken: ata(admin), amount: 50_000n * USDC })]);
for (let i = 0; i < 12; i++) {
  const p = activePositions((await user(alice))).find((x) => x.market_id === 2n)!;
  const mm = (await market(2n));
  if (amm.isLiquidatableAtMark(mm.z, 500, 0, Number(p.shares), Number(p.debt))) break;
  await send(admin, [ix.openPosition({ signer: admin.publicKey, authority: admin.publicKey, marketId: 2n, side: SIDE.NO, margin: 150n * USDC, levBps: 10_000n, minShares: 0n })]);
}
await fails("mark lags a sudden push", async () =>
  send(keeper, [ix.liquidate({ payer: keeper.publicKey, owner: alice.publicKey, marketId: 2n, side: SIDE.YES })]),
);
await setTime((await now()) + 1800n);
await send(keeper, [ix.liquidate({ payer: keeper.publicKey, owner: alice.publicKey, marketId: 2n, side: SIDE.YES })]);
ok("price liquidation", (await user(alice)).liquidations === 1 && (await market(2n)).debt_positions === 0);
await setTime((await market(2n)).close_time);
await send(keeper, [ix.closeMarket({ payer: keeper.publicKey, marketId: 2n })]);
await send(oracle, [ix.proposeResolution({ oracle: oracle.publicKey, marketId: 2n, outcome: OUTCOME.INVALID, evidenceHash: ev })]);
await setTime((await now()) + 901n);
await fails("challenge after window", async () => send(auditor, [ix.challenge({ auditor: auditor.publicKey, marketId: 2n })]));
await send(keeper, [ix.finalize({ payer: keeper.publicKey, marketId: 2n })]);
await send(keeper, [ix.sweep({ payer: keeper.publicKey, marketId: 2n })]);
await send(keeper, [ix.claim({ payer: keeper.publicKey, owner: admin.publicKey, marketId: 2n })]);

// ── Global accounting: vault USDC == every internal claim on it ──────────
// A trader cannot cash out their own price impact at the pre-close mark.
const t3 = await now();
const close3 = t3 + 3n * 86_400n;
await send(creator, [ix.createMarket({ creator: creator.publicKey, marketId: 3n, category: 0, questionHash: qh, rulesHash: qh, closeTime: close3, z0: 0, subsidy: 50n * USDC, lend: 100n * USDC })]);
await setTime(close3 - 3601n);
const aliceBeforeForce = (await user(alice)).balance;
await send(alice, [ix.openPosition({ signer: alice.publicKey, authority: alice.publicKey, marketId: 3n, side: SIDE.YES, margin: 20n * USDC, levBps: 11_000n, minShares: 0n })]);
await setTime(close3 - 300n);
await send(keeper, [ix.liquidate({ payer: keeper.publicKey, owner: alice.publicKey, marketId: 3n, side: SIDE.YES })]);
ok("force close cannot monetize own price impact", (await user(alice)).balance <= aliceBeforeForce);
ok("force close repays debt", (await market(3n)).debt_positions === 0 && (await market(3n)).open_debt === 0n);
await setTime(close3);
await send(keeper, [ix.closeMarket({ payer: keeper.publicKey, marketId: 3n })]);
await send(oracle, [ix.proposeResolution({ oracle: oracle.publicKey, marketId: 3n, outcome: OUTCOME.YES, evidenceHash: ev })]);
await setTime(close3 + 901n);
await send(keeper, [ix.finalize({ payer: keeper.publicKey, marketId: 3n }), ix.sweep({ payer: keeper.publicKey, marketId: 3n })]);

const vault = await tokenBal(vaultPda());
const owed = (await config()).house_free + (await user(alice)).balance + (await user(bob)).balance + (await user(admin)).balance;
ok("vault equals internal ledger", vault >= owed && vault - owed <= 4n, `vault ${vault} owed ${owed}`);
const c = (await config());
console.log(
  `house: deposited ${Number(c.house_deposited) / 1e6}, free ${Number(c.house_free) / 1e6}, pnl ${(Number(c.house_free) - Number(c.house_deposited)) / 1e6} USDC`,
);
console.log(`ok: ${passed} checks passed`);
svm.close();
