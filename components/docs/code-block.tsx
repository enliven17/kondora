"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function CodeBlock({ children, code, language }: { children: ReactNode; code: string; language: string }) {
  const [status, setStatus] = useState("Copy");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code.replace(/\n$/, ""));
      setStatus("Copied");
    } catch {
      setStatus("Select code to copy");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("Copy"), 2500);
  }

  return (
    <div className="doc-code">
      <div className="flex items-center justify-between gap-3 border-b border-line/10 px-5 py-2 text-xs text-muted">
        <span>{language || "Code"}</span>
        <button type="button" onClick={copy} className="rounded-xs px-2 py-1 text-fg transition-colors hover:bg-fg/10" aria-label="Copy code">
          <span aria-live="polite">{status}</span>
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}
