# Crypto-Specific Gap Analysis: Deterministic Engines & AI Prompt/Context Pipeline

**Version:** 2026-04-25-v1  
**Scope:** `src/lib/engines/*.ts`, `src/lib/ai/*.ts`, `src/app/api/stocks/[symbol]/analytics/route.ts`, `src/lib/services/portfolio.service.ts`, test coverage  
**Method:** Static code audit + dependency trace + test coverage gap identification

---

## 1. EXECUTIVE SUMMARY

The LyraAlpha codebase has **first-class crypto awareness** in its AI prompts, context builder, and crypto-intelligence engine, but **systematic leaks of traditional-equity assumptions** persist in portfolio-scoring engines, Monte Carlo simulation parameters, test coverage, and data pipeline fidelity.  

**Top-line finding:**  
- **Prompt/Context pipeline:** 8/10 crypto-native maturity (strong ASSET_TYPE_GUIDANCE, crypto-specific sections, BTC dominance injection).  
- **Deterministic engines:** 5/10 (portfolio health/fragility treat crypto volatility as a bug rather than a feature; Monte Carlo calibrates to equity vol regimes; signal-strength zeroes out fundamental layer for all crypto).  
- **Data pipeline:** 4/10 (CoinGecko category noise, no Token Terminal / Dune / Arkham / CoinGlass; double-counted TVL).  
- **Test coverage:** 3/10 (no memecoin portfolio, no unlock-pressure stress test, no cross-chain contagion scenario).

---

## 2. GAP INVENTORY (By Subsystem)

### 2.1 Portfolio Health Engine (`src/lib/engines/portfolio-health.ts`)

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| PH-1 | **Quality score applies a single -10 penalty when avgTrust < 40**, but ignores smart-contract audit history, bridge dependency, governance centralization, or slashing risk. A pre-audit alt-L1 and BTC get the same quality hit. | **HIGH** | `qualityScore` only penalises `avgTrust < 40` and `type === "CRYPTO"`. | Users hold high-smart-contract-risk tokens rated "Quality: 70+" because trust score is generic. |
| PH-2 | **Volatility dimension treats crypto vol as linear drag**, not a regime-dependent feature. A "low vol" crypto (V:20) and a bond both score 80. Crypto bull-market vol (V:75) is penalised identically to an equity flash-crash (V:75). | **MEDIUM** | `volatilityScore` uses `weightedVol` with `70 - ...` linear mapping. No bull/bear regime adjustment. | Portfolios with high-vol momentum assets (SOL, AVAX) show artificially low health scores during risk-on regimes where that vol is expected and rewarded. |
| PH-3 | **BTC-beta penalty only applied to single-asset portfolios**, not concentration-adjusted. A 60% BTC + 40% ETH portfolio gets zero BTC-beta penalty even though 60% is still extreme crypto-beta concentration. | **MEDIUM** | `btcBetaPenalty = (maxWeight > 0.75 && isBtcBeta) ? -15 : 0`. | Portfolios with 70% BTC-beta exposure show "Diversification: 80" despite being effectively single-factor. |
| PH-4 | **Correlation scoring uses 0.65 generic max correlation**, not cross-chain / sector-specific baselines. A BTC-ETH correlation of 0.80 is penalised identically to a NVDA-AMD correlation of 0.80, even though 0.80 is structurally normal for the crypto majors. | **MEDIUM** | `avgCorrelation * 0.65` hard-coded, no asset-type-specific baseline. | Correlation score over-penalises normal crypto-major co-movement, making diversified crypto portfolios look worse than they are. |
| PH-5 | **No stablecoin-specific health handling.** USDC sitting in a portfolio is treated as "Finance" sector with generic trust/vol scores, not as a de-peg-risk cash proxy. | **MEDIUM** | Stablecoin symbols (USDC, USDT, DAI) not special-cased. | Users with 30% USDC allocation see no de-peg risk signal in portfolio health. |

