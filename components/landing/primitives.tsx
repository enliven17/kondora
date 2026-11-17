"use client";

import { AnimatePresence, motion } from "motion/react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 6500;

interface Row {
  label: string;
  value: string;
  tone?: "up" | "down" | "acc";
  mono?: boolean;
}

interface Tab {
  title: string;
  body: string;
  card: { eyebrow: string; caption: string; heading: string; badge?: { text: string; tone: "up" | "down" }; rows: Row[]; code?: string };
}

const TABS: Tab[] = [
  {
    title: "pm-AMM pricing",
    body: "Prices come from a curve built for outcomes that end at 0 or 1. Liquidity stays even across the range, so a trade at 0.90 costs what it should.",
    card: {
      eyebrow: "Live quote",
      caption: "Market",
      heading: "Fed cuts in March",
      rows: [
        { label: "YES", value: "62¢", tone: "up" },
        { label: "NO", value: "38¢", tone: "down" },
        { label: "Pool cash", value: "$64,000" },
        { label: "Impact on $500", value: "0.8%" },
        { label: "Trade fee", value: "0.5%" },
        { label: "Curve", value: "pm-AMM" },
      ],
    },
  },
  {
    title: "Leverage up to 5x",
    body: "Your margin plus a loan from the market's lending pool. The cap tightens as the close gets near and as the price gets lopsided.",
    card: {
      eyebrow: "Open position",
      caption: "Market",
      heading: "BTC above $70,000",
      badge: { text: "YES 3x", tone: "up" },
      rows: [
        { label: "Margin", value: "$100.00" },
        { label: "Notional", value: "$300.00" },
        { label: "Entry", value: "0.45" },
        { label: "Liquidation", value: "0.31", tone: "acc" },
        { label: "Borrowed", value: "$200.00" },
        { label: "Closes in", value: "6h" },
      ],
    },
  },
  {
    title: "Mark-price liquidations",
    body: "Health reads a five minute average of the pool price, not the last trade. One wick cannot take you out, and nobody can farm your liquidation.",
    card: {
      eyebrow: "Position health",
      caption: "Market",
      heading: "SOL above $250 this week",
      badge: { text: "NO 2x", tone: "down" },
      rows: [
        { label: "Mark price", value: "0.44" },
        { label: "Liquidation", value: "0.31", tone: "acc" },
        { label: "Distance", value: "29.5%" },
        { label: "Penalty", value: "1%" },
        { label: "Mark window", value: "5 min" },
        { label: "Wind-down", value: "T minus 10m" },
      ],
    },
  },
  {
    title: "Sealed evidence",
    body: "Every outcome ships with the sha256 of its evidence bundle: sources, fetch times, excerpts and panel reports. The hash lives on-chain next to the result.",
    card: {
      eyebrow: "Proposal",
      caption: "Market",
      heading: "Arsenal beat Chelsea",
      badge: { text: "Proposed YES", tone: "up" },
      rows: [
        { label: "Source", value: "ESPN final" },
        { label: "Confidence", value: "97%" },
        { label: "Evidence", value: "9f3c1a...e04b", mono: true },
        { label: "Dispute window", value: "12m left", tone: "acc" },
      ],
    },
  },
  {
    title: "Bring your own agent",
    body: "The API hands back unsigned transactions. Your agent signs locally, trades under the same caps as everyone, and shows up on the agents board.",
    card: {
      eyebrow: "kondora-agent",
      caption: "Terminal",
      heading: "Quote, then trade",
      rows: [],
      code: "$ kondora-agent quote 42 yes 5 --lev 2\n  shares 17.9  avg 0.556  liq 0.29\n$ kondora-agent bet 42 yes 5 --lev 2\n  filled  tx 4hQe...9xTr",
    },
  },
];

const toneClass = { up: "text-up", down: "text-down", acc: "text-acc" } as const;

