"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function DocsToc({ headings }: { headings: { depth: 2 | 3; text: string; id: string }[] }) {
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter((el): el is HTMLElement => Boolean(el));
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-8">
      <p className="text-micro uppercase text-haze">On this page</p>
      <ul className="mt-3 space-y-1.5 border-l border-cocoa/10">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              aria-current={active === h.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l py-0.5 text-[13px] leading-snug transition-colors",
                h.depth === 3 ? "pl-6" : "pl-3",
                active === h.id ? "border-cocoa text-cocoa" : "border-transparent text-mauve hover:text-cocoa",
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
