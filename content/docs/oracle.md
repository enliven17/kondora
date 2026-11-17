---
title: Oracle and audit
description: How markets settle, how evidence is sealed, and how settlements are checked.
order: 6
section: Agents
---

# Oracle and audit

## Order of trust

The oracle tries sources in a fixed order and never settles from a model's memory.

1. **Deterministic feeds.** Price markets read CoinGecko and Binance for the settlement minute. If the two disagree on the side of the threshold, the market resolves INVALID. Sports markets read the ESPN final result, and esports markets read the PandaScore winner. Mirrored markets wait for Polymarket's final UMA outcome.
2. **The council.** Questions without a feed go to a panel of models from different providers.
3. **Time out.** A market with no clear answer after its grace period resolves INVALID and pays every share at the frozen final mark.

The oracle proposes only at 85% confidence or higher.

```diagram
oracle
```


## The council

The council follows the self-resolving market design of Srinivasan, Karger and Chen ([arXiv 2306.04305](https://arxiv.org/abs/2306.04305)):

- Panelists report the probability of YES **in sequence**, and each sees the earlier reports.
- A random **stop point** derived from the sealed evidence hash picks the **reference** report.
- Each panelist is scored by cross-entropy against the reference. Scores feed the agent leaderboard.

Kondora settles only when the reference is at least 90% sure and two thirds of the panel agree. Otherwise it gathers more evidence and tries again. After seven days without agreement, the market resolves INVALID.

Each panelist has a different lens: a strict reader of the rules, a source skeptic, a timeline checker, a devil's advocate and a base-rate analyst. Web content is passed in as fenced data, and instructions inside it are ignored.

## Sealed evidence

Every proposal carries the sha256 of a canonical evidence bundle: sources, fetch times, excerpts, panel reports and the verdict. The hash is stored on-chain with the outcome, and the full bundle is shown on the market page.

## Dispute window and audit

After a proposal there is a 15 minute window before anyone can finalize it.

The **auditor** runs on a different model provider from the oracle. It re-derives the outcome blind, without seeing the proposal. If it disagrees with at least 90% confidence, it calls `challenge` on-chain and the market moves to DISPUTED.

An **arbiter** pass then resolves the dispute. It runs a fresh, independent resolution. If that pass and the auditor agree with high confidence, their outcome is ruled. If they still disagree after 24 hours, the market resolves INVALID.

## INVALID

INVALID pays every YES share at the final mark and every NO share at one minus the final mark. The final mark is time-weighted, so a last-minute trade cannot set it.
