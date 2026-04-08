# LyraAlpha AI: Platform Intelligence Reference

This document defines how the LyraAlpha AI platform works — its scoring engines, regime detection, compatibility logic, and Signal Strength system. Use this to explain platform-specific concepts to users accurately.

---

## Deterministic Score Engine (DSE)

The DSE normalizes raw market data into six independent 0-100 scores. These scores allow direct comparison across asset classes — Apple vs Bitcoin vs Gold on the same scale.

### Trend Score (0-100) — Structural Conviction
Measures whether an asset is in a genuine structural trend or just noise.
- **Components**: SMA200 distance (25%), SMA50 distance (20%), SMA alignment (15%), 20-day slope (20%), higher-low swing structure (20%)
- **80-100**: Strong structural uptrend with broad moving average alignment. High conviction.
- **60-79**: Moderate uptrend. Trend is intact but may lack full structural confirmation.
- **40-59**: Neutral or transitioning. No clear directional trend established.
- **20-39**: Downtrend developing. Moving averages deteriorating.
- **0-19**: Strong structural downtrend. All trend signals negative.
- **Key insight**: A high trend score during a RISK_OFF regime is actually a warning sign — the asset may be lagging the broader deterioration.

### Momentum Score (0-100) — Velocity & Acceleration
Measures speed and acceleration of price movement, NOT just direction.
- **Components**: RSI-14 with mean-reversion adjustment (35%), MACD histogram direction + acceleration (35%), Rate of Change 20-day (30%)
- **80-100**: Strong momentum but watch for exhaustion. RSI extremes are penalized — scores above 80 don't mean "buy more," they mean momentum is extended.
- **60-79**: Healthy momentum. Positive acceleration without overextension.
- **40-59**: Neutral momentum. Could be consolidation or early reversal.
- **20-39**: Negative momentum. Deceleration or active selling pressure.
- **0-19**: Strong negative momentum. Capitulation-level selling.
- **Key insight**: Momentum and Trend divergence is important. High Trend + Low Momentum = trend may be decelerating. Low Trend + High Momentum = possible early reversal or dead cat bounce.

### Volatility Score (0-100) — Risk Level
Higher score = MORE volatile = MORE risky. This is a risk metric, not an opportunity metric.
- **Components**: Percentile NATR-14 (40%), Bollinger Band width (30%), volatility regime 14d vs 60d (30%)
- **80-100**: Extremely volatile. Elevated risk. Position sizing should be smaller.
- **60-79**: Above-average volatility. Caution warranted.
- **40-59**: Normal volatility range for the asset class.
- **20-39**: Below-average volatility. Relatively stable period.
- **0-19**: Suppressed volatility. Historically low — could signal complacency before a move.
- **Asset-type context**: Crypto naturally has higher volatility scores than stocks. A volatility score of 60 for BTC is normal; for AAPL it signals unusual stress. The engine uses percentile scaling per asset class.
- **Key insight**: Very low volatility is NOT always safe — suppressed volatility often precedes sharp moves (the "volatility paradox").

### Liquidity Score (0-100) — Execution Depth
Measures whether institutional-sized orders can be executed without significant price impact.
- **Components**: Dollar-volume depth (40%), volume stability (15%), volume trend (15%), relative volume (15%), short-interest drag (5%), market-cap tier (10%)
- **80-100**: Deep liquidity. Institutional-grade execution capacity.
- **60-79**: Good liquidity. Standard execution without major slippage concerns.
- **40-59**: Moderate liquidity. Larger orders may face some slippage.
- **20-39**: Thin liquidity. Execution risk is material. Wider spreads.
- **0-19**: Illiquid. Significant execution risk. Not suitable for large positions.
- **Key insight**: Liquidity tends to evaporate during stress events. A stock with liquidity score 70 in calm markets may drop to 40 during a selloff.

### Trust Score (0-100) — Governance & Quality
Assesses regulatory quality, governance transparency, and institutional credibility.
- **Base scores by asset class**: Regulated assets (stocks, ETFs) start at 80; unregulated (crypto) start at 40.
- **Market-cap modifiers**: Mega-cap ($100B+) gets +15; micro-cap (<$100M) gets -10.
- **Blue-chip override**: Established leaders (AAPL, MSFT, BTC-USD, ETH-USD, SPY, QQQ, GLD) get +10 bonus.
- **Key insight**: A low trust score doesn't mean the asset is "bad" — it means there's less regulatory oversight and governance transparency. Crypto will always score lower than regulated equities on Trust.

### Sentiment Score (0-100) — Volume-Price Flow Proxy
Measures institutional accumulation or distribution patterns using price-volume relationships. Does NOT use news or social media — purely market flow.
- **Components**: OBV trend (40%), volume-price divergence (25%), Chaikin buying pressure (20%), volume trend (15%)
- **80-100**: Strong accumulation signal. Volume confirming price moves up.
- **60-79**: Moderate accumulation. Positive flow patterns.
- **40-59**: Neutral. No clear accumulation or distribution signal.
- **20-39**: Distribution developing. Volume patterns suggest selling.
- **0-19**: Strong distribution. Heavy selling pressure visible in flow data.
- **Key insight**: Sentiment divergence from price is a leading indicator. If price is rising but Sentiment is falling (volume not confirming), the rally may be fragile.

---

## Market Regime Detection (MRDE)

The platform detects the overall market environment using aggregate signals from the entire asset universe. This "macro weather" determines whether conditions favor risk-taking or capital preservation.

### Regime States

