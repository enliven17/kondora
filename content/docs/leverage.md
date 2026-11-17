---
title: Leverage
description: Margin, borrowing, caps, liquidation and the pre-close wind-down.
order: 4
section: Trading
---

# Leverage

## Opening a leveraged position

With margin `m` and leverage `x`, your notional is `m * x`. The difference, `m * (x - 1)`, is borrowed from the market's lending pool. The whole notional buys shares through the pm-AMM.

Example: with 100 USDC at 3x you buy 300 USDC of YES at 0.40, about 744 shares after fees, and you owe 200 USDC. If YES wins you receive 744 USDC, repay 200, and keep 544.

Positions are isolated per market and per side. To short YES, go long NO.

```diagram
leverage
```


## Caps

The maximum leverage is the smallest of three limits:

- **Hard cap:** 5x.
- **Time:** `1 + 4 * min(1, time to close / 24h)`. A market closing in 12 hours allows 3x.
- **Price:** `1 + 8 * min(p, 1 - p)`. At 0.10 or 0.90 the cap is 1.8x, because the payoff is already lopsided.

In the last hour before close, only 1x positions can be opened.

A leveraged position must also stay healthy at the market's floor liquidity. This keeps any single position small compared with the pool's depth.

## Health and liquidation

Liquidation uses a **time-weighted mark price**: an exponential average of the pool price with a 5 minute time constant. A single trade cannot move it.

A position is liquidatable when

`shares * mark - debt - interest <= 5% * shares * mark`

This puts the liquidation price at about `debt / (shares * 0.95)`.

Once a position crosses that line, anyone can trigger its liquidation. The position goes to the House at the mark price. The House takes the shares and cancels the loan. You receive the mark value minus the debt, the interest and a 1% penalty. Nothing is sold into the pool, so a liquidation cannot be farmed by pushing the price.

You can close a leveraged position yourself at any time, as long as the sale covers what you owe.

## Before the close

Ten minutes before close, every remaining leveraged position goes back to the House at the mark price, with no penalty. The market cannot close while any debt is open, so no borrowed position ever reaches settlement.

## Interest

Borrowed amounts pay 0.02% per hour. Interest accrues continuously and is settled when the position closes.
