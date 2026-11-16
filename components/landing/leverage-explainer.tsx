"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState } from "react";

import { ParallaxScene, type SceneLayer } from "@/components/art/parallax-scene";

import { LeverageDial } from "@/components/bet/leverage-dial";
import { CountUp } from "@/components/ui/count-up";
import { TornEdge } from "@/components/ui/torn-edge";
import { formatCents, formatUsd } from "@/lib/format";
import { liquidationPrice, PROTOCOL } from "@/lib/leverage";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const ART: SceneLayer[] = [
  { name: "cloud-wisp", depth: 0.15, float: "drift", className: "left-[-8%] top-[8%] w-[60%] opacity-50" },
  { name: "fragment", depth: 0.35, className: "left-[2%] bottom-[4%] w-[38%] opacity-80 -rotate-6" },
  { name: "hand-scale", depth: 0.65, className: "right-[0%] top-[6%] w-[70%]" },
  { name: "cloud-wisp", depth: 0.9, float: "drift", className: "right-[-12%] bottom-[-2%] w-[62%] opacity-70" },
];

const MARGIN = 100;
const PRICE = 0.4;

/** Simplified example at a fixed price, no slippage, to show how leverage scales payout and risk. */
export function LeverageExplainer() {
  const [lev, setLev] = useState(3);
  const root = useRef<HTMLElement>(null);
  /** Scroll drives the dial until the reader takes over. */
  const touched = useRef(false);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        ScrollTrigger.create({
          trigger: root.current?.querySelector("[data-dial-stage]") ?? root.current,
          start: "top 80%",
          end: "bottom 35%",
          scrub: true,
          onUpdate: (self) => {
            if (touched.current) return;
            setLev(Math.round((1 + self.progress * 4) * 10) / 10);
          },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const onDial = (v: number) => {
    touched.current = true;
    setLev(v);
  };
  const notional = MARGIN * lev;
  const shares = (notional * (1 - PROTOCOL.feeRate)) / PRICE;
  const payout = shares - (notional - MARGIN);
  const liq = liquidationPrice(PRICE, lev);

  return (
    <section ref={root} id="leverage" aria-labelledby="leverage-title" className="relative scroll-mt-20 overflow-x-clip bg-night-900 py-24 sm:py-32">
      <TornEdge position="top" className="text-night-900" seed={23} />
      <div className="page-x mx-auto grid max-w-page grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <div className="relative order-2 aspect-[4/5] max-h-[70vh] w-full lg:order-1">
          <ParallaxScene layers={ART} tilt={3} pointerRange={36} className="overflow-visible" />
        </div>

        <div className="order-1 lg:order-2">
          <p className="micro">Leverage</p>
          <h2 id="leverage-title" className="mt-3 font-display text-display-md text-marble-50">
            Same view. <em className="text-marble-200">More weight.</em>
          </h2>
          <p className="mt-5 max-w-lg leading-relaxed text-marble-200">
            Leverage multiplies your position with a loan from the pool. If you are right, you keep the upside after
            repaying the loan. If the price moves against you far enough, the position is liquidated and you lose the
            margin. The cap tightens near the close and near 0¢ or 100¢.
          </p>

          <div data-dial-stage className="mt-10 grid gap-8 rounded-md border border-line bg-night-950/60 p-5 sm:grid-cols-[1fr_1fr] sm:p-6">
            <div>
              <p className="micro mb-2">Try it: {formatUsd(MARGIN)} on YES at {formatCents(PRICE)}</p>
              <LeverageDial value={lev} onChange={onDial} tone="yes" size="sm" />
            </div>
            <dl className="grid content-center gap-4" aria-live="polite">
              <div>
                <dt className="micro">Payout if YES</dt>
                <dd>
                  <CountUp value={payout} format={formatUsd} className="num text-5xl leading-none text-yes tabular" />
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-line/70 pt-4">
                <div>
                  <dt className="micro">Position</dt>
                  <dd className="mt-1 font-mono text-sm text-marble-50 tabular">{formatUsd(notional)}</dd>
                </div>
                <div>
                  <dt className="micro">Liquidation</dt>
                  <dd className={cn("mt-1 font-mono text-sm tabular", lev > 1 ? "text-gold" : "text-marble-400")}>
                    {lev > 1 ? formatCents(liq) : "None"}
                  </dd>
                </div>
              </div>
            </dl>
          </div>
          <p className="mt-3 text-xs text-marble-600">
            Illustration at a fixed price with the 0.5% fee. Real fills move the pool price and borrow fees accrue hourly.
          </p>
        </div>
      </div>
      <TornEdge className="text-night-950" seed={29} />
    </section>
  );
}
