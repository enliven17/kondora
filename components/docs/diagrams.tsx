// Server-rendered diagrams: responsive HTML flows and SVG charts, without client JS.
import type { ReactNode } from "react";

import styles from "./diagrams.module.css";

function Frame({ caption, children, label }: { caption: string; label: string; children: ReactNode }) {
  return (
    <figure className={styles.frame} aria-label={label}>
      <div className={styles.eyebrow}>{label}</div>
      {children}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className={styles.connector}>
      {label && <span>{label}</span>}
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 3v17m-6-6 6 6 6-6" />
      </svg>
    </div>
  );
}

function Node({ title, children, accent = false }: { title: string; children: ReactNode; accent?: boolean }) {
  return <div className={`${styles.node} ${accent ? styles.accent : ""}`}><strong>{title}</strong><p>{children}</p></div>;
}

function Lifecycle() {
  const steps = [
    ["Creator opens", "A sourced question, clear rules, and House liquidity."],
    ["You trade", "Choose YES or NO and open a funded position."],
    ["Leverage winds down", "Borrowed positions exit before settlement."],
    ["Trading closes", "The final mark freezes; the market returns to Solana."],
    ["Oracle proposes", "An outcome and its evidence hash go on-chain."],
    ["Auditor checks", "A blind review during the 15-minute dispute window."],
    ["You claim", "Finalized payouts credit your trading balance."],
  ];
  return (
    <Frame label="Market lifecycle" caption="Read in numbered order. Only fully paid shares reach settlement.">
      <ol className={styles.timeline}>
        {steps.map(([title, detail], index) => (
          <li key={title}>
            <span className={styles.step}>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{title}</strong><p>{detail}</p></div>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

function Rollup() {
  return (
    <Frame label="Solana ↔ Ephemeral Rollup" caption="The market returns to Solana at close. Your trading account returns to Solana for deposits and withdrawals.">
      <Node title="Solana devnet">USDC custody · deposits and withdrawals · market creation · settlement</Node>
      <div className={styles.bridge}>
        <Arrow label="Delegate accounts ↓" />
        <Arrow label="↑ Commit and undelegate" />
      </div>
      <Node title="MagicBlock Ephemeral Rollup" accent>Open and close positions · liquidations · session-signed execution</Node>
      <div className={styles.note}>No per-trade SOL fees. Trading fees and borrowing costs still apply.</div>
    </Frame>
  );
}

const cdf = (z: number) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
};
const curvePoint = (z: number) => `${(52 + ((z + 3) / 6) * 496).toFixed(1)} ${(214 - cdf(z) * 180).toFixed(1)}`;
const curve = Array.from({ length: 81 }, (_, i) => `${i ? "L" : "M"}${curvePoint(-3 + (i / 80) * 6)}`).join(" ");

function Amm() {
  return (
    <Frame label="The pm-AMM price curve" caption="An illustrative curve: YES price = Φ(z). Buying YES moves the pool state right; buying NO moves it left.">
      <svg className={styles.chart} viewBox="0 0 580 260" role="img" aria-label="YES price rises along an S-shaped curve from near zero to near one as the pool state increases.">
        {[0, 0.25, 0.5, 0.75, 1].map((price) => (
          <g key={price}>
            <line x1="52" x2="548" y1={214 - price * 180} y2={214 - price * 180} className={styles.gridLine} />
            <text x="40" y={219 - price * 180} textAnchor="end">{price.toFixed(2)}</text>
          </g>
        ))}
        <path d={curve} className={styles.priceCurve} />
        <circle cx="300" cy="124" r="5" className={styles.chartPoint} />
        <text x="312" y="143" className={styles.highlightText}>50% YES</text>
        <path d="M348 53h102m-7-5 7 5-7 5" className={styles.buyArrow} />
        <text x="348" y="39" className={styles.highlightText}>Buy YES</text>
        <text x="52" y="246">NO more likely</text>
        <text x="548" y="246" textAnchor="end">YES more likely</text>
      </svg>
      <div className={styles.note}>The quote includes the full price impact of your order. The displayed spot price is not your guaranteed fill.</div>
    </Frame>
  );
}

const SPOT = [0.46, 0.47, 0.45, 0.46, 0.44, 0.45, 0.43, 0.27, 0.42, 0.44, 0.45, 0.46, 0.45, 0.47];
const MARK = SPOT.map((_, i) => {
  let mark = SPOT[0]!;
  for (let j = 1; j <= i; j++) mark += 0.35 * (SPOT[j]! - mark);
  return mark;
});
const priceY = (price: number) => 214 - ((price - 0.2) / 0.32) * 180;
const priceLine = (prices: number[]) => prices.map((price, i) => `${i ? "L" : "M"}${(52 + (i / (prices.length - 1)) * 496).toFixed(1)} ${priceY(price).toFixed(1)}`).join(" ");

function Leverage() {
  return (
    <Frame label="Margin, borrowing, and the mark" caption="Illustrative price samples, not a live quote or a simulation of the exact five-minute mark. Liquidation uses the time-weighted mark, not the spot wick.">
      <div className={styles.metrics}>
        <div><span>Your margin</span><strong>100 USDC</strong></div>
        <div><span>Borrowed at 3×</span><strong>200 USDC</strong></div>
        <div><span>Total notional</span><strong>300 USDC</strong></div>
      </div>
      <div className={styles.legend}><span><i className={styles.spotSwatch} />Spot price</span><span><i className={styles.markSwatch} />Time-weighted mark</span></div>
      <svg className={styles.chart} viewBox="0 0 580 255" role="img" aria-label="Spot price briefly falls to 0.27 below an illustrative 0.31 liquidation threshold, while the smoothed mark stays above the threshold.">
        {[0.2, 0.3, 0.4, 0.5].map((price) => <g key={price}><line x1="52" x2="548" y1={priceY(price)} y2={priceY(price)} className={styles.gridLine} /><text x="40" y={priceY(price) + 5} textAnchor="end">{price.toFixed(2)}</text></g>)}
        <line x1="52" x2="548" y1={priceY(0.31)} y2={priceY(0.31)} className={styles.threshold} />
        <text x="548" y={priceY(0.31) + 24} textAnchor="end" className={styles.highlightText}>Liquidation · 0.31</text>
        <path d={priceLine(SPOT)} className={styles.spotLine} />
        <path d={priceLine(MARK)} className={styles.markLine} />
        <text x="52" y="246">Earlier</text><text x="548" y="246" textAnchor="end">Later →</text>
      </svg>
      <div className={styles.note}>Approximate threshold = (debt + accrued interest) / (shares × 0.95). Actual shares depend on fees and price impact.</div>
    </Frame>
  );
}

function Oracle() {
  return (
    <Frame label="Evidence → proposal → settlement" caption="The auditor checks independently. A challenged proposal goes to an arbiter before an outcome can be finalized.">
      <div className={styles.columns}>
        <Node title="01 · Named feeds">Prices, match results, or a final UMA outcome. Deterministic sources first.</Node>
        <Node title="02 · Model council">Used when a deterministic source cannot settle the question.</Node>
      </div>
      <Arrow label="Evidence supports an outcome" />
      <Node title="On-chain proposal" accent>YES, NO, or INVALID + the SHA-256 hash of the sealed evidence bundle.</Node>
      <Arrow label="15-minute dispute window · blind auditor review" />
      <div className={styles.columns}>
        <Node title="Unchallenged → finalize">After the window ends, finalize the proposal and make payouts claimable.</Node>
        <Node title="Challenged → arbiter">A fresh review decides the outcome. Unresolved disagreement times out to INVALID.</Node>
      </div>
      <Arrow />
      <Node title="Finalized → claim" accent>Winning shares pay 1 USDC. INVALID pays YES at the final mark and NO at its complement.</Node>
    </Frame>
  );
}

function Agent() {
  return (
    <Frame label="Your agent, your signing key" caption="The API builds unsigned transactions. Your agent validates the instructions, signs locally, and submits to the RPC returned by the API.">
      <Node title="Your agent" accent>Your model · your strategy · your locally stored signing key</Node>
      <Arrow label="1 · Read markets and request a quote" />
      <Node title="Kondora API">GET /markets · POST /quote · POST /tx</Node>
      <Arrow label="2 · Receive and validate the unsigned transaction" />
      <Node title="Sign on your machine" accent>Check the program, accounts, amounts, and slippage before signing.</Node>
      <Arrow label="3 · Submit to the returned RPC" />
      <Node title="Solana or Ephemeral Rollup">Setup and funding use Solana. Delegated trading uses the rollup.</Node>
    </Frame>
  );
}

const DIAGRAMS: Record<string, () => ReactNode> = { lifecycle: Lifecycle, rollup: Rollup, amm: Amm, leverage: Leverage, oracle: Oracle, agent: Agent };

export function Diagram({ name }: { name: string }) {
  const Component = DIAGRAMS[name.trim()];
  return Component ? <Component /> : null;
}
