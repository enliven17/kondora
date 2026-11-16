"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState } from "react";

import { ParallaxScene, type SceneLayer } from "@/components/art/parallax-scene";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const STEPS = [
  {
    kicker: "Open",
    title: "An agent opens the market",
    body: "Creator agents read live sources every hour and write questions with a fixed resolution spec: the source, the field, the comparison and the deadline. No spec, no market.",
  },
  {
    kicker: "Trade",
    title: "You pick a side, up to 5x",
    body: "Buy YES or NO from the pool at a fair price. Add leverage and the protocol lends the rest. Bets are signed by a session key on an ephemeral rollup, so there is no wallet popup and no gas per bet.",
  },
  {
    kicker: "Resolve",
    title: "An oracle agent settles it",
    body: "After the close, the oracle reads the deterministic source first. When a question needs judgement, a council of independent models votes. The evidence bundle is sealed and its hash goes on-chain.",
  },
  {
    kicker: "Audit",
    title: "An auditor checks the call",
    body: "A separate agent on a different model re-derives every outcome blind. If it is confident the proposal is wrong, it challenges on-chain inside the dispute window and the outcome is reviewed.",
  },
] as const;

/** Free-floating cutouts, no frame. */
const ART: SceneLayer[] = [
  { name: "moon", depth: 0.1, blend: "screen", className: "left-[6%] top-[2%] w-[20%] opacity-80" },
  { name: "cloud-wisp", depth: 0.3, float: "drift", className: "left-[-10%] top-[46%] w-[70%] opacity-60" },
  { name: "oracle", depth: 0.6, className: "right-[6%] top-[4%] w-[52%]" },
  { name: "cloud-wisp", depth: 0.85, float: "drift", className: "right-[-14%] bottom-[2%] w-[64%] opacity-75" },
];

export function HowItWorks() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Desktop: pin, then bring steps in one by one with scroll progress.
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 1024px)", () => {
        const steps = gsap.utils.toArray<HTMLElement>("[data-step]", root.current);
        gsap.set(steps.slice(1), { autoAlpha: 0, y: 60 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: `+=${steps.length * 75}%`,
            scrub: 0.6,
            pin: true,
            anticipatePin: 1,
            onUpdate: (self) => setActive(Math.min(steps.length - 1, Math.floor(self.progress * steps.length))),
          },
        });
        steps.forEach((step, i) => {
          if (i === 0) return;
          const prev = steps[i - 1];
          if (prev) tl.to(prev, { autoAlpha: 0, y: -40, scale: 0.97, duration: 0.4 }, i - 0.55);
          tl.to(step, { autoAlpha: 1, y: 0, duration: 0.5 }, i - 0.1);
        });
      });

      // Small screens: each step rises as it enters.
      mm.add("(prefers-reduced-motion: no-preference) and (max-width: 1023px)", () => {
        gsap.utils.toArray<HTMLElement>("[data-step]", root.current).forEach((step) => {
          gsap.from(step, { autoAlpha: 0, y: 40, duration: 0.8, ease: "expo.out", scrollTrigger: { trigger: step, start: "top 85%" } });
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section id="how" ref={root} aria-labelledby="how-title" className="relative scroll-mt-20 overflow-hidden lg:motion-safe:h-screen">
      <div className="page-x mx-auto grid h-full max-w-page grid-cols-1 gap-12 py-24 sm:py-32 lg:grid-cols-2 lg:items-center lg:gap-20 lg:motion-safe:py-0">
        <div className="relative">
          <p className="micro">How it works</p>
          <h2 id="how-title" className="mt-3 font-display text-display-md text-marble-50">
            Agents run the market. <em className="text-marble-200">You trade it.</em>
          </h2>
          <div className="relative mt-6 hidden h-[44vh] lg:block">
            <ParallaxScene layers={ART} tilt={3} pointerRange={40} />
            <div className="absolute bottom-0 left-0" aria-hidden="true">
              <span className="micro block text-marble-400">Step</span>
              <span className="num block text-7xl leading-none text-marble-50">0{active + 1}</span>
            </div>
          </div>
        </div>

        <div className="relative lg:motion-safe:h-[50vh]">
          <ol className="space-y-4 lg:motion-safe:space-y-0">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                data-step
                className={cn(
                  "rounded-md border border-line/70 bg-night-900/85 p-6 backdrop-blur-sm sm:p-8 lg:motion-safe:absolute lg:motion-safe:inset-x-0 lg:motion-safe:top-0",
                  active === i && "lg:border-marble-50/25",
                )}
                style={{ zIndex: i + 1 }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="micro">{step.kicker}</span>
                  <span className="font-mono text-xs text-marble-600 tabular">0{i + 1} / 04</span>
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-marble-50 sm:text-3xl">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-marble-200">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
