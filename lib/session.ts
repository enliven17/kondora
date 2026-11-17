// Session keys (devnet). A browser Keypair signs ER trades so bets need no wallet popup.
// The secret lives in localStorage keyed by wallet: acceptable on devnet only, since a
// session key can open and close positions but never withdraw.

import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";

import { PROGRAM_ID, SESSION_PROGRAM_ID, sessionTokenPda } from "./kondora";
import { Writer } from "./kondora/codec";

const KEY_PREFIX = "kondora:session:v1:";
export const SESSION_TTL_SECS = 24 * 3600;
/** SOL moved to the session signer on creation so it can pay ER fees if the validator charges any. */
export const SESSION_TOP_UP_LAMPORTS = Math.round(0.01 * LAMPORTS_PER_SOL);
/** Treat a token as expired a minute early so a trade never races the deadline. */
const EXPIRY_MARGIN_SECS = 60;
/** SessionTokenV2: discriminator, authority, target_program, session_signer, fee_payer, valid_until. */
const VALID_UNTIL_OFFSET = 8 + 32 * 4;

export interface StoredSession {
  keypair: Keypair;
  /** Unix seconds from the on-chain token once confirmed, else the requested deadline. */
  validUntil: number;
}

export interface ActiveSession extends StoredSession {
  token: PublicKey;
}

const storageKey = (owner: PublicKey) => `${KEY_PREFIX}${owner.toBase58()}`;

export function loadSession(owner: PublicKey): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(owner));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { secret: number[]; validUntil: number };
    return { keypair: Keypair.fromSecretKey(Uint8Array.from(parsed.secret)), validUntil: parsed.validUntil };
  } catch {
    return null;
  }
}

export function saveSession(owner: PublicKey, session: StoredSession): void {
  window.localStorage.setItem(storageKey(owner), JSON.stringify({ secret: Array.from(session.keypair.secretKey), validUntil: session.validUntil }));
}

export function clearSession(owner: PublicKey): void {
  window.localStorage.removeItem(storageKey(owner));
}

/** valid_until from an on-chain SessionTokenV2, or null when the data is not a token. */
export function readValidUntil(data: Uint8Array | null | undefined): number | null {
  if (!data || data.length < VALID_UNTIL_OFFSET + 8) return null;
  return Number(new DataView(data.buffer, data.byteOffset, data.byteLength).getBigInt64(VALID_UNTIL_OFFSET, true));
}

export const isLive = (validUntil: number | null, now = Date.now() / 1000) => validUntil !== null && validUntil > now + EXPIRY_MARGIN_SECS;

/** Encode the session program's create_session_v2 instruction locally. */
export function sessionInstruction(owner: PublicKey, signer: PublicKey, validUntil: number): TransactionInstruction {
  const writer = new Writer();
  writer.bytes(Uint8Array.from([223, 233, 108, 7, 65, 194, 235, 38]));
  writer.write({ option: "bool" }, true);
  writer.write({ option: "i64" }, BigInt(validUntil));
  writer.write({ option: "u64" }, BigInt(SESSION_TOP_UP_LAMPORTS));
  return new TransactionInstruction({
    programId: SESSION_PROGRAM_ID,
    keys: [
      { pubkey: sessionTokenPda(signer, owner), isSigner: false, isWritable: true },
      { pubkey: signer, isSigner: true, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(writer.finish()),
  });
}

/** Fresh session keypair plus its create_session_v2 instruction. */
export async function createSessionIx(owner: PublicKey, connection: import("@solana/web3.js").Connection): Promise<{ session: StoredSession; ix: TransactionInstruction }> {
  void connection;
  const keypair = Keypair.generate();
  const validUntil = Math.floor(Date.now() / 1000) + SESSION_TTL_SECS;
  const ix = sessionInstruction(owner, keypair.publicKey, validUntil);
  return { session: { keypair, validUntil }, ix };
}