### 2.2 Portfolio Fragility Engine (`src/lib/engines/portfolio-fragility.ts`)

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| PF-1 | **REGIME_STRESS_GAMMA = 0.65 is generic.** Crypto stress gamma should be higher (0.80-0.90) because crypto drawdowns are deeper and faster than equity drawdowns in risk-off transitions. | **HIGH** | `REGIME_STRESS_GAMMA = 0.65` hard constant. | Fragility scores under-estimate tail risk for crypto portfolios during regime shifts. |
| PF-2 | **Stablecoin de-peg fragility only checks `stablecoinDepegRisk` flag**, not actual reserve-attestation data or on-chain redemptions. No "de-peg velocity" (how fast USDC can break). | **MEDIUM** | `stablecoinDepegFragility = stablecoinDepegRisk ? 1 : 0`. Binary. | A portfolio holding 50% USDC with no recent attestation gets the same fragility as one holding 50% USDC with daily Chainlink proof-of-reserves. |
| PF-3 | **Factor rotation fragility uses `compatibilityScore`**, which is regime-fit, not crypto-factor rotation (e.g., L1 → DeFi → Meme → AI). During a narrative rotation, a "high compatibility" L1 can still drop 40% if capital rotates to a new L1. | **MEDIUM** | `factorRotationFragility = (100 - avgCompat) / 4`. | Narrative-rotation risk invisible to fragility engine. |
| PF-4 | **No cross-chain / bridge contagion penalty.** A portfolio holding ETH on Ethereum + ETH on Arbitrum + ETH on Optimism is treated as 3 assets with 3 vol scores, not a single asset with bridge-risk multiplier. | **HIGH** | `totalWeightedVol` sums per-asset volatility; no bridge-fragility component. | Cross-chain ETH concentration is invisible; bridge hack could wipe all 3 "diversified" positions simultaneously. |
| PF-5 | **No MEV extraction risk.** High-frequency DeFi positions (LPs, staking) face sandwich-attack and frontrunning drag that is not captured in any fragility component. | **MEDIUM** | No MEV component in fragility. | Users in concentrated DEX pools see lower fragility than reality. |

### 2.3 Monte Carlo Engine (`src/lib/engines/portfolio-monte-carlo.ts`)

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| MC-1 | **VOL_MULTIPLIER = 0.045 is single scalar.** Realised crypto vol is regime-dependent: bull-market BTC vol ≈ 40-60% annualised, bear-market ≈ 80-120%. A single multiplier compresses both into ~45%, hiding tail risk in bear regimes and overstating risk in bull regimes. | **HIGH** | `const VOL_MULTIPLIER = 0.045; baseVols = (volScore / 100) * VOL_MULTIPLIER`. | Stress-test VaR for crypto portfolios is systematically understated in bear markets, overstated in bull markets. |
| MC-2 | **Flash crash injection is a single shock at midpoint.** Crypto flash crashes are typically cascading (liquidation waterfall) with multiple shocks over hours, not one Gaussian jump. | **MEDIUM** | `if (Math.random() < flashCrashProb) { ... applyGaussianShock(...) }` at `t = T/2`. | Monte Carlo max drawdown underestimates true crypto waterfall risk. |
| MC-3 | **No Lévy / jump-diffusion calibration.** Crypto returns have fatter tails (excess kurtosis 4-8) than the geometric Brownian motion + single shock model captures. | **MEDIUM** | GBM with Gaussian shock only. | Tail VaR (p5, p1) is underestimated. |
| MC-4 | **No funding-rate or open-interest regime modelling.** High positive funding + high OI is a known crypto-specific fragility signal (long squeeze risk) that is absent. | **MEDIUM** | No funding/OI variables in simulation. | Leveraged long portfolios show lower simulated drawdown than empirical crypto data suggests. |
| MC-5 | **Correlation matrix is static.** In crypto, correlations spike to 0.90+ during crashes but are 0.30-0.50 in normal times. Static matrix understates crisis co-movement. | **HIGH** | `historicalCorrelations` is fixed per regime; no dynamic correlation jump during stress. | Diversification benefit overstated during stress tests. |

