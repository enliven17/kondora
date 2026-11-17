"use client";

import { WalletContext, type WalletContextState } from "@solana/wallet-adapter-react";
import { WalletModalContext, type WalletModalContextState } from "@solana/wallet-adapter-react-ui";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { type ComponentType, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MotionProvider } from "@/app/providers";
import { SmoothScroll } from "@/components/ui/smooth-scroll";

import type { WalletBridgeProps } from "./wallet-runtime";
import { hasRememberedWallet, loadWallet } from "./wallet-loader";

/* ---------------------------------------------------------------- Convex */

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
/** Created once per browser session, on the first app route. Null until NEXT_PUBLIC_CONVEX_URL is set. */
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

function OptionalConvex({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

/* ---------------------------------------------------------------- Wallet */

const notReady = () => Promise.reject(new Error("Wallet is still loading"));

/** Disconnected wallet state until the runtime loads (the library default logs errors on every read). */
const IDLE_WALLET: WalletContextState = {
  autoConnect: false,
  wallets: [],
  wallet: null,
  publicKey: null,
  connecting: false,
  connected: false,
  disconnecting: false,
  select: () => undefined,
  connect: notReady,
  disconnect: notReady,
  sendTransaction: notReady,
  signTransaction: undefined,
  signAllTransactions: undefined,
  signMessage: undefined,
  signIn: undefined,
};

/**
 * The wallet adapters and @solana/web3.js (~130KB gz) load only when needed: a remembered wallet
 * to auto-connect, or the first "Connect wallet" click (warmed on hover). Until then the hooks
 * read a disconnected state. The contexts are provided here with a fixed tree shape and the
 * runtime mounts as a sibling, so loading it never remounts the page.
 */
function LazyWallet({ children }: { children: ReactNode }) {
  const [Runtime, setRuntime] = useState<ComponentType<WalletBridgeProps> | null>(null);
  const [wallet, setWallet] = useState<WalletContextState>(IDLE_WALLET);
  const [modal, setModal] = useState<WalletModalContextState | null>(null);
  const openOnLoad = useRef(false);

  const start = useCallback(() => {
    void loadWallet()
      .then((m) => setRuntime(() => m.WalletRuntime))
      .catch(() => {
        openOnLoad.current = false;
      });
  }, []);

  useEffect(() => {
    if (hasRememberedWallet()) start();
  }, [start]);

  // Open the modal as soon as the runtime reports in, if a click asked for it.
  useEffect(() => {
    if (modal && openOnLoad.current) {
      openOnLoad.current = false;
      modal.setVisible(true);
    }
  }, [modal]);

  const pendingModal = useMemo<WalletModalContextState>(
    () => ({
      visible: false,
      setVisible: (open: boolean) => {
        openOnLoad.current = open;
        if (open) start();
      },
    }),
    [start],
  );

  return (
    <WalletContext.Provider value={wallet}>
      <WalletModalContext.Provider value={modal ?? pendingModal}>
        {children}
        {Runtime && <Runtime onWallet={setWallet} onModal={setModal} />}
      </WalletModalContext.Provider>
    </WalletContext.Provider>
  );
}

/* ------------------------------------------------------------------ Root */

/** Providers for the trading app only: Convex live queries, the Solana wallet, motion settings, smooth scroll. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <OptionalConvex>
      <LazyWallet>
        <MotionProvider>
          <SmoothScroll />
          {children}
        </MotionProvider>
      </LazyWallet>
    </OptionalConvex>
  );
}
