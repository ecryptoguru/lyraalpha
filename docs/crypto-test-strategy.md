# Crypto-Specific Test Strategy

**Version:** 2026-04-25-v1  
**Scope:** `src/lib/engines/`, `src/lib/ai/`, `src/app/api/stocks/[symbol]/analytics/`, `src/lib/services/portfolio.service.ts`

---

## 1. PHILOSOPHY

Crypto assets are **not equities with extra volatility**. They have fundamentally different risk vectors: smart-contract risk, unlock pressure, MEV extraction, bridge contagion, oracle manipulation, and holder concentration. The test strategy therefore treats crypto as a **first-class asset class** with its own test suites, not as a modifier on equity tests.

**Golden rules:**
1. **Every crypto-specific engine score must have a regression test.**
2. **Portfolio tests must include cross-chain and memecoin scenarios.**
3. **Prompt output must be validated for crypto-native section presence.**
4. **Data pipeline tests must assert against real (mocked) API shapes, not heuristics.**

---

## 2. TEST PYRAMID

```
                    ┌─────────────┐
                    │   E2E       │  (1 suite: full crypto portfolio CRUD + analytics)
                    │  (slow)     │
                    ├─────────────┤
                    │ Integration │  (API routes + service layer + engine chain)
                    │   (medium)  │
                    ├─────────────┤
                    │   Unit      │  (engine maths, prompt assembly, classifier regex)
                    │   (fast)    │
                    └─────────────┘
```

**Target coverage by end of Phase 6:**
- Unit tests: 80+ new crypto-specific assertions
- Integration tests: 15+ new test cases across API + service + engine
- E2E tests: 1 new full portfolio journey

---

## 3. UNIT TESTS — DETERMINISTIC ENGINES

### 3.1 Portfolio Health (`src/lib/engines/__tests__/portfolio-health.test.ts`)

**Existing gaps to close:**

| Test Case | Input | Expected Assertion | Gap ID |
|-----------|-------|-------------------|--------|
| `memecoin portfolio shows low quality` | 100% DOGE, avgTrust=30 | `qualityScore < 40` | TC-1 |
| `memecoin split portfolio shows concentration penalty` | 50% SHIB + 50% PEPE, same sector | `diversificationScore < 30` | TC-1 |
| `stablecoin-only portfolio is not "Strong"` | 100% USDC | `healthScore < 50`, `band !== "Strong"` | TC-3 |
| `cross-chain ETH portfolio has low diversification` | ETH (L1) 33%, WETH-Arbitrum 33%, WETH-Optimism 33% | `diversificationScore < 40` | TC-4 |
| `high smart-contract risk penalises quality` | 100% unaudited alt-L1, smartContractRiskScore=15 | `qualityScore < 50` | PH-1 |
| `unlock pressure > 70 penalises health` | 100% token with unlockPressure=85 | `healthScore < 60` | TC-2 |
| `holder concentration > 80% reduces quality` | 100% token, top10HolderPercent=85 | `qualityScore < 50` | CI-6 |
| `BTC-beta penalty applies at 60% threshold` | 60% BTC + 40% ETH | `btcBetaPenalty < 0` (extend threshold logic) | PH-3 |
| `correlation baseline adjustment for crypto majors` | BTC + ETH correlation=0.80 | `correlationScore > 60` (not penalised as if equity) | PH-4 |

**Mock data helpers to add:**
```ts
function makeCryptoHolding(overrides: Partial<CryptoHoldingInput> = {}): CryptoHoldingInput {
  return {
    symbol: "BTC",
    weight: 0.25,
    avgVolatilityScore: 60,
    avgLiquidityScore: 90,
    avgTrustScore: 88,
    sector: "Layer 1",
    type: "CRYPTO",
    unlockPressureScore: 20,
    mevExposureScore: 10,
    bridgeDependencyScore: 0,
    holderConcentrationScore: 60,  // 100 - whaleConcentration
    smartContractRiskScore: 75,
    ...overrides,
  };
}
```

### 3.2 Portfolio Fragility (`src/lib/engines/__tests__/portfolio-fragility.test.ts`)