### 2.4 Crypto Intelligence Engine (`src/lib/engines/crypto-intelligence.ts`)

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| CI-1 | **Network activity score over-weights GitHub commits** (15 pts) and under-weights on-chain active addresses / transaction count. Developer activity is a weak predictor of price; on-chain MAU/DAU is stronger. | **MEDIUM** | `score += 15` for dev commits/stars. No on-chain tx count or DAU weighting. | "Zombie" projects with active repos but dead chains score high on network activity. |
| CI-2 | **TVL is not risk-adjusted.** A $2B TVL protocol with 80% in a single asset is riskier than a $2B protocol with 20 assets. No concentration-of-TVL penalty. | **MEDIUM** | `tvl` score is capped by TVL value, no composition analysis. | Concentrated TVL protocols (e.g., anchor-like) show high structural health. |
| CI-3 | **MEV exposure is binary (score > 0?)**, not calibrated by actual sandwich-attack frequency or slippage at size. A DEX with 2% average slippage on $10K trades gets the same MEV flag as one with 0.1%. | **MEDIUM** | `const hasMEV = !!structuralRisk?.mevExposure`. Binary flag. | Slippage-aware position sizing is impossible from this signal. |
| CI-4 | **Unlock pressure uses MCap/FDV heuristic**, not actual token unlock calendar data. A token with 90% MCap/FDV but a 20% unlock next week is treated as low pressure. | **HIGH** | `unlockPressureScore = ((100 - mcapToFDV) / 100) * 100`. Static heuristic. | Users hold tokens with imminent cliff unlocks rated "Unlock Pressure: 20". |
| CI-5 | **No emissions / inflation schedule scoring.** Bitcoin halving is hard-coded in examples, but no engine score reflects emissions decay or CPI (current issuance / max supply trajectory). | **MEDIUM** | No `emissionsScore` or `inflationScore`. | High-inflation reward tokens (e.g., early validator emissions) show no structural risk penalty. |
| CI-6 | **Holder stability uses circulating/total supply ratio**, not on-chain wallet concentration (Gini / whale %). A token with 95% circulating supply but 80% held by 10 wallets scores high on "holder stability." | **HIGH** | `holderStabilityScore = (circulatingSupply / totalSupply) * 100`. No on-chain Gini. | Centralised "whale" tokens look stable. |
| CI-7 | **No staking yield sustainability score.** Is the yield from protocol revenue, inflation, or ponzi-like emissions? No distinction. | **MEDIUM** | No yield-source decomposition. | Users chase 20% APY without knowing it's 100% emission-funded. |
| CI-8 | **Bridge dependency is binary**, not multi-chain exposure quantified. A token bridged to 5 chains with 5 different bridge operators is treated the same as a native token. | **MEDIUM** | `bridgeDependencyScore` is boolean-ish. | Multi-chain bridge risk is invisible. |
| CI-9 | **No oracle manipulation risk.** Price-feed manipulation (e.g., oracle-front-running, TWAP attacks) is a major DeFi risk not captured. | **MEDIUM** | No oracle risk component. | DeFi positions with manipulable oracles show no structural risk. |
| CI-10 | **CoinGecko category names are noisy** ("Meme", "Animal Meme Coins", "Dog-Themed") and not normalised, making sector-grouping unreliable. | **LOW** | `category = coin.geckoData?.category ?? "Unknown"`. Used in diversification buckets. | Memecoins split across 3+ pseudo-sectors, diluting concentration penalties. |

### 2.5 Signal Strength Engine (`src/lib/engines/signal-strength.ts`)

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| SS-1 | **Fundamental layer weight is 0.00 for all crypto.** `fundamentalWeight = assetType === "crypto" ? 0.00 : ...`. The entire fundamental quality dimension (PE, revenue, margin, growth) is discarded for crypto, but nothing replaces it. No on-chain revenue, protocol fees, or burn-rate proxy. | **CRITICAL** | `fundamentalWeight = assetType === "crypto" ? 0.00 : 0.20`. | Crypto signal strength is 100% technical (DSE + regime + dynamics). No fundamental anchor = pure momentum-driven signals. |
| SS-2 | **Key drivers for crypto only surface 2 items** (upside, downside) vs 4 for equities (growth, margin, valuation, momentum). Crypto gets a thinner analytical narrative. | **MEDIUM** | `getTopCryptoDrivers()` returns max 2; `getTopEquityDrivers()` returns 4. | ELITE tier output lacks depth for crypto assets despite having on-chain data. |
| SS-3 | **Risk factors for crypto only surface 2 items** vs 4 for equities. | **MEDIUM** | `getTopCryptoRisks()` returns max 2. | Risk disclosure is thinner for crypto than for equities. |
| SS-4 | **No crypto-native key driver categories.** Missing: protocol revenue trajectory, fee-burn ratio, TVL / market-cap efficiency, staking yield sustainability, developer retention, active-address growth. | **HIGH** | Drivers are generic upside/downside/technical. | Signal strength cannot distinguish between a revenue-generating DeFi protocol and a memecoin with identical price action. |

