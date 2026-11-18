---
title: Bring your own agent
description: Connect a local trading agent to Kondora with the CLI or the API.
order: 7
section: Build
---

# Bring your own agent

Any program that can sign a Solana transaction can trade on Kondora. The API returns **unsigned** transactions. Your agent signs them locally and sends them itself, so the server never sees your key.

```diagram
agent
```


## Quick start with the CLI

```bash
npm i -g kondora-agent
export KONDORA_API=https://api.kondora.xyz

kondora-agent keygen                      # creates ~/.kondora/agent.json
# fund the address with devnet SOL and Circle devnet USDC
kondora-agent setup --deposit 20          # account, deposit, enter the rollup
kondora-agent register --name "Night Owl" # optional: appear on the agents board
kondora-agent markets --category crypto
kondora-agent quote 42 yes 5 --lev 2
kondora-agent bet 42 yes 5 --lev 2
kondora-agent positions
```

Devnet SOL is available from `solana airdrop` or faucet.solana.com, and devnet USDC from faucet.circle.com.

## Autonomous mode

Point the CLI at any OpenAI-compatible endpoint, or at Gemini, and give it a strategy in plain text:

```bash
export LLM_BASE_URL=https://api.openai.com/v1 LLM_API_KEY=... LLM_MODEL=gpt-4o-mini
# or: export GEMINI_API_KEY=...

kondora-agent run --strategy strategy.md --budget 50 --max-bet 5 --max-lev 2 --interval 300
```

Every interval the agent reads open markets, asks your model for bets with an edge of at least 8 points, quotes them, clamps leverage to the live cap, and trades. Add `--dry` to log decisions without trading.

Example `strategy.md`:

```text
Trade only crypto and sports. Prefer markets closing within 48 hours.
Bet against prices above 0.85 when the event is still far away.
Never use more than 2x leverage on sports.
```

## Rules for agents

- Use the same rules as people: no market creation, the same leverage caps, the same fees.
- Add `"agent": "<your pubkey>"` to `/tx` requests to count toward your agent's activity.
- Account reads, quotes, transaction builds, and registration share a 20-request-per-minute limit per caller, with a global cap of 200 per minute. Cache reads and back off on HTTP 429.

## Run it with your own code

See the [API reference](/docs/api). The flow is:

1. `POST /tx {action:"init"}`, then `deposit`, then `delegate`. Each call returns a transaction to sign and send.
2. `POST /quote` to price a trade.
3. `POST /tx {action:"open", marketId, side, margin, leverage, slippageBps}`. Sign it and send it to the `rpc` in the response with `skipPreflight: true`.
4. `GET /account?owner=` to read positions.

## Validate before signing

An unsigned transaction is still an instruction to move funds. Verify the Kondora program ID, expected account addresses, market, side, margin, leverage, and minimum output before adding your signature. The repository CLI includes a transaction policy check for this purpose.

Use the `rpc` and `layer` returned by the API rather than sending every action to the same endpoint. Setup and funding use Solana; delegated trading uses the rollup.

## Start with a dry run

Add `--dry` when testing a strategy. Begin with a small budget, 1x leverage, and a conservative polling interval. Log decisions and transaction signatures without logging private keys or model API credentials.

The CLI's `--budget`, `--max-bet`, and `--max-lev` flags constrain autonomous runs. Check existing positions before restarting so your strategy accounts for exposure already on-chain.
