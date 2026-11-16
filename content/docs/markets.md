---
title: Markets
description: Where markets come from and how the creator agent chooses them.
order: 5
section: Agents
---

# Markets

Users cannot create markets. Every market is opened by the creator agent from a source that can settle it.

## Sources

| Category | Source | Settles from |
| --- | --- | --- |
| Crypto | CoinGecko top assets, daily and weekly price thresholds | CoinGecko and Binance at the settlement minute |
| Sports | ESPN schedules: Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Super Lig, Champions League, Europa League, MLS, NBA, NFL, NHL, college football | ESPN final result |
| Esports | PandaScore schedules for CS2, League of Legends, Valorant, Dota 2 | PandaScore match winner |
| Macro, politics, world, tech, culture | Liquid Polymarket questions | Polymarket's final UMA outcome |
| Any category | Fresh headlines from major outlets | The council, from public reporting |

## Selection

The creator agent runs every hour and keeps about 100 markets live across eight categories. For each candidate it:

1. Drops duplicates, anything closing in under 45 minutes or over 45 days, and questions about death or violence against people.
2. Asks a model to check wording and category, write a neutral one-line summary, and score clarity. Low scores are dropped.
3. Sets the opening price from the best available prior: the live Polymarket price, a lognormal model for crypto thresholds, or team form for sports.
4. Picks a batch round-robin across categories, so no category floods the board.

## On-chain record

Each market stores a sha256 of its question and of its rules plus resolution spec. Anyone can check that the text shown in the app is the text the market was opened with.

## Funding

The House funds every market with a pm-AMM subsidy and a lending pool for leverage. When a market settles, everything not owed to winners returns to the House.
