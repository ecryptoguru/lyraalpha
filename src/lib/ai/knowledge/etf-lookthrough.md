# ETF Lookthrough Intelligence Reference

This document explains how to interpret the ETF lookthrough data computed by the InsightAlpha AI platform. When an ETF has holdings data, the platform decomposes it into factor exposure, concentration metrics, behavioral profile, and constituent-level scores. Use this to deliver ETF analysis that goes beyond the headline numbers.

---

## Factor Exposure Interpretation

The platform computes factor tilts for each ETF based on its actual holdings:

### Factor Dimensions
- **Growth tilt (0-1)**: Exposure to high-revenue-growth, high-P/E stocks. Tilt >0.6 = growth-heavy. Tilt <0.3 = value-leaning.
- **Value tilt (0-1)**: Exposure to low-P/E, high-dividend, high-book-value stocks. Tilt >0.6 = deep value. Tilt <0.3 = growth-leaning.
- **Momentum tilt (0-1)**: Exposure to stocks with strong recent price performance. Tilt >0.6 = momentum-heavy (performs well in trends, poorly in reversals).
- **Low Volatility tilt (0-1)**: Exposure to stable, low-beta stocks. Tilt >0.6 = defensive. Tilt <0.3 = high-beta.

### Factor-Regime Alignment
This is the critical analytical insight: an ETF's factor tilt determines how it behaves in different regimes.

| Factor Tilt | RISK_ON | DEFENSIVE | RISK_OFF |
|:-----------|:--------|:----------|:---------|
| Growth-heavy | Outperforms | Underperforms | Significantly underperforms |
| Value-heavy | Moderate | Outperforms | Less downside |
| Momentum-heavy | Strong in trends | Whipsaw risk | Severe drawdowns |
| Low-Vol heavy | Lags | Outperforms | Best relative performance |

**Key insight**: An ETF labeled "Growth" might actually have significant value exposure if its top holdings have matured. Always check the ACTUAL factor tilt, not the label.

---

## Concentration Metrics

### HHI (Herfindahl-Hirschman Index)
- **HHI < 500**: Well-diversified. No single holding dominates.
- **HHI 500-1500**: Moderate concentration. Top holdings have meaningful impact.
- **HHI > 1500**: Highly concentrated. The ETF behaves more like its top 5-10 holdings than a diversified basket.
- **Context**: S&P 500 (SPY) has HHI ~800-1000 due to mega-cap tech concentration. This means even "the market" is concentrated.

### Top-5 Weight
- **Top-5 < 20%**: Genuinely diversified.
- **Top-5 20-40%**: Moderate concentration. Acceptable for sector/thematic ETFs.
- **Top-5 > 40%**: You're essentially buying 5 stocks with an expense ratio wrapper. Analyze the top holdings individually.

### Hidden Concentration Risk
Even when HHI looks reasonable, check for:
- **Supply chain overlap**: If 3 of the top 10 holdings are in the same supply chain (e.g., AAPL, AVGO, TSM), a single disruption affects all three.
- **Sector concentration**: A "diversified" ETF with 35% tech exposure is making a sector bet.
- **Geographic concentration**: International ETFs may be concentrated in 2-3 countries despite holding 50+ stocks.

---

## Behavioral Profile

The platform classifies each ETF into a behavioral profile based on its factor DNA and historical behavior:

### Profile Types
- **Growth-Sensitive**: Outperforms when growth expectations rise, underperforms when they fall. High correlation with NASDAQ. Examples: QQQ, VGT, XLK.
- **Rate-Sensitive**: Moves inversely with interest rates. Includes REITs, utilities, long-duration bonds. Examples: VNQ, XLU, TLT.
- **Defensive**: Low beta, outperforms in drawdowns, lags in rallies. Examples: XLP, XLV, USMV.
- **Cyclical**: Tied to economic cycle. Outperforms in expansion, underperforms in contraction. Examples: XLI, XLF, XLE.
- **Commodity-Linked**: Driven by commodity prices more than equity market. Examples: GLD, SLV, USO, DBA.
- **Balanced**: No dominant factor tilt. Broad market exposure. Examples: SPY, VTI, VOO.

### Using Behavioral Profile
The behavioral profile tells you what DRIVES the ETF's returns. When analyzing an ETF:
1. Identify its behavioral profile
2. Check if the current regime favors that profile
3. If regime and profile are misaligned, the ETF is swimming against the current — flag this

---

## Constituent-Level Score Analysis

When the platform has holdings data, it computes aggregate engine scores from the constituents:

### Lookthrough Scores vs ETF-Level Scores
- **ETF-level scores**: Computed from the ETF's own price/volume data. Reflects how the ETF trades.
- **Lookthrough scores**: Computed from the weighted average of constituent scores. Reflects the underlying health.
- **Divergence is the signal**: If ETF-level T:75 but lookthrough T:55, the ETF's price trend is being driven by a few strong holdings while most constituents are weaker. This is fragile — a rotation out of those leaders would break the ETF's trend.

### Constituent Score Distribution
- **Tight distribution** (most holdings score 60-70): Broad-based strength. Sustainable.
- **Wide distribution** (some at 80+, many at 40-): Narrow leadership. The ETF's aggregate score is misleading. Analyze the leaders separately.
- **Bimodal distribution**: Two clusters of holdings behaving differently. Often signals a sector rotation happening within the ETF.

---

## Expense Ratio Impact

### Compounding Cost
Always quantify the long-term cost of the expense ratio:
- **0.03% (e.g., VOO)**: ₹3,000/year on ₹1 Cr. ₹30,000 over 10 years. Negligible.
- **0.20% (e.g., sector ETFs)**: ₹20,000/year on ₹1 Cr. ₹2L over 10 years. Acceptable for specialized exposure.
- **0.50-0.75% (e.g., thematic/active ETFs)**: ₹50-75K/year on ₹1 Cr. ₹5-7.5L over 10 years. Must justify with alpha or unique exposure.
- **>1.0% (e.g., leveraged/complex ETFs)**: ₹1L+/year on ₹1 Cr. Significant drag. Only justified for tactical, short-term positions.

### Expense Ratio vs Tracking Error
A low expense ratio with high tracking error may cost more than a higher expense ratio with tight tracking. The total cost of ownership = expense ratio + tracking error + bid-ask spread.

---

## ETF Comparison Framework

When comparing ETFs, use this hierarchy:
1. **Behavioral profile**: Are they in the same category? Comparing QQQ to XLP is comparing growth to defensive — not a fair comparison.
2. **Factor alignment**: Which ETF's factor tilt better matches the current regime?
3. **Concentration risk**: Which is more diversified? Higher concentration = higher single-stock risk.
4. **Lookthrough health**: Which has healthier constituent scores?
5. **Cost**: All else equal, lower expense ratio wins.
6. **Liquidity**: Higher Liquidity score = tighter spreads, better execution.
