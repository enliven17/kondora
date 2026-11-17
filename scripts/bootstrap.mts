// One-time devnet setup after `solana program deploy`:
//   1. creates role keypairs in .keys/ (creator, oracle, auditor, crank) if missing
//   2. funds them with SOL from the admin wallet
//   3. initializes Config with those roles and the pinned ER validator
//   4. deposits House liquidity from the admin's USDC account
//
// Run (owner's go only):  npx tsx scripts/bootstrap.mts --house 200
// Admin = the Solana CLI wallet (ADMIN_KEYPAIR or ~/.config/solana/id.json).

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_PARAMS, DEVNET_USDC, ENDPOINTS, ER_VALIDATOR, configPda, decodeConfig, ix } from "../lib/kondora/client";

const arg = (k: string, d?: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const conn = new Connection(process.env.SOLANA_RPC ?? ENDPOINTS.base, "confirmed");
const load = (p: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf8"))));
const adminPath = process.env.ADMIN_KEYPAIR ?? join(".keys", "admin.json");
const admin = load(adminPath);

mkdirSync(".keys", { recursive: true });
function role(name: string): Keypair {
  const p = join(".keys", `${name}.json`);
  if (!existsSync(p)) writeFileSync(p, JSON.stringify([...Keypair.generate().secretKey]), { mode: 0o600 });
  return load(p);
}
const roles = { creator: role("creator"), oracle: role("oracle"), auditor: role("auditor"), crank: role("crank") };

async function send(tx: Transaction, signers: Keypair[]) {
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(admin, ...signers);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}

console.log(`admin ${admin.publicKey.toBase58()}`);
for (const [name, kp] of Object.entries(roles)) {
  const bal = await conn.getBalance(kp.publicKey);
  console.log(`${name.padEnd(8)} ${kp.publicKey.toBase58()} ${(bal / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
  if (bal < 0.3 * LAMPORTS_PER_SOL) {
    await send(new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: kp.publicKey, lamports: 0.5 * LAMPORTS_PER_SOL })), []);
  }
}

const usdcMint = new PublicKey(arg("mint", DEVNET_USDC.toBase58())!);
const existing = await conn.getAccountInfo(configPda());
if (!existing) {
  const sig = await send(
    new Transaction().add(
      ix.initialize({
        admin: admin.publicKey,
        usdcMint,
        creator: roles.creator.publicKey,
        oracle: roles.oracle.publicKey,
        auditor: roles.auditor.publicKey,
        validator: ER_VALIDATOR,
        // Small markets: Circle devnet USDC is scarce, so trades start at 0.1 USDC.
        params: { ...DEFAULT_PARAMS, min_trade: BigInt(Math.round(Number(arg("min-trade", "0.1")) * 1e6)) },
      }),
    ),
    [],
  );
  console.log(`initialized ${sig}`);
} else {
  console.log("config exists, skipping initialize");
}

const house = Number(arg("house", "0"));
if (house > 0) {
  const adminToken = getAssociatedTokenAddressSync(usdcMint, admin.publicKey);
  const sig = await send(new Transaction().add(ix.houseDeposit({ admin: admin.publicKey, adminToken, amount: BigInt(Math.round(house * 1e6)) })), []);
  console.log(`house +${house} USDC ${sig}`);
}

const cfg = decodeConfig((await conn.getAccountInfo(configPda()))!.data);
console.log(`house free ${Number(cfg.house_free) / 1e6} USDC, next market ${cfg.next_market_id}`);
