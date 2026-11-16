"use client";

import "@solana/wallet-adapter-react-ui/styles.css";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { MotionConfig } from "motion/react";
import { type ReactNode, useEffect, useMemo } from "react";

gsap.registerPlugin(ScrollTrigger);

export const SOLANA_NETWORK = WalletAdapterNetwork.Devnet;

/* ---------------------------------------------------------------- Convex */

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
/** Created once per browser session. Null until NEXT_PUBLIC_CONVEX_URL is set. */
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

function OptionalConvex({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

/* ---------------------------------------------------------------- Wallet */

export function WalletProvider({ children }: { children: ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(SOLANA_NETWORK);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: SOLANA_NETWORK })], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

/* ---------------------------------------------------------- Smooth scroll */

function SmoothScroll() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, anchors: { offset: -64 } });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const onMotionChange = () => {
      if (media.matches) lenis.destroy();
    };
    media.addEventListener("change", onMotionChange);

    return () => {
      media.removeEventListener("change", onMotionChange);
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return null;
}

/* ------------------------------------------------------------------ Root */

export function Providers({ children }: { children: ReactNode }) {
  return (
    <OptionalConvex>
      <WalletProvider>
        {/* "user": transform and layout animations are skipped under prefers-reduced-motion. */}
        <MotionConfig reducedMotion="user">
          <SmoothScroll />
          {children}
        </MotionConfig>
      </WalletProvider>
    </OptionalConvex>
  );
}
