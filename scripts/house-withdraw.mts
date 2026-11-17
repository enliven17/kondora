// Withdraw free House liquidity back to the admin wallet: tsx scripts/house-withdraw.mts <usdc>
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { readFileSync } from "node:fs";
import { DEVNET_USDC, ENDPOINTS, ix } from "../lib/kondora/client";

const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(".keys/admin.json", "utf8"))));
const conn = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC ?? ENDPOINTS.base, "confirmed");
const tx = new Transaction().add(
  ix.houseWithdraw({ admin: admin.publicKey, adminToken: getAssociatedTokenAddressSync(DEVNET_USDC, admin.publicKey), amount: BigInt(Math.round(Number(process.argv[2]) * 1e6)) }),
);
tx.feePayer = admin.publicKey;
tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
tx.sign(admin);
const sig = await conn.sendRawTransaction(tx.serialize());
await conn.confirmTransaction(sig, "confirmed");
console.log(`withdrew ${process.argv[2]} USDC ${sig}`);
