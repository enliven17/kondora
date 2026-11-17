import type { Side } from "./types";

/**
 * Trading boundary. The UI only calls these functions.
 * Replace the bodies with lib/kondora instruction builders sent through the session key
 * on the MagicBlock ER. Amounts here are whole USDC: convert to 6-decimal integers and
 * leverage to basis points (x * 10_000) inside, never in components.
 */

export interface PlaceBetParams {
  marketId: string;
  side: Side;
  /** Margin in USDC. */
  margin: number;
  /** 1 to 5. */
  leverage: number;
  /** Slippage guard: minimum shares accepted. */
  minShares: number;
  /** Base58 owner wallet, if connected. */
  owner?: string;
}

export type TradeResult = { ok: true; signature: string; shares: number } | { ok: false; error: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mockSignature() {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 88; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

/** Stub: open_position via session key on the ER. */
export async function placeBet(params: PlaceBetParams): Promise<TradeResult> {
  if (!(params.margin > 0)) return { ok: false, error: "Enter an amount above zero." };
  if (params.leverage < 1 || params.leverage > 5) return { ok: false, error: "Leverage must be between 1x and 5x." };
  await wait(700);
  return { ok: true, signature: mockSignature(), shares: params.minShares };
}

export interface ClosePositionParams {
  marketId: string;
  side: Side;
  /** 10_000 closes the whole position. */
  fractionBps: number;
  minOut: number;
  owner?: string;
}

/** Stub: close_position via session key on the ER. */
export async function closePosition(params: ClosePositionParams): Promise<TradeResult> {
  if (params.fractionBps <= 0 || params.fractionBps > 10_000) return { ok: false, error: "Invalid close size." };
  await wait(600);
  return { ok: true, signature: mockSignature(), shares: 0 };
}

export interface ClaimParams {
  marketId: string;
  side: Side;
  owner?: string;
}

/** Stub: claim the payout of a settled position. */
export async function claimPosition(params: ClaimParams): Promise<TradeResult> {
  if (!params.marketId) return { ok: false, error: "Unknown market." };
  await wait(600);
  return { ok: true, signature: mockSignature(), shares: 0 };
}
