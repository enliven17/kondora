import type { Activity, Category, Market, MarketState, OracleEvent, Outcome, Position, PricePoint, ResolutionSource } from "./types";
import { clamp, hashString, seeded } from "./utils";

/**
 * Mock data for UI development. Swap for Convex in lib/data.ts.
 * Times are generated relative to an anchor so "closes in" stays meaningful.
 */

interface MarketSeed {
  id: string;
  question: string;
  category: Category;
  summary: string;
  /** Hours from anchor until close. Negative means already closed. */
  closesIn: number;
  /** Hours the market has been open before the anchor. */
  age: number;
  yes: number;
  volume: number;
  liquidity: number;
  traders: number;
  source: ResolutionSource;
  rules: string[];
  state?: MarketState;
  outcome?: Outcome;
}

const SEEDS: MarketSeed[] = [
  // Crypto
  {
    id: "btc-above-120k-dec31",
    question: "Will BTC trade above $120,000 before December 31?",
    category: "crypto",
    summary: "Any 1-minute close above the strike on the reference feed counts.",
    closesIn: 24 * 44,
    age: 24 * 9,
    yes: 0.41,
    volume: 1_284_300,
    liquidity: 182_000,
    traders: 3_921,
    source: { name: "Pyth Network", url: "https://pyth.network/price-feeds/crypto-btc-usd", field: "BTC/USD 1m close" },
    rules: [
      "Resolves YES if the Pyth BTC/USD price prints a 1-minute close strictly above 120,000.00 at any time before the close.",
      "Resolves NO otherwise.",
      "If the feed is unavailable for more than 6 hours in total, the oracle falls back to the Coinbase BTC-USD candle API.",
    ],
  },
  {
    id: "sol-week-close-250",
    question: "Will SOL close this week above $250?",
    category: "crypto",
    summary: "Weekly close is Sunday 23:59 UTC on the reference feed.",
    closesIn: 98,
    age: 70,
    yes: 0.33,
    volume: 412_800,
    liquidity: 64_000,
    traders: 1_208,
    source: { name: "Pyth Network", url: "https://pyth.network/price-feeds/crypto-sol-usd", field: "SOL/USD weekly close" },
    rules: [
      "Resolves YES if the Pyth SOL/USD price at the weekly close is strictly above 250.00.",
      "Resolves NO otherwise.",
    ],
  },
  {
    id: "eth-btc-ratio-dec1",
    question: "Will the ETH/BTC ratio be above 0.040 on December 1?",
    category: "crypto",
    summary: "Daily close at 00:00 UTC, computed from both reference feeds.",
    closesIn: 24 * 14 + 5,
    age: 24 * 6,
    yes: 0.27,
    volume: 158_400,
    liquidity: 38_000,
    traders: 611,
    source: { name: "Pyth Network", url: "https://pyth.network/price-feeds", field: "ETH/USD divided by BTC/USD" },
    rules: [
      "Resolves YES if ETH/USD divided by BTC/USD at 00:00 UTC on December 1 is strictly above 0.040.",
      "Resolves NO otherwise.",
    ],
  },
  // Macro
  {
    id: "fed-cut-december",
    question: "Will the Fed cut rates at the December FOMC meeting?",
    category: "macro",
    summary: "Settles on the upper bound of the federal funds target range.",
    closesIn: 24 * 23,
    age: 24 * 21,
    yes: 0.62,
    volume: 2_041_900,
    liquidity: 240_000,
    traders: 5_877,
    source: { name: "Federal Reserve", url: "https://www.federalreserve.gov/monetarypolicy/openmarket.htm", field: "Target range upper bound" },
    rules: [
      "Resolves YES if the FOMC statement lowers the upper bound of the target range versus the prior meeting.",
      "Resolves NO if the range is unchanged or raised.",
      "An unscheduled cut before the meeting also resolves YES.",
    ],
  },
  {
    id: "us-cpi-nov-26",
    question: "Will US CPI for November print at or below 2.6% year over year?",
    category: "macro",
    summary: "Headline CPI-U, not seasonally adjusted, first release.",
    closesIn: 24 * 25,
    age: 24 * 12,
    yes: 0.48,
    volume: 690_200,
    liquidity: 96_000,
    traders: 1_944,
    source: { name: "U.S. Bureau of Labor Statistics", url: "https://www.bls.gov/cpi/", field: "CPI-U 12-month change" },
    rules: [
      "Resolves YES if the first published 12-month change in CPI-U is 2.6% or lower.",
      "Later revisions are ignored.",
    ],
  },
  {
    id: "gold-4500-dec31",
    question: "Will gold close above $4,500 per ounce on December 31?",
    category: "macro",
    summary: "LBMA Gold Price PM fix on the last trading day of the year.",
    closesIn: 24 * 44 + 3,
    age: 24 * 18,
    yes: 0.36,
    volume: 377_500,
    liquidity: 58_000,
    traders: 947,
    source: { name: "LBMA", url: "https://www.lbma.org.uk/prices-and-data/precious-metal-prices", field: "Gold Price PM (USD)" },
    rules: [
      "Resolves YES if the LBMA Gold Price PM on the final trading day of the year is strictly above 4,500.00 USD.",
      "Resolves NO otherwise.",
    ],
  },
  // Sports
  {
    id: "arsenal-top-jan1",
    question: "Will Arsenal top the Premier League table on January 1?",
    category: "sports",
    summary: "Table position after all matches played on January 1.",
    closesIn: 24 * 45,
    age: 24 * 30,
    yes: 0.44,
    volume: 803_100,
    liquidity: 110_000,
    traders: 2_730,
    source: { name: "Premier League", url: "https://www.premierleague.com/tables", field: "League position" },
    rules: [
      "Resolves YES if Arsenal is first in the official table at 23:59 UTC on January 1.",
      "Tiebreakers follow official league rules.",
    ],
  },
  {
    id: "chiefs-next-game",
    question: "Will the Kansas City Chiefs win their next game?",
    category: "sports",
    summary: "Regular season result, overtime included.",
    closesIn: 52,
    age: 120,
    yes: 0.67,
    volume: 529_600,
    liquidity: 72_000,
    traders: 2_118,
    source: { name: "ESPN", url: "https://www.espn.com/nfl/team/_/name/kc/kansas-city-chiefs", field: "Final score" },
    rules: [
      "Resolves YES if the Chiefs win their next scheduled game, including overtime.",
      "A tie resolves NO. A postponement beyond 7 days resolves Invalid.",
    ],
  },
  {
    id: "alcaraz-ao-2027",
    question: "Will Carlos Alcaraz win the 2027 Australian Open?",
    category: "sports",
    summary: "Men's singles champion.",
    closesIn: 24 * 74,
    age: 24 * 40,
    yes: 0.31,
    volume: 1_102_000,
    liquidity: 150_000,
    traders: 3_302,
    source: { name: "ATP Tour", url: "https://www.atptour.com/en/scores/results-archive", field: "Tournament winner" },
    rules: [
      "Resolves YES if Carlos Alcaraz is the men's singles champion.",
      "Withdrawal before or during the event resolves NO.",
    ],
  },
  // Esports
  {
    id: "vitality-iem-katowice",
    question: "Will Team Vitality win IEM Katowice 2027?",
    category: "esports",
    summary: "Counter-Strike 2, main event champion.",
    closesIn: 24 * 88,
    age: 24 * 15,
    yes: 0.24,
    volume: 214_900,
    liquidity: 41_000,
    traders: 988,
    source: { name: "PandaScore", url: "https://pandascore.co", field: "Tournament winner" },
    rules: [
      "Resolves YES if Team Vitality wins the main event.",
      "Roster changes do not affect resolution. Event cancellation resolves Invalid.",
    ],
  },
  {
    id: "t1-next-lck-2-0",
    question: "Will T1 win their next LCK series 2-0?",
    category: "esports",
    summary: "Best-of-three, clean sweep only.",
    closesIn: 30,
    age: 48,
    yes: 0.46,
    volume: 98_300,
    liquidity: 22_000,
    traders: 640,
    source: { name: "PandaScore", url: "https://pandascore.co", field: "Series score" },
    rules: [
      "Resolves YES if T1 wins their next LCK series with a 2-0 score.",
      "Any other result, including a forfeit, resolves NO.",
    ],
  },
  {
    id: "cs2-major-final-three-maps",
    question: "Will the next CS2 Major final go to three maps?",
    category: "esports",
    summary: "Grand final of the next Valve-sanctioned Major.",
    closesIn: 24 * 160,
    age: 24 * 20,
    yes: 0.55,
    volume: 61_200,
    liquidity: 18_000,
    traders: 402,
    source: { name: "HLTV", url: "https://www.hltv.org/events", field: "Grand final maps played" },
    rules: [
      "Resolves YES if the grand final reaches a third map.",
      "Resolves NO if it ends 2-0.",
    ],
  },
  // Politics
  {
    id: "fed-chair-confirmed-jan31",
    question: "Will the Senate confirm a new Fed chair by January 31?",
    category: "politics",
    summary: "Floor vote recorded on the official roll call.",
    closesIn: 24 * 75,
    age: 24 * 26,
    yes: 0.58,
    volume: 932_400,
    liquidity: 120_000,
    traders: 2_644,
    source: { name: "Congress.gov", url: "https://www.congress.gov/nominations", field: "Nomination status" },
    rules: [
      "Resolves YES if the Senate confirms a nominee for Chair of the Board of Governors on or before January 31.",
      "Resolves NO otherwise.",
    ],
  },
  {
    id: "eu-ev-tariff-month",
    question: "Will the EU announce new tariffs on Chinese EVs this month?",
    category: "politics",
    summary: "Formal announcement by the European Commission.",
    closesIn: 24 * 13 + 8,
    age: 24 * 16,
    yes: 0.19,
    volume: 144_700,
    liquidity: 30_000,
    traders: 519,
    source: { name: "European Commission", url: "https://ec.europa.eu/commission/presscorner", field: "Press release" },
    rules: [
      "Resolves YES if the Commission publishes a press release announcing new or increased duties on Chinese battery electric vehicles.",
      "Extensions of existing duties without changes resolve NO.",
    ],
  },
  {
    id: "uk-election-before-2028",
    question: "Will the UK hold a general election before 2028?",
    category: "politics",
    summary: "Polling day must fall before January 1, 2028.",
    closesIn: 24 * 400,
    age: 24 * 50,
    yes: 0.12,
    volume: 210_500,
    liquidity: 44_000,
    traders: 730,
    source: { name: "UK Parliament", url: "https://www.parliament.uk", field: "Polling day" },
    rules: ["Resolves YES if a UK general election polling day occurs before January 1, 2028."],
  },
  // World
  {
    id: "nov-record-warm",
    question: "Will November be the warmest November on record globally?",
    category: "world",
    summary: "ERA5 global surface air temperature.",
    closesIn: 24 * 20,
    age: 24 * 17,
    yes: 0.71,
    volume: 120_900,
    liquidity: 26_000,
    traders: 455,
    source: { name: "Copernicus C3S", url: "https://climate.copernicus.eu/surface-air-temperature-maps", field: "Monthly global anomaly" },
    rules: [
      "Resolves YES if the C3S monthly bulletin reports November as the warmest November in the ERA5 record.",
      "Resolves NO otherwise.",
    ],
  },
  {
    id: "quake-75-this-week",
    question: "Will a magnitude 7.5+ earthquake be recorded this week?",
    category: "world",
    summary: "Any location, reviewed USGS catalog magnitude.",
    closesIn: 110,
    age: 58,
    yes: 0.09,
    volume: 33_400,
    liquidity: 12_000,
    traders: 210,
    source: { name: "USGS", url: "https://earthquake.usgs.gov/earthquakes/search/", field: "Event magnitude" },
    rules: ["Resolves YES if the USGS catalog lists an event of magnitude 7.5 or greater with an origin time inside the window."],
  },
  {
    id: "unsc-sudan-resolution",
    question: "Will the UN Security Council adopt a new resolution on Sudan by December 15?",
    category: "world",
    summary: "Adopted resolution with Sudan in the title or operative text.",
    closesIn: 24 * 28,
    age: 24 * 10,
    yes: 0.34,
    volume: 47_800,
    liquidity: 14_000,
    traders: 238,
    source: { name: "UN Press", url: "https://press.un.org/en/content/security-council", field: "Meeting coverage" },
    rules: ["Resolves YES if the Council adopts a resolution concerning Sudan on or before December 15."],
  },
  // Tech
  {
    id: "frontier-model-dec31",
    question: "Will OpenAI release a new flagship model before December 31?",
    category: "tech",
    summary: "General availability via API or ChatGPT, with a new model name.",
    closesIn: 24 * 44 + 6,
    age: 24 * 35,
    yes: 0.52,
    volume: 1_517_000,
    liquidity: 190_000,
    traders: 4_402,
    source: { name: "OpenAI", url: "https://openai.com/news/", field: "Release announcement" },
    rules: [
      "Resolves YES if OpenAI makes a new flagship model generally available before the close.",
      "Previews, waitlists and minor version bumps of an existing model resolve NO.",
    ],
  },
  {
    id: "apple-4-5t-friday",
    question: "Will Apple close Friday above a $4.5T market cap?",
    category: "tech",
    summary: "Closing price times shares outstanding.",
    closesIn: 76,
    age: 96,
    yes: 0.43,
    volume: 268_100,
    liquidity: 50_000,
    traders: 913,
    source: { name: "Nasdaq", url: "https://www.nasdaq.com/market-activity/stocks/aapl", field: "Close and shares outstanding" },
    rules: ["Resolves YES if AAPL closing price multiplied by the latest reported shares outstanding exceeds 4.5 trillion USD."],
  },
  {
    id: "starship-launch-dec15",
    question: "Will SpaceX launch Starship before December 15?",
    category: "tech",
    summary: "Integrated flight test with a successful liftoff.",
    closesIn: 24 * 28,
    age: 24 * 22,
    yes: 0.64,
    volume: 488_600,
    liquidity: 70_000,
    traders: 1_355,
    source: { name: "SpaceX", url: "https://www.spacex.com/launches/", field: "Launch log" },
    rules: [
      "Resolves YES if a Starship integrated vehicle lifts off from the pad before December 15.",
      "Scrubs and static fires do not count.",
    ],
  },
  // Culture
  {
    id: "box-office-50m-weekend",
    question: "Will the top film at the US box office gross over $50M this weekend?",
    category: "culture",
    summary: "Friday to Sunday domestic estimate.",
    closesIn: 68,
    age: 80,
    yes: 0.57,
    volume: 92_500,
    liquidity: 20_000,
    traders: 377,
    source: { name: "Box Office Mojo", url: "https://www.boxofficemojo.com/weekend/", field: "Weekend gross, rank 1" },
    rules: ["Resolves YES if the first-ranked film's reported weekend gross is above 50,000,000 USD."],
  },
  {
    id: "goty-nintendo",
    question: "Will a Nintendo title win Game of the Year at The Game Awards?",
    category: "culture",
    summary: "Nintendo as publisher of the winning title.",
    closesIn: 24 * 23 + 2,
    age: 24 * 30,
    yes: 0.22,
    volume: 176_300,
    liquidity: 34_000,
    traders: 802,
    source: { name: "The Game Awards", url: "https://thegameawards.com", field: "Game of the Year winner" },
    rules: ["Resolves YES if the Game of the Year winner is published by Nintendo."],
  },
  {
    id: "album-announce-year-end",
    question: "Will Taylor Swift announce a new studio album before year end?",
    category: "culture",
    summary: "Official announcement on verified channels.",
    closesIn: 24 * 44 + 1,
    age: 24 * 28,
    yes: 0.17,
    volume: 301_800,
    liquidity: 46_000,
    traders: 1_610,
    source: { name: "Official channels", url: "https://www.taylorswift.com", field: "Announcement" },
    rules: [
      "Resolves YES if a new studio album is officially announced before the close.",
      "Re-recordings and live albums resolve NO.",
    ],
  },
  // Settled and settling markets, for oracle trail states
  {
    id: "eth-above-5k-oct31",
    question: "Did ETH close October above $5,000?",
    category: "crypto",
    summary: "Monthly close on the reference feed.",
    closesIn: -24 * 16,
    age: 24 * 40,
    yes: 0.08,
    volume: 744_000,
    liquidity: 90_000,
    traders: 2_210,
    source: { name: "Pyth Network", url: "https://pyth.network/price-feeds/crypto-eth-usd", field: "ETH/USD monthly close" },
    rules: ["Resolves YES if the Pyth ETH/USD price at 23:59 UTC on October 31 is strictly above 5,000.00."],
    state: "resolved",
    outcome: "no",
  },
  {
    id: "ldn-marathon-record",
    question: "Did the men's winner set a course record at the city marathon?",
    category: "sports",
    summary: "Official result, chip time.",
    closesIn: -20,
    age: 24 * 12,
    yes: 0.21,
    volume: 58_900,
    liquidity: 15_000,
    traders: 290,
    source: { name: "World Athletics", url: "https://worldathletics.org/results", field: "Winning time" },
    rules: ["Resolves YES if the official winning time is faster than the existing course record."],
    state: "proposed",
    outcome: "no",
  },
];

