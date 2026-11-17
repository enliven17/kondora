// Trading boundary: the UI only calls these functions. Amounts come in whole USDC and
// leverage as a multiple; conversion to micro USDC and basis points happens here.
//
// Layers:
// - Base (wallet signs): init_user, deposit, session token, delegate_user, withdraw.
// - ER (session key signs, no popup): open_position, close_position, claim.
//   Without a valid session the wallet signs the same ER transaction instead.

import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import {
  type Connection,
  type Keypair,
  PACKET_DATA_SIZE,
  type PublicKey,
  Transaction,
  type TransactionInstruction,
  type VersionedTransaction,
} from "@solana/web3.js";

import type { AccountSnapshot } from "./account";
import { baseConnection, erConnection, explorerTx, type Layer } from "./chain";
import { amm, DEVNET_USDC, ix, PROGRAM_ID, type PositionData, userPda } from "./kondora";
import type { LiveMarket } from "./live";
import { clearSession, createSessionIx, saveSession } from "./session";
import { friendlyError } from "./trade-errors";
import type { Side } from "./types";

export const SLIPPAGE_BPS = 100;
const UNDELEGATE_WAIT_MS = 25_000;
const BPS = BigInt(amm.BPS);

export interface TradeWallet {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
}

export interface TxLink {
  signature: string;
  layer: Layer;
  explorer: string;
}

export type TradeResult =
  | { ok: true; tx: TxLink; steps: TxLink[]; shares?: number }
  | { ok: false; error: string; tx?: TxLink };

class TxFailed extends Error {
  constructor(
    readonly reason: unknown,
    readonly tx?: TxLink,
  ) {
    super(typeof reason === "string" ? reason : JSON.stringify(reason));
  }
}

const sideNum = (s: Side): amm.Side => (s === "yes" ? 0 : 1);
const toMicro = (usdc: number) => BigInt(amm.micro(usdc));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fail(error: unknown): TradeResult {
  if (error instanceof TxFailed) return { ok: false, error: friendlyError(error.reason), tx: error.tx };
  return { ok: false, error: friendlyError(error) };
}

function done(steps: TxLink[], shares?: number): TradeResult {
  const tx = steps[steps.length - 1];
  if (!tx) return { ok: false, error: "Nothing to send." };
  return { ok: true, tx, steps, shares };
}

// ── Sending ──────────────────────────────────────────────────────────────

type Blockhash = { blockhash: string; lastValidBlockHeight: number };

async function sendAndConfirm(conn: Connection, tx: Transaction, layer: Layer, bh: Blockhash): Promise<TxLink> {
  const signature = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: layer === "er", preflightCommitment: "confirmed" });
  const link: TxLink = { signature, layer, explorer: explorerTx(signature, layer) };
  const res = await conn.confirmTransaction({ signature, ...bh }, "confirmed");
  if (res.value.err) throw new TxFailed(res.value.err, link);
  return link;
}

/** One transaction signed by the wallet (and optional extra keys), sent to `layer`. */
async function walletSend(wallet: TradeWallet, layer: Layer, ixs: TransactionInstruction[], cosigners: Keypair[] = []): Promise<TxLink> {
  const conn = layer === "er" ? erConnection() : baseConnection();
  const bh = await conn.getLatestBlockhash("confirmed");
  const signed = await wallet.signTransaction(new Transaction({ feePayer: wallet.publicKey, ...bh }).add(...ixs));
  cosigners.forEach((k) => signed.partialSign(k));
  return sendAndConfirm(conn, signed, layer, bh);
}

/** One ER transaction signed and paid by a local key: no wallet popup. */
async function keySend(key: Keypair, ixs: TransactionInstruction[]): Promise<TxLink> {
  const conn = erConnection();
  const bh = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: key.publicKey, ...bh }).add(...ixs);
  tx.sign(key);
  return sendAndConfirm(conn, tx, "er", bh);
}

/** Trade on the ER with the session key when there is one, else with the wallet. */
function erSend(wallet: TradeWallet, snap: AccountSnapshot, ixs: TransactionInstruction[]): Promise<TxLink> {
  return snap.session ? keySend(snap.session.keypair, ixs) : walletSend(wallet, "er", ixs);
}

function fits(owner: PublicKey, ixs: TransactionInstruction[]): boolean {
  try {
    const tx = new Transaction({ feePayer: owner, blockhash: PROGRAM_ID.toBase58(), lastValidBlockHeight: 0 }).add(...ixs);
    return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length <= PACKET_DATA_SIZE;
  } catch {
    return false;
  }
}

