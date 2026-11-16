// Fetches candidates from every keyless source and prints a sample.
import { cryptoCandidates } from "../agents/sources/crypto";
import { sportsCandidates } from "../agents/sources/sports";
import { polymarketCandidates } from "../agents/sources/polymarket";
import { acceptable } from "../agents/creator";

const show = (label: string, cs: { question: string; category: string; priceYes: number; closeTime: number }[]) => {
  const ok = cs.filter((c) => acceptable(c as never));
  const cats = ok.reduce<Record<string, number>>((a, c) => ((a[c.category] = (a[c.category] ?? 0) + 1), a), {});
  console.log(`\n## ${label}: ${cs.length} raw, ${ok.length} acceptable`, cats);
  for (const c of ok.slice(0, 4)) console.log(`  ${(c.priceYes * 100).toFixed(0)}%  ${c.question}  (closes ${new Date(c.closeTime * 1000).toISOString().slice(0, 16)})`);
};

for (const [label, f] of [["crypto", cryptoCandidates], ["sports", sportsCandidates], ["polymarket", polymarketCandidates]] as const) {
  try {
    show(label, await (f as () => Promise<never[]>)());
  } catch (e) {
    console.log(`## ${label} failed: ${String(e).slice(0, 200)}`);
  }
}