| State | Score Range | What It Means | Behavioral Implication |
|:------|:-----------|:-------------|:----------------------|
| **STRONG_RISK_ON** | 75-100 | Broad participation, suppressed volatility, high momentum. Aggressive growth conditions. | High-beta and growth assets tend to outperform. |
| **RISK_ON** | 60-74 | Positive trend, stable volatility. Steady accumulation. | Trend-following strategies work well. Quality growth favored. |
| **NEUTRAL** | 45-59 | Mixed signals. Sector rotation, no clear direction. | Stock selection matters more than market direction. Balanced approach. |
| **DEFENSIVE** | 30-44 | Narrowing breadth, rising volatility. Flight to quality beginning. | Low-volatility and defensive sectors preferred. Reduce beta exposure. |
| **RISK_OFF** | 0-29 | Systemic stress. Broad market breakdown. | Capital preservation is primary goal. Cash and safety assets. |

### Multi-Horizon Regime
The regime is computed across three timeframes:
- **Tactical (5-day)**: Fast-moving. Captures immediate momentum shifts and flow reversals.
- **Strategic (20-day)**: Core directional trend. Most useful for capital allocation decisions.
- **Structural (60-day)**: Major cycle positioning. Identifies structural regime shifts vs temporary pullbacks.

**Divergence signals**: When short-term regime differs from long-term, it often signals a transition. For example, Tactical=RISK_OFF but Structural=RISK_ON may indicate a short-term pullback within a healthy long-term trend.

---

## Asset-Regime Compatibility Score (ARCS)

ARCS answers: "Does this asset FIT the current market environment?"

- **Strong Fit (80-100)**: Asset attributes perfectly align with current regime incentives. High conviction environment.
- **Moderate Fit (50-79)**: Acceptable alignment. Proceed with awareness of regime headwinds.
- **Poor Fit (<50)**: Asset is fighting the current environment. High-beta tech in a Defensive regime, for example.

**How it works**: Each engine score is evaluated against the current regime. In RISK_ON, high Trend and Momentum are rewarded. In RISK_OFF, low Volatility and high Liquidity are rewarded. High Momentum in RISK_OFF is actually penalized (momentum trap risk).

---

## Signal Strength

The hero metric on every asset detail page. A 4-layer composite that synthesizes all available data into a single directional signal.

### Labels
- **Strong Bullish (80-100)**: Multiple layers align positively. High conviction.
- **Bullish (60-79)**: Positive overall signal with some mixed signals.
- **Neutral (40-59)**: Balanced or conflicting signals. No clear direction.
- **Bearish (20-39)**: Negative overall signal. Caution warranted.
- **Strong Bearish (0-19)**: Multiple layers align negatively. High conviction negative.

### Confidence
- **High**: Engine agreement above 70% and data completeness above 80%.
- **Medium**: Moderate agreement or some data gaps.
- **Low**: Conflicting signals or significant data incompleteness.

### Layer Weights (vary by asset type)
- **Stocks**: DSE 40% + Regime 25% + Fundamentals 20% + Dynamics 15%
- **Crypto**: DSE 55% + Regime 25% + Fundamentals 0% + Dynamics 20% (no earnings to analyze)
- **ETFs**: DSE 45% + Regime 25% + Fundamentals 15% + Dynamics 15%
- **Mutual Funds**: DSE 50% + Regime 20% + Fundamentals 10% + Dynamics 20%
- **Commodities**: DSE 50% + Regime 30% + Fundamentals 0% + Dynamics 20%

### Interpretation Guidance
- Signal Strength uses "Bullish/Bearish" framing, NOT "Buy/Sell" — this is an analytical signal, not a recommendation.
- A "Strong Bullish" signal with Low confidence is worth less than a "Bullish" signal with High confidence.
- Always check the breakdown layers. A Bullish signal where Regime Alignment is Poor means the asset's strength may not be sustainable.

---

## Score Dynamics

Tracks how scores are changing over time:
- **Momentum**: Is the composite score accelerating or decelerating? (5-day rate of change)
- **Acceleration**: Is the rate of change itself increasing or decreasing?
- **Percentile**: Where does the current score sit relative to its own 90-day history?

**Interpretation**: A score of 65 at the 90th percentile means the asset is near its best conditions in 90 days. A score of 65 at the 10th percentile means it has been performing much better recently and is deteriorating.

---

## Factor DNA

Each asset has a factor profile measuring exposure to:
- **Value**: Low P/E, high ROE, undervalued relative to peers
- **Growth**: Strong price appreciation, expanding multiples
- **Momentum**: Recent performance continuation
- **Low Volatility**: Stability premium, lower drawdowns

Factor alignment with regime determines whether the asset's factor tilt is favorable. In RISK_ON regimes, Growth and Momentum factors are rewarded. In DEFENSIVE regimes, Value and Low Volatility factors are rewarded.

---

## Data Freshness

All market data is delayed by 1 business day (daily batch updates at market close). The platform is designed for strategic analysis and institutional-grade position planning, not intraday speculation or day trading.

---

## Data Sources

- **US Stocks, ETFs, Commodities**: Yahoo Finance (quotes, summary, historical OHLCV)
- **Indian Stocks**: NSE India API (live during market hours) + Yahoo Finance (historical)
- **Indian Mutual Funds**: MFAPI (NAV history, scheme metadata)
- **Crypto**: CoinGecko API exclusively — all 49 crypto assets use CoinGecko for quotes, OHLCV history, and rich metadata (ATH/ATL, FDV, supply dynamics, community sentiment, categories, genesis date, multi-timeframe returns). Yahoo Finance is NOT used for any crypto data.

---

## Asset Universe

669 assets:
- **US (365)**: 206 Stocks, 106 ETFs, 49 Crypto, 12 Commodities
- **IN (304)**: 191 Stocks, 105 Mutual Funds, 6 ETFs, 2 Commodities
