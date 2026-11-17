"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

export interface NavGroup {
  section: string;
  docs: { href: string; title: string }[];
}

function NavList({ groups, pathname }: { groups: NavGroup[]; pathname: string }) {
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
export function DocsSidebar({ groups, current }: { groups: NavGroup[]; current: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerId = useId();

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <nav aria-label="Docs" className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] overflow-y-auto pb-8 lg:block">
        <NavList groups={groups} pathname={pathname} />
      </nav>

      <div className="sticky top-16 z-30 -mx-[var(--page-x)] border-b border-cocoa/10 bg-paper/95 px-[var(--page-x)] backdrop-blur-md lg:hidden">
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

      <div id={drawerId} hidden={!open} className="lg:hidden">
        <div className="fixed inset-0 z-[60] bg-cocoa/40" onClick={() => setOpen(false)} aria-hidden />
        <div
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
              autoFocus
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                <path d="M5 5l10 10M15 5 5 15" />
              </svg>
            </button>
          </div>
          <NavList groups={groups} pathname={pathname} />
        </div>
      </div>
    </>
  );
}