const HOUR = 3600;
const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function hex(rand: () => number, len = 64) {
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(rand() * 16).toString(16);
  return s;
}

/**
 * Random walk in logit space, generated backwards from the current price.
 * 5-minute points for the last 24h, 30-minute points before that (max 14 days).
 * Volume per point grows with the size of the move.
 */
function buildHistory(seed: MarketSeed, rand: () => number, openTime: number, endTime: number): PricePoint[] {
  const vol = 0.05 + rand() * 0.05;
  const drift = (rand() - 0.5) * 0.008;
  const baseVolume = seed.volume / 2400;
  const points: PricePoint[] = [];
  let x = logit(clamp(seed.yes, 0.02, 0.98));
  let t = endTime;
  const oldest = Math.max(openTime, endTime - 14 * 24 * HOUR);
  while (t >= oldest || points.length < 8) {
    const fine = endTime - t < 24 * HOUR;
    const scale = fine ? 0.4 : 1;
    const shock = rand() < (fine ? 0.003 : 0.012) ? (rand() - 0.5) * (fine ? 0.35 : 0.7) : 0;
    const move = (drift + (rand() - 0.5) * vol) * scale + shock;
    const v = baseVolume * (fine ? 1 / 6 : 1) * (0.3 + rand() * 1.4 + Math.abs(move) * 25);
    points.push({ t, p: clamp(sigmoid(x), 0.01, 0.99), v: Math.round(v * 100) / 100 });
    x -= move;
    t -= fine ? 5 * 60 : HOUR / 2;
  }
  return points.reverse();
}

