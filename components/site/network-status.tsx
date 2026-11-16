"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";

type Status = { state: "checking" } | { state: "live"; slot: number; latency: number } | { state: "down" };

/** Polls the configured devnet RPC for the current slot. Text-only status, no indicators. */
export function NetworkStatus() {
  const { connection } = useConnection();
  const [status, setStatus] = useState<Status>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const started = performance.now();
      try {
        const slot = await connection.getSlot("confirmed");
        if (!cancelled) setStatus({ state: "live", slot, latency: Math.round(performance.now() - started) });
      } catch {
        if (!cancelled) setStatus({ state: "down" });
      }
    };
    void poll();
    const id = window.setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [connection]);

  const rows: Array<[string, string]> = [
    ["Network", "Solana devnet"],
    ["Execution", "MagicBlock Ephemeral Rollup"],
    ["Collateral", "USDC (devnet)"],
    [
      "RPC",
      status.state === "live" ? `Operational, ${status.latency} ms` : status.state === "down" ? "Unreachable" : "Checking",
    ],
    ["Slot", status.state === "live" ? status.slot.toLocaleString("en-US") : "..."],
  ];

  return (
    <dl className="grid gap-x-10 gap-y-2 text-sm sm:grid-cols-2" aria-live="polite">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line/50 pb-2">
          <dt className="micro">{k}</dt>
          <dd className={k === "RPC" && status.state === "down" ? "text-no" : "tabular text-marble-200"}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
