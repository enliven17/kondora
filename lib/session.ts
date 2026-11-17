// Session keys (devnet). A browser Keypair signs ER trades so bets need no wallet popup.
// The secret lives in localStorage keyed by wallet: acceptable on devnet only, since a
// session key can open and close positions but never withdraw.

import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";

import { PROGRAM_ID, sessionTokenPda } from "./kondora";

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

/** Fresh session keypair plus its create_session_v2 instruction, built with the MagicBlock gum SDK. */
export async function createSessionIx(owner: PublicKey, connection: import("@solana/web3.js").Connection): Promise<{ session: StoredSession; ix: TransactionInstruction }> {
  const [{ SessionTokenManager }, { BN }] = await Promise.all([import("@magicblock-labs/gum-sdk"), import("@coral-xyz/anchor")]);
  const keypair = Keypair.generate();
  const validUntil = Math.floor(Date.now() / 1000) + SESSION_TTL_SECS;
  // The manager only needs a wallet to build an Anchor provider; nothing is signed through it.
  const readOnlyWallet = {
    publicKey: owner,
    signTransaction: () => Promise.reject(new Error("not used")),
    signAllTransactions: () => Promise.reject(new Error("not used")),
  };
  const manager = new SessionTokenManager(readOnlyWallet as never, connection as never);
  const methods = manager.program.methods as unknown as {
    createSessionV2: (topUp: boolean, validUntil: InstanceType<typeof BN>, lamports: InstanceType<typeof BN>) => {
      accountsPartial: (a: Record<string, PublicKey>) => { instruction: () => Promise<TransactionInstruction> };
    };
  };
  const ix = await methods
    .createSessionV2(true, new BN(validUntil), new BN(SESSION_TOP_UP_LAMPORTS))
    .accountsPartial({
      sessionToken: sessionTokenPda(keypair.publicKey, owner),
      sessionSigner: keypair.publicKey,
      feePayer: owner,
      authority: owner,
      targetProgram: PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return { session: { keypair, validUntil }, ix };
}