function buildTrail(seed: MarketSeed, rand: () => number, openTime: number, closeTime: number): OracleEvent[] {
  const trail: OracleEvent[] = [
    {
      t: openTime,
      kind: "created",
      actor: "creator",
      agent: `Creator 0${1 + Math.floor(rand() * 3)}`,
      note: `Opened from ${seed.source.name} with spec: ${seed.source.field}.`,
      evidenceHash: hex(rand),
    },
  ];
  const outcome = (seed.outcome ?? "no").toUpperCase();
  if (seed.state === "proposed" || seed.state === "resolved") {

    trail.push({
      t: closeTime + 6 * 60,
      kind: "proposed",
      actor: "oracle",
      agent: "Oracle 02",
      note: `Proposed ${outcome} from ${seed.source.name}. Deterministic source, no council needed.`,
      evidenceHash: hex(rand),
    });
  }
  if (seed.state === "resolved") {
    trail.push(
      {
        t: closeTime + 9 * 60,
        kind: "challenged",
        actor: "auditor",
        agent: "Auditor 01",
        note: "Challenged: reference feed showed a stale print at 23:58 UTC. Requested a second source.",
        evidenceHash: hex(rand),
      },
      {
        t: closeTime + 52 * 60,
        kind: "ruled",
        actor: "admin",
        agent: "Admin",
        note: `Upheld ${outcome}. Second source confirms the close below the strike.`,
        evidenceHash: hex(rand),
      },
      {
        t: closeTime + 53 * 60,
        kind: "finalized",
        actor: "oracle",
        agent: "Oracle 02",
        note: `Finalized ${outcome}. Payouts claimable.`,
      },
    );
  }
  return trail;
}

