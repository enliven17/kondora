// Animated docs diagrams. Pure SVG + CSS (no client JS), so docs stay light.
// Used from markdown with a fenced block:  ```diagram lifecycle```
// Motion stops under prefers-reduced-motion and the final state is shown.

import type { ReactNode } from "react";

const CSS = `
.kd-dia{margin:2rem 0;border-radius:20px;background:rgb(var(--cocoa));color:rgb(var(--fg));padding:20px 18px 14px;overflow:hidden}
.kd-dia svg{display:block;width:100%;height:auto}
.kd-dia figcaption{margin-top:10px;font-size:12px;color:rgb(var(--muted));line-height:1.5}
.kd-dia text{font-family:var(--font-sans),system-ui,sans-serif;fill:rgb(var(--fg))}
.kd-dia .t-s{font-size:11px;fill:rgb(var(--muted))}
.kd-dia .t-m{font-size:13px;font-weight:600}
.kd-dia .t-acc{fill:rgb(var(--acc))}
.kd-dia .box{fill:rgb(var(--panel));stroke:rgb(var(--line)/.12)}
.kd-dia .box-acc{fill:rgb(var(--plum));stroke:rgb(var(--petal)/.55)}
.kd-dia .wire{fill:none;stroke:rgb(var(--line)/.18);stroke-width:1.5}
.kd-dia .wire-acc{fill:none;stroke:rgb(var(--acc));stroke-width:2}
.kd-dia .flow{fill:none;stroke:rgb(var(--petal));stroke-width:2;stroke-dasharray:6 8;animation:kd-dash 1.2s linear infinite}
.kd-dia .draw{stroke-dasharray:1200;stroke-dashoffset:1200;animation:kd-draw 2.4s cubic-bezier(.23,1,.32,1) forwards}
.kd-dia .pulse{animation:kd-pulse 7s ease-in-out infinite}
.kd-dia .rise{transform-box:fill-box;transform-origin:bottom;animation:kd-rise 6s cubic-bezier(.23,1,.32,1) infinite}
.kd-dia .fade{opacity:0;animation:kd-fade 6s ease-in-out infinite}
.kd-dia .runner{offset-rotate:0deg;animation:kd-run var(--dur,7s) cubic-bezier(.65,0,.35,1) infinite}
.kd-dia .fill-bar{transform-box:fill-box;transform-origin:left;animation:kd-fill 6s cubic-bezier(.23,1,.32,1) infinite}
.kd-dia .drain{transform-box:fill-box;transform-origin:left;animation:kd-drain 6s linear infinite}
@keyframes kd-dash{to{stroke-dashoffset:-28}}
@keyframes kd-draw{to{stroke-dashoffset:0}}
@keyframes kd-run{0%{offset-distance:0%}100%{offset-distance:100%}}
@keyframes kd-pulse{0%,100%{fill:rgb(var(--panel))}8%,22%{fill:rgb(var(--plum))}}
@keyframes kd-rise{0%{transform:scaleY(.05)}35%,100%{transform:scaleY(1)}}
@keyframes kd-fade{0%,15%{opacity:0}30%,85%{opacity:1}100%{opacity:0}}
@keyframes kd-fill{0%{transform:scaleX(0)}40%,100%{transform:scaleX(1)}}
@keyframes kd-drain{0%{transform:scaleX(1)}100%{transform:scaleX(.08)}}
@media (prefers-reduced-motion:reduce){
  .kd-dia *{animation:none!important}
  .kd-dia .draw{stroke-dashoffset:0}
  .kd-dia .fade{opacity:1}
  .kd-dia .runner{offset-distance:100%}
}`;

