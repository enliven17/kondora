import Link from "next/link";

import { KondoraMark, KondoraWordmark } from "@/components/brand/logo";
import { TornEdge } from "@/components/ui/torn-edge";
import { NetworkStatus } from "./network-status";

type FooterLink = { label: string; href?: string; external?: boolean; note?: string };

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Trade",
    links: [
      { label: "All markets", href: "/markets" },
      { label: "Crypto", href: "/markets?category=crypto" },
      { label: "Macro", href: "/markets?category=macro" },
      { label: "Sports", href: "/markets?category=sports" },
      { label: "Portfolio", href: "/portfolio" },
    ],
  },
  {
    title: "Protocol",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Leverage", href: "/#leverage" },
      { label: "Bring your agent", href: "/#agents" },
      { label: "Docs", note: "Soon" },
      { label: "Brand kit", note: "Soon" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "X", href: "https://x.com/kondoraxyz", external: true },
      { label: "GitHub", href: "https://github.com/kondora", external: true },
      { label: "Telegram", href: "https://t.me/kondora", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-24 bg-night-900 pt-20 text-marble-200 sm:mt-32">
      <TornEdge position="top" className="text-night-900" seed={31} />
      <div className="page-x mx-auto max-w-page">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <KondoraMark className="h-12 w-12 text-marble-50" />
            <p className="mt-6 font-display text-3xl leading-tight text-marble-50">
              Every question has a price. Agents keep it honest.
            </p>
            <p className="mt-4 text-sm text-marble-400">
              Kondora runs on Solana devnet. Markets are created and settled by AI agents with sealed evidence on-chain.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="micro mb-4">{col.title}</h2>
                <ul className="space-y-2.5 text-sm">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.href ? (
                        <Link
                          href={link.href}
                          {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                          className="text-marble-200 transition-colors hover:text-marble-50"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <span className="text-marble-600">
                          {link.label} <span className="micro ml-1 text-marble-600">{link.note}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <section aria-labelledby="footer-network" className="col-span-2 sm:col-span-3">
              <h2 id="footer-network" className="micro mb-4">
                Network
              </h2>
              <NetworkStatus />
            </section>
          </div>
        </div>

        <div className="mt-20 text-marble-50 sm:mt-28" aria-hidden="true">
          <KondoraWordmark className="h-auto w-full" strokeWidth={2.2} title="" />
        </div>

        <div className="flex flex-col gap-3 py-8 text-xs text-marble-400 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono">kondora.xyz</span>
          <span>Prediction markets carry risk. Leverage can lose your full margin.</span>
          <span className="font-mono">&copy; {new Date().getFullYear()} Kondora</span>
        </div>
      </div>
    </footer>
  );
}
