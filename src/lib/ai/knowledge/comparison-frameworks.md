# Asset Comparison Frameworks

This document provides structured frameworks for comparing assets — the most common multi-asset query type on the platform. Use these frameworks to deliver structured, data-grounded comparisons instead of generic "on one hand / on the other hand" responses.

---

## Same-Class Comparison (e.g., NVDA vs AMD, BTC vs ETH)

### Framework: Score-by-Score with Verdict
Compare each engine score dimension, then synthesize into a verdict.

| Dimension | Asset A | Asset B | Edge | Why It Matters |
|:----------|:--------|:--------|:-----|:---------------|
| Trend | T:82 | T:68 | A | Stronger structural uptrend |
| Momentum | M:58 | M:72 | B | Better acceleration |
| Volatility | V:72 | V:55 | B | Lower risk per unit of exposure |
| Liquidity | L:45 | L:68 | B | Better execution, less slippage |
| Trust | Trust:71 | Trust:65 | A | Higher governance quality |
| Signal Strength | 74 | 68 | A | Stronger composite signal |

### Synthesis Rules
- Count the "edges" but weight them by importance for the current regime
- In RISK_ON: Trend and Momentum edges matter most
- In DEFENSIVE: Volatility and Liquidity edges matter most
- Always identify the KEY DIFFERENTIATOR — the single dimension that most separates the two assets
- State a clear verdict: "Asset A is the stronger technical setup, but Asset B offers better risk-adjusted positioning for the current regime"

---

## Cross-Class Comparison (e.g., NVDA vs BTC, SPY vs Gold)

### Framework: Regime Compatibility First
Cross-class comparisons are fundamentally about regime fit, not score-by-score comparison.

1. **Regime alignment**: Which asset fits the current regime better? Use ARCS compatibility.
2. **Role in portfolio**: These assets serve different functions. A stock is a growth engine; gold is a hedge; crypto is a high-beta speculative allocation. Compare within their roles.
3. **Correlation**: Are they correlated or diversifying? If both move together in stress, holding both doesn't reduce risk.
4. **Risk budget**: Compare the volatility-adjusted exposure. $10K in a V:72 stock ≠ $10K in a V:35 bond ETF in terms of risk contribution.

### Key Rule
Never compare cross-class assets as if they're substitutes. Frame the comparison as: "Given the current regime, which asset better serves [growth / income / hedging / diversification]?"

---

## ETF vs ETF Comparison

### Framework: Lookthrough Decomposition
1. **Factor DNA comparison**: Which ETF's factor tilt better matches the current regime?
2. **Concentration comparison**: Which is more diversified? Higher concentration = higher single-stock risk.
3. **Constituent health**: Compare lookthrough scores — which ETF has healthier underlying holdings?
4. **Cost comparison**: Expense ratio difference compounded over 5-10 years.
5. **Behavioral profile**: Do they behave the same way in different regimes, or are they actually different exposures?

### Common Trap
Two ETFs in the same category (e.g., "Large Cap Growth") may have very different actual exposures. Always compare the ACTUAL factor DNA, not the label.

---

## MF vs MF Comparison (India)

### Framework: Risk-Adjusted Returns + Style Consistency
1. **Rolling returns** (3Y, 5Y): More meaningful than point-to-point. Which fund is more consistent?
2. **Category rank**: Where does each fund rank within its SEBI category?
3. **Style drift**: Has either fund drifted from its declared category? Check actual cap-weighted allocation.
4. **Expense ratio**: Direct plan comparison. Even 0.3% difference compounds significantly over 10+ years.
5. **AUM consideration**: For small/mid-cap funds, larger AUM = harder to generate alpha.
6. **Drawdown behavior**: Which fund fell less in the last correction? Max drawdown comparison reveals risk management quality.

---

## Commodity vs Commodity Comparison (e.g., Gold vs Silver, Oil vs Natural Gas)

### Framework: Macro Driver Decomposition
Commodities are driven by fundamentally different forces — compare the DRIVERS, not just the scores.

