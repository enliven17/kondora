---
title: Leverage
description: Margin, borrowing, caps, liquidation and the pre-close wind-down.
order: 4
section: Trading
---

# Leverage

## Opening a leveraged position

With margin `m` and leverage `x`, your notional is `m * x`. The difference, `m * (x - 1)`, is borrowed from the market's lending pool. The whole notional buys shares through the pm-AMM.

Example: 100 USDC of margin at 3x creates 300 USDC of notional and 200 USDC of debt. The 0.5% opening fee is 1.50 USDC, leaving 298.50 USDC to buy shares. At an illustrative average fill of 0.40, that is about 746.25 shares. The live quote determines the actual shares and liquidation price.

When you close, the proceeds repay your debt and accrued interest before any remaining value returns to your balance. Leveraged positions are wound down before the market closes; they do not carry borrowed exposure into the outcome payout.

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

Liquidation uses a **time-weighted mark price**: an exponential average of the pool price with a 5 minute time constant. It smooths short-lived spot moves instead of immediately following each trade.

A position is liquidatable when

`shares * mark - debt - interest <= 5% * shares * mark`

This puts the liquidation price at about `(debt + accrued interest) / (shares * 0.95)`.

Once a position crosses that line, anyone can trigger its liquidation. The position goes to the House at the mark price. The House takes the shares and cancels the loan. You receive the mark value minus the debt, the interest and a 1% penalty. Nothing is sold into the pool, so a liquidation cannot be farmed by pushing the price.

You can close a leveraged position yourself at any time, as long as the sale covers what you owe.

## Before the close

Ten minutes before close, solvent leveraged positions are sold through the pool and their debt is repaid, with no liquidation penalty. The exit includes price impact and trading fees. Positions that cannot repay their debt go to the House; a stale mark cannot be used to withdraw equity from an underwater position. The market cannot close while any debt is open, so no borrowed position ever reaches settlement.

## Interest

Borrowed amounts pay 0.02% per hour. Interest accrues continuously and is settled when the position closes.

For example, borrowing 200 USDC for one hour adds about 0.04 USDC of interest. This is separate from the opening fee, closing fee, price impact, and any liquidation penalty.

## Reading a leveraged quote

| Field | What to check |
| --- | --- |
| Margin | The USDC taken from your available balance. |
| Notional and debt | Total exposure and the portion that must be repaid. |
| Shares and average price | The actual quoted fill after fees and price impact. |
| Liquidation price | The selected side's mark threshold, including debt. Interest can move this threshold over time. |
| Maximum leverage | The current cap, which can fall before a later order executes. |

The quoted winning payout is an illustration of share value after debt, not a promise that a leveraged position can remain open through settlement. See the [pre-close wind-down](#before-the-close).
