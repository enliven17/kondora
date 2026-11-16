"use client";

import Link from "next/link";

import { TornEdge } from "@/components/ui/torn-edge";

import Marquee from "@/components/ui/marquee";
import { formatCents, formatSignedPts } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TickerItem {
  id: string;
  label: string;
  category: string;
  yesPrice: number;
  change24h: number;
}

export function LiveMarquee({ items }: { items: TickerItem[] }) {
  return (
    <section aria-label="Live markets" className="relative bg-night-900 pb-8 pt-5">
      <Marquee speed={42} gap="0rem" pauseOnHover scrollVelocity maxVelocity={3} label="Live market prices">
        <ul className="flex">
          {items.map((m) => (
            <li key={m.id} className="flex items-center border-r border-line/70 px-6">
              <Link href={`/markets/${m.id}`} className="flex items-baseline gap-3 whitespace-nowrap py-1 hover:text-marble-50">
                <span className="micro">{m.category}</span>
                <span className="text-sm text-marble-200">{m.label}</span>
                <span className="font-mono text-sm text-marble-50 tabular">{formatCents(m.yesPrice)}</span>
                <span className={cn("font-mono text-xs tabular", m.change24h >= 0 ? "text-yes" : "text-no")}>
                  {formatSignedPts(m.change24h)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Marquee>
      <TornEdge className="text-night-950" seed={17} height={14} deckle={false} />
    </section>
  );
}
