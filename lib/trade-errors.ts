// Program and wallet errors mapped to short, plain messages.

import idlJson from "./kondora/idl.json";

const FRIENDLY: Record<string, string> = {
  Unauthorized: "This wallet cannot do that.",
  Paused: "New bets are paused. Closing and claiming still work.",
  InvalidParams: "Those trade settings are not valid.",
  Math: "The pool cannot fill this size. Try a smaller amount.",
  MarketNotOpen: "This market is not open for trading.",
  WrongState: "This market is not ready for that yet.",
  TradingClosed: "Trading on this market has closed.",
  TradingStillOpen: "Trading is still open on this market.",
  TooSmall: "Below the minimum trade of 0.1 USDC.",
  InsufficientBalance: "Not enough balance in your trading account.",
  LeverageTooHigh: "Leverage is above the current cap. Lower it and try again.",
  InsufficientLiquidity: "Not enough lending liquidity for this leverage. Try less leverage or a smaller size.",
  PriceOutOfRange: "This bet would push the price past the allowed range. Try a smaller amount.",
  Slippage: "The price moved before your trade landed. Try again.",
  NoSlot: "You have 24 open positions. Close one first.",
  NoPosition: "No position found on this market.",
  Unhealthy: "This would be liquidatable right away. Use less leverage or a smaller size.",
  Healthy: "This position is healthy.",
  DebtOutstanding: "Leveraged positions are still open on this market.",
  DisputeWindowOpen: "The dispute window is still open. Try again after it ends.",
  DisputeWindowClosed: "The dispute window has passed.",
  InvalidOutcome: "Invalid outcome.",
  AlreadySwept: "This market was already swept.",
  HouseLiquidity: "The House cannot fund this right now.",
  MintMismatch: "Wrong token. Deposits take devnet USDC only.",
};

const BY_CODE = new Map<number, string>(
  (idlJson as { errors: { code: number; name: string; msg: string }[] }).errors.map((e) => [e.code, FRIENDLY[e.name] ?? e.msg]),
);

/** Custom error code from a confirm result or a thrown RPC error. */
export function customCode(err: unknown): number | null {
  if (err && typeof err === "object" && "InstructionError" in err) {
    const detail = (err as { InstructionError: [number, unknown] }).InstructionError[1];
    if (detail && typeof detail === "object" && "Custom" in detail) return Number((detail as { Custom: number }).Custom);
  }
  const text = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err ?? "");
  const hex = /custom program error: (0x[0-9a-f]+)/i.exec(text);
  if (hex?.[1]) return Number.parseInt(hex[1], 16);
  const dec = /"Custom":\s*(\d+)/.exec(text);
  return dec?.[1] ? Number(dec[1]) : null;
}

export function friendlyError(err: unknown): string {
  const code = customCode(err);
  if (code !== null) {
    const known = BY_CODE.get(code);
    if (known) return known;
    if (code === 3012) return "Your trading account is not set up yet. Enable trading first.";
    // System transfer error 1 inside a delegate or init: the wallet ran out of SOL for rent.
    if (code === 1) return "Not enough devnet SOL for fees.";
    return `The program rejected this transaction (code ${code}).`;
  }
  const text = err instanceof Error ? err.message : String(err ?? "");
  if (/reject|denied|cancel/i.test(text)) return "You cancelled in your wallet.";
  if (/insufficient (lamports|funds)|0x1\b|debit an account/i.test(text)) return "Not enough devnet SOL for fees.";
  if (/blockhash|expired|timed? ?out/i.test(text)) return "The network did not confirm in time. Check your portfolio before retrying.";
  if (/too large/i.test(text)) return "Transaction too large. Try again.";
  return text ? text.slice(0, 160) : "Something went wrong. Try again.";
}