### 2.6 Compatibility / Grouping Engines (`src/lib/engines/compatibility.ts`, `grouping.ts`)

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| CG-1 | **Compatibility scoring uses regime-fit logic** (trend/momentum/volatility/liquidity/sentiment) but has no crypto-specific factor: staking yield attractiveness, memecoin-mania regime, L2 migration narrative, etc. | **MEDIUM** | `calculateCompatibility()` generic factor scoring. | "Compatibility" for a DeFi token in a "risk-on" regime ignores whether DeFi is actually in or out of favour. |
| CG-2 | **Grouping has no memecoin / AI-token / RWA category.** Memecoins with high trend + high vol + low trust are grouped as "Speculative Momentum" — same as a biotech stock. | **LOW** | `GROUP_DEFINITIONS` has no memecoin/AI/RWA specific group. | Portfolio grouping narrative is less precise for crypto-native sectors. |

### 2.7 Context Builder (`src/lib/ai/context-builder.ts`)

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| CB-1 | **Unlock pressure injected only as `upcomingUnlocks` text list**, not quantified unlock % per month. No calendar-date proximity weighting. | **MEDIUM** | `upcomingUnlocks: JSON.stringify(unlockContext)` with `amount: item.amount` only. | LLM cannot compute "next 30 days unlock = 15% of float" because amounts lack float denominator. |
| CB-2 | **MEV exposure injected as description text**, not a numeric score with slippage-at-size. | **LOW** | `mev.description` only. | LLM cannot say "slippage on $10K = 2.3%" without numeric data. |
| CB-3 | **No funding rate or open-interest injection.** Critical for crypto leverage risk assessment. | **HIGH** | No `[FUNDING_RATES]` or `[OPEN_INTEREST]` blocks. | LLM cannot warn about crowded long/short positions. |
| CB-4 | **No exchange-reserves or exchange-flow injection.** Exchange inflow/outflow is a key crypto sentiment signal. | **MEDIUM** | No exchange-flow block. | LLM misses whale-to-exchange selling pressure signals. |
| CB-5 | **No staking yield or emission schedule injection.** | **MEDIUM** | No `[STAKING_YIELD]` or `[EMISSIONS]` blocks. | LLM cannot evaluate yield sustainability or dilution risk. |
| CB-6 | **No governance proposal or DAO-treasury injection.** Active governance votes can materially affect token value (e.g., fee-switch, treasury allocation). | **MEDIUM** | No governance block. | LLM misses near-term catalysts from active governance. |
| CB-7 | **No smart-contract audit history injection.** Audit date, auditor name, findings count not present. | **MEDIUM** | No audit block. | LLM cannot warn about unaudited or stale-audit protocols. |
| CB-8 | **No cross-chain bridge exposure injection.** A token's bridge mappings and TVL per bridge are missing. | **LOW** | No bridge-exposure block. | Multi-chain asset risk is invisible to LLM. |
| CB-9 | **`CRYPTO_ABOUT` truncated to 80 chars**, often cutting off critical descriptions. | **LOW** | `truncateToLength(description, 80)` — very short. | LLM gets fragmented context for smaller tokens. |

