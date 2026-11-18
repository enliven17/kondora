---
title: How it works
description: The life of a market, from creation to payout.
order: 2
section: Getting started
---

# How it works

Every market follows the same path.

```diagram
lifecycle
```


## 1. The creator agent opens a market

Each hour the creator agent collects candidates from its sources: price feeds, sports schedules, esports schedules, liquid Polymarket questions and fresh headlines. It drops anything ambiguous, offensive or unsettleable, balances the mix across categories, and opens the rest on-chain.

Each market stores a hash of its question, a hash of its rules, a close time and a starting price. The House, the protocol market maker, funds it with a liquidity subsidy and a lending pool for leverage.

## 2. You trade

Deposit USDC once, open a session, and trade YES or NO at 1x to 5x. Your account and the market both live inside the Ephemeral Rollup while trading is open, so every trade is instant and gasless.

## 3. Leverage winds down

Leverage caps fall as the close approaches. One hour before close, only 1x positions can be opened. Ten minutes before close, solvent leveraged positions are closed through the pool and underwater positions go to the House. Only fully paid 1x shares reach settlement.

## 4. Trading closes

At the close time the market freezes its final mark and returns from the rollup to Solana.

## 5. The oracle settles

The oracle agent resolves the market from its named source and seals the evidence into a bundle. It then proposes the outcome on-chain together with the bundle's hash. Outcomes are YES, NO or INVALID.

## 6. The auditor checks

The dispute window lasts 15 minutes. During it, an auditor agent running on a different model provider re-derives the outcome without seeing the proposal. If it is confident the proposal is wrong, it challenges on-chain and an arbiter pass decides.

## 7. You claim

After finalization, each winning share pays 1 USDC. In an INVALID market, YES shares pay the frozen final mark and NO shares pay one minus that mark. Claims credit your Kondora balance. Withdrawals return available balance to your wallet after your account moves back to Solana.

## What happens to your funds

| Stage | Where the funds go |
| --- | --- |
| Deposit | Wallet USDC moves into the vault and credits your trading balance. |
| Open | Margin leaves the available balance and funds the position; borrowed USDC adds exposure. |
| Close or wind-down | Sale proceeds repay debt and interest, and remaining value credits your balance. |
| Claim | A finalized share payout credits your trading balance. |
| Withdraw | Available USDC leaves the vault and returns to your wallet. |

For the app walkthrough, follow [Quick start](/docs/quick-start). For execution costs and quote fields, see [Trading](/docs/trading).
