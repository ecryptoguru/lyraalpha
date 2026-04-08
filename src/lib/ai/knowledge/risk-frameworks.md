# Risk Frameworks & Analytical Reference

This document provides risk assessment frameworks, metric interpretation guidance, and asset-type-specific risk profiles for the LyraAlpha AI platform. Use this to deliver risk-aware analysis grounded in established institutional methodology.

---

## Core Risk Metrics

### Sharpe Ratio
Measures risk-adjusted return: how much excess return per unit of total risk.
- **Formula**: (Portfolio Return - Risk-Free Rate) / Standard Deviation of Portfolio Returns
- **Interpretation**: >1 is acceptable, >2 is strong, >3 is exceptional. Most mutual funds target 0.5-1.5.
- **Limitation**: Penalizes upside volatility equally with downside. An asset that occasionally spikes upward gets the same penalty as one that crashes — use Sortino Ratio for asymmetric returns.
- **Platform context**: When comparing assets on LyraAlpha AI, a high Trend score + low Volatility score combination implies a favorable risk-adjusted profile (Sharpe-like).

### Sortino Ratio
Like Sharpe but only penalizes downside volatility.
- **Formula**: (Portfolio Return - Risk-Free Rate) / Downside Deviation
- **When to use**: Better for assets with positive skew (crypto, growth stocks) where upside spikes shouldn't be treated as "risk."
- **Platform context**: For crypto assets where volatility is inherently high but often to the upside, Sortino provides a fairer risk-adjusted view than Sharpe.

### Alpha (Jensen's Alpha)
Excess return above what the market delivered, adjusted for risk taken (beta).
- **Formula**: R_portfolio = R_riskfree + Beta × (R_market - R_riskfree) + Alpha
- **Positive alpha**: Manager or strategy outperformed on a risk-adjusted basis.
- **Negative alpha**: Underperformed after accounting for market exposure.
- **Platform context**: The platform doesn't directly compute alpha, but the ARCS compatibility score captures a similar concept — an asset with high ARCS is "in alpha" relative to the current regime.

### Beta
Sensitivity to market movements. Beta of 1.0 = moves with the market.
- **>1.0**: Amplifies market moves. High-beta assets outperform in bull markets, underperform in bear markets.
- **<1.0**: Dampens market moves. Lower risk but lower upside capture.
- **Negative beta**: Moves opposite to market (rare — gold sometimes exhibits this).
- **Platform context**: The Volatility engine captures a related concept. High Volatility score + RISK_OFF regime = high-beta asset in hostile environment.

### Maximum Drawdown
Largest peak-to-trough decline in a given period.
- **Why it matters**: Tells you the worst-case scenario you would have experienced. A -50% drawdown requires a +100% return to recover.
- **Thresholds**: <10% is conservative, 10-20% is moderate, 20-40% is aggressive, >40% is speculative.
- **Platform context**: Assets with high Volatility scores and low Liquidity scores are more susceptible to deep drawdowns, especially during regime transitions.

### CAGR (Compound Annual Growth Rate)
Annualized return assuming reinvestment. Used for Indian Mutual Fund analysis.
- **Formula**: (Ending Value / Beginning Value)^(1/Years) - 1
- **Risk-free rate for India**: 6.5% (used as benchmark for Sharpe calculation)
- **Platform context**: CAGR alone is misleading without risk context. A fund with 15% CAGR and 25% max drawdown is very different from one with 15% CAGR and 10% max drawdown.

---

## Regime-Based Risk Framework

### How Risk Changes Across Regimes

| Regime | Primary Risk | Volatility Behavior | Liquidity Behavior | What to Watch |
|:-------|:------------|:--------------------|:-------------------|:-------------|
| **STRONG_RISK_ON** | Complacency, crowded positioning | Suppressed — but this IS the risk (volatility paradox) | Deep, stable | Signs of breadth narrowing. When fewer stocks drive the rally, the regime is fragile. |
| **RISK_ON** | Momentum exhaustion, sector rotation | Normal range | Healthy | Trend score deceleration. Watch for Momentum divergence from Trend. |
| **NEUTRAL** | Directionless whipsaw, false signals | Rising from low levels | Adequate but thinning | Cross-sector correlation. If correlations spike, rotation may turn into broad selloff. |
| **DEFENSIVE** | Accelerating deterioration, liquidity withdrawal | Elevated and rising | Deteriorating — bid-ask spreads widening | Credit spreads and VIX term structure. Defensive can quickly become Risk-Off. |
| **RISK_OFF** | Systemic contagion, forced selling | Extreme — correlations approach 1.0 | Severely impaired | Policy response signals (Fed/RBI intervention). Recovery usually starts when fear peaks. |

### Regime Transition Risk

The most dangerous period is during regime transitions, not within stable regimes.

- **RISK_ON → DEFENSIVE**: High-beta assets that thrived in RISK_ON get re-priced rapidly. ARCS compatibility drops sharply for growth/momentum names. This transition often happens faster than DEFENSIVE → RISK_ON.
- **DEFENSIVE → RISK_OFF**: Liquidity dries up. Assets that seemed "cheap" get cheaper. Correlation spikes mean diversification fails when you need it most.
- **RISK_OFF → NEUTRAL**: Recovery is usually violent and narrow. The first assets to rally are often the highest-beta names that fell the most — but this doesn't mean they're the safest.
- **Divergence signals**: When Tactical regime differs from Structural regime, it often signals a transition in progress. Tactical RISK_OFF + Structural RISK_ON = likely a pullback within a healthy trend. Tactical RISK_ON + Structural DEFENSIVE = likely a bear market rally.

---

## Asset-Type Risk Profiles

