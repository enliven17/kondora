// End-to-end check of the real trading path on devnet + the MagicBlock ER,
// using the same lib/trade.ts functions the browser uses, with a keypair wallet.
//   program/node_modules/.bin/tsx scripts/e2e-devnet.mts [marketId] [usdc]
// Funds a fresh test wallet from .keys/admin.json (0.05 SOL + usdc + 0.5).

import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { readFileSync } from "node:fs";

// Minimal browser globals for lib/session.ts and lib/live.ts.
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  }),
});

const { baseConnection } = await import("../lib/chain");
const { readAccount } = await import("../lib/account");
const { subscribeMarket } = await import("../lib/live");
const trade = await import("../lib/trade");
const { DEVNET_USDC } = await import("../lib/kondora/client");

const marketId = process.argv[2] ?? "1";
const amount = Number(process.argv[3] ?? "1");
const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(".keys/admin.json", "utf8"))));
const user = Keypair.generate();
const conn = baseConnection();

const wallet = {
  publicKey: user.publicKey,
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof VersionedTransaction) tx.sign([user]);
    else tx.partialSign(user);
    return tx;
  },
};

function step(label: string, r: { ok: boolean; error?: string; tx?: { explorer: string } }) {
  console.log(`${r.ok ? "PASS" : "FAIL"} ${label}${r.ok ? "" : `: ${r.error}`}${r.tx ? `\n     ${r.tx.explorer}` : ""}`);
  if (!r.ok) process.exit(1);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1. Fund the test wallet.
const usdcFrom = getAssociatedTokenAddressSync(DEVNET_USDC, admin.publicKey);
const usdcTo = getAssociatedTokenAddressSync(DEVNET_USDC, user.publicKey);
const fund = new Transaction().add(
  SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: user.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL }),
  createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, usdcTo, user.publicKey, DEVNET_USDC),
  createTransferCheckedInstruction(usdcFrom, DEVNET_USDC, usdcTo, admin.publicKey, BigInt(Math.round((amount + 0.5) * 1e6)), 6),
);
fund.feePayer = admin.publicKey;
fund.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
fund.sign(admin);
await conn.confirmTransaction(await conn.sendRawTransaction(fund.serialize()), "confirmed");
console.log(`test wallet ${user.publicKey.toBase58()} funded`);

// 2. Enable trading: init + deposit + session + delegate, one signature.
let snap = await readAccount(user.publicKey);
step("enable trading", await trade.enableTrading({ wallet, snap, deposit: amount + 0.5 }));
for (let i = 0; i < 20; i++) {
  snap = await readAccount(user.publicKey);
  if (snap.user && snap.delegated) break;
  await sleep(1500);
}
console.log(`     account delegated=${snap.delegated} balance=${snap.user ? Number(snap.user.balance) / 1e6 : "?"}`);

// 3. Live market state from the ER.
const live = await new Promise<Parameters<Parameters<typeof subscribeMarket>[1]>[0]>((resolve) => {
  const stop = subscribeMarket(marketId, (s) => {
    stop();
    resolve(s);
  });
});
console.log(`     market #${marketId} YES ${(live.priceYes * 100).toFixed(1)}% delegated=${live.delegated}`);

// 4. Bet with the session key (no wallet signature).
let signed = 0;
const counting = { ...wallet, signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => (signed++, wallet.signTransaction(tx)) };
step("open YES 1x via session", await trade.placeBet({ wallet: counting, snap, live, side: "yes", margin: amount, leverage: 1 }));
console.log(`     wallet signatures during bet: ${signed}`);
await sleep(1500);
snap = await readAccount(user.publicKey);
const pos = snap.user?.positions.find((p) => p.market_id === BigInt(marketId) && p.shares > 0n);
console.log(`     position shares=${pos ? Number(pos.shares) / 1e6 : 0}`);
if (!pos) process.exit(1);

// 5. Close it.
const live2 = await new Promise<typeof live>((resolve) => {
  const stop = subscribeMarket(marketId, (s) => {
    stop();
    resolve(s);
  });
});
step("close position", await trade.closePosition({ wallet: counting, snap, live: live2, position: pos }));
await sleep(1500);
snap = await readAccount(user.publicKey);
const bal = snap.user ? Number(snap.user.balance) / 1e6 : 0;
console.log(`     balance after round trip ${bal}`);

// 6. Withdraw everything (undelegate, then withdraw on base).
step("withdraw", await trade.withdraw({ wallet, snap, amount: bal }));
const final = await conn.getTokenAccountBalance(usdcTo);
console.log(`     wallet USDC ${final.value.uiAmount}`);
process.exit(0);
