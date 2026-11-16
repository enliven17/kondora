"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { KondoraLockup } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { WalletButton } from "./wallet-button";

const NAV = [
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/#how", label: "How it works" },
  { href: "/#agents", label: "Agents" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile sheet on navigation.
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

  const solid = scrolled || pathname !== "/" || open;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-300",
        solid ? "border-b border-line/70 bg-night-950/80 backdrop-blur-md" : "border-b border-transparent",
      )}
    >
      <div className="page-x mx-auto flex h-[var(--header-h)] max-w-page items-center justify-between gap-4">
        <Link href="/" aria-label="Kondora home" className="shrink-0 text-marble-50">
          <KondoraLockup />
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = !item.href.includes("#") && pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-sm px-3 py-2 text-sm transition-colors",
                      active ? "text-marble-50" : "text-marble-400 hover:text-marble-50",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden xs:block">
            <WalletButton />
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-marble-50 hover:bg-marble-50/5 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
              {open ? (
                <path d="M4 4 L16 16 M16 4 L4 16" stroke="currentColor" strokeWidth="1.5" />
              ) : (
                <path d="M2 6 H18 M2 14 H18" stroke="currentColor" strokeWidth="1.5" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="page-x fixed inset-x-0 bottom-0 top-[var(--header-h)] overflow-y-auto bg-night-950 pb-10 pt-6 md:hidden"
          >
            <ul className="flex flex-col">
              {NAV.map((item, i) => (
                <li key={item.href} className="border-b border-line/60">
                  <Link href={item.href} onClick={() => setOpen(false)} className="flex items-baseline justify-between py-5">
                    <span className="text-3xl font-semibold tracking-tight text-marble-50">{item.label}</span>
                    <span className="micro">0{i + 1}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <WalletButton variant="primary" size="lg" className="w-full" />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
