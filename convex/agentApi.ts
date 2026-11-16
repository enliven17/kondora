"use node";
// Agent API backends: live quotes, unsigned transactions, account reads.
// The server never holds user keys; agents sign and send themselves.

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { DELEGATION_PROGRAM_ID, ENDPOINTS, STATE, activePositions, amm, decodeUser, ix, userPda } from "../lib/kondora";
import { baseConnection, erConnection, fetchConfig, fetchMarket } from "../lib/kondora/server";

const SIDES = { yes: 0, no: 1 } as const;

function poolOf(a: Awaited<ReturnType<typeof fetchMarket>>) {
  const m = a!.account;
  const now = Math.floor(Date.now() / 1000);
  const l = Math.min(m.l, amm.liquidityAt(m.l0, Number(m.open_time), Number(m.close_time), now, m.params.l_floor_bps));
  const p = amm.cdf(m.z);
  return {
    pool: { z: m.z, l, feeBps: m.params.fee_bps, mmBps: m.params.mm_bps },
    priceYes: p,
    maxLeverage: amm.maxLeverageBps(m.params.max_lev_bps, Number(m.close_time) - now, Number(m.params.tau0), p, Number(m.params.reduce_only_secs)) / 10_000,
    maxLeverageNo: amm.maxLeverageBps(m.params.max_lev_bps, Number(m.close_time) - now, Number(m.params.tau0), 1 - p, Number(m.params.reduce_only_secs)) / 10_000,
    state: m.state,
  };
}

export const quote = internalAction({
  args: { marketId: v.number(), side: v.string(), margin: v.number(), leverage: v.number() },
  handler: async (_ctx, a) => {
    const live = await fetchMarket(BigInt(a.marketId));
    if (!live) throw new Error("market not found");
    const side = SIDES[a.side as keyof typeof SIDES];
    if (side === undefined) throw new Error("side must be yes or no");
    const info = poolOf(live);
    const q = amm.quoteOpen(info.pool, side, Math.round(a.margin * 1e6), Math.round(a.leverage * 10_000));
    if (!q) throw new Error("trade too large for current liquidity");
    return {
      marketId: a.marketId,
      side: a.side,
      priceYes: info.priceYes,
      maxLeverage: side === 0 ? info.maxLeverage : info.maxLeverageNo,
      tradingOpen: info.state === STATE.OPEN,
      notional: q.notional / 1e6,
      debt: q.debt / 1e6,
      fee: q.fee / 1e6,
      shares: q.shares / 1e6,
      avgPrice: q.avgPrice,
      priceAfter: q.priceAfter,
      payoutIfWin: q.maxPayout / 1e6,
      liquidationPrice: q.liquidationPrice,
    };
  },
});

export const account = internalAction({
  args: { owner: v.string() },
  handler: async (_ctx, { owner }) => {
    const pk = new PublicKey(owner);
    const base = baseConnection();
    const info = await base.getAccountInfo(userPda(pk));
    if (!info) return { exists: false, delegated: false };
    const delegated = info.owner.equals(DELEGATION_PROGRAM_ID);
    const data = delegated ? (await erConnection().getAccountInfo(userPda(pk)))?.data ?? info.data : info.data;
    const u = decodeUser(data);
    return {
      exists: true,
      delegated,
      balance: Number(u.balance) / 1e6,
      deposited: Number(u.deposited) / 1e6,
      withdrawn: Number(u.withdrawn) / 1e6,
      realizedPnl: Number(u.realized_pnl) / 1e6,
      trades: u.trades,
      liquidations: u.liquidations,
      positions: activePositions(u).map((p) => ({
        marketId: Number(p.market_id),
        side: p.side === 0 ? "yes" : "no",
        shares: Number(p.shares) / 1e6,
        debt: Number(p.debt) / 1e6,
        accrued: Number(p.accrued) / 1e6,
        margin: Number(p.margin) / 1e6,
        openedAt: Number(p.opened_at),
      })),
    };
  },
});

