---
title: "Score Dynamics & Momentum"
slug: "score-dynamics-explained"
category: "signals"
xpReward: 15
estimatedTime: "1.5 minutes"
prerequisite: "what-is-signal-strength"
badgeContribution: "signal-reader"
isEliteOnly: false
---

## Key Concept

A score of 75 is good. But a score of 75 that used to be 50 is vastly different from a score of 75 that used to be 95. 

**Score Dynamics** measures the *trajectory* of an asset's underlying metrics (Trend, Sentiment, Liquidity, etc.). It answers the crucial question: Is the asset improving, deteriorating, or stalling?

## The 3 Components of Dynamics

The Score Dynamics layer evaluates historical data (7-day to 30-day lookbacks) to calculate three specific vectors:

1. **Momentum (Velocity)**: The rate of change. A positive momentum means the score is rising; negative means it's falling.
2. **Acceleration (Change in Velocity)**: Is the momentum speeding up or slowing down? If a score is rising, but acceleration is deeply negative, the move is losing steam and likely to stall.
3. **Percentile Rank**: How does this asset's momentum compare to every other asset in the platform, and specifically to its sector peers? 

## What It Means

- **Improving Dynamics**: The asset's scores are rising, acceleration is positive, and it's outperforming its peer group. This provides a strong "tailwind" bonus to the final Signal Strength.
- **Deteriorating Dynamics**: Scores are falling or momentum is decelerating rapidly. Even if the current absolute score is high (e.g., an 80 Trend), deteriorating dynamics act as an early warning system that the structure is weakening.
- **Static Dynamics**: The data hasn't changed. The engine detects this and neutralizes the dynamics layer so it doesn't fabricate false momentum.

## The Peer Divergence Signal

The most powerful dynamic signal occurs when an asset's score momentum diverges from its peers. If the Tech sector's average sentiment is dropping, but a specific tech stock's sentiment is accelerating upward, the dynamics engine flags this as a high-conviction relative strength anomaly.

## Quick Check

- [x] Acceleration measures whether momentum is speeding up or slowing down. | Correct — it's the rate of change of the rate of change.
- [ ] An asset with a high Trend score will always have positive dynamics. | No — a high score can have negative momentum if it is currently dropping from an even higher peak.
- [x] Score dynamics compare an asset's trajectory against its sector peers. | Yes — the percentile rank component evaluates relative momentum within the peer group.
- [ ] If an asset's data hasn't changed in weeks, the dynamics engine will give it a high score. | No — the engine detects static data and neutralizes the dynamics output to prevent false signals.
