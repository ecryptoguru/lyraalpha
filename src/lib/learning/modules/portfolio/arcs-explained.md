---
title: "ARCS — Regime Compatibility Score"
description: "How the Asset-Regime Compatibility Score tells you whether each holding is suited to the current macro environment."
category: portfolio
xpReward: 20
estimatedTime: "1.5 minutes"
badgeContribution: portfolio-builder
---

## ARCS — Asset-Regime Compatibility Score

Knowing an asset's score is one thing. Knowing whether that asset is *suited to the current environment* is another. ARCS answers the second question.

### What ARCS Measures

ARCS is a compatibility score between an asset's characteristics and the current market regime. It answers: **"Given where the market is right now, is this asset in its sweet spot or fighting the current?"**

A high ARCS means the asset's factor profile (trend, momentum, liquidity, volatility) aligns well with what the current regime rewards.

A low ARCS means there's a mismatch — the asset may have decent scores but is structurally out of phase with the macro environment.

### Why This Matters

Two assets can have similar Trend scores but very different ARCS. A high-beta growth stock and a defensive dividend payer might both trend positively — but in a risk-off regime, the growth stock's ARCS will be significantly lower.

ARCS helps you answer: "Is this a good time to hold this, not just is this a good asset?"

### ARCS in Portfolio Context

On the Portfolio page, ARCS is shown per holding. When multiple holdings have low ARCS simultaneously, the portfolio health score reflects regime misalignment — the fragility index rises.

This is the signal to ask Lyra for a regime-aware portfolio review.

### ARCS vs Score

| | Score | ARCS |
|---|---|---|
| **What it measures** | Asset quality & momentum | Fit with current regime |
| **Changes with** | Price action, on-chain data | Regime shifts |
| **Good use** | Ranking assets | Timing and allocation decisions |

## Quick Check

- [ ] A high Trend score always means a high ARCS. | False — ARCS depends on regime fit, not just score level. A trending asset can have low ARCS if the regime doesn't favour its factor profile.
- [x] ARCS can change even when an asset's scores haven't moved. | Correct — if the market regime shifts, ARCS recalculates against the new environment.
- [x] Two assets with similar Trend scores can have very different ARCS values. | Correct — a high-beta growth stock and a defensive dividend payer score very differently on regime fit even if both trend positively.
- [ ] ARCS is only available on Elite and Enterprise plans. | False — ARCS is visible across all plans as part of the portfolio and asset analysis surfaces.