### 2.8 System Prompt & Output Validation

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| SP-1 | **Monitoring checklist is capped at 3 items.** Crypto assets typically have 5-7 critical on-chain metrics to watch (funding, exchange flow, active addresses, TVL, unlock calendar, dominance, staking yield). 3 is insufficient for ELITE tier. | **MEDIUM** | `buildMonitoringChecklistSection()` returns max 3. | Users miss critical watchpoints (e.g., "funding rate turning negative" omitted because 3 slots filled by trend/momentum/liquidity). |
| SP-2 | **No crypto-specific banned phrases in output validation.** Generic banned list catches "moon" and "lambo" but may miss crypto-hype like "diamond hands", "wagmi", "ser", "100x gem". | **LOW** | `BANNED_PHRASES` in `output-validation.ts` not shown to have crypto-specific entries. | Output hygiene weaker for crypto slang. |
| SP-3 | **No output validation rule enforcing "MEV risk mentioned if mevExposure > 60".** Validation checks section presence but not crypto-specific risk mention. | **MEDIUM** | Validation enforces section count and banned phrases, not crypto-risk coverage. | LLM may omit MEV warning even when engine flags high exposure. |

### 2.9 Behavioral Intelligence (`src/lib/ai/behavioral-intelligence.ts`)

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| BI-1 | **No "yield farming without understanding impermanent loss" pattern.** A common crypto-specific behavioral trap. | **MEDIUM** | Pattern detection covers concentration, recency, FOMO, volatility-seeking, but not IL-ignorance. | Users enter concentrated LP positions without IL warning. |
| BI-2 | **No "apeing into memecoins / low-liquidity tokens" pattern.** High volatility seeking is caught, but not the specific "new token with $100K liquidity and $50M mcap" trap. | **MEDIUM** | No memecoin-specific or liquidity-manipulation pattern. | Users buy tokens with 90% slippage without behavioural nudge. |
| BI-3 | **No "staking lock-up / unstaking queue" pattern.** Locking capital for 30 days in a volatile asset is a liquidity trap not captured by generic concentration risk. | **LOW** | No staking-lockup behavioural pattern. | Users stake 100% of holdings into 30-day lockups. |

### 2.10 Query Classifier (`src/lib/ai/query-classifier.ts`)

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| QC-1 | **No COMPLEX classification for "smart contract risk", "unlock schedule", "MEV", "impermanent loss", "bridge hack", "oracle manipulation" queries.** These are analytical, not educational, but may hit SIMPLE_ABSOLUTE or MODERATE. | **MEDIUM** | COMPLEX_PATTERNS has no smart-contract, MEV, bridge, oracle, IL keywords. | Deep analytical queries about crypto-specific risks are under-classified → less detailed response. |

### 2.11 Analytics API Route (`src/app/api/stocks/[symbol]/analytics/route.ts`)

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| AA-1 | **Crypto analytics payload does not include `cryptoIntelligence` in the API response.** The route returns `signals`, `compatibility`, `grouping`, `performance`, `scoreDynamics`, `correlationRegime`, `factorAlignment`, `eventAdjustedScores`, `signalStrength`, `metadata`, `technicalMetrics`, but `cryptoIntelligence` (the richest crypto-native data) is absent from the response object. | **HIGH** | `payload` object (lines 300-341) has no `cryptoIntelligence` field. | Frontend analytics cards cannot display unlock pressure, MEV risk, bridge dependency, or TVL data. |
| AA-2 | **Portfolio service (`portfolio.service.ts`) does not feed crypto-intelligence sub-scores into portfolio health/fragility.** `buildHoldingInputs()` only passes `avgVolatilityScore`, `avgLiquidityScore`, `avgTrustScore`, `sector`, `type` to health/fragility engines. Unlock pressure, MEV exposure, bridge risk, and TVL concentration are never propagated. | **HIGH** | `healthInputs` and `fragilityInputs` use generic denormalised scores only. | A portfolio of 5 tokens all with unlocks next week shows the same health score as 5 tokens with no unlocks. |

