---
title: "Advanced MF Analysis"
slug: "mf-advanced-analysis"
category: "advanced"
xpReward: 20
estimatedTime: "2 minutes"
prerequisite: "style-drift-explained"
badgeContribution: null
isEliteOnly: true
---

## Key Concept

**Advanced Mutual Fund Analysis** goes beyond basic metrics (returns, expense ratio) to examine the structural integrity of a fund through three lenses: **Deep Lookthrough Analysis** (what does the fund actually own?), **Closet Indexing Detection** (is the manager earning their fee?), and **Cross-Fund Overlap** (are your multiple funds secretly the same bet?).

At this level, you're not asking "did the fund beat its benchmark?" — you're asking "what risks am I actually taking, and am I being compensated for them?"

## What It Means

- **Deep Lookthrough Analysis**: Decompose the fund's holdings into factor exposures, sector concentrations, and individual stock overlaps. A "diversified equity" fund might have 60% in financials and IT — that's a sector bet disguised as diversification. Look at the top 20 holdings' combined weight, the effective number of stocks (1/HHI), and sector deviation from the benchmark.

- **Closet Indexing Detection**: Compare the fund's Active Share, tracking error, and R-squared against its benchmark. A fund with Active Share below 60%, tracking error below 4%, and R-squared above 0.95 is likely a closet indexer — charging active fees for passive-like returns. The test: could you replicate 90% of this fund's returns with a cheap index fund?

- **Cross-Fund Overlap Matrix**: When you hold multiple funds, build an overlap matrix showing the percentage of common holdings between every pair. If Fund A and Fund B have 75% overlap, you're paying two expense ratios for essentially one portfolio. The goal is to identify which funds provide *incremental* diversification and which are redundant.

Advanced metrics to track:
- **Portfolio Turnover**: High turnover (>100%) means the manager is trading aggressively, generating transaction costs and potential tax events.
- **Cash Drag**: Funds holding >5% cash are creating a performance drag in rising markets.
- **Sharpe Ratio vs Peers**: Risk-adjusted returns compared to category peers, not just the benchmark.

## What It Does NOT Mean

- Advanced analysis does **not** mean you need to check these metrics daily. Quarterly review is sufficient — fund portfolios change slowly.
- Finding a closet indexer does **not** mean the fund will lose money. It means you're overpaying for what you're getting. The fix is simple: switch to a cheaper index fund.
- High portfolio turnover is **not** always bad. Some strategies (momentum, event-driven) require frequent trading. The question is whether the turnover generates enough excess return to justify the costs.

## Quick Check

- [x] Deep lookthrough analysis reveals the actual risk exposures hidden within a fund's holdings. | Correct — it decomposes the portfolio into factor, sector, and concentration exposures that the fund's label might not reveal.
- [ ] A fund with high Active Share is guaranteed to outperform its benchmark. | No — high Active Share means the manager is making different bets, which can lead to outperformance or underperformance. It measures differentiation, not skill.
- [x] Cross-fund overlap analysis helps identify redundant holdings across multiple funds. | Yes — if two funds have 75% overlap, holding both provides minimal diversification benefit while doubling your expense ratio exposure.
- [ ] Portfolio turnover above 100% is always a red flag. | Not always — some legitimate strategies require high turnover. The key question is whether the excess trading generates enough return to justify the transaction costs.
