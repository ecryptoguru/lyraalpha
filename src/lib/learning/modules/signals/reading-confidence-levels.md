---
title: "Reading Confidence Levels"
slug: "reading-confidence-levels"
category: "signals"
xpReward: 15
estimatedTime: "1 minute"
prerequisite: "what-is-signal-strength"
badgeContribution: "signal-reader"
isEliteOnly: false
---

## Key Concept

Every Signal Strength label (e.g., "Bullish") is paired with a **Confidence Level** (High, Medium, or Low). While the signal tells you the *direction*, the confidence level tells you how much you should *trust* that direction.

A "Low Confidence Bullish" signal is vastly different from a "High Confidence Bullish" signal, and treating them the same is a common analytical mistake.

## How Confidence is Calculated

The confidence score (0-100%) is derived from three primary factors:

1. **Engine Agreement (35%)**: Do the sub-engines agree? If Trend is Bullish, but Momentum is Bearish and Sentiment is Neutral, the agreement is low. If all engines point the same way, agreement is high.
2. **Data Completeness (35%)**: Do we have a full historical dataset? A newly listed ETF or a token with missing fundamental data will have lower confidence than a 20-year-old stock with complete metrics.
3. **Regime Confidence (30%)**: How clear is the current market regime? If the macro environment is transitioning chaotically, the signal confidence is penalized because the backdrop is unstable.

*Note: If the engines reach a "Neutral" consensus, the confidence is capped at Medium. It is impossible to have "High Confidence" in a non-directional state.*

## What It Means

- **High Confidence**: The data is robust, multiple independent engines (trend, momentum, fundamentals) are confirming the same direction, and the macro regime is clear. This is a strong structural setup.
- **Medium Confidence**: The primary signal is valid, but there is friction. Perhaps momentum is fading against the trend, or the asset lacks complete fundamental data. Proceed with standard caution.
- **Low Confidence**: The signal is weak or fractured. The asset might be flashing "Bullish" because of a sudden price spike, but underlying liquidity is poor and engines disagree. **Treat Low Confidence signals as noise until they prove otherwise.**

## Quick Check

- [x] A Low Confidence signal suggests the sub-engines might be disagreeing with each other. | Correct — engine agreement is a major component of the confidence score.
- [ ] If an asset is "Neutral", it can still have High Confidence. | No — Neutral signals are capped at Medium confidence because they lack directional conviction.
- [x] Missing fundamental data will lower the confidence level of a signal. | Yes — data completeness makes up 35% of the confidence calculation.
- [ ] You should trade a "Low Confidence Bullish" signal exactly the same as a "High Confidence Bullish" one. | No — Low Confidence indicates structural friction or missing data, requiring much tighter risk management.