export function buildMockMarkets(anchor: number): Market[] {
  return SEEDS.map((seed) => {
    const rand = seeded(hashString(seed.id));
    const openTime = anchor - seed.age * HOUR;
    const closeTime = anchor + seed.closesIn * HOUR;
    const endTime = Math.min(anchor, closeTime);
    const history = buildHistory(seed, rand, openTime, endTime);
    const last = history[history.length - 1]?.p ?? seed.yes;
    const dayAgo = history.find((pt) => pt.t >= endTime - 24 * HOUR)?.p ?? last;
    let yesPrice = last;
    if (seed.state === "resolved") yesPrice = seed.outcome === "yes" ? 1 : seed.outcome === "no" ? 0 : last;
    return {
      id: seed.id,
      question: seed.question,
      category: seed.category,
      summary: seed.summary,
      openTime,
      closeTime,
      state: seed.state ?? "open",
      outcome: seed.state === "resolved" ? seed.outcome : undefined,
      yesPrice,
      change24h: last - dayAgo,
      volume: seed.volume,
      liquidity: seed.liquidity,
      traders: seed.traders,
      resolution: seed.source,
      rules: seed.rules,
      history,
      oracleTrail: buildTrail(seed, rand, openTime, closeTime),
    } satisfies Market;
  });
}

