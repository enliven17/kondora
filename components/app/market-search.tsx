"use client";

import { useRouter } from "next/navigation";
import { type KeyboardEvent, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";

import { CATEGORY_META } from "@/lib/categories";
import type { SearchItem } from "@/lib/data";
import { formatChance } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryThumb } from "./category-thumb";

const LIMIT = 7;

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={cn("size-4", className)} fill="none">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m13.2 13.2 3.3 3.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export interface MarketSearchProps {
  items: SearchItem[];
  className?: string;
  /** Focus on mount (mobile overlay). */
  autoFocus?: boolean;
  /** Listen for the global `/` shortcut. Only one instance should. */
  shortcut?: boolean;
  onNavigate?: () => void;
}

/** Combobox over market questions and categories. `/` focuses it, arrows move, Enter opens. */
export function MarketSearch({ items, className, autoFocus = false, shortcut = false, onNavigate }: MarketSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const deferred = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    const pool = q
      ? items.filter((m) => m.question.toLowerCase().includes(q) || CATEGORY_META[m.category].label.toLowerCase().includes(q))
      : items.filter((m) => m.state === "open");
    return pool.slice(0, LIMIT);
  }, [items, deferred]);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const go = (id: string) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    onNavigate?.();
    router.push(`/markets/${id}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const hit = results[active];
      if (hit) {
        e.preventDefault();
        go(hit.id);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      onNavigate?.();
    }
  };

  const showList = open && (results.length > 0 || deferred.trim().length > 0);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <label className="flex h-10 items-center gap-2.5 rounded border border-line/10 bg-ink/30 px-3 text-muted transition-colors focus-within:border-line/25 focus-within:bg-ink/50">
        <SearchIcon className="shrink-0" />
        <span className="sr-only">Search markets</span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search markets or categories"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-haze focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {shortcut && (
          <kbd className="hidden shrink-0 rounded-xs border border-line/10 bg-fg/5 px-1.5 font-mono text-[11px] leading-5 text-haze sm:block">/</kbd>
        )}
      </label>

      {showList && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-line/10 bg-panel/95 shadow-2xl backdrop-blur-xl">
          <p className="app-label px-3 pb-1 pt-2.5">{deferred.trim() ? "Results" : "Open markets"}</p>
          <ul id={listId} role="listbox" aria-label="Markets" className="max-h-[60vh] overflow-y-auto p-1" data-lenis-prevent>
            {results.map((m, i) => (
              <li
                key={m.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerEnter={() => setActive(i)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  go(m.id);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors",
                  i === active ? "bg-fg/[0.07]" : "hover:bg-fg/5",
                )}
              >
                <CategoryThumb category={m.category} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm text-fg">{m.question}</span>
                  <span className="text-xs text-haze">{CATEGORY_META[m.category].label}</span>
                </span>
                <span className="num shrink-0 text-sm text-fg">{formatChance(m.yesPrice)}</span>
              </li>
            ))}
          </ul>
          {results.length === 0 && <p className="px-3 pb-3 text-sm text-muted">No markets match that.</p>}
        </div>
      )}
    </div>
  );
}
