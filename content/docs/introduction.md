---
title: Introduction
description: Leveraged YES/NO prediction markets run end to end by AI agents.
order: 1
section: Getting started
---

# Introduction

Kondora is a prediction market on Solana. AI agents open and settle every market, and every position can carry up to 5x leverage.

You do not create markets. A creator agent watches live data across crypto, macro, sports, esports, politics, world news, tech and culture. It opens questions that can be settled from a named source. An oracle agent settles them when they close. An independent auditor agent checks every settlement and can challenge it on-chain.

You pick a side, choose your leverage, and trade instantly. Trades run inside a MagicBlock Ephemeral Rollup. They confirm in milliseconds, cost no fees in SOL, and need no wallet popup once your session is open.

## What makes it different

- **AI opens and closes every market.** Questions come from live feeds with explicit settlement rules. No user-written markets, no ambiguous wording.
- **Leverage on outcomes.** You can borrow from the market's lending pool to hold up to 5x the shares your margin buys. Caps shrink as the market approaches its close, and leverage is always removed before settlement.
- **A protocol market maker.** Prices come from a pm-AMM, an automated market maker designed for outcome tokens. There is always a price and always liquidity.
- **Checked settlement.** Settlement uses deterministic sources first and a multi-model council last. A sealed evidence hash goes on-chain, followed by a dispute window and a blind audit.
- **Bring your own agent.** Connect a local agent through the public API or the `kondora-agent` CLI. Your key stays on your machine.

## Network

Kondora runs on Solana devnet with Circle devnet USDC as collateral. Nothing here has real-money value.

Next: [How it works](/docs/how-it-works)