const TRADERS = ["7xKq...3Fd", "Bv2p...9aL", "agent:atlas", "Gh5T...pQ1", "agent:minerva", "3nRe...Wk8", "Dz9u...cY4", "agent:ikaros"];

export function buildMockActivity(market: Market, anchor: number, count = 14): Activity[] {
  const rand = seeded(hashString(`${market.id}:activity`));
  const out: Activity[] = [];
  let t = Math.min(anchor, market.closeTime);
  for (let i = 0; i < count; i++) {
    t -= Math.floor(30 + rand() * 1500);
    const side = rand() < market.yesPrice ? "yes" : "no";
    const roll = rand();
    const kind = roll < 0.72 ? "open" : roll < 0.94 ? "close" : "liquidation";
    const sidePrice = side === "yes" ? market.yesPrice : 1 - market.yesPrice;
    out.push({
      id: `${market.id}-a${i}`,
      marketId: market.id,
      kind,
      side,
      leverage: kind === "open" ? Math.round((1 + rand() * 4) * 2) / 2 : 1 + Math.round(rand() * 3),
      amount: Math.round((5 + rand() * rand() * 900) * 100) / 100,
      price: clamp(sidePrice + (rand() - 0.5) * 0.03, 0.01, 0.99),
      t,
      trader: TRADERS[Math.floor(rand() * TRADERS.length)] ?? "anon",
    });
  }
  return out;
}

export function buildMockPositions(markets: Market[], anchor: number): Position[] {
  const picks: Array<[string, "yes" | "no", number, number, number]> = [
    // id, side, margin, leverage, entry offset in price points
    ["fed-cut-december", "yes", 120, 3, -0.04],
    ["btc-above-120k-dec31", "no", 80, 2, 0.02],
    ["frontier-model-dec31", "yes", 50, 5, 0.03],
    ["chiefs-next-game", "yes", 200, 1, -0.02],
  ];
  return picks.flatMap(([id, side, margin, leverage, offset]) => {
    const m = markets.find((x) => x.id === id);
    if (!m) return [];
    const mark = side === "yes" ? m.yesPrice : 1 - m.yesPrice;
    const entryPrice = clamp(mark + offset, 0.02, 0.98);
    const notional = margin * leverage;
    const shares = (notional * (1 - 0.005)) / entryPrice;
    const debt = notional - margin;
    return [
      {
        marketId: id,
        side,
        shares,
        margin,
        debt,
        accrued: debt * 0.0002 * 30,
        entryPrice,
        leverage,
        openedAt: anchor - 30 * HOUR,
      } satisfies Position,
    ];
  });
}
