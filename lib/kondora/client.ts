// Kondora program client: addresses, PDAs, account decoders, instruction builders.
// Depends only on @solana/web3.js v1 so it runs in the browser, Node and Convex.

import { AccountMeta, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import idlJson from "./idl.json";

// JSON default import differs between ESM and CJS loaders.
const idl = ((idlJson as unknown as { default?: typeof idlJson }).default ?? idlJson) as typeof idlJson;
import { decodeAccount, encodeArgs } from "./codec";

export const PROGRAM_ID = new PublicKey(idl.address);
export const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
export const MAGIC_PROGRAM_ID = new PublicKey("Magic11111111111111111111111111111111111111");
export const MAGIC_CONTEXT_ID = new PublicKey("MagicContext1111111111111111111111111111111");
export const SESSION_PROGRAM_ID = new PublicKey("KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5");
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
/** Circle devnet USDC. */
export const DEVNET_USDC = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

export const ENDPOINTS = {
  base: "https://api.devnet.solana.com",
  er: "https://devnet-as.magicblock.app",
  erWs: "wss://devnet-as.magicblock.app",
  router: "https://devnet-router.magicblock.app",
};
/** Asia devnet ER validator identity (pins delegation to the ER we read from). */
export const ER_VALIDATOR = new PublicKey("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57");

export const SIDE = { YES: 0, NO: 1 } as const;
export const STATE = { OPEN: 0, CLOSED: 1, PROPOSED: 2, DISPUTED: 3, RESOLVED: 4 } as const;
export const OUTCOME = { NONE: 0, YES: 1, NO: 2, INVALID: 3 } as const;
export const STATE_NAME = ["open", "closed", "proposed", "disputed", "resolved"] as const;
export const OUTCOME_NAME = ["none", "yes", "no", "invalid"] as const;
export const CATEGORIES = ["crypto", "macro", "sports", "esports", "politics", "world", "tech", "culture"] as const;
export type Category = (typeof CATEGORIES)[number];

// ── Types (IDL field names) ──────────────────────────────────────────────

export interface Params {
  fee_bps: number;
  mm_bps: number;
  liq_bps: number;
  max_lev_bps: number;
  borrow_bps_per_hour: number;
  l_floor_bps: number;
  max_price_bps: number;
  min_trade: bigint;
  tau0: bigint;
  reduce_only_secs: bigint;
  halt_secs: bigint;
  dispute_secs: bigint;
}

export const DEFAULT_PARAMS: Params = {
  fee_bps: 50,
  mm_bps: 500,
  liq_bps: 100,
  max_lev_bps: 50_000,
  borrow_bps_per_hour: 2,
  l_floor_bps: 3_000,
  max_price_bps: 9_900,
  min_trade: 1_000_000n,
  tau0: 86_400n,
  reduce_only_secs: 3_600n,
  halt_secs: 600n,
  dispute_secs: 900n,
};

export interface ConfigAccount {
  admin: PublicKey;
  creator: PublicKey;
  oracle: PublicKey;
  auditor: PublicKey;
  usdc_mint: PublicKey;
  vault: PublicKey;
  validator: PublicKey;
  params: Params;
  next_market_id: bigint;
  house_free: bigint;
  house_deposited: bigint;
  house_allocated: bigint;
  house_returned: bigint;
  paused: boolean;
  bump: number;
  vault_bump: number;
}

export interface MarketAccount {
  id: bigint;
  category: number;
  state: number;
  outcome: number;
  swept: boolean;
  question_hash: Uint8Array;
  rules_hash: Uint8Array;
  evidence_hash: Uint8Array;
  open_time: bigint;
  close_time: bigint;
  proposed_at: bigint;
  resolved_at: bigint;
  z0: number;
  z: number;
  l0: number;
  l: number;
  final_price_yes: number;
  mark_z: number;
  mark_t: bigint;
  cash: bigint;
  q_yes: bigint;
  q_no: bigint;
  subsidy: bigint;
  lend_initial: bigint;
  lend_pool: bigint;
  open_debt: bigint;
  debt_positions: number;
  fees: bigint;
  bad_debt: bigint;
  volume: bigint;
  trades: bigint;
  params: Params;
  bump: number;
}

export interface PositionData {
  market_id: bigint;
  side: number;
  shares: bigint;
  debt: bigint;
  accrued: bigint;
  margin: bigint;
  last_accrual: bigint;
  opened_at: bigint;
}

export interface UserAccountData {
  owner: PublicKey;
  balance: bigint;
  deposited: bigint;
  withdrawn: bigint;
  realized_pnl: bigint;
  trades: number;
  liquidations: number;
  positions: PositionData[];
  bump: number;
}

export const decodeConfig = (d: Uint8Array) => decodeAccount<ConfigAccount>("Config", d);
export const decodeMarket = (d: Uint8Array) => decodeAccount<MarketAccount>("Market", d);
export const decodeUser = (d: Uint8Array) => decodeAccount<UserAccountData>("UserAccount", d);

export const activePositions = (u: UserAccountData) =>
  u.positions.filter((p) => p.shares > 0n || p.debt > 0n || p.margin > 0n);

// ── PDAs ─────────────────────────────────────────────────────────────────

const enc = new TextEncoder();
const pda = (seeds: (Uint8Array | Buffer)[], program = PROGRAM_ID) => PublicKey.findProgramAddressSync(seeds, program)[0];

export function u64le(v: bigint | number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(v), true);
  return b;
}

