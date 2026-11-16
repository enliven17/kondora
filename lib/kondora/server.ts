// Server-side chain helpers for agents (Convex node actions, scripts).
// Never import from browser code: loads secret keys from env.

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import bs58 from "bs58";
import {
  DELEGATION_PROGRAM_ID,
  ENDPOINTS,
  PROGRAM_ID,
  accountDiscriminator,
  configPda,
  decodeConfig,
  decodeMarket,
  decodeUser,
  marketPda,
  MarketAccount,
  UserAccountData,
} from "./index";

export function keypairFromEnv(name: string): Keypair {
  const raw = process.env[name]?.trim();
  if (!raw) throw new Error(`${name} not configured`);
  const bytes = raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw) as number[]) : bs58.decode(raw);
  return Keypair.fromSecretKey(bytes);
}

export const baseConnection = () => new Connection(process.env.SOLANA_RPC ?? ENDPOINTS.base, "confirmed");
export const erConnection = () =>
  new Connection(process.env.ER_RPC ?? ENDPOINTS.er, { commitment: "confirmed", wsEndpoint: process.env.ER_WS ?? ENDPOINTS.erWs });

export async function sendIxs(
  conn: Connection,
  payer: Keypair,
  ixs: TransactionInstruction[],
  opts: { signers?: Keypair[]; er?: boolean } = {},
): Promise<string> {
  const tx = new Transaction().add(...ixs);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer, ...(opts.signers ?? []).filter((s) => !s.publicKey.equals(payer.publicKey)));
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: !!opts.er, preflightCommitment: "confirmed" });
  const res = await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (res.value.err) {
    const logs = (await conn.getTransaction(sig, { maxSupportedTransactionVersion: 0 }).catch(() => null))?.meta?.logMessages ?? [];
    throw new Error(`tx ${sig} failed: ${JSON.stringify(res.value.err)} ${logs.slice(-6).join(" | ")}`);
  }
  return sig;
}

export async function fetchConfig(conn = baseConnection()) {
  const a = await conn.getAccountInfo(configPda());
  return a ? decodeConfig(a.data) : null;
}

export interface LiveMarket {
  account: MarketAccount;
  delegated: boolean;
}

/** Reads a market from the layer that currently owns it. */
export async function fetchMarket(id: bigint, base = baseConnection(), er = erConnection()): Promise<LiveMarket | null> {
  const pk = marketPda(id);
  const info = await base.getAccountInfo(pk);
  if (!info) return null;
  if (info.owner.equals(DELEGATION_PROGRAM_ID)) {
    const erInfo = await er.getAccountInfo(pk);
    return { account: decodeMarket((erInfo ?? info).data), delegated: true };
  }
  return { account: decodeMarket(info.data), delegated: false };
}

/** Every user account the ER currently holds (delegated traders). */
export async function erUserAccounts(er = erConnection()): Promise<{ pubkey: PublicKey; account: UserAccountData }[]> {
  const disc = bs58.encode(accountDiscriminator("UserAccount"));
  const rows = await er.getProgramAccounts(PROGRAM_ID, { filters: [{ memcmp: { offset: 0, bytes: disc } }] });
  const out: { pubkey: PublicKey; account: UserAccountData }[] = [];
  for (const r of rows) {
    try {
      out.push({ pubkey: r.pubkey, account: decodeUser(r.account.data) });
    } catch {
      // skip malformed
    }
  }
  return out;
}

export const hexToBytes = (hex: string) => Uint8Array.from(hex.match(/../g)?.map((b) => parseInt(b, 16)) ?? []);
export const bytesToHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
