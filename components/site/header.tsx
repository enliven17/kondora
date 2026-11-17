"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { KondoraLockup } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const SITE_NAV = [
  { href: "/markets", label: "Markets" },
  { href: "/docs/how-it-works", label: "How it works" },
  { href: "/stats", label: "Stats" },
  { href: "/agents", label: "Agents" },
  { href: "/docs", label: "Docs" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/docs")
    return pathname.startsWith("/docs") && pathname !== "/docs/how-it-works";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Marketing header: lockup left, centered nav, "Launch app" right. Paper surface with a hairline. */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  // Close the mobile menu on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth >= 768 && setOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-cocoa/10 bg-paper/90 backdrop-blur-md">
        <div className="page-x mx-auto flex h-16 max-w-page items-center justify-between gap-6">
          <Link
            href="/"
            aria-label="Kondora home"
            className="flex items-center text-cocoa"
          >
            <KondoraLockup className="h-[22px]" title="" />
          </Link>

          <nav
            aria-label="Main"
            className="absolute left-1/2 hidden -translate-x-1/2 md:block"
          >
            <ul className="flex items-center gap-1">
              {SITE_NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rounded-sm px-3 py-2 text-sm transition-colors duration-200",
                        active
                          ? "font-medium text-cocoa"
                          : "text-mauve hover:text-cocoa",
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
            <ButtonLink
              href="/markets"
              variant="dark"
              arrow
              className="hidden sm:inline-flex"
            >
              Launch app
            </ButtonLink>
            <button
              type="button"
              className="grid size-11 place-items-center rounded text-cocoa hover:bg-blush md:hidden"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden
              >
                {open ? (
                  <path d="M6 6l12 12M18 6 6 18" />
                ) : (
                  <path d="M4 8h16M4 16h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Outside the header: its backdrop-filter would make it the containing block of this fixed panel and clip it to 64px. */}
      <div
        id={menuId}
        hidden={!open}
        className="site-menu fixed inset-x-0 bottom-0 top-16 z-[45] overflow-y-auto border-t border-cocoa/10 bg-paper md:hidden"
      >
        <nav aria-label="Mobile" className="page-x flex flex-col py-4">
          {SITE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className="border-b border-cocoa/10 py-4 text-2xl font-medium tracking-[-0.02em] text-cocoa"
            >
              {item.label}
            </Link>
          ))}
          <ButtonLink
            href="/markets"
            variant="dark"
            size="lg"
            arrow
            className="mt-6 w-full justify-start"
          >
            Launch app
          </ButtonLink>
        </nav>
      </div>
    </>
  );
}