export const configPda = () => pda([enc.encode("config")]);
export const vaultPda = () => pda([enc.encode("vault")]);
export const userPda = (owner: PublicKey) => pda([enc.encode("user"), owner.toBytes()]);
export const marketPda = (id: bigint | number) => pda([enc.encode("market"), u64le(id)]);
export const sessionTokenPda = (signer: PublicKey, authority: PublicKey) =>
  pda([enc.encode("session_token_v2"), PROGRAM_ID.toBytes(), signer.toBytes(), authority.toBytes()], SESSION_PROGRAM_ID);

function delegationAccounts(prefix: string, account: PublicKey): Record<string, PublicKey> {
  return {
    [`buffer_${prefix}`]: pda([enc.encode("buffer"), account.toBytes()], PROGRAM_ID),
    [`delegation_record_${prefix}`]: pda([enc.encode("delegation"), account.toBytes()], DELEGATION_PROGRAM_ID),
    [`delegation_metadata_${prefix}`]: pda([enc.encode("delegation-metadata"), account.toBytes()], DELEGATION_PROGRAM_ID),
  };
}

// ── Instruction builder ──────────────────────────────────────────────────

interface IdlIxAccount {
  name: string;
  writable?: boolean;
  signer?: boolean;
  optional?: boolean;
  address?: string;
}
const IXS = new Map(
  (idl.instructions as { name: string; accounts: IdlIxAccount[] }[]).map((i) => [i.name, i.accounts]),
);

export function buildIx(
  name: string,
  accounts: Record<string, PublicKey | undefined>,
  args: Record<string, unknown> = {},
  remaining: AccountMeta[] = [],
): TransactionInstruction {
  const defs = IXS.get(name);
  if (!defs) throw new Error(`unknown instruction ${name}`);
  const keys: AccountMeta[] = defs.map((a) => {
    const given = accounts[a.name];
    const pubkey = given ?? (a.address ? new PublicKey(a.address) : a.optional ? PROGRAM_ID : undefined);
    if (!pubkey) throw new Error(`${name}: missing account ${a.name}`);
    const absentOptional = a.optional && !given;
    return { pubkey, isSigner: !!a.signer && !absentOptional, isWritable: !!a.writable && !absentOptional };
  });
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [...keys, ...remaining],
    data: Buffer.from(encodeArgs(name, args)),
  });
}

// ── Friendly builders ────────────────────────────────────────────────────

