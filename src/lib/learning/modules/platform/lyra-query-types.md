---
title: "Lyra Query Types"
description: "Single-asset analysis, Compare, Shock Simulator — when to use each and how Lyra adapts."
category: platform
xpReward: 15
estimatedTime: "1 minute"
badgeContribution: lyra-user
---

## Lyra Query Types

Lyra operates in several distinct modes depending on what you ask. Understanding these helps you get the right depth without wasting credits.

### Single-Asset Analysis

The default mode. Ask about one asset — its score trajectory, regime alignment, what the signal means in context. Lyra assembles price context, knowledge base content, and any relevant memory notes.

**Example:** "Walk me through NVDA's current situation."

### Compare Assets (Elite / Enterprise)

Ask Lyra to compare 2–4 assets side by side. Lyra runs a premium workflow that synthesises scores, regime fit, and divergence signals across all assets simultaneously. Costs 5 credits for the first asset + 3 per additional.

**Example:** "Compare Bitcoin, Ethereum, and SOL right now."

### Shock Simulator (Elite / Enterprise)

Ask Lyra to stress-test your portfolio or specific assets against a historical scenario. The platform runs a deterministic replay engine first, then Lyra interprets the results — she's reading structured data, not guessing.

**Example:** "Run a 2020 COVID crash scenario on my portfolio."

### General Market Questions

Regime overviews, sector rotation, macro context — no asset required. Lyra pulls from the knowledge base and current regime data.

**Example:** "What does the current risk-off regime mean for commodities?"

## Quick Check

- [ ] Compare Assets runs multiple separate queries, one per asset. | False — it's a single premium workflow that synthesises all assets together in one pass.
- [x] In Shock Simulator, the platform runs a deterministic replay engine before Lyra interprets the results. | Correct — Lyra reads structured replay output, not guessing from scratch.
- [x] General market questions (no specific asset) are valid Lyra queries. | Yes — Lyra pulls from the knowledge base and current regime data for broad market questions.
- [ ] Shock Simulator is available on all plans. | No — Shock Simulator requires ELITE or ENTERPRISE.
