---
title: "Portfolio Stress Testing"
slug: "stress-testing-basics"
category: "portfolio"
xpReward: 20
estimatedTime: "2 minutes"
prerequisite: "monte-carlo-explained"
badgeContribution: "stress-tester"
isEliteOnly: true
---

## Key Concept

While a Monte Carlo simulation uses math to project *theoretical* future risks, a **Stress Test** uses brutal reality. It asks: "If a specific, historical market crash happened exactly the same way starting tomorrow, what would happen to my specific portfolio?"

This reveals hidden vulnerabilities, concentration risks, and the true cost of illiquidity during a panic.

## Historical Crash Scenarios

The engine applies the exact market dynamics of historical crises to your current holdings:

1. **The 2008 Global Financial Crisis (Systemic Credit Collapse)**: Severe, prolonged drawdown across almost all equities. Only the highest quality, defensive assets survived.
2. **The 2020 COVID-19 Crash (Liquidity Shock)**: The fastest bear market in history. Everything correlated to 1.0. Cash and treasuries were the only immediate safe havens. 
3. **The 2022 Inflation Shock (Rate Hike Cycle)**: The death of the 60/40 portfolio. Both stocks and bonds fell simultaneously as interest rates spiked.
4. **The 2000 Dot-Com Bust (Tech Bubble Collapse)**: Massive destruction in high-beta, unprofitable tech, while value and defensive sectors remained relatively insulated.

## What It Reveals

- **Asset Breakdown**: The stress test doesn't just give you a total portfolio loss; it breaks down the exact drawdown for every single asset you hold under that specific scenario.
- **The "Best" and "Worst" Offenders**: You will immediately see which asset is your biggest liability during a liquidity shock, and which asset acts as your strongest anchor.
- **False Diversification**: You might think you are diversified holding Tech, Crypto, and Consumer Discretionary. A stress test of the 2022 Inflation Shock will show all three collapsing together, revealing that you actually hold highly correlated risk.

## Lyra Hedging Analysis

The most powerful aspect of the Stress Test is the **Lyra Synthesis**. Once the test runs, Lyra analyzes the specific vulnerabilities exposed in your portfolio and provides actionable hedging recommendations. 

If you get crushed in the Inflation Shock scenario, Lyra will suggest adding specific commodities, TIPS, or defensive sectors to plug that specific hole.

## Quick Check

- [x] A Stress Test applies the dynamics of specific historical crashes to your current holdings. | Correct — it uses empirical history rather than theoretical math.
- [ ] If my portfolio survives the 2008 GFC scenario, it will survive the 2022 Inflation scenario. | No — different crashes expose entirely different vulnerabilities (e.g., credit risk vs. interest rate risk).
- [x] Stress tests are excellent at exposing "false diversification" where assets you thought were independent actually crash together. | Yes — correlation convergence is a key finding in stress tests.
- [ ] Lyra's hedging analysis tells you exactly when the next crash will happen. | No — Lyra analyzes your structural vulnerabilities and suggests hedges; it does not predict crash timing.
