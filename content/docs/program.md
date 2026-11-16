---
title: Program
description: On-chain accounts, instructions and the Ephemeral Rollup flow.
order: 9
section: Build
---

# Program

Program ID: `3h2nKsRRXsxnbX7R98R31PepeoEqdhm5GTrBGeh1KKCZ` (Solana devnet), Anchor 1.0.

## Accounts

| Account | Seeds | Holds |
| --- | --- | --- |
| Config | `config` | Roles (admin, creator, oracle, auditor), the pinned rollup validator, risk parameters, House balances |
| Vault | `vault` | Every USDC in the protocol, owned by Config |
| UserAccount | `user`, owner | Internal balance and up to 24 positions |
| Market | `market`, id | pm-AMM state, mark, cash, outstanding shares, lending pool, fees, outcome, evidence hash |

Accounting is internal. At every point the vault holds at least the sum of user balances, free House capital, and the cash, lending pool and fees of every unsettled market. The test suite checks this after every settlement path.

## Instructions

**Base layer:** `initialize`, `update_config`, `house_deposit`, `house_withdraw`, `init_user`, `deposit`, `withdraw`, `create_market` (creator only), `delegate_market` (creator only), `delegate_user`, `close_market`, `propose_resolution` (oracle), `challenge` (auditor), `finalize`, `rule` (admin), `sweep`.

**Ephemeral Rollup:** `open_position`, `close_position`, `liquidate`, `claim`, `undelegate_user`, `undelegate_market`.

`liquidate`, `claim`, `finalize`, `sweep` and `undelegate_market` are permissionless.

## Rollup flow

1. The creator opens a market on Solana and delegates it to the pinned MagicBlock validator in the same transaction.
2. A trader deposits on Solana, then delegates their UserAccount.
3. Trades run in the rollup: no fees, instant confirmation, and a session key in place of a wallet popup.
4. At close, `undelegate_market` freezes the mark and commits the market back to Solana, where the oracle settles it.
5. To withdraw, the trader undelegates their account and withdraws on Solana.

## Session keys

Trades accept either the owner's signature or a MagicBlock session token (`SessionTokenV2`) scoped to this program. A session key can open and close positions but cannot withdraw. Closes signed by a session key must carry a slippage bound.

## Safety properties

- Sells never fail: the curve is clamped at its bound, so a position can always be closed.
- Liquidations hand the position to the House at the time-weighted mark, never through the pool.
- A leveraged position must stay healthy at floor liquidity, which caps its size relative to the pool.
- An owner cannot close an underwater position. Only liquidation can realize a shortfall.
- A market cannot close while debt is open, and leverage is forced out ten minutes before close.
- Pausing stops new positions. Exits and claims still work.
