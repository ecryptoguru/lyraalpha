---
title: "What is Signal Strength?"
slug: "what-is-signal-strength"
category: "signals"
xpReward: 15
estimatedTime: "1.5 minutes"
prerequisite: null
badgeContribution: "signal-reader"
isEliteOnly: false
---

## Key Concept

**Signal Strength** is the core analytical output of InsightAlpha AI. It distills millions of data points across price action, fundamentals, network activity, and market regimes into a single, unified score (0-100) and directional label. 

It is *not* a price prediction. It is a measurement of **current systemic conviction** behind an asset's price movement.

## How It's Built: The 4 Layers

The Signal Strength engine processes data through four distinct layers before outputting a final score:

1. **DSE Composite**: The foundation. A weighted blend of Trend, Momentum, Volatility (inverted), Sentiment, Liquidity, and Trust scores.
2. **Regime Alignment (ARCS)**: The macro filter. An asset might have strong momentum, but if it behaves like a risk-on asset during a defensive market regime, its score is penalized.
3. **Fundamental Quality**: The structural check. Uses Lyra's deep analysis to factor in valuation, growth, profitability, and (for crypto) on-chain health and tokenomics.
4. **Score Dynamics**: The trajectory layer. Evaluates whether the asset's underlying scores are accelerating, decelerating, or breaking away from their sector peers.

These layers are weighted differently depending on the asset class (e.g., Fundamentals matter more for stocks than crypto, while Network Activity replaces Fundamentals for crypto).

## Reading the Labels

The final 0-100 score is mapped to a directional label:

- **Strong Bullish (75+)**: High conviction. Multiple engines agree, macro regime is supportive, and momentum is accelerating.
- **Bullish (60-74)**: Positive bias. The prevailing current is upward, but may lack consensus across all engines or face slight regime headwinds.
- **Neutral (40-59)**: Mixed signals. Engines are conflicting, the asset is range-bound, or it's transitioning between states.
- **Bearish (25-39)**: Negative bias. Downward pressure is evident, supported by weakening fundamentals or trend breakdowns.
- **Strong Bearish (0-24)**: High conviction downside. Severe structural weakness, broken trends, and negative momentum across the board.

## What It Does NOT Mean

- It is **not** a trading signal to buy or sell immediately.
- A "Strong Bullish" signal does **not** mean the price can't drop tomorrow due to macro news. It means the *structural conditions* are currently highly supportive of upward movement.
- A "Neutral" signal is **not** a "hold" recommendation; it simply means the engine detects no clear systemic edge in either direction right now.

## Quick Check

- [x] Signal Strength combines technical, fundamental, and regime data into one score. | Correct — it uses 4 distinct layers to build a composite view.
- [ ] A Strong Bullish signal means the asset is guaranteed to go up. | No — it measures current systemic conviction, not absolute future performance. Risk management is always required.
- [x] The engine penalizes assets that fight the current market regime. | Yes — the Regime Alignment (ARCS) layer adjusts scores based on macro compatibility.
- [ ] Fundamentals are weighted exactly the same for stocks and crypto. | No — the engine uses asset-type-aware weighting (e.g., using Network Activity for crypto instead of traditional fundamentals).