| Test Case | Input | Expected Assertion | Gap ID |
|-----------|-------|-------------------|--------|
| `crypto regime shift has higher stress gamma` | RISK_ON → DEFENSIVE, portfolio type=CRYPTO | `fragilityScore > 50` (vs equities < 40 in same shift) | PF-1 |
| `stablecoin de-peg with reserve uncertainty` | 50% USDC (no recent attestation) | `fragilityScore > 60` | PF-2 |
| `cross-chain bridge concentration` | ETH + WETH-Arbitrum + WETH-Optimism | `fragilityScore > 55` (bridge hack wipes all) | PF-4 |
| `high MEV extraction in concentrated LP` | 100% low-liquidity DEX pair, mevScore=70 | `fragilityScore > 50` | PF-5 |
| `unlock cliff within 7 days elevates fragility` | 3 tokens, all unlockPressure > 80 | `fragilityScore > 60` | TC-2 |

### 3.3 Monte Carlo (`src/lib/engines/__tests__/portfolio-monte-carlo.test.ts`)

| Test Case | Input | Expected Assertion | Gap ID |
|-----------|-------|-------------------|--------|
| `bear regime vol multiplier > bull regime` | Same portfolio, BULL vs BEAR regime | `simulatedPaths.bear.stdDev > simulatedPaths.bull.stdDev * 1.5` | MC-1 |
| `stress correlation jump for crypto pairs` | BTC + ETH pair, EXTREME_STRESS event | `correlationDuringStress >= 0.85` | MC-5 |
| `funding-rate crowding increases flash-crash prob` | fundingRate=0.04, OI percentile=0.95 | `flashCrashCount > baseline * 1.5` | MC-4 |
| `fat-tail shock produces larger drawdown than Gaussian` | t-distribution shock (df=3) vs Gaussian | `maxDrawdown.tDist > maxDrawdown.gaussian` | MC-3 |
| `crypto max drawdown exceeds equity max drawdown` | CRYPTO portfolio vs EQUITY portfolio, same health score | `cryptoMaxDrawdown > equityMaxDrawdown * 1.3` | MC-1 |

### 3.4 Crypto Intelligence (`src/lib/engines/__tests__/crypto-intelligence.test.ts` — NEW FILE)

**New test file to create:** `src/lib/engines/__tests__/crypto-intelligence.test.ts`

| Test Case | Input | Expected Assertion | Gap ID |
|-----------|-------|-------------------|--------|
| `unlock pressure from calendar > heuristic` | Token with 15% unlock in 14 days, MCap/FDV=0.90 | `unlockPressureScore > 70` (heuristic would give ~10) | CI-4 |
| `holder Gini penalises whale concentration` | top10HolderPercent=80, circulating/total=0.95 | `holderStabilityScore < 40` | CI-6 |
| `protocol revenue scores higher than memecoin` | DeFi protocol: revenue=$10M, mcap=$100M vs Meme: revenue=$0 | `fundamentalScore.deFi > fundamentalScore.meme + 30` | SS-1 |
| `staking yield sustainability affects structural score` | Yield 100% from fees vs 100% from emissions | `structuralRisk.score.feeYield > structuralRisk.score.emissionYield` | CI-7 |
| `oracle manipulation risk for custom TWAP` | Custom TWAP oracle vs Chainlink | `oracleRiskScore.custom > oracleRiskScore.chainlink` | CI-9 |
| `MEV score from slippage not binary` | Slippage $1K = 3% vs Slippage $1K = 0.1% | `mevScore.high > mevScore.low * 5` | CI-3 |
| `TVL concentration penalty` | $1B TVL in 1 asset vs $1B TVL in 20 assets | `tvlScore.concentrated < tvlScore.diversified` | CI-2 |
| `GitHub commits over-weighted vs active addresses` | Repo with 500 commits but 0 daily transactions | `networkActivityScore < 50` | CI-1 |

### 3.5 Signal Strength (`src/lib/engines/__tests__/signal-strength.test.ts`)

| Test Case | Input | Expected Assertion | Gap ID |
|-----------|-------|-------------------|--------|
| `crypto fundamental weight > 0` | type=CRYPTO, cryptoFundamentalScore present | `fundamentalWeight === 0.15` | TC-6 / SS-1 |
| `revenue-generating DeFi outscores memecoin` | Identical DSE/regime/dynamics, DeFi revenue=$50M vs Meme revenue=$0 | `signalStrength.deFi > signalStrength.meme` | SS-1 |
| `crypto key drivers include protocol metrics` | type=CRYPTO | `keyDrivers.some(d => d.category === "protocol_revenue" \|\| d.category === "tvl_efficiency")` | SS-4 |
| `crypto risk factors include MEV and unlock` | type=CRYPTO, mevScore=70, unlockPressure=80 | `riskFactors.some(r => r.category === "mev_extraction" \|\| r.category === "token_unlock")` | SS-3 |

