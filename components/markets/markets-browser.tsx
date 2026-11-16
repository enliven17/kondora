"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useDeferredValue, useMemo, useState } from "react";

import AnimatedTabs from "@/components/ui/animated-tabs";
import { CATEGORY_META } from "@/lib/categories";
import { CATEGORIES, type Category, type Market, type SortKey } from "@/lib/types";
import { MarketCard } from "./market-card";

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: "trending", label: "Volume" },
  { value: "closing", label: "Closing soon" },
  { value: "newest", label: "Newest" },
  { value: "liquidity", label: "Liquidity" },
];

type Filter = Category | "all";

function sortMarkets(list: Market[], sort: SortKey) {
  const openFirst = (a: Market, b: Market) => Number(b.state === "open") - Number(a.state === "open");
  const by: Record<SortKey, (a: Market, b: Market) => number> = {
    trending: (a, b) => b.volume - a.volume,
    closing: (a, b) => a.closeTime - b.closeTime,
    newest: (a, b) => b.openTime - a.openTime,
    liquidity: (a, b) => b.liquidity - a.liquidity,
  };
  return [...list].sort((a, b) => openFirst(a, b) || by[sort](a, b));
}

export function MarketsBrowser({ markets, initialCategory }: { markets: Market[]; initialCategory?: Category }) {
  const [category, setCategory] = useState<Filter>(initialCategory ?? "all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("trending");
  const deferredQuery = useDeferredValue(query);
  const reduce = useReducedMotion();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: markets.length };
    for (const m of markets) c[m.category] = (c[m.category] ?? 0) + 1;
    return c;
  }, [markets]);

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const filtered = markets.filter(
      (m) =>
        (category === "all" || m.category === category) &&
        (!q || m.question.toLowerCase().includes(q) || m.resolution.name.toLowerCase().includes(q)),
    );
    return sortMarkets(filtered, sort);
  }, [markets, category, deferredQuery, sort]);

  const onCategory = (value: string) => {
    const next = value as Filter;
    setCategory(next);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", next);
    window.history.replaceState(null, "", url);
  };

  const tabs = [
    { value: "all", title: <TabTitle label="All" count={counts.all ?? 0} />, ariaControls: "market-grid" },
    ...CATEGORIES.map((c) => ({
      value: c,
      title: <TabTitle label={CATEGORY_META[c].label} count={counts[c] ?? 0} />,
      ariaControls: "market-grid",
    })),
  ];

  return (
    <div>
      <div className="sticky top-[var(--header-h)] z-30 -mx-[var(--page-x)] border-b border-line/70 bg-night-950/90 px-[var(--page-x)] py-3 backdrop-blur-md">
        <AnimatedTabs tabs={tabs} value={category} onValueChange={onCategory} ariaLabel="Market categories" className="-mx-1 px-1" />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search markets</span>
            <svg viewBox="0 0 20 20" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-marble-400">
              <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M13 13 L17 17" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions or sources"
              className="h-10 w-full rounded-sm border border-line bg-night-900 pl-9 pr-3 text-sm text-marble-50 placeholder:text-marble-600 focus:border-marble-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="micro shrink-0">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-10 w-full rounded-sm border border-line bg-night-900 px-3 text-sm text-marble-50 focus:border-marble-400 focus:outline-none sm:w-44"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="micro mt-6" aria-live="polite">
        {visible.length} {visible.length === 1 ? "market" : "markets"}
      </p>

      <div id="market-grid" role="tabpanel" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((m) => (
            <motion.div
              key={m.id}
              layout={!reduce}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            >
              <MarketCard market={m} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {visible.length === 0 && (
        <div className="mt-10 rounded-md border border-line p-10 text-center">
          <p className="text-xl font-semibold text-marble-50">Nothing matches yet.</p>
          <p className="mt-2 text-sm text-marble-400">Agents open new markets every hour. Try another category or search.</p>
        </div>
      )}
    </div>
  );
}

function TabTitle({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      {label}
      <span className="font-mono text-[0.6875rem] opacity-60 tabular">{count}</span>
    </span>
  );
}