/** Builds an unsigned transaction for the right layer. */
export const buildTx = internalAction({
  args: {
    action: v.string(),
    owner: v.string(),
    signer: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    marketId: v.optional(v.number()),
    side: v.optional(v.string()),
    margin: v.optional(v.number()),
    leverage: v.optional(v.number()),
    fraction: v.optional(v.number()),
    slippageBps: v.optional(v.number()),
    amount: v.optional(v.number()),
  },
  handler: async (_ctx, a) => {
    const owner = new PublicKey(a.owner);
    const signer = a.signer ? new PublicKey(a.signer) : owner;
    const sessionToken = a.sessionToken ? new PublicKey(a.sessionToken) : undefined;
    const slip = Math.min(Math.max(a.slippageBps ?? 100, 0), 5_000);
    const usd = (x?: number) => BigInt(Math.round((x ?? 0) * 1e6));
    let ixs: TransactionInstruction[] = [];
    let layer: "base" | "er" = "base";

    const cfg = await fetchConfig();
    if (!cfg) throw new Error("program not initialized");
    const ownerToken = getAssociatedTokenAddressSync(cfg.usdc_mint, owner);

    switch (a.action) {
      case "init":
        ixs = [ix.initUser(owner)];
        break;
      case "deposit":
        ixs = [ix.deposit({ owner, ownerToken, amount: usd(a.amount) })];
        break;
      case "withdraw":
        ixs = [ix.withdraw({ owner, ownerToken, amount: usd(a.amount) })];
        break;
      case "delegate":
        ixs = [ix.delegateUser(owner)];
        break;
      case "undelegate":
        ixs = [ix.undelegateUser(owner)];
        layer = "er";
        break;
      case "open":
      case "close":
      case "claim": {
        if (a.marketId === undefined) throw new Error("marketId required");
        const live = await fetchMarket(BigInt(a.marketId));
        if (!live) throw new Error("market not found");
        const userInfo = await baseConnection().getAccountInfo(userPda(owner));
        layer = userInfo?.owner.equals(DELEGATION_PROGRAM_ID) ? "er" : "base";
        const marketId = BigInt(a.marketId);
        if (a.action === "claim") {
          ixs = [ix.claim({ payer: signer, owner, marketId })];
          break;
        }
        const side = SIDES[a.side as keyof typeof SIDES];
        if (side === undefined) throw new Error("side must be yes or no");
        if (a.action === "open") {
          const levBps = Math.round((a.leverage ?? 1) * 10_000);
          const margin = usd(a.margin);
          const q = amm.quoteOpen(poolOf(live).pool, side, Number(margin), levBps);
          if (!q) throw new Error("trade too large for current liquidity");
          const minShares = BigInt(Math.floor((q.shares * (10_000 - slip)) / 10_000));
          ixs = [ix.openPosition({ signer, authority: owner, marketId, side, margin, levBps: BigInt(levBps), minShares, sessionToken })];
        } else {
          const fractionBps = BigInt(Math.round(Math.min(Math.max(a.fraction ?? 1, 0.0001), 1) * 10_000));
          ixs = [ix.closePosition({ signer, authority: owner, marketId, side, fractionBps, minOut: 0n, sessionToken })];
        }
        break;
      }
      default:
        throw new Error(`unknown action ${a.action}`);
    }

    const conn = layer === "er" ? erConnection() : baseConnection();
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: signer, blockhash, lastValidBlockHeight }).add(...ixs);
    return {
      transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
      layer,
      rpc: layer === "er" ? process.env.ER_RPC ?? ENDPOINTS.er : process.env.SOLANA_RPC ?? ENDPOINTS.base,
      signers: [...new Set([signer.toBase58(), ...(a.action === "open" || a.action === "close" || a.action === "claim" ? [] : [owner.toBase58()])])],
      note: layer === "er" ? "Send to the ER endpoint with skipPreflight: true." : "Send to Solana devnet.",
    };
  },
});

/** Ed25519 check for the signed registration envelope. */
export const verifySignature = internalAction({
  args: { pubkey: v.string(), message: v.string(), signature: v.string() },
  handler: async (_ctx, { pubkey, message, signature }) => {
    try {
      return ed25519.verify(bs58.decode(signature), new TextEncoder().encode(message), new PublicKey(pubkey).toBytes());
    } catch {
      return false;
    }
  },
});

