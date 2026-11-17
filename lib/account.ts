// Reads everything the trading UI needs about one wallet in two RPC calls:
// the UserAccount (from the ER when delegated), the USDC ATA, SOL and the session token.

import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";

import { baseConnection, erConnection } from "./chain";
import { decodeUser, DELEGATION_PROGRAM_ID, DEVNET_USDC, sessionTokenPda, type UserAccountData, userPda } from "./kondora";
import { type ActiveSession, isLive, loadSession, readValidUntil } from "./session";

export interface AccountSnapshot {
  owner: PublicKey;
  /** UserAccount exists on chain. */
  exists: boolean;
  /** UserAccount is delegated to the ER (trading mode). */
  delegated: boolean;
  user: UserAccountData | null;
  /** Wallet's USDC associated token account. */
  ata: PublicKey;
  ataExists: boolean;
  /** Wallet USDC, micro units. */
  usdc: bigint;
  /** Wallet SOL, lamports. */
  lamports: number;
  /** A stored session key whose on-chain token is still valid. */
  session: ActiveSession | null;
  /** Unix seconds of this read. */
  at: number;
}

const tokenAmount = (data: Uint8Array) => new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(64, true);

export async function readAccount(owner: PublicKey): Promise<AccountSnapshot> {
  const base = baseConnection();
  const user = userPda(owner);
  const ata = getAssociatedTokenAddressSync(DEVNET_USDC, owner);
  const stored = loadSession(owner);
  const tokenPk = stored ? sessionTokenPda(stored.keypair.publicKey, owner) : null;

  const [u, a, w, t] = await base.getMultipleAccountsInfo([user, ata, owner, ...(tokenPk ? [tokenPk] : [])], "confirmed");
  const delegated = Boolean(u?.owner.equals(DELEGATION_PROGRAM_ID));
  let data = u?.data ?? null;
  if (delegated) data = (await erConnection().getAccountInfo(user, "confirmed"))?.data ?? data;

  let decoded: UserAccountData | null = null;
  if (data) {
    try {
      decoded = decodeUser(data);
    } catch {
      decoded = null;
    }
  }

  const validUntil = readValidUntil(t?.data);
  const session = stored && tokenPk && isLive(validUntil) ? { keypair: stored.keypair, validUntil: validUntil ?? stored.validUntil, token: tokenPk } : null;

  return {
    owner,
    exists: Boolean(u),
    delegated,
    user: decoded,
    ata,
    ataExists: Boolean(a),
    usdc: a && a.data.length >= 72 ? tokenAmount(a.data) : 0n,
    lamports: w?.lamports ?? 0,
    session,
    at: Date.now() / 1000,
  };
}
