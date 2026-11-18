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

```diagram
amm
```


Two properties matter for traders:

- **Price impact is smooth near 50% and grows in the tails.** This fits how outcome tokens behave.
- **Liquidity decays with time to close.** The formula is `L(t) = L0 * sqrt(time left / total time)`, floored at 30% of `L0`. Markets are deep early and more decisive near the end, and the pool's expected loss to informed traders stays even over the market's life.

A buy may not push a side above 0.99. Sells are supported at the curve boundary, but a close must still satisfy transaction constraints such as slippage and debt repayment.

## Fees

| Item | Amount |
| --- | --- |
| Trade fee | 0.5% of notional, on open and close |
| Borrow fee | 0.02% of the borrowed amount per hour |
| Liquidation penalty | 1% of position value |

Fees go to the House, which takes the other side of every trade and funds every market.

## Slippage

Every trade carries a minimum: the shares you receive on open, or the USDC you receive on close. The app and the API set it from a live quote and your slippage tolerance, which is 1% by default.

**Price impact** comes from your own order moving through the pool. **Slippage** is an additional change between the quote and execution. A large order can have significant price impact even when the market does not move while you submit it.

If a trade fails its minimum, request a fresh quote before trying again. Increasing tolerance allows a worse fill; reducing your order size may be a better way to reduce the impact.

## A simple 1x example

Suppose you spend 10 USDC at 1x. The opening fee is 0.05 USDC, so 9.95 USDC buys shares. At an illustrative average fill of 0.50, you receive 19.9 shares.

| What happens next | Result before any other costs |
| --- | --- |
| Your side wins and you claim after finalization | 19.9 USDC payout; 9.9 USDC above the original margin. |
| Your side loses | The shares pay zero; the 10 USDC margin is lost. |
| You sell before close | The current exit quote determines proceeds after the closing fee and price impact. |
| The market resolves INVALID | YES pays at the frozen final mark; NO pays at its complement. |

The average fill in this example is assumed. Use the live quote for actual share counts. At 1x there is no borrowing, interest, or liquidation from debt.

## Closing a position

You can close a full position or a fraction while trading is open. The pool quotes the sale of those shares, applies the closing fee, and repays the corresponding debt and interest. The rest credits your trading balance.

A leveraged close cannot withdraw equity that the sale does not cover. Underwater positions follow the [liquidation and wind-down rules](/docs/leverage).

## Your balance

A deposit moves USDC into the Kondora vault and credits your internal balance. Inside the rollup, trades, closes and claims update that balance instantly. A withdrawal returns USDC to your wallet.
