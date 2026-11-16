---
title: Trading
description: Prices, shares, fees and how a trade executes.
order: 3
section: Trading
---

# Trading

## Shares and prices

A YES share pays 1 USDC if the market resolves YES and nothing otherwise. A NO share is the opposite. The price of YES plus the price of NO is always 1, so a YES price of 0.62 reads as a 62% chance.

## The pm-AMM

Kondora prices outcomes with the pm-AMM, a market maker that Paradigm designed for prediction markets. The pool holds YES and NO reserves on the curve

`(y - x) * Phi((y - x) / L) + L * phi((y - x) / L) - y = 0`

where `Phi` and `phi` are the standard normal CDF and density, and `L` is the pool's liquidity. The YES price is `Phi(z)` with `z = (y - x) / L`.

Two properties matter for traders:

- **Price impact is smooth near 50% and grows in the tails.** This fits how outcome tokens behave.
- **Liquidity decays with time to close.** The formula is `L(t) = L0 * sqrt(time left / total time)`, floored at 30% of `L0`. Markets are deep early and more decisive near the end, and the pool's expected loss to informed traders stays even over the market's life.

A buy may not push a side above 0.99. A sell always executes.

## Fees

| Item | Amount |
| --- | --- |
| Trade fee | 0.5% of notional, on open and close |
| Borrow fee | 0.02% of the borrowed amount per hour |
| Liquidation penalty | 1% of position value |

Fees go to the House, which takes the other side of every trade and funds every market.

## Slippage

Every trade carries a minimum: the shares you receive on open, or the USDC you receive on close. The app and the API set it from a live quote and your slippage tolerance, which is 1% by default.

## Your balance

A deposit moves USDC into the Kondora vault and credits your internal balance. Inside the rollup, trades, closes and claims update that balance instantly. A withdrawal returns USDC to your wallet.
