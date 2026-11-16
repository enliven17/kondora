import { ParallaxScene, type SceneLayer } from "@/components/art/parallax-scene";

import SplitText from "@/components/ui/split-text";
import { Reveal } from "./reveal";

const SNIPPET = `# list open markets
GET  /api/agent/v1/markets?category=macro

# quote 40 USDC on YES at 3x
POST /api/agent/v1/quote
{ "market": "fed-cut-december", "side": "yes",
  "margin": 40, "leverage": 3 }

# build an unsigned rollup transaction,
# sign it locally with your session key
POST /api/agent/v1/tx/open`;

const ART: SceneLayer[] = [
  { name: "moon", depth: 0.1, blend: "screen", className: "right-[12%] top-[8%] w-[7%] min-w-[56px] opacity-70" },
  { name: "peaks-far", depth: 0.2, className: "inset-x-0 bottom-[14%] w-full opacity-50", style: { filter: "brightness(0.55)" } },
  { name: "condor", depth: 0.5, float: "glide", className: "right-[22%] top-[14%] w-[14%] min-w-[110px] opacity-90", style: { filter: "brightness(1.3) drop-shadow(0 0 14px rgb(184 196 220 / 0.3))" } },
  { name: "peaks-near", depth: 0.45, className: "inset-x-0 bottom-0 w-full opacity-80" },
  { name: "mist", depth: 0.9, float: "drift", className: "inset-x-[-10%] bottom-[-8%] w-[120%] opacity-60" },
];

const POINTS = [
  { title: "Your model, your keys", body: "Run the kondora-agent CLI on your machine with any model. It signs with a local session key that can only trade." },
  { title: "Same rules as everyone", body: "Agents trade through the same pool, the same caps and the same liquidations as people do." },
  { title: "Signed requests", body: "Every call is an Ed25519 signed envelope with a nonce and timestamp. No API keys to leak." },
] as const;

export function AgentsSection() {
  return (
    <section id="agents" aria-labelledby="agents-title" className="relative scroll-mt-20 overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-0 -z-10">
        <ParallaxScene layers={ART} scrollRange={40} />
        <div className="absolute inset-0 bg-gradient-to-b from-night-950 via-night-950/60 to-night-950/80" />
      </div>

      <div className="page-x mx-auto grid max-w-page grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="micro">Bring your own agent</p>
          <SplitText scrollTrigger variant="words" className="mt-3">
            <h2 id="agents-title" className="font-display text-display-md text-marble-50">
              Let your agent take the trade.
            </h2>
          </SplitText>
          <p className="mt-5 max-w-lg leading-relaxed text-marble-200">
            Kondora has an open agent API. Point your own model at the markets, let it quote and size positions, and
            keep the keys on your machine.
          </p>
          <ul className="mt-10 space-y-6">
            {POINTS.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 0.08} className="grid grid-cols-[2.5rem_1fr]">
                <span className="font-mono text-xs leading-7 text-marble-600">0{i + 1}</span>
                <div>
                  <h3 className="text-lg text-marble-50">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-marble-400">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal className="min-w-0 self-center">
          <figure className="overflow-hidden rounded-md border border-line bg-night-950/90">
            <figcaption className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="micro">Agent API preview</span>
              <span className="font-mono text-[0.6875rem] text-marble-600">v1</span>
            </figcaption>
            <pre className="overflow-x-auto p-5 font-mono text-[0.8125rem] leading-relaxed text-marble-200">
              <code>{SNIPPET}</code>
            </pre>
          </figure>
          <p className="mt-3 text-xs text-marble-600">Endpoints are in preview and may change before mainnet.</p>
        </Reveal>
      </div>
    </section>
  );
}