---

## 4. INTEGRATION TESTS — SERVICE & API LAYER

### 4.1 Analytics API (`src/app/api/stocks/[symbol]/analytics/route.test.ts`)

| Test Case | Request | Expected Response Field | Gap ID |
|-----------|---------|------------------------|--------|
| `crypto analytics includes cryptoIntelligence` | GET /api/stocks/BTC-USD/analytics | `response.cryptoIntelligence !== undefined` | AA-1 |
| `cryptoIntelligence has unlockPressure sub-score` | GET /api/stocks/SOL-USD/analytics | `response.cryptoIntelligence.structuralRisk.unlockPressure.score` is number | CI-4 |
| `cryptoIntelligence has holderConcentration` | GET /api/stocks/ETH-USD/analytics | `response.cryptoIntelligence.holderStability.holderConcentration` is number | CI-6 |
| `cryptoIntelligence has mevExposure score` | GET /api/stocks/UNI-USD/analytics | `response.cryptoIntelligence.structuralRisk.mevExposure.score` is number | CI-3 |

### 4.2 Portfolio Service (`src/lib/services/__tests__/portfolio.service.test.ts`)

| Test Case | Setup | Expected Assertion | Gap ID |
|-----------|-------|-------------------|--------|
| `portfolio health propagates crypto-intelligence scores` | Portfolio with holdings having cryptoIntelligence data | `healthInputs[0].unlockPressureScore` is number | AA-2 |
| `fragility inputs include mevExposure` | Portfolio with concentrated DEX LP position | `fragilityInputs[0].mevExposureScore > 50` | PF-5 |
| `computeAndStorePortfolioHealth stores crypto sub-scores` | Call with crypto portfolio | `prisma.portfolioHealthSnapshot.create` receives `riskMetrics` with `unlockPressure` | AA-2 |

### 4.3 Context Builder (`src/lib/ai/__tests__/context-builder.test.ts`)

| Test Case | Context Input | Expected Context Block | Gap ID |
|-----------|--------------|------------------------|--------|
| `funding rate block present for crypto` | asset.type=CRYPTO, fundingRate=0.018 | `context.includes("[FUNDING_RATES]")` | CB-3 |
| `exchange flow block present for crypto` | asset.type=CRYPTO, exchangeNetFlow=-$50M | `context.includes("[EXCHANGE_FLOWS]")` | CB-4 |
| `staking yield block present for crypto` | asset.type=CRYPTO, stakingYield=5.2 | `context.includes("[STAKING_YIELD]")` | CB-5 |
| `unlock calendar block present for crypto` | asset.type=CRYPTO, unlocks=[{date, amount}] | `context.includes("[UNLOCK_CALENDAR]")` | CB-1 |
| `MEV score is numeric not text-only` | asset.type=CRYPTO, mevScore=65 | `context.includes("MEV_Exposure:65")` | CB-2 |
| `crypto about is not truncated to 80 chars` | description length = 250 | `context.match(/CRYPTO_ABOUT:.{150,}/)` | CB-9 |

---

## 5. PROMPT & OUTPUT VALIDATION TESTS

### 5.1 System Prompt Assembly (`src/lib/ai/__tests__/system-prompt.test.ts`)

| Test Case | Params | Expected Assertion | Gap ID |
|-----------|--------|-------------------|--------|
| `crypto monitoring checklist has > 3 items` | type=CRYPTO, planTier=ELITE | `prompt.includes("☐")` count >= 5 | SP-1 |
| `crypto asset type guidance includes MEV warning` | type=CRYPTO | `prompt.includes("MEV") \|\| prompt.includes("sandwich")` | SP-1 |
| `crypto asset type guidance includes unlock warning` | type=CRYPTO | `prompt.includes("unlock") \|\| prompt.includes("cliff")` | SP-1 |

### 5.2 Output Validation (`src/lib/ai/__tests__/guardrails.test.ts` or new `output-validation.test.ts`)