function SampleCard({ card }: { card: Tab["card"] }) {
  return (
    <div className="w-full max-w-[26rem] rounded-xl bg-cocoa p-6 text-fg shadow-[0_40px_80px_-30px_rgb(var(--plum)/0.55)] sm:p-7">
      <p className="text-micro uppercase text-muted">{card.eyebrow}</p>
      <div className="mt-4 flex items-end justify-between gap-4 border-b border-line/10 pb-5">
        <div className="min-w-0">
          <p className="text-xs text-muted">{card.caption}</p>
          <p className="mt-1 text-xl font-bold leading-tight tracking-[-0.02em] sm:text-2xl">{card.heading}</p>
        </div>
        {card.badge && (
          <span
            className={cn(
              "shrink-0 rounded-sm px-2 py-1 text-xs font-bold",
              card.badge.tone === "up" ? "bg-up/15 text-up" : "bg-down/15 text-down",
            )}
          >
            {card.badge.text}
          </span>
        )}
      </div>
      {card.code ? (
        <pre className="mt-5 overflow-x-auto whitespace-pre font-mono text-[12px] leading-relaxed text-fg/90">{card.code}</pre>
      ) : (
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
          {card.rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-muted">{row.label}</dt>
              <dd className={cn("mt-0.5 text-[15px]", row.mono ? "font-mono text-[13px]" : "num", row.tone && toneClass[row.tone])}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Five primitives as vertical tabs. Autoplays with a progress bar; pauses on hover, focus or reduced motion. */
export function Primitives() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    const io = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.35 });
    if (rootRef.current) io.observe(rootRef.current);
    return () => {
      media.removeEventListener("change", sync);
      io.disconnect();
    };
  }, []);

  const autoplay = visible && !reduced;
  const running = autoplay && !paused;

  const select = (i: number, focus = false) => {
    const next = (i + TABS.length) % TABS.length;
    setActive(next);
    if (focus) tabRefs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, number> = { ArrowDown: active + 1, ArrowRight: active + 1, ArrowUp: active - 1, ArrowLeft: active - 1, Home: 0, End: TABS.length - 1 };
    if (e.key in keys) {
      e.preventDefault();
      select(keys[e.key] as number, true);
    }
  };

  const tab = TABS[active] as Tab;

  return (
    <section ref={rootRef} aria-labelledby={`${id}-title`} className="page-x mx-auto max-w-[72rem] pb-24 sm:pb-32">
      <h2 id={`${id}-title`} className="text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.035em] text-cocoa">
        What runs under every trade
      </h2>

      <div
        className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-8"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div role="tablist" aria-orientation="vertical" aria-label="Primitives" className="flex flex-col">
          {TABS.map((t, i) => {
            const selected = i === active;
            return (
              <div key={t.title} className="border-b border-cocoa/10">
                <button
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  role="tab"
                  id={`${id}-tab-${i}`}
                  aria-selected={selected}
                  aria-controls={`${id}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(i)}
                  onKeyDown={onKeyDown}
                  className={cn(
                    "w-full rounded-sm px-2 py-4 text-left text-lg tracking-[-0.01em] transition-colors sm:text-xl",
                    selected ? "text-cocoa" : "text-mauve/80 hover:text-cocoa",
                  )}
                >
                  {t.title}
                </button>
                {selected && (
                  <div className="px-2 pb-4">
                    <p className="text-sm leading-relaxed text-mauve">{t.body}</p>
                    <div className="mt-4 h-px w-full bg-cocoa/10" aria-hidden>
                      {autoplay && (
                        <div
                          key={active}
                          className="site-progress h-px w-full bg-cocoa"
                          style={{ animationDuration: `${AUTOPLAY_MS}ms`, animationPlayState: running ? "running" : "paused" }}
                          onAnimationEnd={() => select(active + 1)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-tab-${active}`}
          className="relative grid min-h-[22rem] place-items-center overflow-hidden rounded-xl bg-blush px-4 py-12 sm:min-h-[28rem] sm:px-10"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              className="flex w-full justify-center"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            >
              <SampleCard card={tab.card} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
