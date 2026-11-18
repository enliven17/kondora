---
title: Troubleshooting
description: Resolve common wallet, funding, session, quote, and settlement issues.
order: 11
section: Reference
---

# Troubleshooting

## My wallet shows funds, but I cannot trade

Check both balances. Your wallet holds tokens outside Kondora; your trading account holds deposited margin. Deposit through **Enable trading** or **Portfolio → Funds** before opening a position.

Use Circle devnet USDC on Solana devnet. Mainnet USDC, a similarly named token, or USDC on another chain will not fund the account.

## Setup says I need more SOL

Initial setup requires devnet SOL for rent and network fees, even if you already have USDC. The app checks for at least **0.03 SOL** before enabling trading.

Get test SOL from the [Solana faucet](https://faucet.solana.com), send it to the connected wallet, and wait for the balance to refresh. Do not send real SOL to solve a devnet funding issue.

## A transaction is pending or failed

Open its transaction link and check the result on the correct network. A wallet approval does not by itself mean that the transaction executed.

If the result is unclear, refresh the account and position before submitting again. This avoids duplicating a successful deposit or trade. If a transaction expired, request a fresh transaction after checking that the original did not execute.

## My quote is rejected

Common causes include a market that has stopped trading, a position too large for current liquidity, or leverage above the live cap.

Try a smaller margin or 1x leverage, then request a fresh quote. A buy cannot move the selected outcome above the pool's maximum price. The available leverage also falls as the market approaches close.

See [Trading](/docs/trading#slippage) and [Leverage](/docs/leverage#caps).

## My session no longer works

A session can expire, be missing from this browser, or belong to a different wallet. Reconnect the intended wallet and use **Enable trading** when prompted to establish a valid session.

Never paste a wallet seed phrase or private key into a support message. The web app does not need either to reconnect your wallet.

## I cannot deposit or withdraw while delegated

Deposits and withdrawals execute on Solana, while delegated trading accounts live in the rollup. The app moves the account between these layers as part of the funding flow, which can involve multiple approvals and a short wait.

Keep enough devnet SOL for base-layer fees. With the API or CLI, explicitly undelegate and wait for the account to return to Solana before funding it. See the [transaction actions](/docs/api#post-tx).

## The market closed, but I cannot claim

Trading close, an oracle proposal, and finalization are different steps. The oracle must propose an outcome, and the **15-minute dispute window** must finish before an unchallenged proposal can be finalized.

A disputed market requires an arbiter decision. A market waiting for reliable evidence can take longer. Inspect the market's oracle and audit trail; a closed market does not guarantee an immediate payout.

## My leveraged position closed before the event

This can happen through liquidation or the scheduled wind-down. **Ten minutes before close**, remaining leveraged positions are closed and their debt is repaid. A position can also be liquidated earlier if its mark value no longer satisfies maintenance margin.

Check the activity record and [pre-close rules](/docs/leverage#before-the-close).

## The API returns HTTP 429

The account, quote, transaction, and registration endpoints share a limit of **20 requests per minute per caller**, with a global limit of **200 per minute**. Slow down, cache market data, and retry with backoff after the rate-limit window.

Requesting a transaction does not submit it. Before retrying a submission, check the original signature and account state. See [API errors](/docs/api#errors-and-retries).

## Where can I inspect the implementation?

The [source repository](https://github.com/enliven17/kondora) contains the frontend, CLI, Convex agents, and on-chain program. Every docs page links to its Markdown source. For account layout and instruction boundaries, start with [Program](/docs/program).