| Test Case | LLM Output | Expected Validation Result | Gap ID |
|-----------|------------|---------------------------|--------|
| `"diamond hands" is flagged as banned phrase` | "Just diamond hands through the dip" | `validation.bannedPhrases.includes("diamond hands")` | SP-2 |
| `"wagmi" is flagged as banned phrase` | "We're all gonna make it — wagmi" | `validation.bannedPhrases.includes("wagmi")` | SP-2 |
| `"100x gem" is flagged as banned phrase` | "This is a hidden 100x gem" | `validation.bannedPhrases.includes("100x gem")` | SP-2 |

### 5.3 Query Classifier (`src/lib/ai/__tests__/query-classifier.test.ts`)

| Test Case | Query | Expected Tier | Gap ID |
|-----------|-------|--------------|--------|
| `MEV risk query is COMPLEX` | "What is the MEV risk for Uniswap V3?" | `"COMPLEX"` | QC-1 |
| `Bridge hack risk query is COMPLEX` | "How would a bridge hack affect my Arbitrum ETH?" | `"COMPLEX"` | QC-1 |
| `Token unlock query is COMPLEX` | "When is the next SOL unlock and how will it affect price?" | `"COMPLEX"` | QC-1 |
| `Impermanent loss query is COMPLEX` | "How do I calculate impermanent loss for my ETH-USDC LP?" | `"COMPLEX"` | QC-1 |
| `Oracle manipulation query is COMPLEX` | "Can Chainlink oracles be manipulated?" | `"COMPLEX"` | QC-1 |

---

## 6. BEHAVIOURAL INTELLIGENCE TESTS

### 6.1 Behavioural Pattern Detection (`src/lib/ai/__tests__/behavioral-intelligence.test.ts`)

| Test Case | Query Sequence | Expected Pattern | Gap ID |
|-----------|---------------|------------------|--------|
| `impermanent loss ignorance detected` | ["Should I put all my ETH in a Uniswap pool?", "What is impermanent loss?"] | `patterns.includes("impermanent_loss_ignorance")` | BI-1 |
| `memecoin aping detected` | ["PEPE is pumping, should I buy?", "What about FLOKI?"] | `patterns.includes("memecoin_aping")` | BI-2 |
| `staking lockup blindness detected` | ["I'm staking 100% of my SOL for 30 days", "Should I worry about price drops?"] | `patterns.includes("staking_lockup_blindness")` | BI-3 |

---

## 7. E2E TESTS

### 7.1 Full Crypto Portfolio Journey (`e2e/crypto-portfolio-journey.spec.ts` — NEW FILE)

**Scenario:**
1. User creates portfolio: 40% BTC-USD, 30% ETH-USD, 20% SOL-USD, 10% UNI-USD
2. System computes health/fragility via cron or API trigger
3. User opens dashboard → sees portfolio health card
4. User clicks "Deep Analysis" → chat opens with MODERATE/COMPLEX tier
5. LLM response includes: unlock pressure for SOL, MEV risk for UNI, funding rates for BTC
6. User asks "What if ETH bridge to Arbitrum fails?" → query classified COMPLEX, response includes bridge risk

**Assertions:**
- Portfolio health score < 80 (because of crypto vol and concentration)
- Fragility score reflects cross-chain bridge risk
- Chat response contains "bridge" and "MEV" and "unlock"
- Response does NOT contain banned phrases ("diamond hands", "wagmi")
- Analytics API returns `cryptoIntelligence` for each asset

---

## 8. TEST DATA STRATEGY

### 8.1 Mock External APIs

All new tests must use **deterministic mocks**, not live API calls:

```ts
// Mock TokenUnlocks API
vi.mock("@/lib/services/token-unlocks.service", () => ({
  fetchTokenUnlocks: vi.fn().mockResolvedValue([
    { date: new Date(Date.now() + 7 * 86400000), amount: 5000000, percentOfSupply: 0.15, category: "team" },
  ]),
}));

// Mock Dune holder concentration
vi.mock("@/lib/services/dune.service", () => ({
  fetchHolderConcentration: vi.fn().mockResolvedValue({
    gini: 0.82,
    top10Percent: 0.78,
    top50Percent: 0.95,
  }),
}));

// Mock CoinGlass funding rates
vi.mock("@/lib/services/coinglass.service", () => ({
  fetchFundingRate: vi.fn().mockResolvedValue({
    fundingRate: 0.018,
    openInterest: 2.5e9,
    openInterestPercentile: 0.92,
  }),
}));
```