1. **Primary driver identification**: Gold = monetary/safe-haven demand. Silver = industrial + monetary hybrid. Oil = energy demand cycle + OPEC supply. Natural gas = weather + storage. Never compare two commodities as if they respond to the same inputs.
2. **Supply-demand regime**: Is the commodity in structural deficit or surplus? Deficit = price support even in risk-off. Surplus = price pressure even in risk-on.
3. **Regime fit by commodity type**:
   - **RISK_OFF**: Gold, silver (monetary), natural gas (defensive) outperform.
   - **RISK_ON**: Industrial metals, crude oil, agricultural commodities outperform.
   - Gold is the only commodity that reliably acts as a portfolio hedge — do not assume other commodities have the same property.
4. **Contango vs backwardation**: Contango (futures > spot) = negative roll yield, costs money to hold. Backwardation (futures < spot) = positive roll yield, rewarded for holding. Always factor this for ETF/futures-based commodity exposure.
5. **Volatility context**: V:70 for crude oil is normal during supply disruptions. V:70 for gold is extreme and signals a macro shock. Contextualize volatility scores within the commodity's own historical range.
6. **Currency link**: Most commodities are USD-denominated. Weak USD = commodity tailwind. Strong USD = commodity headwind. When comparing a commodity to a non-USD asset, adjust for currency impact.

### Verdict Structure for Commodities
State: (1) which macro regime each commodity fits, (2) what the current regime implies for each, (3) which is the better hedge vs growth allocation, (4) the regime-adjusted verdict.

---

## US Equity Fund Comparison (Index vs Active, or Active vs Active)

### Framework: Alpha Source Identification
1. **Index vs active**: For US large-cap, >85% of active funds underperform their benchmark over 10 years (S&P SPIVA data). Burden of proof is on active. Ask: what specific alpha source justifies the higher fee?
2. **Factor tilt**: Most "active" US funds are closet index funds with minor factor tilts. Check the actual factor DNA — if it's 0.9 correlated to SPY, it's effectively an expensive index fund.
3. **Expense ratio compounding**: 1% active vs 0.03% index = 0.97% annual drag. Over 20 years on $100K, this is ~$50K in foregone compounding at 8% base return.
4. **Rolling alpha**: Has the active fund generated consistent alpha or was it a single lucky period? 5-year rolling alpha is more meaningful than total return.
5. **Concentration vs diversification**: Concentrated active funds (20-40 holdings) have more alpha potential but higher tracking error. Diversified active (100+ holdings) rarely justify their fees.

---

## Temporal Comparison (Same Asset, Different Periods)

### Framework: Score Dynamics + Regime Context
When users ask "How has X changed?" or "Is X better now than last month?":

1. **Score trajectory**: Use Score Dynamics data (momentum, acceleration, percentile) to show direction of change.
2. **Regime context**: A score of 65 in RISK_ON means something different than 65 in RISK_OFF. Always contextualize within the regime.
3. **Percentile positioning**: Where is the current score relative to its own 90-day history? 90th percentile = near its best. 10th percentile = near its worst.
4. **Catalyst identification**: What changed? New earnings data? Regime shift? Sector rotation? Connect the score change to a specific driver.

---

## Comparison Output Structure

For any comparison, use this structure:

### Quick Verdict (2-3 sentences)
State the winner and why, with the key differentiating metric. Be decisive — no "it depends" without specifying what it depends on.

### Score Comparison Table
Use a markdown table showing side-by-side scores with "Edge" column.

### The Key Difference
Identify the single most important analytical difference. This is the insight that matters most for decision-making.

### Regime Context
How does the current regime affect this comparison? Would the verdict change in a different regime?

### Risk Comparison
Which asset has better risk-adjusted characteristics? Use Volatility, Liquidity, and max drawdown context.

---

## Anti-Patterns in Comparisons

- **Never give a "balanced" comparison without a verdict.** Users ask comparisons to make decisions. "Both are good" is not analysis.
- **Never compare only engine scores.** Include valuation, fundamentals, regime fit, and sector context.
- **Never ignore the regime.** A stock that looks better on scores may be worse if its factor profile fights the current regime.
- **Never compare absolute numbers across asset classes.** V:60 for crypto is normal; V:60 for a utility stock is alarming. Always contextualize within asset class norms.
- **Never forget correlation.** If two assets are 0.9 correlated, choosing between them matters less than if they're 0.3 correlated (where the choice has real diversification implications).