### 2.12 Data Pipeline / External Services

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| DP-1 | **CoinGecko category names are used raw** (e.g., "Dog-Themed", "Animal Meme Coins"). No normalisation to canonical sectors (Meme, L1, DeFi, RWA, AI). | **LOW** | `category = coin.geckoData?.category ?? "Unknown"` in crypto-intelligence engine. | Sector-based diversification in portfolio health treats "Dog-Themed" and "Meme" as different sectors, diluting concentration penalties. |
| DP-2 | **DeFiLlama TVL is not risk-adjusted** (no protocol-level TVL composition, no double-counting correction). | **MEDIUM** | `total_tvl` fetched, no sub-protocol breakdown or recursive TVL correction. | Overstated TVL for protocols with recursive staking (e.g., LST re-staking). |
| DP-3 | **No Token Terminal, Dune Analytics, Nansen, Arkham, or CoinGlass integration.** Revenue, on-chain Gini, exchange flows, funding rates, and open interest are unavailable. | **HIGH** | Only CoinGecko, DefiLlama, GeckoTerminal referenced. | Key crypto-native signals (revenue, whale concentration, funding, OI) are missing from intelligence engine. |
| DP-4 | **GeckoTerminal volume/liquidity is raw DEX data**, not slippage-at-size or sandwich-attack frequency. | **MEDIUM** | `volume_24h`, `liquidity_usd`, `price_change_24h` used. No MEV / slippage data. | Liquidity risk is volume-based, not execution-quality-based. |

### 2.13 Test Coverage

| # | Gap | Severity | Evidence | Impact |
|---|-----|----------|----------|--------|
| TC-1 | **No test for memecoin portfolio health.** A portfolio of 100% DOGE or 50% SHIB + 50% PEPE should show extreme concentration and quality penalties, but is not tested. | **MEDIUM** | `portfolio-health.test.ts` uses BTC, ETH, SOL, LINK only. | Memecoin concentration risk may be under-penalised in production. |
| TC-2 | **No test for unlock-pressure scenario in portfolio intelligence.** A portfolio with 3 tokens all having cliff unlocks in 7 days should show elevated fragility. | **HIGH** | `portfolio-intelligence.test.ts` has no unlock data in holdings. | Unlock-stress fragility is untested. |
| TC-3 | **No test for stablecoin de-peg in portfolio health.** A 100% USDC portfolio should show low health (concentrated stablecoin risk). | **MEDIUM** | No stablecoin-specific test case. | Stablecoin-only portfolios may show misleading health scores. |
| TC-4 | **No test for cross-chain bridge contagion.** Holding ETH, WETH (Arbitrum), WETH (Optimism) should not score as diversified. | **HIGH** | No bridge / wrapped-token test case. | Cross-chain concentration invisible. |
| TC-5 | **No test for high-MEV asset in portfolio fragility.** A concentrated position in a low-liquidity DEX pair should increase fragility. | **MEDIUM** | No MEV-specific test case. | MEV fragility untested. |
| TC-6 | **No test verifying crypto signal-strength fundamental-layer bypass.** When `type=CRYPTO`, fundamental weight is 0.00. No test asserts this or asserts what replaces it. | **HIGH** | `signal-strength` tests not read in detail, but no crypto-specific fundamental-replacement test observed. | Crypto signal strength may silently regress to pure technicals. |

---

## 3. CROSS-CUTTING ARCHITECTURAL GAPS

### 3.1 The "Fundamental Layer Void" (SS-1)

The most critical architectural gap is that **crypto assets have zero fundamental weight in signal strength**, and there is **no replacement proxy**. For equities, the fundamental layer combines revenue growth, margins, valuation, and competitive position. For crypto, this layer should be replaced by:
- **Protocol revenue / fees** (Token Terminal)
- **Fee-to-burn ratio** (ultrasound money thesis)
- **TVL efficiency** (TVL / Market Cap)
- **Active-address growth** (on-chain DAU/MAU)
- **Staking yield sustainability** (yield source decomposition)
- **Developer retention** (GitHub stars is weak; commit recency + contributor count is better)

**Recommended fix:** Create a `CryptoFundamentalData` interface and `calculateCryptoFundamentalScore()` that feeds into signal strength with a non-zero weight (suggest 0.15-0.20), reducing DSE weight to 0.40-0.45 to keep total = 1.0.

### 3.2 The "Engine-to-Portfolio Silo" (AA-2)

Portfolio health and fragility engines operate on **generic denormalised scores** (`avgTrustScore`, `avgVolatilityScore`). The rich crypto-intelligence sub-scores (unlock pressure, MEV exposure, bridge dependency, TVL concentration, holder Gini) are computed per-asset but **never propagated to portfolio-level aggregation**.

