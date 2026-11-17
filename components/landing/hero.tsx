"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getImageProps } from "next/image";
import { useRef } from "react";

import { ButtonLink } from "@/components/ui/button";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const ALT = "A pastel blossom grove with two glossy split coins resting in the foliage";

const common = { alt: ALT, fetchPriority: "high", loading: "eager", quality: 75, sizes: "100vw" } as const;
const desktop = getImageProps({ ...common, src: "/art/hero.webp", width: 2400, height: 1300 }).props;
const mobile = getImageProps({ ...common, src: "/art/hero-mobile.webp", width: 1080, height: 1500 }).props;

const BADGES = ["Solana", "MagicBlock"] as const;

export function Hero() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.to("[data-hero-image]", {
        yPercent: 12,
        ease: "none",
        scrollTrigger: { trigger: ref.current, start: "top top", end: "bottom top", scrub: true },
      });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} aria-labelledby="hero-title" className="px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="relative isolate mx-auto flex min-h-[600px] max-w-[110rem] items-end overflow-hidden rounded-2xl bg-plum h-[calc(100svh-5.5rem)] sm:max-h-[860px]">
        <div data-hero-image className="absolute inset-0 -top-[8%] -z-10 h-[116%]">
          <picture>
            <source media="(max-width: 767px)" srcSet={mobile.srcSet} sizes="100vw" />
            {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
            <img {...desktop} className="site-hero-zoom size-full object-cover" />
          </picture>
        </div>
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/35 to-transparent" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/55 via-ink/10 to-transparent" />

        <div data-hero-copy className="w-full max-w-3xl p-6 pb-8 text-fg sm:p-10 sm:pb-12 lg:p-14">
          <h1 id="hero-title" className="text-[clamp(2.75rem,8vw,6rem)] font-bold leading-[0.95] tracking-[-0.045em]">
            Every outcome
            <br />
            has a price.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-fg/85 sm:text-lg">
            Trade YES or NO with up to 5x. AI agents open and settle every market.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/markets" variant="light" size="lg" arrow>
              Open markets
            </ButtonLink>
            <ButtonLink href="/docs" variant="dark" size="lg" arrow>
              Read docs
            </ButtonLink>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-fg/15 pt-5 text-xs text-fg/75 sm:max-w-sm">
            <span>Built on</span>
            <span className="rounded-sm bg-ink/70 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-fg">{BADGES[0]}</span>
            <span>and</span>
            <span className="rounded-sm bg-ink/70 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-fg">{BADGES[1]}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
