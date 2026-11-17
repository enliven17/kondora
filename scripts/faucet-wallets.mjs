// Devnet helper wallets for collecting Circle test USDC.
//   node scripts/faucet-wallets.mjs gen [count]   creates keys in .keys/faucet/ and prints addresses
//   node scripts/faucet-wallets.mjs balances      shows USDC per wallet and the total
//   node scripts/faucet-wallets.mjs sweep         moves all USDC to the admin wallet (admin pays fees)
// Keys stay in .keys/ (gitignored). Devnet only.

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const USDC = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const DIR = join(".keys", "faucet");
const FILE = join(DIR, "wallets.json");
const conn = new Connection(process.env.SOLANA_RPC ?? "https://api.devnet.solana.com", "confirmed");
const adminPath = process.env.ADMIN_KEYPAIR ?? join(homedir(), ".config", "solana", "talos-deploy.json");
const loadWallets = () => JSON.parse(readFileSync(FILE, "utf8")).map((s) => Keypair.fromSecretKey(Uint8Array.from(s)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function balances(wallets) {
  const out = [];
  for (let i = 0; i < wallets.length; i += 100) {
    const atas = wallets.slice(i, i + 100).map((w) => getAssociatedTokenAddressSync(USDC, w.publicKey));
    const infos = await conn.getMultipleAccountsInfo(atas);
    infos.forEach((info) => out.push(info ? info.data.readBigUInt64LE(64) : 0n));
  }
  return out;
}

const [cmd, arg] = process.argv.slice(2);

if (cmd === "gen") {
  if (existsSync(FILE)) throw new Error(`${FILE} exists; refusing to overwrite`);
  mkdirSync(DIR, { recursive: true });
  const n = Number(arg ?? 100);
  const ws = Array.from({ length: n }, () => Keypair.generate());
  writeFileSync(FILE, JSON.stringify(ws.map((w) => [...w.secretKey])), { mode: 0o600 });
  const list = ws.map((w) => w.publicKey.toBase58()).join("\n");
  writeFileSync(join(DIR, "addresses.txt"), list + "\n");
  console.log(list);
} else if (cmd === "balances") {
  const ws = loadWallets();
  const b = await balances(ws);
  let total = 0n;
  ws.forEach((w, i) => {
    total += b[i];
    if (b[i] > 0n) console.log(`${String(i + 1).padStart(3)} ${w.publicKey.toBase58()} ${Number(b[i]) / 1e6}`);
  });
  console.log(`funded ${b.filter((x) => x > 0n).length}/${ws.length}, total ${Number(total) / 1e6} USDC`);
} else if (cmd === "sweep") {
  const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(adminPath, "utf8"))));
  const dest = getAssociatedTokenAddressSync(USDC, admin.publicKey);
  const ws = loadWallets();
  const b = await balances(ws);
  const funded = ws.map((w, i) => ({ w, amt: b[i] })).filter((x) => x.amt > 0n);
  let moved = 0n;
  // 6 transfers per transaction keeps it under the size limit with 7 signers.
  for (let i = 0; i < funded.length; i += 6) {
    const batch = funded.slice(i, i + 6);
    const tx = new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, dest, admin.publicKey, USDC));
    for (const { w, amt } of batch) {
      tx.add(createTransferCheckedInstruction(getAssociatedTokenAddressSync(USDC, w.publicKey), USDC, dest, w.publicKey, amt, 6));
    }
    tx.feePayer = admin.publicKey;
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    tx.sign(admin, ...batch.map((x) => x.w));
    const sig = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction(sig, "confirmed");
    moved += batch.reduce((a, x) => a + x.amt, 0n);
    console.log(`swept ${batch.length} wallets ${sig}`);
    await sleep(400);
  }
  console.log(`moved ${Number(moved) / 1e6} USDC to ${admin.publicKey.toBase58()}`);
} else {
  console.log("usage: node scripts/faucet-wallets.mjs gen [count] | balances | sweep");
}