### 8.2 Golden Master Data

Create a shared `crypto-golden-masters.ts` file with canonical test assets:

```ts
export const GOLDEN_BTC = {
  symbol: "BTC-USD",
  type: "CRYPTO",
  price: 92400,
  marketCap: 1.82e12,
  cryptoIntelligence: {
    networkActivity: { score: 85, activeAddresses30d: 1.2e6 },
    holderStability: { score: 70, holderConcentration: 0.45, top10Percent: 0.12 },
    liquidityRisk: { score: 90, volumeToMcap: 0.023 },
    structuralRisk: { score: 75, unlockPressure: { score: 5, next30dPct: 0.0 }, mevExposure: { score: 10 } },
    enhancedTrust: { score: 88 },
  },
};

export const GOLDEN_UNI = {
  symbol: "UNI-USD",
  type: "CRYPTO",
  price: 12.5,
  marketCap: 7.5e9,
  cryptoIntelligence: {
    networkActivity: { score: 60, activeAddresses30d: 45000 },
    holderStability: { score: 55, holderConcentration: 0.72, top10Percent: 0.68 },
    liquidityRisk: { score: 75, volumeToMcap: 0.015 },
    structuralRisk: {
      score: 45,
      unlockPressure: { score: 65, next30dPct: 0.12 },
      mevExposure: { score: 70, slippage1000USD: 0.025 },
      bridgeDependency: { score: 0 },
    },
    enhancedTrust: { score: 62 },
  },
};

export const GOLDEN_PEPE = {
  symbol: "PEPE-USD",
  type: "CRYPTO",
  price: 0.000012,
  marketCap: 5.0e9,
  cryptoIntelligence: {
    networkActivity: { score: 30, activeAddresses30d: 8000 },
    holderStability: { score: 20, holderConcentration: 0.91, top10Percent: 0.85 },
    liquidityRisk: { score: 35, volumeToMcap: 0.08 },
    structuralRisk: { score: 25, unlockPressure: { score: 90, next30dPct: 0.35 }, mevExposure: { score: 85 } },
    enhancedTrust: { score: 15 },
  },
};
```

---

## 9. CONTINUOUS VALIDATION

### 9.1 Nightly Golden Master Regression

Run a nightly job that:
1. Computes signal strength for all ~200 CRYPTO assets in the DB
2. Asserts top-10 assets by signal strength have `cryptoFundamentalScore > 0` (post Phase 1)
3. Asserts no memecoin in top-10 has `qualityScore > 70`
4. Asserts portfolio health for a 100% BTC portfolio is < 75 (concentration penalty)

### 9.2 Prompt Output Sampling

Weekly, sample 50 random crypto chat responses and assert:
- `monitoringChecklist.length >= 5` (SP-1)
- No banned phrases (SP-2)
- `riskFactors` mentions MEV if mevScore > 60
- `riskFactors` mentions unlock if unlockPressure > 50

### 9.3 Data Pipeline Freshness

Monitor:
- `TokenUnlockEvent` table: assert 80%+ of CRYPTO assets have unlock data within 30 days of CI-4 shipping
- `Asset.holderConcentration` field: assert 70%+ of CRYPTO assets have data within 30 days of CI-6 shipping

---

## 10. RUNNING THE TESTS

```bash
# Unit tests (fast)
npm test -- src/lib/engines/__tests__/portfolio-health.test.ts
npm test -- src/lib/engines/__tests__/portfolio-fragility.test.ts
npm test -- src/lib/engines/__tests__/crypto-intelligence.test.ts
npm test -- src/lib/engines/__tests__/signal-strength.test.ts
npm test -- src/lib/ai/__tests__/context-builder.test.ts
npm test -- src/lib/ai/__tests__/query-classifier.test.ts
npm test -- src/lib/ai/__tests__/behavioral-intelligence.test.ts

# Integration tests
npm test -- src/app/api/stocks/[symbol]/analytics/route.test.ts
npm test -- src/lib/services/__tests__/portfolio.service.test.ts

# E2E tests
npx playwright test e2e/crypto-portfolio-journey.spec.ts
```

---

*End of Test Strategy*
