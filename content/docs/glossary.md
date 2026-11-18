---
title: Glossary
description: A plain-language reference for the terms used across Kondora.
order: 12
section: Reference
---

# Glossary

## Positions and prices

| Term | Meaning |
| --- | --- |
| YES / NO | The two sides of a market's exact question. A finalized winning share pays 1 USDC. |
| Spot price | The current pool price for an outcome, before the price impact of your order. |
| Mark price | A time-weighted pool price used for liquidation and the frozen final mark. |
| Average fill price | The average price paid across all shares in a trade. |
| Margin | Your own USDC committed to a position. |
| Notional | Total purchasing amount before the trading fee: margin × leverage. |
| Debt | The amount borrowed to buy the position, excluding accrued interest. |
| Equity | Position value after subtracting debt and accrued interest. The exit quote also reflects execution costs. |
| Liquidation | A transfer of an unhealthy borrowed position to the House, with debt cancellation and a penalty. |
| Slippage | The difference between a quote and execution; a slippage bound limits how much worse the fill may be. |

See [Trading](/docs/trading) and [Leverage](/docs/leverage) for the formulas and limits.

## Accounts and execution

| Term | Meaning |
| --- | --- |
| House | The protocol market maker that supplies liquidity and lending capital. |
| pm-AMM | The automated market maker that quotes YES and NO shares. |
| Trading balance | Deposited USDC credited to your Kondora account and available to use. |
| Ephemeral Rollup | MagicBlock's execution environment for delegated accounts and fast trading. |
| Delegation | Moving account execution into the rollup. It does not give the API your signing key. |
| Undelegation | Committing the account back to Solana so base-layer operations can run. |
| Session key | A scoped trading key that lets you trade without approving every order in your wallet. It cannot withdraw. |
| Gasless trade | A rollup trade without a per-trade SOL fee. Trading fees and borrowing costs still apply. |

See [Program](/docs/program) for the account and instruction reference.

## Resolution and payouts

| Term | Meaning |
| --- | --- |
| Close time | The deadline after which trading stops. It is separate from finalization. |
| Oracle | The agent that derives an outcome from named sources and proposes it on-chain. |
| Evidence hash | A SHA-256 commitment to the sealed bundle of sources and resolution evidence. |
| Auditor | An agent that checks the outcome independently and can challenge a proposal. |
| Dispute window | The 15-minute period after a proposal during which it can be challenged. |
| Arbiter | The independent resolution pass used after a challenge. |
| Finalization | The step that makes the decided outcome available for claims. |
| INVALID | An outcome that pays YES at the frozen final mark and NO at one minus that mark. It does not refund entry prices. |
| Claim | Crediting a finalized position's payout to the trading account. Withdrawal to a wallet is a separate step. |

See [Oracle and audit](/docs/oracle) for the settlement paths.
