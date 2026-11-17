"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

function shorten(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export interface WalletButtonProps {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Label when disconnected. */
  label?: string;
}

/** Connect button styled with Kondora tokens. Opens the wallet-adapter modal. */
export function WalletButton({ className, variant = "outline", size = "sm", label = "Connect wallet" }: WalletButtonProps) {
  const { publicKey, connecting, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Wallet state only exists in the browser; render the neutral label on the server.
  if (!mounted || !publicKey) {
    return (
      <button
        type="button"
        className={buttonClass(variant, size, className)}
        onClick={() => setVisible(true)}
        disabled={mounted && connecting}
      >
        {mounted && connecting ? "Connecting" : label}
      </button>
    );
  }

  const address = publicKey.toBase58();

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={buttonClass(variant, size, cn("font-mono tabular", className))}
      >
        {wallet?.adapter.icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wallet.adapter.icon} alt="" width={16} height={16} className="h-4 w-4" />
        )}
        {shorten(address)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border border-line bg-night-900 p-1 shadow-2xl">
          <button
            role="menuitem"
            type="button"
            className="w-full rounded-sm px-3 py-2 text-left text-sm text-marble-200 hover:bg-night-800"
            onClick={() => {
              void navigator.clipboard?.writeText(address);
              setOpen(false);
            }}
          >
            Copy address
          </button>
          <button
            role="menuitem"
            type="button"
            className="w-full rounded-sm px-3 py-2 text-left text-sm text-marble-200 hover:bg-night-800"
            onClick={() => {
              setOpen(false);
              setVisible(true);
            }}
          >
            Change wallet
          </button>
          <button
            role="menuitem"
            type="button"
            className="w-full rounded-sm px-3 py-2 text-left text-sm text-no hover:bg-night-800"
            onClick={() => {
              setOpen(false);
              void disconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
