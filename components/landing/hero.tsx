"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useRef } from "react";

import { ParallaxScene, type SceneLayer } from "@/components/art/parallax-scene";
import { ButtonLink } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import Magnetic from "@/components/ui/magnetic-button";
import { Starfield } from "@/components/ui/starfield";
import { TornEdge } from "@/components/ui/torn-edge";
import { formatUsdCompact } from "@/lib/format";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

export interface HeroStats {
  openMarkets: number;
  volume: number;
}

const condorLight = { filter: "drop-shadow(0 0 18px rgb(184 196 220 / 0.35)) brightness(1.35) contrast(1.05)" };

/** Back to front. Depth drives scroll separation, pointer shift and translateZ. */
const LAYERS: SceneLayer[] = [
  { name: "sky", depth: 0.02, cover: true, priority: true },
  { name: "moon", depth: 0.08, blend: "screen", className: "right-[24%] top-[9%] w-[9vw] min-w-[64px] max-w-[150px]", priority: true },
  { name: "peaks-far", depth: 0.18, className: "inset-x-0 bottom-[17%] w-full opacity-70", style: { filter: "brightness(0.6) saturate(0.8)" }, priority: true },
  { name: "clouds", depth: 0.3, float: "drift", className: "right-[-6%] top-[24%] w-[62%] opacity-70", priority: true },
  { name: "torn-paper", depth: 0.42, className: "right-[-12%] top-[46%] w-[58%] -rotate-[7deg] opacity-90 max-md:hidden" },
  { name: "condor", depth: 0.55, float: "glide", className: "left-[36%] top-[13%] w-[19%] min-w-[130px] max-md:left-[46%] max-md:top-[16%]", style: condorLight, priority: true },
  { name: "peaks-near", depth: 0.5, className: "inset-x-0 bottom-0 w-full", priority: true },
  { name: "statue", depth: 0.72, className: "right-[1%] bottom-[-8%] w-[34%] min-w-[250px] max-w-[620px] max-md:right-[-18%] max-md:opacity-60", priority: true },
  { name: "mist", depth: 0.95, float: "drift", className: "inset-x-[-10%] bottom-[-6%] w-[120%] opacity-70" },
];

export function Hero({ stats }: { stats: HeroStats }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Headline: split into lines and words, masked reveal once fonts are ready.
        let split: SplitText | undefined;
        const title = root.current?.querySelector<HTMLElement>("[data-hero-title]");
        const run = () => {
          if (!title) return;
          split = SplitText.create(title, { type: "lines,words", mask: "lines" });
          gsap.from(split.words, { yPercent: 115, rotate: 3, duration: 1.1, ease: "expo.out", stagger: 0.06, delay: 0.2 });
        };
        if (document.fonts.status === "loaded") run();
        else void document.fonts.ready.then(run);

        gsap.from("[data-hero-fade]", { opacity: 0, y: 18, duration: 1, ease: "expo.out", stagger: 0.08, delay: 0.55 });
        gsap.from("[data-depth]", { opacity: 0, duration: 1.6, ease: "expo.out", stagger: 0.05 });

        return () => split?.revert();
      });

      // Desktop: pin the hero and pull the layers apart in depth while scrolling.
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
        const layers = gsap.utils.toArray<HTMLElement>("[data-depth]", root.current);
        const tl = gsap.timeline({
          scrollTrigger: { trigger: root.current, start: "top top", end: "+=110%", scrub: 0.7, pin: true, anticipatePin: 1 },
        });
        layers.forEach((el) => {
          const d = Number(el.dataset.depth);
          tl.to(el, { y: -d * 340, scale: 1 + d * 0.22, ease: "none" }, 0);
        });
        tl.to("[data-hero-copy]", { y: -160, opacity: 0, ease: "power1.in" }, 0.05).to(
          "[data-hero-veil]",
          { opacity: 0.55, ease: "none" },
          0.55,
        );
      });

      // Mobile: lighter, unpinned parallax.
      mm.add("(prefers-reduced-motion: no-preference) and (max-width: 767px)", () => {
        gsap.utils.toArray<HTMLElement>("[data-depth]", root.current).forEach((el) => {
          gsap.to(el, {
            y: -Number(el.dataset.depth) * 120,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
          });
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="hero-title" className="relative isolate h-[100svh] min-h-[560px] overflow-hidden bg-night-950">
      <ParallaxScene
        layers={LAYERS}
        scroll="external"
        tilt={2}
        pointerRange={34}
        insertAt={{ index: 1, node: <Starfield density={0.8} /> }}
      />

      {/* Legibility scrims for the headline area */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-night-950/85 via-night-950/35 to-transparent max-md:from-night-950/70" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-night-950/80 to-transparent" />
      <div data-hero-veil className="pointer-events-none absolute inset-0 bg-night-950 opacity-0" />

      <div data-hero-copy className="page-x relative mx-auto flex h-full max-w-page flex-col justify-end pb-16 pt-28 sm:justify-center sm:pb-20">
        <p data-hero-fade className="micro text-marble-200">
          Prediction markets on Solana. Up to 5x.
        </p>
        <h1 id="hero-title" data-hero-title className="mt-5 max-w-[13ch] font-display text-display-lg text-marble-50 [text-wrap:balance]">
          Every question has a <em className="text-marble-200">price.</em>
        </h1>
        <p data-hero-fade className="mt-6 max-w-md text-base leading-relaxed text-marble-200 sm:text-lg">
          Trade YES or NO on what happens next. AI agents open every market and settle every outcome. You pick a side
          and choose your leverage.
        </p>
        <div data-hero-fade className="mt-9 flex flex-col gap-3 xs:flex-row">
          <Magnetic magneticIntensity={0.25} magneticRange={120}>
            <ButtonLink href="/markets" size="lg" className="w-full xs:w-auto">
              Browse markets
            </ButtonLink>
          </Magnetic>
          <ButtonLink href="/#how" variant="secondary" size="lg">
            How it works
          </ButtonLink>
        </div>
        <dl data-hero-fade className="mt-12 flex gap-8 sm:gap-14">
          <div>
            <dt className="micro">Open markets</dt>
            <dd className="mt-1">
              <CountUp
                value={stats.openMarkets}
                from={0}
                startOnView
                duration={1.4}
                format={(v) => String(Math.round(v))}
                className="num text-2xl text-marble-50 sm:text-3xl"
              />
            </dd>
          </div>
          <div>
            <dt className="micro">Volume</dt>
            <dd className="mt-1">
              <CountUp
                value={stats.volume}
                from={0}
                startOnView
                duration={1.6}
                format={formatUsdCompact}
                className="num text-2xl text-marble-50 sm:text-3xl"
              />
            </dd>
          </div>
          <div className="hidden xs:block">
            <dt className="micro">Max leverage</dt>
            <dd className="num mt-1 text-2xl text-marble-50 sm:text-3xl">5x</dd>
          </div>
        </dl>
      </div>

      <TornEdge className="text-night-900" seed={11} height={34} />
    </section>
  );
}
