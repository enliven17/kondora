import { ParallaxScene, type SceneLayer } from "@/components/art/parallax-scene";

import { ButtonLink } from "@/components/ui/button";
import Magnetic from "@/components/ui/magnetic-button";
import { Reveal } from "./reveal";

const ART: SceneLayer[] = [
  { name: "sky", depth: 0.02, cover: true },
  { name: "moon", depth: 0.12, blend: "screen", className: "left-[10%] top-[10%] w-[10%] min-w-[60px]" },
  { name: "clouds", depth: 0.35, float: "drift", className: "right-[-10%] top-[18%] w-[70%] opacity-60" },
  { name: "torn-paper", depth: 0.55, className: "left-[-8%] bottom-[6%] w-[60%] rotate-[4deg] opacity-80" },
  { name: "cloud-wisp", depth: 0.85, float: "drift", className: "right-[-6%] bottom-[-4%] w-[46%] opacity-70" },
];

export function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="page-x mx-auto max-w-page">
      <div className="relative isolate overflow-hidden rounded-md border border-line px-6 py-24 text-center sm:px-12 sm:py-32">
        <div className="absolute inset-0 -z-10">
          <ParallaxScene layers={ART} scrollRange={24} />
          <div className="absolute inset-0 bg-night-950/45" />
        </div>
        <Reveal>
          <p className="micro text-marble-200">Devnet is open</p>
          <h2 id="cta-title" className="mx-auto mt-4 max-w-[14ch] font-display text-display-md text-marble-50">
            The sky is wide. <em className="text-marble-200">Call it.</em>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-marble-200">
            Connect a wallet, pick a market and place your first bet in seconds. Test USDC only.
          </p>
          <div className="mt-10 flex justify-center">
            <Magnetic magneticIntensity={0.3} magneticRange={140}>
              <ButtonLink href="/markets" size="lg">
                Start trading
              </ButtonLink>
            </Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