export const ix = {
  initialize: (p: {
    admin: PublicKey;
    usdcMint: PublicKey;
    creator: PublicKey;
    oracle: PublicKey;
    auditor: PublicKey;
    /** Pinned ER validator; PublicKey.default allows any. */
    validator?: PublicKey;
    params?: Params;
  }) =>
    buildIx(
      "initialize",
      { admin: p.admin, config: configPda(), usdc_mint: p.usdcMint, vault: vaultPda(), token_program: TOKEN_PROGRAM_ID },
      { creator: p.creator, oracle: p.oracle, auditor: p.auditor, validator: p.validator ?? PublicKey.default, params: p.params ?? DEFAULT_PARAMS },
    ),

  updateConfig: (p: { admin: PublicKey; creator: PublicKey; oracle: PublicKey; auditor: PublicKey; validator: PublicKey; params: Params; paused: boolean }) =>
    buildIx("update_config", { admin: p.admin, config: configPda() }, p),

  houseDeposit: (p: { admin: PublicKey; adminToken: PublicKey; amount: bigint }) =>
    buildIx(
      "house_deposit",
      { admin: p.admin, config: configPda(), vault: vaultPda(), admin_token: p.adminToken, token_program: TOKEN_PROGRAM_ID },
      { amount: p.amount },
    ),

  houseWithdraw: (p: { admin: PublicKey; adminToken: PublicKey; amount: bigint }) =>
    buildIx(
      "house_withdraw",
      { admin: p.admin, config: configPda(), vault: vaultPda(), admin_token: p.adminToken, token_program: TOKEN_PROGRAM_ID },
      { amount: p.amount },
    ),

  initUser: (owner: PublicKey) => buildIx("init_user", { owner, user: userPda(owner) }),

  deposit: (p: { owner: PublicKey; ownerToken: PublicKey; amount: bigint }) =>
    buildIx(
      "deposit",
      { owner: p.owner, config: configPda(), user: userPda(p.owner), vault: vaultPda(), owner_token: p.ownerToken, token_program: TOKEN_PROGRAM_ID },
      { amount: p.amount },
    ),

  withdraw: (p: { owner: PublicKey; ownerToken: PublicKey; amount: bigint }) =>
    buildIx(
      "withdraw",
      { owner: p.owner, config: configPda(), user: userPda(p.owner), vault: vaultPda(), owner_token: p.ownerToken, token_program: TOKEN_PROGRAM_ID },
      { amount: p.amount },
    ),

  createMarket: (p: {
    creator: PublicKey;
    marketId: bigint;
    category: number;
    questionHash: Uint8Array;
    rulesHash: Uint8Array;
    closeTime: bigint;
    z0: number;
    subsidy: bigint;
    lend: bigint;
  }) =>
    buildIx(
      "create_market",
      { creator: p.creator, config: configPda(), market: marketPda(p.marketId) },
      {
        category: p.category,
        question_hash: p.questionHash,
        rules_hash: p.rulesHash,
        close_time: p.closeTime,
        z0: p.z0,
        subsidy: p.subsidy,
        lend: p.lend,
      },
    ),

  openPosition: (p: {
    signer: PublicKey;
    authority: PublicKey;
    marketId: bigint;
    side: number;
    margin: bigint;
    levBps: bigint;
    minShares: bigint;
    sessionToken?: PublicKey;
  }) =>
    buildIx(
      "open_position",
      { signer: p.signer, config: configPda(), authority: p.authority, user: userPda(p.authority), market: marketPda(p.marketId), session_token: p.sessionToken },
      { side: p.side, margin: p.margin, lev_bps: p.levBps, min_shares: p.minShares },
    ),

  closePosition: (p: {
    signer: PublicKey;
    authority: PublicKey;
    marketId: bigint;
    side: number;
    fractionBps: bigint;
    minOut: bigint;
    sessionToken?: PublicKey;
  }) =>
    buildIx(
      "close_position",
      { signer: p.signer, config: configPda(), authority: p.authority, user: userPda(p.authority), market: marketPda(p.marketId), session_token: p.sessionToken },
      { side: p.side, fraction_bps: p.fractionBps, min_out: p.minOut },
    ),

  liquidate: (p: { payer: PublicKey; owner: PublicKey; marketId: bigint; side: number }) =>
    buildIx("liquidate", { payer: p.payer, user: userPda(p.owner), market: marketPda(p.marketId) }, { side: p.side }),

  claim: (p: { payer: PublicKey; owner: PublicKey; marketId: bigint }) =>
    buildIx("claim", { payer: p.payer, user: userPda(p.owner), market: marketPda(p.marketId) }),

  closeMarket: (p: { payer: PublicKey; marketId: bigint }) =>
    buildIx("close_market", { payer: p.payer, market: marketPda(p.marketId) }),

  proposeResolution: (p: { oracle: PublicKey; marketId: bigint; outcome: number; evidenceHash: Uint8Array }) =>
    buildIx(
      "propose_resolution",
      { oracle: p.oracle, config: configPda(), market: marketPda(p.marketId) },
      { outcome: p.outcome, evidence_hash: p.evidenceHash },
    ),

  challenge: (p: { auditor: PublicKey; marketId: bigint }) =>
    buildIx("challenge", { auditor: p.auditor, config: configPda(), market: marketPda(p.marketId) }),

  finalize: (p: { payer: PublicKey; marketId: bigint }) =>
    buildIx("finalize", { payer: p.payer, market: marketPda(p.marketId) }),

  rule: (p: { admin: PublicKey; marketId: bigint; outcome: number; evidenceHash: Uint8Array }) =>
    buildIx(
      "rule",
      { admin: p.admin, config: configPda(), market: marketPda(p.marketId) },
      { outcome: p.outcome, evidence_hash: p.evidenceHash },
    ),

  sweep: (p: { payer: PublicKey; marketId: bigint }) =>
    buildIx("sweep", { payer: p.payer, config: configPda(), market: marketPda(p.marketId) }),

  delegateUser: (owner: PublicKey, validator: PublicKey | null = ER_VALIDATOR) => {
    const user = userPda(owner);
    return buildIx(
      "delegate_user",
      { owner, config: configPda(), user, ...delegationAccounts("user", user) },
      {},
      validator ? [{ pubkey: validator, isSigner: false, isWritable: false }] : [],
    );
  },

  undelegateUser: (owner: PublicKey) => buildIx("undelegate_user", { owner, user: userPda(owner) }),

  delegateMarket: (payer: PublicKey, marketId: bigint, validator: PublicKey | null = ER_VALIDATOR) => {
    const market = marketPda(marketId);
    return buildIx(
      "delegate_market",
      { payer, config: configPda(), market, ...delegationAccounts("market", market) },
      { id: marketId },
      validator ? [{ pubkey: validator, isSigner: false, isWritable: false }] : [],
    );
  },

  undelegateMarket: (payer: PublicKey, marketId: bigint) =>
    buildIx("undelegate_market", { payer, market: marketPda(marketId) }),
};

export { SystemProgram };
