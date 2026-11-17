// Live market state (client only).
//
// A delegated market is read from the Ephemeral Rollup and followed over its
// websocket (onAccountChange). A market on the base layer is polled every 15 s
// and switches to the ER subscription as soon as it is delegated. Subscriptions
// are shared per market and torn down when the last listener leaves.

import type { AccountInfo, Connection, PublicKey } from "@solana/web3.js";

import { baseConnection, erConnection, poolOf } from "./chain";
import { amm, decodeMarket, DELEGATION_PROGRAM_ID, marketPda, type MarketAccount } from "./kondora";
import type { PricePoint } from "./types";

const POLL_MS = 15_000;

export interface LiveMarket {
  account: MarketAccount;
  delegated: boolean;
  /** YES price, amm.cdf(z). */
  priceYes: number;
  /** Pool with L decayed to now: feed this to quoteOpen and exitValue. */
  pool: amm.PoolState;
  /** Liquidity at its floor: leveraged positions must stay healthy here too (program size cap). */
  floorL: number;
  /** Unix seconds when this state was read. */
  at: number;
}

type Listener = (state: LiveMarket) => void;

interface Entry {
  listeners: Set<Listener>;
  last: LiveMarket | null;
  stop: () => void;
}

const entries = new Map<string, Entry>();

function toLive(account: MarketAccount, delegated: boolean): LiveMarket {
  const at = Date.now() / 1000;
  const floorL = (account.l0 * account.params.l_floor_bps) / amm.BPS;
  return { account, delegated, priceYes: amm.cdf(account.z), pool: poolOf(account, at), floorL, at };
}

function decodeSafe(info: AccountInfo<Buffer> | null): MarketAccount | null {
  if (!info) return null;
  try {
    return decodeMarket(info.data);
  } catch {
    return null;
  }
}

function start(id: bigint, entry: Entry): () => void {
  const pk: PublicKey = marketPda(id);
  const base: Connection = baseConnection();
  const er: Connection = erConnection();
  let stopped = false;
  let wsId: number | null = null;
  let timer = 0;

  const emit = (account: MarketAccount, delegated: boolean) => {
    if (stopped) return;
    const next = toLive(account, delegated);
    entry.last = next;
    entry.listeners.forEach((l) => l(next));
  };

  const subscribeEr = async () => {
    const first = decodeSafe(await er.getAccountInfo(pk, "confirmed"));
    if (stopped) return;
    if (first) emit(first, true);
    wsId = er.onAccountChange(
      pk,
      (info) => {
        const m = decodeSafe(info);
        if (m) emit(m, true);
      },
      { commitment: "confirmed" },
    );
  };

  const poll = async () => {
    if (stopped) return;
    try {
      const info = await base.getAccountInfo(pk, "confirmed");
      if (stopped || !info) return;
      if (info.owner.equals(DELEGATION_PROGRAM_ID)) {
        await subscribeEr();
        return; // The ER websocket takes over.
      }
      const m = decodeSafe(info);
      if (m) emit(m, false);
    } catch {
      // Transient RPC failure: the next poll retries.
    }
    if (!stopped) timer = window.setTimeout(poll, POLL_MS);
  };

  void poll();

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    if (wsId !== null) void er.removeAccountChangeListener(wsId).catch(() => undefined);
  };
}

/** Follow one market's on-chain state. Returns an unsubscribe function. */
export function subscribeMarket(marketId: string, onState: Listener): () => void {
  if (!/^\d+$/.test(marketId)) return () => undefined;
  let entry = entries.get(marketId);
  if (!entry) {
    const fresh: Entry = { listeners: new Set(), last: null, stop: () => undefined };
    entries.set(marketId, fresh);
    fresh.stop = start(BigInt(marketId), fresh);
    entry = fresh;
  }
  entry.listeners.add(onState);
  if (entry.last) onState(entry.last);
  const e = entry;
  return () => {
    e.listeners.delete(onState);
    if (e.listeners.size === 0) {
      e.stop();
      entries.delete(marketId);
    }
  };
}

/** Last known state without subscribing. */
export const peekMarket = (marketId: string) => entries.get(marketId)?.last ?? null;

/**
 * Price ticks for the chart. Emits a point whenever the on-chain price or volume moves.
 * `v` is the traded notional since the previous tick, USDC.
 */
export function subscribePrice(marketId: string, last: PricePoint, onTick: (point: PricePoint) => void): () => void {
  let prevP = last.p;
  let prevVolume: bigint | null = null;
  return subscribeMarket(marketId, (s) => {
    const volume = s.account.volume;
    const v = prevVolume === null ? 0 : Number(volume - prevVolume) / 1e6;
    const moved = Math.abs(s.priceYes - prevP) > 1e-6 || v > 0;
    prevVolume = volume;
    if (!moved) return;
    prevP = s.priceYes;
    onTick({ t: Math.floor(s.at), p: s.priceYes, v: Math.max(0, v) });
  });
}
