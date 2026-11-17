"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type { AccountSnapshot } from "@/lib/account";
import type { TradeWallet } from "@/lib/trade";
import { preloadTrading, readAccount } from "@/lib/trade-lazy";

const POLL_MS = 12_000;

export interface AccountState {
  snap: AccountSnapshot | null;
  loading: boolean;
  error: string | null;
}

interface Store {
  state: AccountState;
  listeners: Set<() => void>;
  timer: number;
  inflight: Promise<void> | null;
}

const IDLE: AccountState = { snap: null, loading: false, error: null };
const stores = new Map<string, Store>();

function storeFor(owner: string): Store {
  let s = stores.get(owner);
  if (!s) {
    s = { state: { snap: null, loading: true, error: null }, listeners: new Set(), timer: 0, inflight: null };
    stores.set(owner, s);
  }
  return s;
}

function set(store: Store, next: AccountState) {
  store.state = next;
  store.listeners.forEach((l) => l());
}

function refresh(owner: PublicKey): Promise<void> {
  const store = storeFor(owner.toBase58());
  store.inflight ??= readAccount(owner)
    .then((snap) => set(store, { snap, loading: false, error: null }))
    .catch(() => set(store, { ...store.state, loading: false, error: "Could not read your account. Retrying." }))
    .finally(() => {
      store.inflight = null;
    });
  return store.inflight;
}

/**
 * The connected wallet's Kondora account, USDC and SOL balances and session key.
 * One poller per wallet no matter how many components read it.
 */
export function useKondoraAccount() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const key = publicKey?.toBase58() ?? null;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!key || !publicKey) return () => undefined;
      const store = storeFor(key);
      store.listeners.add(onChange);
      if (store.listeners.size === 1) {
        preloadTrading(); // a wallet is connected: trading is likely, warm the builders
        void refresh(publicKey);
        // Skip ticks while the tab is hidden; the visibilitychange handler below refreshes on return.
        store.timer = window.setInterval(() => document.visibilityState === "visible" && void refresh(publicKey), POLL_MS);
      }
      return () => {
        store.listeners.delete(onChange);
        if (store.listeners.size === 0) window.clearInterval(store.timer);
      };
    },
    [key, publicKey],
  );

  const state = useSyncExternalStore(
    subscribe,
    () => (key ? storeFor(key).state : IDLE),
    () => IDLE,
  );

  const wallet = useMemo<TradeWallet | null>(
    () => (publicKey && signTransaction ? { publicKey, signTransaction, signAllTransactions } : null),
    [publicKey, signTransaction, signAllTransactions],
  );

  const reload = useCallback(() => (publicKey ? refresh(publicKey) : Promise.resolve()), [publicKey]);

  // Refresh when the tab comes back so balances are never stale after a faucet visit.
  useEffect(() => {
    if (!publicKey) return;
    const onVisible = () => document.visibilityState === "visible" && void refresh(publicKey);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [publicKey]);

  const snap = state.snap && key && state.snap.owner.toBase58() === key ? state.snap : null;
  const ready = Boolean(snap?.exists && snap.delegated);
  return { ...state, snap, wallet, ready, reload, connected: Boolean(publicKey) };
}