/** Undelegate on the ER, then wait until Solana owns the account again. */
async function undelegate(wallet: TradeWallet): Promise<TxLink> {
  const owner = wallet.publicKey;
  const link = await walletSend(wallet, "er", [ix.undelegateUser(owner)]);
  const base = baseConnection();
  const deadline = Date.now() + UNDELEGATE_WAIT_MS;
  while (Date.now() < deadline) {
    const info = await base.getAccountInfo(userPda(owner), "confirmed");
    if (info?.owner.equals(PROGRAM_ID)) return link;
    await wait(1_500);
  }
  throw new TxFailed("Your account is still moving back to Solana. Wait a minute, then try again.", link);
}

// ── Setup ────────────────────────────────────────────────────────────────

export interface EnableParams {
  wallet: TradeWallet;
  snap: AccountSnapshot;
  /** USDC to deposit from the wallet, may be 0. */
  deposit: number;
}

/**
 * Gets an account ready to trade in one wallet popup when possible:
 * init_user, deposit, a 24h session key and delegate_user. Adding funds to a
 * delegated account first undelegates it (one extra popup).
 */
export async function enableTrading({ wallet, snap, deposit }: EnableParams): Promise<TradeResult> {
  const owner = wallet.publicKey;
  const steps: TxLink[] = [];
  try {
    const amount = toMicro(Math.max(0, deposit));
    if (amount > snap.usdc) throw new TxFailed("That is more USDC than your wallet holds.");
    let delegated = snap.delegated;
    if (delegated && amount > 0n) {
      steps.push(await undelegate(wallet));
      delegated = false;
    }

    const setup: TransactionInstruction[] = [];
    if (!snap.exists) setup.push(ix.initUser(owner));
    if (amount > 0n) setup.push(ix.deposit({ owner, ownerToken: snap.ata, amount }));
    const cosigners: Keypair[] = [];
    if (!snap.session) {
      const created = await createSessionIx(owner, baseConnection());
      setup.push(created.ix);
      cosigners.push(created.session.keypair);
      saveSession(owner, created.session);
    }
    const tail = delegated ? [] : [ix.delegateUser(owner)];
    const all = [...setup, ...tail];
    if (all.length === 0) return { ok: false, error: "Already set up." };

    if (fits(owner, all)) {
      steps.push(await walletSend(wallet, "base", all, cosigners));
    } else {
      steps.push(...(await sendPair(wallet, setup, tail, cosigners)));
    }
    return done(steps);
  } catch (error) {
    if (!snap.session && error instanceof TxFailed && !error.tx) clearSession(owner);
    return fail(error);
  }
}

/** Two base transactions signed in one popup when the wallet supports signAllTransactions. */
async function sendPair(wallet: TradeWallet, first: TransactionInstruction[], second: TransactionInstruction[], cosigners: Keypair[]): Promise<TxLink[]> {
  if (!wallet.signAllTransactions || second.length === 0) {
    const links = [await walletSend(wallet, "base", first, cosigners)];
    if (second.length) links.push(await walletSend(wallet, "base", second));
    return links;
  }
  const conn = baseConnection();
  const bh = await conn.getLatestBlockhash("confirmed");
  const [a, b] = await wallet.signAllTransactions([
    new Transaction({ feePayer: wallet.publicKey, ...bh }).add(...first),
    new Transaction({ feePayer: wallet.publicKey, ...bh }).add(...second),
  ]);
  if (!a || !b) throw new TxFailed("The wallet did not sign both transactions.");
  cosigners.forEach((k) => a.partialSign(k));
  const one = await sendAndConfirm(conn, a, "base", bh);
  return [one, await sendAndConfirm(conn, b, "base", bh)];
}

// ── Trading on the ER ────────────────────────────────────────────────────

export interface PlaceBetParams {
  wallet: TradeWallet;
  snap: AccountSnapshot;
  live: LiveMarket;
  side: Side;
  /** Margin in USDC. */
  margin: number;
  /** 1 to 5. */
  leverage: number;
}

export async function placeBet({ wallet, snap, live, side, margin, leverage }: PlaceBetParams): Promise<TradeResult> {
  if (!snap.delegated) return { ok: false, error: "Enable trading first." };
  const marginMicro = toMicro(margin);
  if (marginMicro < live.account.params.min_trade) return { ok: false, error: "Below the minimum trade of 0.1 USDC." };
  const levBps = Math.round(leverage * amm.BPS);
  const q = amm.quoteOpen(live.pool, sideNum(side), Number(marginMicro), levBps);
  if (!q || q.shares <= 0) return { ok: false, error: "The pool cannot fill this size. Try a smaller amount." };
  const minShares = (BigInt(q.shares) * (BPS - BigInt(SLIPPAGE_BPS))) / BPS;
  try {
    const link = await erSend(wallet, snap, [
      ix.openPosition({
        signer: snap.session?.keypair.publicKey ?? wallet.publicKey,
        authority: wallet.publicKey,
        marketId: live.account.id,
        side: sideNum(side),
        margin: marginMicro,
        levBps: BigInt(levBps),
        minShares,
        sessionToken: snap.session?.token,
      }),
    ]);
    return done([link], amm.usdc(q.shares));
  } catch (error) {
    return fail(error);
  }
}

