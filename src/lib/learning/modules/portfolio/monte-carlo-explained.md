---
title: "Monte Carlo Simulation"
slug: "monte-carlo-explained"
category: "portfolio"
xpReward: 20
estimatedTime: "2 minutes"
prerequisite: "portfolio-health-explained"
badgeContribution: "portfolio-builder"
isEliteOnly: false
---

## Key Concept

The **Monte Carlo Simulation** projects thousands of possible future paths for your portfolio to understand the *range of potential outcomes* and the probability of severe drawdowns over the next 12 months.

Crucially: It is **not** a price prediction. It is a probabilistic risk-assessment tool. 

## The RS-MGBM Engine

LyraAlpha AI uses an advanced mathematical model called **Regime-Switching Multivariate Geometric Brownian Motion (RS-MGBM)**. 

While traditional Monte Carlo simulations assume the market behaves the same way every day (constant volatility and drift), the RS-MGBM engine knows that markets have *regimes* (bull markets, bear markets, panics, transitions). 

1. **Regime Switching**: The simulation actively models the probability of the market shifting from "Risk-On" to "Risk-Off" over the next year. If a shift occurs in the simulation, volatility spikes, and asset correlations converge toward 1.0 (everything drops together).
2. **Multivariate**: It models how your specific assets interact with each other (covariance). If you hold stocks and bonds, the engine simulates how they normally move oppositely, but also simulates how they might crash together during an inflationary shock.

## Reading the Fan Chart

The output is a "fan chart" showing the spread of 5,000 simulated portfolio paths:

- **The Median Path (50th Percentile)**: The most likely outcome, right in the middle. Half the simulations performed better, half performed worse.
- **The Best Case (90th/95th Percentile)**: The top of the fan. What happens if the market stays in a strong Risk-On regime and volatility remains low.
- **The Worst Case (5th/10th Percentile)**: The bottom of the fan. This is the most critical metric. What happens if the regime shifts to a severe Risk-Off panic? This is your Value-at-Risk (VaR).

## Value-at-Risk (VaR) & Expected Shortfall (CVaR)

The simulation calculates your **95% VaR**. If your 12-month 95% VaR is -18%, it means that in 95% of the 5,000 simulated futures, your portfolio lost *less* than 18%. In the worst 5% of futures, you lost 18% or more. 

**Expected Shortfall (CVaR)** takes it a step further: it calculates the *average* loss of that worst 5%. If things go truly wrong, how bad does it get?

## Quick Check

- [x] A Monte Carlo simulation runs thousands of possible futures to show the probability of different outcomes. | Correct — it generates a distribution of possibilities, not a single prediction.
- [ ] The median path on the fan chart tells you exactly what your portfolio will be worth in 12 months. | No — it is a probability, not a guarantee.
- [x] LyraAlpha AI's simulation models the risk of the market regime changing (e.g., from Bull to Bear). | Yes — the Regime-Switching (RS) component actively models these shifts.
- [ ] A 95% VaR of -10% means you are guaranteed to never lose more than 10%. | No — it means there is a 5% probability you will lose *more* than 10% in extreme scenarios.
