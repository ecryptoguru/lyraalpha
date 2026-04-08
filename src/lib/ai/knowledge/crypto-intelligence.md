# Crypto Intelligence Engine Reference

This document explains how to interpret the proprietary Crypto Intelligence scores computed by the LyraAlpha AI platform. These scores appear in context tags like [CRYPTO_NETWORK_ACTIVITY], [CRYPTO_HOLDER_STABILITY], [CRYPTO_LIQUIDITY_RISK], [CRYPTO_STRUCTURAL_RISK], and [CRYPTO_ENHANCED_TRUST]. Use this to deliver crypto analysis grounded in platform-specific data.

---

## Network Activity Score (0-100)

Measures the health and vitality of the crypto network across four sub-components.

### Sub-Components
- **devActivity (0-100)**: GitHub commits, contributors, code frequency. High dev activity = active development, protocol evolving. Low dev activity = maintenance mode or abandoned. >70 = healthy. <30 = concern.
- **tvlHealth (0-100)**: Total Value Locked relative to market cap (TVL/MCap ratio). High ratio = real economic activity backing the valuation. Low ratio = speculative premium. >60 = strong fundamental backing. <30 = mostly speculative.
- **communityEngagement (0-100)**: Social media activity, community size, sentiment votes. Useful as a contrarian signal at extremes. >80 = potentially overheated. <20 = apathy (can be bullish if other metrics are strong).
- **onChainActivity (0-100)**: Transaction count, active addresses, network utilization. Rising activity + rising price = confirmed demand. Rising price + falling activity = speculative rally (fragile).

### Interpretation Patterns
- **High Network Activity + High Price**: Confirmed demand — the network is being used, not just traded. Bullish.
- **High Network Activity + Low Price**: Accumulation phase — builders and users are active despite price weakness. Often precedes recovery.
- **Low Network Activity + High Price**: Speculative premium — price is detached from usage. Fragile. Watch for mean reversion.
- **Low Network Activity + Low Price**: Genuine decline — both usage and price are weak. Needs a catalyst to reverse.

---

## Holder Stability Score (0-100)

Measures the conviction and distribution health of token holders.

### Sub-Components
- **supplyConcentration**: How concentrated is ownership? Top wallets holding >40% = governance/dump risk. Well-distributed supply = healthier market structure.
- **buyPressure**: Derived from DEX buy/sell ratios and volume patterns. Sustained buy pressure >60 = accumulation. Sell pressure >60 = distribution.
- **marketCapToFDV**: Circulating market cap vs Fully Diluted Valuation. MCap/FDV >0.8 = most tokens already circulating (low dilution risk). MCap/FDV <0.5 = significant future token unlocks will create sell pressure.
- **priceStability**: How stable is the price relative to its own history? Not about direction — about consistency. High stability during an uptrend = strong conviction. High stability during a downtrend = orderly selling (not panic).

### Key Insight: MCap/FDV Ratio
This is one of the most important crypto-specific metrics. A token with $1B MCap but $10B FDV means 90% of tokens haven't entered circulation yet. Each unlock event creates sell pressure. Always flag when MCap/FDV < 0.5 — it means the "real" price per token (accounting for all future supply) is much lower than the current market price.

---

## Liquidity Risk Score (0-100)

Higher score = MORE liquid = LESS risk. Measures how easily the token can be traded without significant price impact.

### Sub-Components
- **volumeToMcap**: Daily volume as percentage of market cap. >5% = actively traded. <1% = illiquid, exit risk.
- **dexLiquidity**: Total liquidity in DEX pools. Thin DEX liquidity means large orders cause significant slippage. This matters more for DeFi tokens that trade primarily on DEXes.
- **exchangePresence**: Number and quality of exchanges listing the token. Listed on 5+ major CEXes = good. Only on 1-2 DEXes = liquidity fragility.
- **poolConcentration**: Is liquidity spread across multiple pools/DEXes or concentrated in one? Single-pool dependency = if that pool gets drained or exploited, liquidity evaporates instantly.

### poolSummary Context Tag
When [CRYPTO_LIQUIDITY_DRIVERS] includes poolSummary data, it shows the top DEX pools with their liquidity depth, 24h volume, and buy/sell ratios. Use this to assess:
- Whether liquidity is concentrated or distributed
- Whether buy/sell pressure is balanced
- Which DEX is the primary trading venue

### Liquidity Risk Thresholds
- **Score >70**: Institutional-grade liquidity. Large orders executable without major slippage.
- **Score 40-70**: Adequate for retail. Larger orders may face 1-3% slippage.
- **Score <40**: Thin liquidity. Significant exit risk. Position sizing should be conservative.

---

## Crypto Structural Risk (0-100)

