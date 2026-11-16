# Kondora build plan

Leveraged YES/NO prediction markets on Solana. AI agents open every market and resolve every market. Users only trade. A protocol market maker (the House) is the counterparty and the lender for leverage.

Stack: Anchor 1.0.2 program on Solana devnet, MagicBlock Ephemeral Rollups (ER) for zero-fee instant trading, session keys for popup-free betting, Next.js 16 on Vercel, Convex for agents, crons, indexing and the agent API. Collateral is Circle devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, 6 decimals).

Nothing is deployed (Convex, Vercel, program) without the owner's explicit go.

## 1. Repo layout

```
app/ components/ lib/ public/ hooks/   Next.js app (App Router)
convex/                                  schema, crons, agents runtime, agent API
agents/                                  pure TS agent logic (sources, creator, oracle, audit, llm)
program/                                 Anchor workspace, programs/kondora
lib/kondora/                             TS client: PDAs, ix builders, math mirror of the program
cli/                                     kondora-agent CLI for user-run agents
brand/                                   brand kit, logo, render scripts
docs content                             app/docs (MDX, GitBook-style)
```

## 2. Units

- USDC and shares both use 6 decimals. One share pays 1 USDC if its side wins.
- Leverage in basis points: 10_000 = 1x, 50_000 = 5x.
- Times are unix seconds (i64), always whole seconds.

## 3. Pricing: pm-AMM (Paradigm, static invariant with dynamic liquidity)

State per market: `z` (f64) and `L` (f64, liquidity in micro USDC).

- `g(z) = z*Phi(z) + phi(z)`, increasing and convex, `g'(z) = Phi(z)`.
- Pool reserves are `x = L*g(-z)` YES and `y = L*g(z)` NO. This is exactly the invariant `(y-x)Phi((y-x)/L) + L phi((y-x)/L) - y = 0` with `z = (y-x)/L`.
- `P(YES) = Phi(z)`, `P(NO) = Phi(-z)`.
- Side-oriented `zs = z` for YES, `-z` for NO.
  - Buy `n` shares of a side: cost `L*(g(zs + n/L) - g(zs))`, then `zs += n/L`.
  - Sell `n` shares of a side: proceeds `L*(g(zs) - g(zs - n/L))`, then `zs -= n/L`.
  - Buy with `c` USDC: solve `g(w) = g(zs) + c/L` by Newton from the right (g convex, monotone convergence), `n = floor((w - zs)*L) - 1`, then verify `cost(n) <= c`.
- Dynamic liquidity: `L(t) = L0 * sqrt(clamp((close - t)/(close - open), floor^2, 1))`, `floor = 0.30`. `L` only ever decreases. Changing `L` with `z` fixed keeps prices and releases reserves to the House.
- Complete-set accounting: `S` = USDC cash in the market (= complete sets minted). `qY`, `qN` = shares held by traders. Invariant after every op: `S >= qY` and `S >= qN`. This guarantees every payout.
- Opening: the creator sets `p0`, program gets `z0` (|z0| <= 2.0, sent by creator, `p0` shown = Phi(z0)) and funding `S0`. `L0 = S0 / g(|z0|)`.
- Buys must keep the bought side's price <= 0.99. Sells are always allowed (liquidations must never be blocked).
- Rounding always favors the pool: costs round up, proceeds and shares round down.
- Math uses `libm` (pure Rust erfc/exp/sqrt), deterministic on SBF.

## 4. Leverage

- Isolated margin, long only: long YES or long NO. A position slot is (market, side).
- Open: margin `m` from balance, leverage `lev`. Notional `N = m*lev`. Debt `d = N - m` is borrowed from the market's `lend_pool`. Fee `f = N*fee_bps`. AMM spend `c = N - f`.
- Borrow fee accrues linearly on debt: `debt * borrow_bps_per_hour * dt / 3600 / 10_000`.
- Value `v` = exact AMM sell proceeds of the whole position minus trade fee. Equity `e = v - debt - accrued`.
- Liquidatable when `e <= mm_bps * v`. Liquidation fully closes, takes `liq_bps * v` (capped at remaining equity) as penalty to the House, returns the rest.
- Shortfall (net proceeds < debt + accrued) is bad debt absorbed by `lend_pool`, tracked in `market.bad_debt`.
- Leverage cap: `min(max_lev, 1 + 4*min(1, tau/tau0), 1 + 8*min(p, 1-p))`, `tau = close - now`, `tau0 = 24h`. Inside `reduce_only_secs` (1h) of close only 1x opens.
- Force close: inside `halt_secs` (10 min) of close, any position with debt can be closed by anyone at AMM price. Resolution requires `market.debt_positions == 0`. Leveraged positions never reach resolution.
- UI liquidation price estimate: `p_liq ~= p0*(1 - 1/lev)/(1 - mm)` (exact check is on-chain).