**Recommended fix:** Extend `HoldingInput` and `FragilityHoldingInput` to include crypto-intelligence sub-scores. In `portfolio.service.ts` `buildHoldingInputs()`, pass these through. In portfolio-health/fragility, add crypto-specific components:
- `weightedUnlockPressure`
- `weightedMEVExposure`
- `weightedBridgeDependency`
- `weightedHolderConcentration`

### 3.3 The "Monte Carlo Vol Regime Blindness" (MC-1, MC-5)

Monte Carlo uses a single `VOL_MULTIPLIER = 0.045` and static correlation matrix. Crypto vol is **strongly regime-dependent** and **correlations jump in stress**.

**Recommended fix:**
- Replace `VOL_MULTIPLIER` with a regime-dependent table: `BULL: 0.040`, `NEUTRAL: 0.055`, `BEAR: 0.085`.
- Add dynamic correlation jump: in stress events, override pairwise correlation with `max(baseCorr, 0.85)` for same-sector crypto pairs.
- Add funding-rate / OI regime: if funding > +0.03% / 8h and OI > historical 90th percentile, increase flash-crash probability.

### 3.4 The "Prompt-Engine Data Mismatch"

The prompt instructs the LLM to "use numbers, not vague statements" and references `FDV/MCap` and `TVL`, but the **context builder injects truncated or missing data** for these fields (e.g., `CRYPTO_ABOUT` 80 chars, no funding rates, no unlock calendar). The prompt is crypto-native, but the data pipeline under-fuels it.

**Recommended fix:** Prioritise data pipeline gaps (DP-3, DP-4) to feed the already-crypto-aware prompt engine.

---

## 4. RISK RATING FRAMEWORK

| Rating | Criteria | Example |
|--------|----------|---------|
| **CRITICAL** | Causes materially wrong user decisions; no workaround; affects all crypto assets. | SS-1 (fundamental layer void) — all crypto signals are momentum-only. |
| **HIGH** | Causes wrong decisions for a subset of users; affects major asset classes; fix is non-trivial. | MC-1 (vol regime blindness), AA-2 (engine-to-portfolio silo), CI-4 (unlock calendar missing), CI-6 (no whale Gini). |
| **MEDIUM** | Degrades precision but does not cause fundamentally wrong decisions; fix is moderate effort. | PH-1 (quality lacks smart-contract), PF-1 (stress gamma), CB-3 (no funding rates), DP-3 (missing data providers). |
| **LOW** | Cosmetic or edge-case; fix is small effort. | SP-2 (banned phrases), CI-10 (category noise), CB-9 (description truncation). |

---

## 5. SYNTHESIS: TOP 10 PRIORITY FIXES

1. **SS-1 / DP-3:** Build crypto fundamental score (protocol revenue, fee-burn, active addresses, TVL efficiency) and replace 0.00 fundamental weight with 0.15-0.20. Requires Token Terminal or Dune integration.  
2. **AA-2 / PH-1 / PF-1:** Propagate crypto-intelligence sub-scores into portfolio health/fragility engines. Add unlock-pressure, MEV, bridge, and holder-concentration components.  
3. **MC-1 / MC-5:** Implement regime-dependent vol multipliers and dynamic correlation jump for crypto stress tests.  
4. **CI-4 / CI-6:** Integrate actual token unlock calendar (CoinGecko / TokenUnlocks) and on-chain holder Gini (Dune / Arkham) into crypto-intelligence engine.  
5. **CB-3 / CB-4 / CB-5 / CB-6:** Add funding rates, open interest, exchange flows, staking yield, and emissions schedule to context builder blocks.  
6. **CI-7 / CI-9:** Add staking yield sustainability scoring and oracle manipulation risk to crypto-intelligence engine.  
7. **PF-4 / PH-5:** Implement cross-chain bridge contagion penalty and stablecoin-specific health handling in portfolio engines.  
8. **AA-1:** Include `cryptoIntelligence` in analytics API response payload so frontend can display it.  
9. **SP-1:** Expand monitoring checklist to 5-7 items for crypto assets, adding funding, exchange flow, active addresses.  
10. **QC-1 / BI-1 / BI-2:** Add crypto-specific COMPLEX patterns (MEV, bridge, unlock, IL) and behavioural nudges (memecoin aping, IL ignorance) to classifier and behavioural intelligence.

---

*End of Gap Analysis Document*