function Frame({ caption, children, label }: { caption: string; label: string; children: ReactNode }) {
  return (
    <figure className="kd-dia not-prose" role="group" aria-label={label}>
      {children}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/* ── lifecycle ───────────────────────────────────────────────────────── */

const STEPS = ["Creator opens", "You trade", "Leverage winds down", "Trading closes", "Oracle proposes", "Auditor checks", "You claim"];

function Lifecycle() {
  // Snake layout: 4 nodes on top left to right, 3 on the bottom right to left.
  const pos = STEPS.map((_, i) => (i < 4 ? { x: 12 + i * 176, y: 30 } : { x: 12 + (6 - i) * 176 + 88, y: 150 }));
  const centers = pos.map((p) => ({ x: p.x + 78, y: p.y + 26 }));
  const path = `M${centers.map((c) => `${c.x} ${c.y}`).join(" L")}`;
  return (
    <Frame label="Market lifecycle" caption="Every market follows the same path. The highlighted step moves through the cycle.">
      <svg viewBox="0 0 720 230">
        <path d={path} className="wire" />
        <path d={path} className="flow" />
        <rect width={12} height={12} rx={3} className="runner" fill="rgb(var(--acc))" x={-6} y={-6} style={{ offsetPath: `path("${path}")`, ["--dur" as string]: "7s" }} />
        {STEPS.map((s, i) => (
          <g key={s}>
            <rect x={pos[i]!.x} y={pos[i]!.y} width={156} height={52} rx={12} className="box pulse" style={{ animationDelay: `${i}s` }} />
            <text x={pos[i]!.x + 14} y={pos[i]!.y + 21} className="t-s">
              0{i + 1}
            </text>
            <text x={pos[i]!.x + 14} y={pos[i]!.y + 39} className="t-m">
              {s}
            </text>
          </g>
        ))}
      </svg>
    </Frame>
  );
}

/* ── rollup ──────────────────────────────────────────────────────────── */

function Rollup() {
  return (
    <Frame label="Solana and the Ephemeral Rollup" caption="Accounts are delegated into the rollup for instant, gasless trades, then committed back to Solana at the close.">
      <svg viewBox="0 0 720 260">
        <rect x={20} y={14} width={680} height={72} rx={14} className="box" />
        <text x={40} y={42} className="t-m">Solana devnet</text>
        <text x={40} y={62} className="t-s">deposits, withdrawals, market creation, settlement</text>
        <rect x={20} y={174} width={680} height={72} rx={14} className="box-acc" />
        <text x={40} y={202} className="t-m">MagicBlock Ephemeral Rollup</text>
        <text x={40} y={222} className="t-s">trades, closes, liquidations, claims</text>

        <path d="M430 86 L430 174" className="wire" />
        <path d="M430 86 L430 174" className="flow" />
        <text x={442} y={124} className="t-s">delegate</text>
        <text x={442} y={140} className="t-s">user and market</text>
        <path d="M630 174 L630 86" className="wire" />
        <path d="M630 174 L630 86" className="flow" style={{ animationDirection: "reverse" }} />
        <text x={642} y={124} className="t-s">commit at</text>
        <text x={642} y={140} className="t-s">close</text>

        {[0, 1, 2, 3].map((i) => (
          <rect key={i} width={10} height={10} rx={2} className="runner" fill="rgb(var(--acc))" x={-5} y={-5}
            style={{ offsetPath: 'path("M260 210 L360 210 L360 230 L260 230 Z")', animationDelay: `${i * 0.4}s`, ["--dur" as string]: "1.6s", animationTimingFunction: "linear" }} />
        ))}
        <text x={260} y={200} className="t-s t-acc">instant trades</text>
      </svg>
    </Frame>
  );
}

/* ── amm ─────────────────────────────────────────────────────────────── */

const cdf = (z: number) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
};
const CURVE = Array.from({ length: 81 }, (_, i) => {
  const z = -3 + (i / 80) * 6;
  return `${i ? "L" : "M"}${(60 + (i / 80) * 600).toFixed(1)} ${(210 - cdf(z) * 180).toFixed(1)}`;
}).join(" ");
const SEG = Array.from({ length: 21 }, (_, i) => {
  const z = 0.3 + (i / 20) * 0.9;
  return `${i ? "L" : "M"}${(60 + ((z + 3) / 6) * 600).toFixed(1)} ${(210 - cdf(z) * 180).toFixed(1)}`;
}).join(" ");

function Amm() {
  return (
    <Frame label="pm-AMM price curve" caption="The YES price is Phi(z). Buying YES moves the state to the right along the curve; the cost is the area the trade sweeps.">
      <svg viewBox="0 0 720 240">
        {[0.25, 0.5, 0.75].map((p) => (
          <g key={p}>
            <line x1={60} x2={660} y1={210 - p * 180} y2={210 - p * 180} className="wire" strokeDasharray="2 6" />
            <text x={20} y={214 - p * 180} className="t-s">{Math.round(p * 100)}¢</text>
          </g>
        ))}
        <path d={CURVE} fill="none" strokeWidth={2.5} className="draw" style={{ stroke: "rgb(var(--petal))" }} />
        <path d={SEG} fill="none" stroke="rgb(var(--acc))" strokeWidth={5} strokeLinecap="round" opacity={0.35} />
        <rect width={14} height={14} rx={3} fill="rgb(var(--acc))" x={-7} y={-7} className="runner" style={{ offsetPath: `path("${SEG}")`, ["--dur" as string]: "3.5s", animationDirection: "alternate" }} />
        <text x={60} y={232} className="t-s">NO certain</text>
        <text x={660} y={232} textAnchor="end" className="t-s">YES certain</text>
        <text x={470} y={70} className="t-s t-acc">a buy slides the price up</text>
      </svg>
    </Frame>
  );
}

/* ── leverage ────────────────────────────────────────────────────────── */

const SPOT = [0.46, 0.47, 0.45, 0.46, 0.44, 0.45, 0.43, 0.27, 0.42, 0.44, 0.45, 0.46, 0.45, 0.47];
const MARK = SPOT.map((_, i) => {
  let m = SPOT[0]!;
  for (let j = 1; j <= i; j++) m += 0.35 * (SPOT[j]! - m);
  return m;
});
const line = (s: number[]) => s.map((p, i) => `${i ? "L" : "M"}${(380 + (i / (s.length - 1)) * 320).toFixed(1)} ${(220 - ((p - 0.2) / 0.32) * 150).toFixed(1)}`).join(" ");
const LIQ = 220 - ((0.31 - 0.2) / 0.32) * 150;

function Leverage() {
  return (
    <Frame label="Leverage and mark-price liquidation" caption="Margin plus a loan from the lending pool buys the position. Liquidation reads the 5 minute mark, so a single wick through the line does not close you.">
      <svg viewBox="0 0 720 240">
        <text x={20} y={34} className="t-m">100 USDC at 3x</text>
        <rect x={20} y={52} width={300} height={34} rx={8} className="box" />
        <rect x={20} y={52} width={100} height={34} rx={8} fill="rgb(var(--petal))" className="fill-bar" />
        <rect x={120} y={52} width={200} height={34} rx={8} fill="rgb(var(--petal) / .3)" className="fill-bar" style={{ animationDelay: ".3s" }} />
        <text x={30} y={74} fontSize={12} fill="rgb(var(--plum))" fontWeight={700}>margin 100</text>
        <text x={132} y={74} className="t-s">borrowed 200</text>
        <text x={20} y={118} className="t-s">notional 300 USDC buys about 664 YES at 0.45</text>
        <text x={20} y={150} className="t-m t-acc">liquidation near 0.31</text>
        <text x={20} y={170} className="t-s">debt / (shares x 0.95)</text>
        <text x={20} y={204} className="t-s">ten minutes before close every loan</text>
        <text x={20} y={220} className="t-s">goes back to the House at the mark</text>

        <line x1={380} x2={700} y1={LIQ} y2={LIQ} stroke="rgb(var(--acc))" strokeDasharray="5 5" />
        <path d={line(SPOT)} fill="none" stroke="rgb(var(--fg) / .4)" strokeWidth={1.5} className="draw" />
        <path d={line(MARK)} fill="none" stroke="rgb(var(--up))" strokeWidth={2.5} className="draw" style={{ animationDelay: ".4s" }} />
        <text x={700} y={LIQ - 8} textAnchor="end" className="t-s t-acc">liquidation line</text>
        <text x={380} y={30} className="t-s">spot (grey) wicks to 0.27</text>
        <text x={380} y={46} className="t-s" fill="rgb(var(--up))">mark (green) stays above</text>
      </svg>
    </Frame>
  );
}

/* ── oracle ──────────────────────────────────────────────────────────── */

function Oracle() {
  const panel = [0.94, 0.91, 0.96, 0.9, 0.93];
  return (
    <Frame label="How a market settles" caption="Deterministic feeds first. The council reports in sequence and a seeded stop picks the reference. The evidence hash goes on-chain, then the auditor has 15 minutes to challenge.">
      <svg viewBox="0 0 720 270">
        <rect x={16} y={20} width={150} height={60} rx={12} className="box" />
        <text x={30} y={44} className="t-m">Feeds</text>
        <text x={30} y={63} className="t-s">prices, scores, UMA</text>

        <rect x={16} y={110} width={150} height={140} rx={12} className="box" />
        <text x={30} y={134} className="t-m">Council</text>
        {panel.map((p, i) => (
          <g key={i}>
            <rect x={32 + i * 24} y={236 - p * 90} width={16} height={p * 90} rx={3} fill="rgb(var(--petal))" className="rise" style={{ animationDelay: `${i * 0.35}s` }} />
          </g>
        ))}
        <rect x={32 + 4 * 24 - 3} y={236 - panel[4]! * 90 - 3} width={22} height={panel[4]! * 90 + 6} rx={4} fill="none" stroke="rgb(var(--acc))" className="fade" style={{ animationDelay: "1.8s" }} />

        <path d="M166 50 L230 50 L230 120 L270 120" className="wire" />
        <path d="M166 180 L230 180 L230 120 L270 120" className="wire" />
        <path d="M166 50 L230 50 L230 120 L270 120" className="flow" />
        <path d="M166 180 L230 180 L230 120 L270 120" className="flow" />

        <rect x={270} y={90} width={170} height={60} rx={12} className="box-acc" />
        <text x={284} y={114} className="t-m">Proposal</text>
        <text x={284} y={134} className="t-s t-acc">sha256 9f3c1a..04b</text>

        <path d="M440 120 L500 120" className="flow" />
        <rect x={500} y={90} width={200} height={60} rx={12} className="box" />
        <text x={514} y={112} className="t-m">Dispute window</text>
        <rect x={514} y={124} width={172} height={8} rx={3} fill="rgb(var(--panel-deep))" />
        <rect x={514} y={124} width={172} height={8} rx={3} fill="rgb(var(--acc))" className="drain" />

        <rect x={500} y={180} width={200} height={34} rx={10} className="box" />
        <text x={514} y={202} className="t-s">Auditor: blind re-check</text>
        <path d="M600 150 L600 180" className="wire" />
        <rect x={270} y={180} width={170} height={34} rx={10} className="box" />
        <text x={284} y={202} className="t-s">Arbiter if challenged</text>
        <path d="M500 197 L440 197" className="wire" strokeDasharray="3 4" />
        <text x={600} y={244} textAnchor="middle" className="t-m" fill="rgb(var(--up))">Resolved</text>
      </svg>
    </Frame>
  );
}

/* ── agent ───────────────────────────────────────────────────────────── */

function Agent() {
  return (
    <Frame label="Bring your own agent" caption="Your agent asks for a quote and an unsigned transaction, signs on your machine and sends it to the rollup. Your key never leaves your machine.">
      <svg viewBox="0 0 720 220">
        <rect x={20} y={40} width={190} height={140} rx={14} className="box-acc" />
        <text x={36} y={68} className="t-m">Your agent</text>
        <text x={36} y={90} className="t-s">your model</text>
        <text x={36} y={108} className="t-s">your strategy</text>
        <text x={36} y={160} className="t-s t-acc">key stays here</text>

        <rect x={300} y={40} width={150} height={140} rx={14} className="box" />
        <text x={316} y={68} className="t-m">Kondora API</text>
        <text x={316} y={92} className="t-s">/markets</text>
        <text x={316} y={110} className="t-s">/quote</text>
        <text x={316} y={128} className="t-s">/tx (unsigned)</text>

        <rect x={540} y={40} width={160} height={140} rx={14} className="box" />
        <text x={556} y={68} className="t-m">Rollup</text>
        <text x={556} y={92} className="t-s">instant fill</text>

        <path d="M210 80 L300 80" className="flow" />
        <text x={220} y={72} className="t-s">1. quote, tx</text>
        <path d="M300 130 L210 130" className="flow" />
        <text x={220} y={150} className="t-s">2. unsigned tx</text>
        <path d="M115 180 L115 205 L620 205 L620 180" className="wire" />
        <path d="M115 180 L115 205 L620 205 L620 180" className="flow" />
        <text x={340} y={198} className="t-s t-acc">3. signed locally, sent to the rollup</text>
      </svg>
    </Frame>
  );
}

const DIAGRAMS: Record<string, () => ReactNode> = { lifecycle: Lifecycle, rollup: Rollup, amm: Amm, leverage: Leverage, oracle: Oracle, agent: Agent };

export function Diagram({ name }: { name: string }) {
  const D = DIAGRAMS[name.trim()];
  if (!D) return null;
  return (
    <>
      <style>{CSS}</style>
      <D />
    </>
  );
}
