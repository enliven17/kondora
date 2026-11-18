---
title: Quick start
description: Set up your wallet, get test funds, and open your first YES or NO position.
order: 1.5
section: Getting started
---

# Quick start

Kondora runs on **Solana devnet**. Use devnet SOL and Circle's devnet USDC throughout this guide. Test tokens have no real-money value.

## 1. Prepare your wallet

Connect a Phantom or Solflare wallet from the [markets page](/markets). Use the same wallet for funding and trading, and select devnet in your wallet when viewing balances and transactions.

You need two different tokens:

| Token | Used for | Where to get it |
| --- | --- | --- |
| Devnet SOL | Account rent, setup, and base-layer transaction fees | [Solana faucet](https://faucet.solana.com) |
| Devnet USDC | Deposits and position margin | [Circle faucet](https://faucet.circle.com), with **Solana Devnet** selected |

Keep at least **0.03 devnet SOL** available for initial setup. USDC does not pay Solana network fees. Tokens on mainnet or another chain will not appear in your devnet balance.

## 2. Choose a market

Open a market and read its question, close time, rules, and named resolution source. YES and NO refer to the exact question, including its deadline and conditions.

The displayed price is a probability between 0 and 1. At a YES price of 0.60, NO is 0.40. A winning, fully paid share pays 1 USDC after finalization; an INVALID outcome follows the [final-mark payout rules](/docs/oracle#invalid).

## 3. Enable trading and deposit

Choose an amount in the **Enable trading** panel and approve the setup in your wallet. Kondora creates your trading account, deposits your test USDC, creates a trading session, and delegates your account to the Ephemeral Rollup.

Your wallet balance and your **trading account balance** are separate. Only the funds credited to the trading account are available as margin.

Once the session is active, trades can be signed without a wallet popup for every order. Session keys are scoped to trading; they cannot withdraw funds.

## 4. Preview and place a trade

1. Select **YES** or **NO**.
2. Enter your margin in USDC. Start at **1x** to learn the flow without borrowing.
3. Review the shares, average fill price, fee, and price impact in the quote.
4. If using leverage, also review the borrowed amount and liquidation price. The live leverage cap depends on time, price, and liquidity.
5. Submit the trade and check your position in [Portfolio](/portfolio).

> A quote is a preview. Your fill must still satisfy the slippage limit when the transaction executes. If the price moves too far, the transaction fails instead of filling beyond that limit.

## 5. Close or claim

While trading is open, you can close all or part of your position at the pool's current price. The proceeds reflect price impact, the closing fee, and any debt and interest owed.

If you keep fully paid shares through close, wait for the oracle proposal, dispute window, and finalization. Then claim the payout into your trading balance. A closed market is not necessarily ready to claim.

Leveraged positions are wound down **ten minutes before close**. They do not remain leveraged through settlement. Read [Leverage](/docs/leverage) before borrowing.

## 6. Withdraw to your wallet

Open **Portfolio → Funds**, enter an amount from your available trading balance, and choose **Withdraw**. The account must return from the rollup to Solana before the wallet receives USDC. Expect wallet approvals and a short wait while the account changes layers.

Funds tied to an open position are not an available cash balance. Close the position or claim a finalized payout first.

## Continue learning

- [How it works](/docs/how-it-works): the full market lifecycle.
- [Trading](/docs/trading): prices, shares, fees, and slippage.
- [Troubleshooting](/docs/troubleshooting): funding, session, and transaction issues.
- [Bring your own agent](/docs/agents): automate the same trading flow.
