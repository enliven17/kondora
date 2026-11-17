"use client";

// The heavy half of the wallet: adapters, @solana/web3.js, the connection and the modal.
// Loaded on demand by LazyWallet (app-providers.tsx), never in a route's first-load JS.

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { ConnectionProvider, useWallet, WalletProvider, type WalletContextState } from "@solana/wallet-adapter-react";
import { useWalletModal, WalletModalProvider, type WalletModalContextState } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { memo, useEffect, useMemo } from "react";

export const SOLANA_NETWORK = WalletAdapterNetwork.Devnet;

export interface WalletBridgeProps {
  onWallet: (state: WalletContextState) => void;
  onModal: (state: WalletModalContextState) => void;
}

/** Reads the live contexts and hands them to LazyWallet, which provides them above the page. */
function Bridge({ onWallet, onModal }: WalletBridgeProps) {
  const wallet = useWallet();
  const modal = useWalletModal();
  useEffect(() => onWallet(wallet), [wallet, onWallet]);
  useEffect(() => onModal(modal), [modal, onModal]);
  return null;
}

/** Memoized: its props are state setters, so it re-renders only on wallet changes, never from the shell above. */
export const WalletRuntime = memo(function WalletRuntime(props: WalletBridgeProps) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(SOLANA_NETWORK);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: SOLANA_NETWORK })], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Bridge {...props} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
});
