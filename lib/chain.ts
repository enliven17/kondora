// Browser chain access: one base and one ER connection per tab, explorer links,
// and pool math from a decoded market account.

import { Connection } from "@solana/web3.js";

import { amm, ENDPOINTS, type MarketAccount } from "./kondora";

let base: Connection | null = null;
let er: Connection | null = null;

export const BASE_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || ENDPOINTS.base;

export function baseConnection(): Connection {
  base ??= new Connection(BASE_RPC, "confirmed");
  return base;
}

export function erConnection(): Connection {
  er ??= new Connection(ENDPOINTS.er, { commitment: "confirmed", wsEndpoint: ENDPOINTS.erWs });
  return er;
}

export type Layer = "base" | "er";

export function explorerTx(signature: string, layer: Layer): string {
  const url = new URL(`https://explorer.solana.com/tx/${signature}`);
  if (layer === "er") {
    url.searchParams.set("cluster", "custom");
    url.searchParams.set("customUrl", ENDPOINTS.er);
  } else {
    url.searchParams.set("cluster", "devnet");
  }
  return url.toString();
}

/** Pool state exactly as the program syncs it before a trade: L follows the time decay. */
export function poolOf(m: MarketAccount, now = Date.now() / 1000): amm.PoolState {
  const decayed = amm.liquidityAt(m.l0, Number(m.open_time), Number(m.close_time), now, m.params.l_floor_bps);
  return { z: m.z, l: Math.min(m.l, decayed), feeBps: m.params.fee_bps, mmBps: m.params.mm_bps };
}
