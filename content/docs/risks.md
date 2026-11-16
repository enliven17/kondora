---
title: Risks
description: What can go wrong, plainly.
order: 10
section: Reference
---

# Risks

Kondora runs on Solana devnet with test USDC. Treat everything here as an experiment.

- **Leverage amplifies losses.** At 5x, a move of about 16% against you at the mark price liquidates the position, and you lose most of your margin.
- **AI settlement can be wrong.** Deterministic sources come first, every council verdict needs strong agreement, and an independent auditor can challenge. Even so, models make mistakes, and source websites can change or go offline.
- **INVALID outcomes** pay the final mark, not your entry price.
- **Smart contract risk.** The program has been reviewed and tested, but it has not been formally audited.
- **Rollup availability.** Trading depends on the MagicBlock Ephemeral Rollup. If it is unavailable, positions stay safe on their last committed state and can be settled on Solana.
- **Operator keys.** On devnet, one operator holds the creator, oracle, auditor and admin roles. A mainnet launch would need separate keys, a multisig for admin, and longer dispute windows.
