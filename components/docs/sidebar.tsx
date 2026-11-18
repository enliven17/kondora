"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export interface NavGroup {
  section: string;
  docs: { href: string; title: string }[];
}

interface SearchEntry {
  href: string;
  title: string;
  description: string;
  text: string;
}

function DocsSearchNav({ groups, pathname, entries, onNavigate }: { groups: NavGroup[]; pathname: string; entries: SearchEntry[]; onNavigate?: () => void }) {
  const [query, setQuery] = useState("");
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = terms.length ? entries.filter((entry) => {
    const text = `${entry.title} ${entry.description} ${entry.text}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  }) : [];

  return (
    <>
      <label className="mb-6 block px-3">
        <span className="sr-only">Search documentation</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search docs…" className="h-10 w-full min-w-0 rounded-sm border border-cocoa/15 bg-paper px-3 text-sm text-cocoa placeholder:text-mauve focus:border-plum" />
      </label>
      {terms.length ? (
        <div className="px-3">
          <p role="status" className="mb-3 text-xs text-mauve">{results.length ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "No results. Try a different keyword."}</p>
          <ul className="space-y-3">
            {results.map((entry) => (
              <li key={entry.href}>
                <Link href={entry.href} onClick={onNavigate} aria-current={pathname === entry.href ? "page" : undefined} className="block rounded-sm py-1 text-sm font-medium text-cocoa hover:text-plum">
                  {entry.title}
                  <span className="mt-1 block text-xs font-normal leading-relaxed text-mauve">{entry.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : <NavList groups={groups} pathname={pathname} onNavigate={onNavigate} />}
    </>
  );
}

function NavList({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="space-y-7">
      {groups.map((g) => (
        <div key={g.section}>
          <p className="px-3 text-micro uppercase text-haze">{g.section}</p>
          <ul className="mt-2 space-y-0.5">
            {g.docs.map((d) => {
              const active = pathname === d.href;
              return (
                <li key={d.href}>
                  <Link
                    href={d.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-sm px-3 py-1.5 text-sm transition-colors",
                      active ? "bg-blush font-medium text-cocoa" : "text-mauve hover:bg-blush/60 hover:text-cocoa",
                    )}
                  >
                    {d.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Desktop: sticky list grouped by section. Mobile: a "Menu" bar that opens a drawer. */
export function DocsSidebar({ groups, current, entries }: { groups: NavGroup[]; current: string; entries: SearchEntry[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const drawer = useRef<HTMLDivElement>(null);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.documentElement.style.overflow;
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const targets = Array.from(drawer.current?.querySelectorAll<HTMLElement>('a[href], button, input') ?? []);
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const onResize = () => { if (window.innerWidth >= 1024) setOpen(false); };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.documentElement.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  return (
    <>
      <nav aria-label="Docs" data-lenis-prevent className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] overflow-y-auto pb-8 lg:block">
        <DocsSearchNav key={pathname} groups={groups} pathname={pathname} entries={entries} />
      </nav>

      <div className="-mx-[var(--page-x)] border-b border-cocoa/10 bg-paper/95 px-[var(--page-x)] backdrop-blur-md lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={drawerId}
          onClick={() => setOpen(true)}
          className="flex h-12 w-full items-center gap-3 text-sm text-cocoa"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="M3 6h14M3 10h14M3 14h9" />
          </svg>
          <span className="font-medium">Docs</span>
          <span className="truncate text-mauve">{current}</span>
        </button>
      </div>

      {open && createPortal(<div id={drawerId} data-lenis-prevent className="lg:hidden">
        <div className="fixed inset-0 z-[60] bg-cocoa/40" onClick={() => setOpen(false)} aria-hidden />
        <div
          ref={drawer}
          role="dialog"
          aria-modal="true"
          aria-label="Docs navigation"
          className="fixed inset-y-0 left-0 z-[61] w-[min(20rem,85vw)] overflow-y-auto bg-paper px-3 py-5 shadow-2xl"
        >
          <div className="mb-6 flex items-center justify-between px-3">
            <p className="font-bold text-cocoa">Docs</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-10 place-items-center rounded text-cocoa hover:bg-blush"
              aria-label="Close docs navigation"
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                <path d="M5 5l10 10M15 5 5 15" />
              </svg>
            </button>
          </div>
          <DocsSearchNav key={pathname} groups={groups} pathname={pathname} entries={entries} onNavigate={() => setOpen(false)} />
        </div>
      </div>, document.body)}
    </>
  );
}
