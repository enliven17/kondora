"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/** A color swatch that copies its hex on click and confirms in place. */
export function CopySwatch({ name, hex, use, dark }: { name: string; hex: string; use: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked: the hex stays visible to select by hand */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="group w-full overflow-hidden rounded-lg border border-cocoa/10 bg-white/60 text-left transition-transform duration-200 ease-enter hover:-translate-y-0.5"
      aria-label={`Copy ${name} ${hex}`}
    >
      <span className={cn("flex h-24 items-end p-3 text-xs font-medium", dark ? "text-fg" : "text-cocoa")} style={{ background: hex }}>
        <span aria-live="polite">{copied ? "Copied" : "Copy hex"}</span>
      </span>
      <span className="block p-3">
        <span className="block text-sm font-bold text-cocoa">{name}</span>
        <span className="mt-0.5 block font-mono text-xs text-mauve">{hex}</span>
        <span className="mt-1 block text-xs text-haze">{use}</span>
      </span>
    </button>
  );
}