/** What the owner receives for closing `fractionBps` of a position now, micro USDC (before slippage). */
export function expectedCloseOut(live: LiveMarket, position: PositionData, fractionBps = amm.BPS, now = Date.now() / 1000): number {
  const frac = Math.min(Math.max(fractionBps, 1), amm.BPS) / amm.BPS;
  const all = frac >= 1;
  const shares = all ? Number(position.shares) : Math.floor(Number(position.shares) * frac);
  const value = amm.exitValue(live.pool, position.side as amm.Side, shares);
  const hours = Math.max(0, now - Number(position.last_accrual)) / 3600;
  const pending = Math.ceil((Number(position.debt) * live.account.params.borrow_bps_per_hour * hours) / amm.BPS);
  const debt = Number(position.debt);
  const accrued = Number(position.accrued) + pending;
  const owed = all ? debt + accrued : Math.ceil(debt * frac) + Math.ceil(accrued * frac);
  return value - owed;
}

export interface ClosePositionParams {
  wallet: TradeWallet;
  snap: AccountSnapshot;
  live: LiveMarket;
  position: PositionData;
  /** 10_000 closes the whole position. */
  fractionBps?: number;
}

export async function closePosition({ wallet, snap, live, position, fractionBps = amm.BPS }: ClosePositionParams): Promise<TradeResult> {
  if (!snap.delegated) return { ok: false, error: "Enable trading first." };
  if (fractionBps <= 0 || fractionBps > amm.BPS) return { ok: false, error: "Invalid close size." };
  const expected = expectedCloseOut(live, position, fractionBps);
  if (expected <= 0 && position.debt > 0n) return { ok: false, error: "This position is underwater. Only liquidation can close it." };
  // Session-signed closes must carry a bound above zero.
  const floor = snap.session ? 1 : 0;
  const minOut = BigInt(Math.max(floor, Math.floor((expected * (amm.BPS - SLIPPAGE_BPS)) / amm.BPS)));
  try {
    const link = await erSend(wallet, snap, [
      ix.closePosition({
        signer: snap.session?.keypair.publicKey ?? wallet.publicKey,
        authority: wallet.publicKey,
        marketId: position.market_id,
        side: position.side,
        fractionBps: BigInt(fractionBps),
        minOut,
        sessionToken: snap.session?.token,
      }),
    ]);
    return done([link]);
  } catch (error) {
    return fail(error);
  }
}

/** Claims every side of a resolved market. Permissionless, so the session key can pay. */
export async function claimPosition({ wallet, snap, marketId }: { wallet: TradeWallet; snap: AccountSnapshot; marketId: bigint }): Promise<TradeResult> {
  try {
    if (snap.delegated) {
      const payer = snap.session?.keypair.publicKey ?? wallet.publicKey;
      return done([await erSend(wallet, snap, [ix.claim({ payer, owner: wallet.publicKey, marketId })])]);
    }
    return done([await walletSend(wallet, "base", [ix.claim({ payer: wallet.publicKey, owner: wallet.publicKey, marketId })])]);
  } catch (error) {
    return fail(error);
  }
}

// ── Withdraw ─────────────────────────────────────────────────────────────

export interface WithdrawParams {
  wallet: TradeWallet;
  snap: AccountSnapshot;
  /** USDC to withdraw to the wallet. */
  amount: number;
}

/**
 * Undelegate on the ER, wait for Solana to own the account, withdraw on Solana.
 * The account is delegated again in the same transaction when anything stays in it,
 * so open positions keep trading.
 */
export async function withdraw({ wallet, snap, amount }: WithdrawParams): Promise<TradeResult> {
  const owner = wallet.publicKey;
  const balance = snap.user?.balance ?? 0n;
  const micro = toMicro(amount);
  if (micro <= 0n) return { ok: false, error: "Enter an amount above zero." };
  if (micro > balance) return { ok: false, error: "Above your trading balance." };
  const steps: TxLink[] = [];
  try {
    if (snap.delegated) steps.push(await undelegate(wallet));
    const keepTrading = micro < balance || (snap.user ? snap.user.positions.some((p) => p.shares > 0n || p.debt > 0n) : false);
    const ixs: TransactionInstruction[] = [];
    if (!snap.ataExists) ixs.push(createAssociatedTokenAccountIdempotentInstruction(owner, snap.ata, owner, DEVNET_USDC));
    ixs.push(ix.withdraw({ owner, ownerToken: snap.ata, amount: micro }));
    if (keepTrading) ixs.push(ix.delegateUser(owner));
    steps.push(await walletSend(wallet, "base", ixs));
    return done(steps);
  } catch (error) {
    const result = fail(error);
    return steps.length && !result.ok ? { ...result, error: `${result.error} Your account is back on Solana; withdraw again to finish.` } : result;
  }
}
