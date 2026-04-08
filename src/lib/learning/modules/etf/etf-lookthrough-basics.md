---
title: "ETF Lookthrough Basics"
slug: "etf-lookthrough-basics"
category: "etf"
xpReward: 15
estimatedTime: "1 minute"
prerequisite: null
badgeContribution: "etf-transparency"
isEliteOnly: false
---

## Key Concept

When you buy an ETF, you're buying a wrapper around dozens or hundreds of individual stocks. **Lookthrough analysis** means peeling back that wrapper to understand what you actually own — the real companies, sectors, and risk factors hiding inside.

Most investors look at an ETF's name and assume they know what's inside. "S&P 500 ETF" sounds diversified, but the top 10 holdings might account for 35% of the fund. "Technology ETF" might have 40% in just two companies. The label is marketing — the holdings are reality.

## What It Means

Our ETF lookthrough engine cross-references each ETF's holdings against our stock universe to compute:

- **Factor Exposure** — Is this ETF tilted toward value, growth, momentum, quality, or size? A "broad market" ETF might secretly be a growth fund if its top holdings are all mega-cap tech.
- **Concentration Risk** — How top-heavy is the ETF? We measure this with HHI (Herfindahl-Hirschman Index) and top-N weight percentages. Higher concentration = less diversification.
- **Geographic Exposure** — Where are the underlying companies actually based and operating? A "US" ETF might have significant international revenue exposure.
- **Behavioral Profile** — Based on factor tilts, we classify each ETF as growth-sensitive, rate-sensitive, defensive-leaning, cyclical-tilted, or balanced. This tells you how the ETF is likely to behave in different market regimes.
- **Lookthrough Scores** — We compute weighted average scores (trend, momentum, volatility, etc.) from the constituent stocks. This gives you the ETF's "true" score based on what's inside, not just the wrapper's price action.

## What It Does NOT Mean

- Lookthrough analysis does **not** tell you whether an ETF is "good" or "bad." A concentrated ETF isn't inherently worse — it just carries different risk characteristics.
- Factor exposure is **not** static. As constituent stock prices change, the ETF's factor tilt shifts. What was a balanced ETF six months ago might be growth-heavy today.
- Lookthrough scores are **not** predictions. They reflect the current state of the underlying holdings, not where those holdings are going.
- This analysis covers **equity holdings only**. Bond ETFs, commodity ETFs, and other non-equity wrappers use different analytical frameworks.

## Quick Check

- [x] An ETF's lookthrough scores are computed from the weighted scores of its individual stock holdings. | Correct — we cross-reference holdings against our stock universe and compute weighted averages.
- [ ] A "diversified" ETF always has low concentration risk. | No — many broad-market ETFs are top-heavy. SPY's top 10 holdings can exceed 30% of the fund.
- [x] An ETF's behavioral profile tells you how it's likely to respond to different market regimes. | Yes — factor tilts determine whether an ETF behaves more like a growth, defensive, or cyclical instrument.
- [ ] Lookthrough analysis replaces the need to look at the ETF's own price chart. | No — lookthrough complements price analysis. The ETF's market price can diverge from NAV and has its own technical patterns.
