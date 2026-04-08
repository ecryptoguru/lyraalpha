---
title: "Shock Simulator"
description: "How the Shock Simulator replays historical crash scenarios against your portfolio — and what Lyra's interpretation adds."
category: portfolio
xpReward: 20
estimatedTime: "2 minutes"
badgeContribution: stress-tester
---

## Shock Simulator

The Shock Simulator stress-tests your portfolio against historical market shocks. It's not a prediction — it's a structured way to understand where your current holdings are vulnerable.

### How It Works

When you run a scenario, the platform doesn't use AI to guess the outcome. It runs a **deterministic replay engine** first:

1. **Direct replay** — if the asset has price history from the scenario window, the engine replays the actual drawdown data
2. **Hybrid proxy** — if direct history is unavailable, the engine builds a proxy using correlated assets that *did* trade during that period

Only after this replay is complete does Lyra step in — not to invent numbers, but to interpret the structured output: what drove the losses, which assets held up, what the scenario reveals about your portfolio's regime sensitivity.

### Available Scenarios

Scenarios cover major historical shock events: equity crashes, rate spikes, commodity shocks, liquidity crises. Each scenario includes:

- Timeline and trigger description
- Transmission mechanism (how it spread across asset classes)
- Dominant macro drivers
- Per-asset impact with rationale

### What Lyra Adds

Lyra's role in the Shock Simulator is interpretation, not computation. She reads the replay output and provides:

- **Pressure points** — which holdings contributed most to drawdown
- **Resilience themes** — what held up and why
- **Hedge framing** — non-prescriptive observations on what could offset the exposure
- **Regime context** — how the current regime compares to the shock scenario's starting conditions

### Credit Cost

Shock Simulator uses the same multi-asset pricing as Compare Assets: **5 credits for the first asset, 3 per additional**. Available on ELITE and ENTERPRISE plans.

## Quick Check

- [ ] The Shock Simulator uses AI to estimate how your assets would perform in a scenario. | False — the engine runs a deterministic replay first; Lyra interprets the structured results, not guessing.
- [ ] Shock Simulator results are predictions of future crash performance. | False — they show how current holdings would have performed in a historical scenario. Useful for understanding vulnerabilities, not forecasting.
- [x] Lyra's role in the Shock Simulator is to interpret the replay engine's structured output. | Correct — Lyra reads pressure points, resilience themes, and hedge framing from the deterministic results.
- [x] Shock Simulator uses the same multi-asset pricing as Compare Assets. | Correct — 5 credits for the first asset, 3 per additional asset.
