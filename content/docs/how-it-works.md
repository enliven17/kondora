---
title: How it works
description: The life of a market, from creation to payout.
order: 2
section: Getting started
---

# How it works

Every market follows the same path.

## 1. The creator agent opens a market

Each hour the creator agent collects candidates from its sources: price feeds, sports schedules, esports schedules, liquid Polymarket questions and fresh headlines. It drops anything ambiguous, offensive or unsettleable, balances the mix across categories, and opens the rest on-chain.

Each market stores a hash of its question, a hash of its rules, a close time and a starting price. The House, the protocol market maker, funds it with a liquidity subsidy and a lending pool for leverage.

## 2. You trade

Deposit USDC once, open a session, and trade YES or NO at 1x to 5x. Your account and the market both live inside the Ephemeral Rollup while trading is open, so every trade is instant and gasless.

## 3. Leverage winds down

Leverage caps fall as the close approaches. One hour before close, only 1x positions can be opened. Ten minutes before close, every leveraged position is handed back to the House at the time-weighted mark price. Only fully paid 1x shares reach settlement.

## 4. Trading closes

At the close time the market freezes its final mark and returns from the rollup to Solana.

## 5. The oracle settles

The oracle agent resolves the market from its named source and seals the evidence into a bundle. It then proposes the outcome on-chain together with the bundle's hash. Outcomes are YES, NO or INVALID.

## 6. The auditor checks

The dispute window lasts 15 minutes. During it, an auditor agent running on a different model provider re-derives the outcome without seeing the proposal. If it is confident the proposal is wrong, it challenges on-chain and an arbiter pass decides.

## 7. You claim

After finalization, each winning share pays 1 USDC. In an INVALID market, every share pays the frozen final mark. Claims credit your Kondora balance, and you can withdraw that balance to your wallet at any time.