Defaults: `fee_bps 50`, `mm_bps 500`, `liq_bps 100`, `max_lev 50_000`, `borrow_bps_per_hour 2`, `tau0 86_400`, `reduce_only_secs 3_600`, `halt_secs 600`, `dispute_secs 900`.

## 5. Accounts

- `Config` [b"config"]: admin, creator, oracle, auditor authorities, usdc mint, params, next_market_id, house: free, allocated, returned, fees.
- Vault token account [b"vault"] owned by the Config PDA. Every USDC lives here. Accounting is internal.
- `UserAccount` [b"user", owner]: balance, 24 position slots `{market_id, side, shares, debt, margin, accrued, last_accrual, opened_at}`, stats. Delegated to the ER for trading.
- `Market` [b"market", id le]: question_hash, rules_hash, category, open/close times, state, z0, z, L0, L, S, qY, qN, lend_pool, lend_initial, subsidy, fees, bad_debt, debt_positions, volume, outcome, evidence_hash, proposed_at, randomness, swept, params snapshot.
- Market states: Open, Closed (undelegated, awaiting oracle), Proposed, Disputed, Resolved. Outcomes: Yes, No, Invalid (pays final mark: YES share pays `Phi(z)`, NO pays `Phi(-z)`).

## 6. Instructions

Base layer:
- `initialize`, `update_config` (admin)
- `house_deposit` (admin)
- `init_user`, `deposit`, `withdraw` (user account must be undelegated)
- `create_market` (creator): takes `subsidy` + `lend` from House, sets z0, L0
- `propose_resolution` (oracle, after close, market undelegated): outcome + evidence hash; `finalize` permissionless after `dispute_secs`
- `challenge` (auditor) moves to Disputed; `rule` (admin) settles a dispute
- `sweep` (permissionless, Resolved): returns `S - winning payout + lend_pool + fees` to House
- `delegate_user`, `delegate_market`

ER (delegated accounts, session key or owner signs):
- `open_position(market_id, side, margin, lev_bps, min_shares)`
- `close_position(market_id, side, fraction_bps, min_out)`
- `liquidate(market_id, side)` permissionless crank
- `claim(market_id)` market read-only, works on either layer
- `undelegate_user` (owner), `undelegate_market` (permissionless after close and debt_positions == 0)

## 7. Agents (Convex)

- Market creator (hourly): sources per category produce candidate questions from live data with deterministic resolution specs (source, field, comparator, deadline). LLM only phrases, categorizes, scores, dedupes. Target 60 to 120 live markets across Crypto, Macro, Sports, Esports, Politics, World, Tech, Culture.
- Oracle (every 2 min): deterministic sources first (price feeds, ESPN, PandaScore, Polymarket UMA result, official data), LLM council last. Council follows self-resolving markets (arXiv 2306.04305): a panel of independent models report probabilities in sequence, a VRF-seeded stop picks the reference, agreement >= 0.9 settles, else Invalid. Evidence bundle sealed, sha256 on-chain.
- Audit agent: re-derives each proposal blind on a different provider (DeepSeek via Token Harbor), challenges on-chain within the dispute window when confident >= 0.9 it is wrong.
- Crank (every 15 s): liquidations, force closes, undelegate closed markets, sweep.
- Keys split by role: CREATOR, ORACLE, AUDIT, WEB. Never in Vercel or `NEXT_PUBLIC_*`.

## 8. User agents

- Agent API under `/api/agent/v1/*` (Convex HTTP): list markets, quote, build unsigned ER transaction, positions. Ed25519 signed envelopes with nonce + timestamp.
- `cli/` `kondora-agent`: runs locally with the user's own model, signs with a local session key.
- Docs: `/docs/agents`.

## 9. Frontend

- Dark night-sky collage: marble statues, torn paper edges, abstract condor mark, serif display + mono labels.
- Banned: AI slop copy, accent lines, em dashes, pill shapes, dot ornaments.
- Lenis + GSAP ScrollTrigger, scroll-reactive sections, splash screen, rich footer.
- Pages: `/` landing, `/markets`, `/markets/[id]` (chart, pm-AMM depth, bet panel with leverage dial, liquidation preview, rules, evidence, oracle trail), `/portfolio`, `/agents` (leaderboard of resolver and user agents), `/docs/*`, `/brand`.
- Betting feels like a game: leverage dial, haptics, sound toggle, count-up payouts, win/liquidation moments.
- OG image for every route and every market (`next/og`).
- Mobile first, works at 320px.

## 10. Phases

0. Scaffold, brand tokens, components from portfolio registry.
1. Program + Rust math tests + LiteSVM flow tests.
2. TS client + Convex schema + agents + crank.
3. UI.
4. Docs, agent API + CLI, OG, brand kit page.
5. E2E, review passes, devnet deploy on owner's go.
