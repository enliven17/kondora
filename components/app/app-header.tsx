"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { SearchItem } from "@/lib/data";
import { cn } from "@/lib/utils";
import { AppLogo } from "./app-logo";
import { MarketSearch, SearchIcon } from "./market-search";
import { WalletButton } from "./wallet-button";

const NAV = [
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
] as const;

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      {open ? (
        <path d="m5 5 10 10M15 5 5 15" />
      ) : (
        <>
          <rect x="3" y="4" width="14" height="12" rx="2" />
          <path d="M8 4v12" />
        </>
      )}
    </svg>
  );
}

const iconButton =
  "grid size-10 shrink-0 place-items-center rounded border border-line/10 bg-plum text-fg transition-colors hover:bg-cocoa";

export function AppHeader({ searchItems }: { searchItems: SearchItem[] }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close overlays on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-line/10 bg-plum/75 backdrop-blur-xl">
      <div className="mx-auto flex h-[var(--app-header-h)] max-w-[100rem] items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <AppLogo className="mr-1 shrink-0" />

        <div ref={menuRef} className="relative md:hidden">
          <button
            type="button"
            className={iconButton}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="app-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MenuIcon open={menuOpen} />
          </button>
          {menuOpen && (
            <nav id="app-menu" aria-label="App" className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-line/10 bg-panel/95 p-1 shadow-2xl backdrop-blur-xl">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-sm px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(n.href) ? "bg-acc text-acc-ink" : "text-fg/85 hover:bg-fg/5 hover:text-fg",
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <nav aria-label="App" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={cn(
                "rounded px-3 py-2 text-sm font-medium transition-colors",
                isActive(n.href) ? "bg-fg/10 text-fg" : "text-muted hover:text-fg",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 justify-center px-2">
          <MarketSearch items={searchItems} shortcut className="hidden w-full max-w-md md:block" />
        </div>

        <button
          type="button"
          className={cn(iconButton, "md:hidden")}
          aria-label={searchOpen ? "Close search" : "Search markets"}
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((v) => !v)}
        >
          {searchOpen ? <MenuIcon open /> : <SearchIcon />}
        </button>
        <WalletButton label="Connect wallet" shortLabel="Connect" className="shrink-0" />
      </div>

      {searchOpen && (
        <div className="border-t border-line/10 px-3 py-2.5 md:hidden">
          <MarketSearch items={searchItems} autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      )}
    </header>
  );
}