Lower score = LESS risk. Measures non-price risks that could fundamentally impair the project.

### Sub-Components
- **dependencyRisk**: Does the project depend on a single chain, bridge, or oracle? Single points of failure amplify tail risk. Cross-chain projects with multiple integrations score better.
- **governanceRisk**: How centralized is decision-making? DAO with active voting = lower risk. Single team controlling upgrades = higher risk. Whale-dominated governance = decisions may not serve smaller holders.
- **maturityRisk**: How long has the project existed? >5 years = battle-tested through multiple market cycles. 1-2 years = unproven in stress conditions. <1 year = high uncertainty.

### Interpretation
Structural risk is the "what could go wrong beyond price" assessment. A project can have great Network Activity and Holder Stability but high Structural Risk if it depends on a single bridge that could be exploited, or if governance is controlled by a small group.

---

## Enhanced Crypto Trust Score (0-100)

A 6-component weighted composite that synthesizes all structural health indicators into a single trust metric. This is the crypto equivalent of the Trust score for stocks, but computed from crypto-native data.

### Components (Weighted)
1. **protocolAge**: Older = more trusted. BTC and ETH score highest.
2. **devActivity**: Active development = maintained and evolving.
3. **govTransparency**: Open governance, clear tokenomics, transparent team.
4. **depRisk (inverse)**: Lower dependency risk = higher trust.
5. **community**: Large, active community = social validation and resilience.
6. **baseTrust**: Baseline from asset class (BTC/ETH get higher base than newer tokens).

### Trust Score Context
- **>70**: High trust. Established project with proven track record. BTC, ETH, and major L1s typically score here.
- **50-70**: Moderate trust. Established but with some concerns (governance centralization, newer protocol, dependency risks).
- **<50**: Low trust. Newer project, centralized governance, or significant structural risks. Not necessarily "bad" — but requires explicit risk acknowledgment.

---

## TVL (Total Value Locked) Analysis

### TVL as a Fundamental Metric
TVL represents real capital deployed in a protocol's smart contracts. It's the closest thing crypto has to "revenue" or "assets under management."

### TVL/MCap Ratio Interpretation
- **TVL/MCap > 1.0**: Undervalued relative to economic activity. More capital is locked in the protocol than its market cap suggests. Rare and potentially bullish.
- **TVL/MCap 0.3-1.0**: Fair value range for DeFi protocols.
- **TVL/MCap < 0.1**: Speculative premium. Market cap is driven by narrative, not usage.
- **TVL/MCap = 0 or N/A**: Not a DeFi protocol (e.g., BTC, payment tokens). TVL is not applicable — don't penalize for this.

### TVL Trends
- Rising TVL + Rising Price = confirmed DeFi demand (strongest signal).
- Rising TVL + Flat Price = capital inflow without speculation (healthy accumulation).
- Falling TVL + Rising Price = speculative rally detached from fundamentals (fragile).
- Falling TVL + Falling Price = capital flight (bearish, watch for acceleration).

---

## Crypto Category Frameworks

### Layer 1 (BTC, ETH, SOL, AVAX, ADA, DOT)
- Analyze as infrastructure plays. Network effects, developer ecosystem, and transaction throughput matter more than tokenomics.
- BTC is unique: store of value narrative, no smart contracts, supply cap. Analyze through macro/monetary lens, not tech lens.
- ETH: dual narrative (tech platform + monetary asset via staking yield). EIP-1559 burn rate makes ETH potentially deflationary.

### DeFi (UNI, AAVE, MKR, CRV, LDO)
- TVL is the primary fundamental metric. Revenue (fees) is secondary.
- Protocol revenue vs token holder revenue — many DeFi tokens don't pass fees to holders. Check if the token captures value.
- Smart contract risk is the dominant tail risk. Audits reduce but don't eliminate this.

### Layer 2 (ARB, OP, IMX)
- Dependent on L1 (usually Ethereum). L1 health directly affects L2 viability.
- Transaction volume and unique addresses are the key growth metrics.
- Token utility often limited to governance — check if there's a value accrual mechanism.

### Gaming/Metaverse (AXS, SAND, MANA)
- User metrics (DAU, MAU) matter more than TVL. These are consumer products.
- Token economies are often inflationary by design (play-to-earn rewards). Check emission schedules.
- Highly narrative-driven. Sentiment score extremes are more meaningful here than in DeFi.

### AI/Compute (FET, RENDER)
- Emerging category. Analyze through adoption metrics (compute hours, API calls) when available.
- High structural risk due to category immaturity. Maturity risk component of Structural Risk is especially relevant.
- Correlation with AI narrative in equities (NVDA, AMD) — when AI hype fades in stocks, these tokens often sell off harder.