### Stocks
- **Earnings risk**: Quarterly earnings can move stocks 10-20% in a day. Watch for earnings dates.
- **Sector concentration**: A stock's risk is partly determined by its sector's regime. Tech in DEFENSIVE regime carries sector headwind.
- **Fundamental floor**: Stocks with strong fundamentals (high Trust, positive cash flow) tend to recover faster from drawdowns.
- **India-specific**: FII outflows can create sudden liquidity shocks in mid-cap Indian stocks. RBI policy decisions have outsized impact on banking and financial stocks.

### Crypto
- **Structural risk**: Crypto is a network, not a company. There are no earnings, no cash flow, no regulatory backstop. Risk assessment must be completely different from equities.
- **Volatility IS the risk**: A Volatility score of 70 for crypto means elevated risk, period. Do not frame high volatility as "opportunity" — frame it as risk that must be understood and managed.
- **Correlation risk**: In stress events, crypto correlates with risk assets (tech stocks) despite the "digital gold" narrative. Diversification benefit is unreliable during crises.
- **Liquidity risk**: Even major crypto assets can experience flash crashes due to liquidation cascades in leveraged markets. Liquidity scores can change rapidly.
- **Regulatory risk**: Ongoing regulatory uncertainty is a permanent risk factor for all crypto assets. This should always be mentioned.
- **What data does NOT tell us**: On-chain metrics, developer activity, governance votes — these are not captured in the platform's scoring. Acknowledge data limitations explicitly.

### ETFs
- **Tracking error**: ETFs may deviate from their index. Expense ratios compound over time.
- **Sector/Factor concentration**: A "diversified" ETF may still have heavy sector concentration (e.g., S&P 500 is ~30% tech).
- **Liquidity layers**: ETF liquidity depends on both the ETF's own trading volume AND the liquidity of underlying holdings. In stress, underlying illiquidity can cause ETF discounts.
- **Leverage risk**: Leveraged ETFs (2x, 3x) suffer from volatility decay. They are designed for single-day holding periods, not long-term investment.

### Mutual Funds (India)
- **NAV lag**: MF NAVs are published end-of-day. Analysis is inherently T+1.
- **Category drift**: Some funds change their investment style over time. Check if current holdings match the stated category.
- **AUM risk**: Very large AUM can limit a fund's ability to generate alpha in small/mid-cap space.
- **Exit load**: Redemption within 1 year typically carries 1% exit load. This is a liquidity consideration.
- **SIP context**: SIP (Systematic Investment Plan) investments benefit from rupee cost averaging. Short-term NAV fluctuations matter less for SIP investors than for lump-sum investors.
- **Direct vs Regular**: Direct plans save 0.5-1.5% annually in commissions. Always compare within the same plan type.

### Commodities
- **Supply-driven**: Unlike stocks, commodity prices are heavily driven by supply shocks (weather, geopolitics, OPEC decisions).
- **Contango/Backwardation**: Commodity futures can be in contango (future price > spot) or backwardation. This affects rolling costs for commodity ETFs and futures-based exposure.
- **USD correlation**: Most commodities are priced in USD. Dollar strength = commodity headwind, dollar weakness = commodity tailwind.
- **Seasonal patterns**: Agricultural commodities have seasonal cycles (planting, harvest). Energy commodities have seasonal demand (heating, driving seasons).
- **Safe haven dynamics**: Gold tends to benefit from RISK_OFF regimes and falling real yields. Oil tends to suffer from demand destruction in RISK_OFF.

---

## Cross-Sector Correlation Framework

The platform tracks how sectors move relative to each other.

### Correlation Regimes
- **Low Correlation (Dispersed)**: Sectors moving independently. Stock selection and sector rotation matter. Good for active strategies.
- **Rising Correlation**: Sectors beginning to move together. Often signals a macro shift. Diversification benefit declining.
- **High Correlation (Converged)**: All sectors moving in lockstep. Macro forces dominate. Individual stock analysis less relevant — "macro is king."
- **Crisis Correlation**: Correlations approach 1.0. Everything falls together. This is when diversification fails and regime detection becomes critical.

### What Dispersion Tells You
- **High sector dispersion** = there are clear winners and losers. Sector positioning matters.
- **Low sector dispersion** = the market is moving as a monolithic block. Macro regime is the dominant factor.

---

## Position Sizing Risk Principles

While the platform does not recommend specific position sizes, these principles inform risk-aware analysis:

1. **Volatility-adjusted sizing**: Higher Volatility score = smaller position. A crypto asset with Volatility score 80 should be sized much smaller than a utility stock with Volatility score 25.
2. **Regime-adjusted conviction**: Strong ARCS compatibility + favorable regime = higher conviction. Poor ARCS + hostile regime = lower conviction regardless of other metrics.
3. **Liquidity constraints**: Never size a position where your order would be a meaningful percentage of daily volume. Low Liquidity score = hard cap on position size.
4. **Correlation awareness**: Holding 5 high-beta tech stocks is NOT diversification. Check cross-asset correlations before concluding a portfolio is diversified.

---

## Red Flags and Warning Signals

Always surface these when present in the data:

- **Momentum-Trend divergence**: High Trend but falling Momentum = trend may be exhausting.
- **Volume-Price divergence**: Price rising but Sentiment falling = rally not confirmed by flow.
- **Regime-Compatibility mismatch**: Strong asset scores but Poor regime fit = swimming against the current.
- **Volatility compression**: Very low Volatility score after a period of high volatility = calm before the storm.
- **Liquidity deterioration**: Falling Liquidity score in any regime = execution risk increasing.
- **Breadth narrowing**: If market regime is RISK_ON but breadth component is declining, the regime is fragile and transition risk is elevated.
