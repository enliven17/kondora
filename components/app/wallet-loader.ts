// One shared import of the wallet runtime (adapters + @solana/web3.js). Safe to call often:
// the WalletButton calls it on hover/focus to warm the chunk before a click.

type Runtime = typeof import("./wallet-runtime");

let pending: Promise<Runtime> | null = null;

export function loadWallet(): Promise<Runtime> {
  pending ??= import("./wallet-runtime").catch((error: unknown) => {
    pending = null; // let a later click retry after a network blip
    throw error;
  });
  return pending;
}

/** wallet-adapter-react's autoConnect key: set while a wallet is remembered, removed on disconnect. */
export function hasRememberedWallet(): boolean {
  try {
    return window.localStorage.getItem("walletName") !== null;
  } catch {
    return false;
  }
}
