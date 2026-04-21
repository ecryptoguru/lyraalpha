# Crypto Gap Priority Matrix & Implementation Plan

**Version:** 2026-04-25-v1  
**Derived from:** `docs/crypto-gap-analysis-2026-04.md`

---

## 1. PRIORITY MATRIX

### 1.1 P0 — Critical (Ship-Blocking, Wrong Decisions)

| ID | Gap | Area | Effort | Dependencies | Rationale |
|----|-----|------|--------|--------------|-----------|
| SS-1 | Fundamental layer weight = 0.00 for crypto; no replacement proxy | `signal-strength.ts` + data pipeline | **2-3 weeks** | Token Terminal API key + schema migration for `protocolRevenue`, `feeBurnRatio`, `activeAddressGrowth` | All crypto signals are pure momentum. Cannot distinguish revenue-generating DeFi from memecoin. |
| AA-2 | Crypto-intelligence sub-scores never reach portfolio engines | `portfolio.service.ts` + `portfolio-health.ts` + `portfolio-fragility.ts` + schema | **1-2 weeks** | Requires crypto-intelligence data model already populated (it is) | Portfolio health/fragility treat a token with 80% whale concentration and a token with distributed holders identically. |
| MC-1 | Single VOL_MULTIPLIER = 0.045 for crypto; no regime adjustment | `portfolio-monte-carlo.ts` | **3-5 days** | Market regime state already available | Stress-test VaR systematically understated in bear markets for crypto portfolios. |

### 1.2 P1 — High (Major Precision Loss, Major Asset Classes Affected)

| ID | Gap | Area | Effort | Dependencies | Rationale |
|----|-----|------|--------|--------------|-----------|
| CI-4 | Unlock pressure uses MCap/FDV heuristic, not calendar data | `crypto-intelligence.ts` + data sync cron | **1 week** | CoinGecko or TokenUnlocks API integration | Users hold tokens with imminent cliff unlocks rated "Unlock Pressure: 20". |
| CI-6 | Holder stability uses circulating/total ratio, not on-chain Gini | `crypto-intelligence.ts` + data sync cron | **1-2 weeks** | Dune / Arkham API or on-chain data provider | 80% whale-held tokens score high on "holder stability". |
| MC-5 | Static correlation matrix; no dynamic jump in crypto stress | `portfolio-monte-carlo.ts` | **3-5 days** | Requires sector-pair correlation history | Diversification benefit overstated during crypto crashes. |
| CB-3 | No funding rate / open interest in context builder | `context-builder.ts` + data sync cron | **3-5 days** | CoinGlass or Coinglass API | LLM cannot warn about crowded leverage. |
| AA-1 | Analytics API response omits `cryptoIntelligence` | `analytics/route.ts` + frontend types | **2-3 days** | None — field already exists in Asset record | Frontend analytics cards cannot display unlock, MEV, TVL data. |
| PH-1 | Quality score ignores smart-contract / bridge / governance risk | `portfolio-health.ts` | **3-5 days** | CI-4 / CI-6 / unlock data available | High-smart-contract-risk tokens rated Quality 70+. |

### 1.3 P2 — Medium (Degraded Precision, Moderate Effort)

| ID | Gap | Area | Effort | Dependencies | Rationale |
|----|-----|------|--------|--------------|-----------|
| PF-1 | REGIME_STRESS_GAMMA = 0.65 generic; crypto should be 0.80-0.90 | `portfolio-fragility.ts` | **1-2 days** | None — constant change | Fragility under-estimates tail risk in crypto regime shifts. |
| CI-7 | No staking yield sustainability score | `crypto-intelligence.ts` | **3-5 days** | Yield source decomposition data | Users chase 20% emission-funded APY without warning. |
| CI-9 | No oracle manipulation risk | `crypto-intelligence.ts` | **3-5 days** | Protocol audit / oracle provider data | DeFi positions with manipulable oracles show no structural risk. |
| CB-4 | No exchange-reserves / exchange-flow injection | `context-builder.ts` | **3-5 days** | Exchange flow data provider | Whale-to-exchange selling pressure invisible to LLM. |
| CB-5 | No staking yield / emission schedule injection | `context-builder.ts` | **2-3 days** | Emissions data from CoinGecko or TokenUnlocks | LLM cannot evaluate yield sustainability or dilution. |
| CB-6 | No governance proposal / DAO-treasury injection | `context-builder.ts` | **3-5 days** | Snapshot API or governance data provider | Near-term governance catalysts invisible to LLM. |
| SP-1 | Monitoring checklist capped at 3 items for crypto | `prompts/system.ts` | **1-2 days** | None — prompt-only change | Users miss funding-rate, exchange-flow, active-address watchpoints. |
| DP-3 | No Token Terminal, Dune, Nansen, Arkham, CoinGlass | Data sync cron + service layer | **2-3 weeks** | API keys + schema migrations | Revenue, whale Gini, funding, OI unavailable. |
| CI-1 | Network activity over-weights GitHub commits | `crypto-intelligence.ts` | **2-3 days** | On-chain active-address data from provider | "Zombie" projects with active repos score high. |
| CI-2 | TVL not risk-adjusted for composition | `crypto-intelligence.ts` | **3-5 days** | DeFiLlama sub-protocol breakdown | Concentrated TVL protocols show high structural health. |

### 1.4 P3 — Low (Cosmetic / Edge Case / Quick Win)

| ID | Gap | Area | Effort | Dependencies | Rationale |
|----|-----|------|--------|--------------|-----------|
| CI-10 | CoinGecko category names noisy | `crypto-intelligence.ts` | **1-2 days** | Manual category mapping table | Memecoins split across pseudo-sectors. |
| SP-2 | No crypto-specific banned phrases | `output-validation.ts` | **1 day** | None | "Diamond hands", "wagmi" may leak into output. |
| CB-9 | CRYPTO_ABOUT truncated to 80 chars | `context-builder.ts` | **1 day** | None | Fragmented descriptions for smaller tokens. |
| QC-1 | No COMPLEX classification for MEV / bridge / unlock queries | `query-classifier.ts` | **1-2 days** | None | Deep crypto-risk queries under-classified. |
| BI-1 | No impermanent-loss ignorance pattern | `behavioral-intelligence.ts` | **2-3 days** | None | LP position risk untriggered. |
| BI-2 | No memecoin-aping pattern | `behavioral-intelligence.ts` | **2-3 days** | None | Low-liquidity token traps untriggered. |
| CG-2 | Grouping lacks memecoin / AI / RWA category | `grouping.ts` | **2-3 days** | Category normalisation (CI-10) | Grouping narrative less precise. |
| PF-5 | No MEV extraction risk in fragility | `portfolio-fragility.ts` | **2-3 days** | MEV score from CI engine | DEX pool fragility invisible. |
| CI-3 | MEV exposure is binary, not slippage-calibrated | `crypto-intelligence.ts` | **3-5 days** | Slippage-at-size data from GeckoTerminal | Position sizing cannot use slippage data. |
| CB-2 | MEV exposure injected as text, not numeric score | `context-builder.ts` | **1 day** | CI-3 | LLM cannot quote slippage %. |
| CB-7 | No smart-contract audit history injection | `context-builder.ts` | **2-3 days** | Audit data provider (e.g., DeFiSafety, CertiK) | Unaudited protocols not flagged. |
| CB-8 | No cross-chain bridge exposure injection | `context-builder.ts` | **2-3 days** | Bridge mapping data | Multi-chain asset risk invisible. |

---

## 2. IMPLEMENTATION PLAN

### Phase 1 — Foundation (Weeks 1-2)
**Goal:** Fix the two critical architectural voids: (1) crypto fundamental layer, and (2) engine-to-portfolio data flow.

**Week 1 — Crypto Fundamental Score (SS-1)**
- **Day 1-2:** Define `CryptoFundamentalData` interface:
  ```ts
  interface CryptoFundamentalData {
    protocolRevenueAnnualized: number | null;      // USD
    feeBurnRatio: number | null;                     // burn / revenue
    activeAddressGrowth30d: number | null;          // % change
    tvlEfficiency: number | null;                   // TVL / MarketCap
    stakingYieldSustainable: number | null;         // yield from fees / total yield
    developerRetentionScore: number | null;         // 0-100
  }
  ```
- **Day 3-4:** Implement `calculateCryptoFundamentalScore()` in `src/lib/engines/crypto-fundamentals.ts` (new file). Score 0-100 based on:
  - Revenue / Market Cap (weight 0.25)
  - Fee-burn ratio (weight 0.20)
  - Active-address growth (weight 0.20)
  - TVL efficiency (weight 0.15)
  - Staking yield sustainability (weight 0.10)
  - Developer retention (weight 0.10)
- **Day 5:** Update `signal-strength.ts`:
  - Change `fundamentalWeight = assetType === "crypto" ? 0.00 : 0.20` → `assetType === "crypto" ? 0.15 : 0.20`
  - Reduce `dseWeight` for crypto from 0.55 → 0.40 (keep total 1.0)
  - Add `cryptoFundamentalScore` to `CryptoInput` and wire into `calculateSignalStrength`
- **Day 5 (parallel):** Add `cryptoFundamentalScore` to Prisma `Asset` schema as `Json?` field. Run `npm run db:generate`.

**Week 2 — Portfolio Engine Data Flow (AA-2, PH-1, PF-1)**
- **Day 1-2:** Extend `HoldingInput` and `FragilityHoldingInput` in `portfolio-health.ts` and `portfolio-fragility.ts`:
  ```ts
  interface CryptoHoldingExtras {
    unlockPressureScore: number | null;
    mevExposureScore: number | null;
    bridgeDependencyScore: number | null;
    holderConcentrationScore: number | null;  // 100 - whaleGini
    smartContractRiskScore: number | null;    // audit + exploit history
  }
  ```
- **Day 3:** Update `portfolio.service.ts` `buildHoldingInputs()` to extract crypto-intelligence sub-scores from Asset record and pass through.
- **Day 4:** Add crypto-specific components to `portfolio-health.ts`:
  - `weightedSmartContractRisk` — penalise quality if avg smartContractRisk < 40
  - `weightedUnlockPressure` — penalise if any holding has unlockPressure > 70
  - `weightedHolderConcentration` — adjust correlation / quality dimensions
- **Day 5:** Add crypto-specific components to `portfolio-fragility.ts`:
  - `crossChainConcentrationFragility` — if multiple holdings are bridged versions of same base asset
  - `stablecoinDepegFragility` — improve from binary to weighted by reserve quality
  - Increase `REGIME_STRESS_GAMMA` for crypto portfolios from 0.65 → 0.85

### Phase 2 — Monte Carlo & Stress Testing (Week 3)
**Goal:** Fix vol calibration and correlation dynamics for crypto stress tests.

**Week 3 — Regime-Aware Monte Carlo (MC-1, MC-5)**
- **Day 1:** Replace `VOL_MULTIPLIER` constant with regime-dependent lookup:
  ```ts
  const CRYPTO_VOL_MULTIPLIERS = {
    BULL: 0.040,
    NEUTRAL: 0.055,
    BEAR: 0.085,
    EXTREME_STRESS: 0.120,
  };
  ```
- **Day 2:** Add `currentRegime` parameter to `simulateRegimeSwitchingPaths()` and select multiplier.
- **Day 3:** Implement dynamic correlation jump: during stress events (flash crash or regime switch to EXTREME_STRESS), override same-sector crypto pair correlations to `max(baseCorr, 0.85)`.
- **Day 4:** Add funding-rate / OI regime: if `fundingRate > 0.03 && openInterestPercentile > 0.90`, increase `flashCrashProb` by 2x and add secondary shock at `t = T/2 + 2` days.
- **Day 5:** Add Lévy/jump-diffusion calibration: replace single Gaussian flash-crash shock with a `t-distribution` shock (df=3) to capture fat tails. Run accuracy tests against historical crypto drawdowns.

### Phase 3 — Data Pipeline & Context Builder (Weeks 4-5)
**Goal:** Feed the prompt engine with richer crypto-native data.

**Week 4 — Unlock Calendar & On-Chain Gini (CI-4, CI-6)**
- **Day 1-2:** Integrate CoinGecko "upcoming unlocks" endpoint or TokenUnlocks API. Store in new Prisma table `TokenUnlockEvent` (assetId, unlockDate, amount, percentOfSupply, category: team/seed/public).
- **Day 3:** Update `crypto-intelligence.ts` `calculateUnlockPressure()` to use actual next-30-day unlock percent instead of MCap/FDV heuristic:
  ```ts
  const next30dUnlockPct = sum(unlocks.filter(u => u.unlockDate <= now + 30d).amount) / totalSupply;
  unlockPressureScore = Math.min(100, next30dUnlockPct * 500);  // 20% unlock = 100 score
  ```
- **Day 4-5:** Integrate Dune / Arkham for on-chain holder concentration. Store `holderGini` and `top10HolderPercent` in Asset record. Update `calculateHolderStability()` to weight `100 - top10HolderPercent` at 0.60 and `circulating/total` at 0.40.

**Week 5 — Context Builder Enrichment (CB-3, CB-4, CB-5, CB-6, AA-1)**
- **Day 1:** Add `[FUNDING_RATES]` and `[OPEN_INTEREST]` blocks to `context-builder.ts`. Fetch from CoinGlass or existing exchange data.
- **Day 2:** Add `[EXCHANGE_FLOWS]` block (exchange inflow / outflow net 7d).
- **Day 3:** Add `[STAKING_YIELD]` and `[EMISSION_SCHEDULE]` blocks. Source: CoinGecko `staking_percentage` + custom emissions data.
- **Day 4:** Add `[GOVERNANCE]` block — active Snapshot proposals with vote end date and estimated impact.
- **Day 5:** Add `cryptoIntelligence` to analytics API response payload (`analytics/route.ts`). Update frontend types if needed.

### Phase 4 — Intelligence Engine Hardening (Week 6)
**Goal:** Add missing crypto-specific risk scores to the intelligence engine.

**Week 6 — Yield Sustainability, Oracle Risk, MEV Calibration (CI-7, CI-9, CI-3)**
- **Day 1-2:** Implement `calculateStakingYieldSustainability()`:
  - If yield source = protocol fees / revenue → score 80+
  - If yield source = inflation / emissions → score proportional to emission decay rate
  - If yield source = ponzi / reflexive → score < 20
- **Day 3-4:** Implement `calculateOracleRisk()`:
  - Check oracle provider (Chainlink = lower risk, custom TWAP = higher risk)
  - Historical manipulation incidents
  - Deviation threshold vs actual price
- **Day 5:** Calibrate MEV exposure from binary to score based on GeckoTerminal `slippage_1000USD` or `slippage_10000USD`:
  ```ts
  mevScore = Math.min(100, (slippage1000USD * 100) * 2);  // 2% slippage on $1K = 40 score
  ```

### Phase 5 — Prompt, Validation & Behavioural Nudges (Week 7)
**Goal:** Align output quality with crypto-native risks and user behaviours.

**Week 7 — Prompt & Validation (SP-1, SP-2, QC-1, BI-1, BI-2)**
- **Day 1:** Expand monitoring checklist to 5-7 items for crypto assets in `prompts/system.ts`.
- **Day 2:** Add crypto-specific banned phrases to `output-validation.ts`: "diamond hands", "wagmi", "ser", "100x gem", "moonshot", "lambo".
- **Day 3:** Add COMPLEX classification patterns for MEV, bridge, unlock, impermanent loss queries in `query-classifier.ts`.
- **Day 4-5:** Add behavioural patterns:
  - `impermanentLossIgnorance`: detects LP-position queries without hedging awareness
  - `memecoinAping`: detects low-liquidity + high-vol + social-hype token mentions
  - `stakingLockupBlindness`: detects 100% staking into long lockups without vol consideration

### Phase 6 — Quality & Testing (Week 8)
**Goal:** Add regression tests for all crypto-specific gaps.

**Week 8 — Test Coverage (TC-1 through TC-6)**
- **Day 1-2:** Add `portfolio-health.test.ts` cases:
  - Memecoin portfolio (100% DOGE, 50% SHIB + 50% PEPE) → assert low quality / high concentration
  - Stablecoin-only portfolio (100% USDC) → assert low health (de-peg concentration)
  - Cross-chain ETH portfolio (ETH + WETH-Arbitrum + WETH-Optimism) → assert low diversification
- **Day 3-4:** Add `portfolio-fragility.test.ts` cases:
  - Unlock-pressure scenario: 3 tokens with cliff unlocks in 7 days → assert elevated fragility
  - High-MEV asset: concentrated position in low-liquidity DEX pair → assert elevated fragility
- **Day 5:** Add `signal-strength.test.ts` case:
  - Assert `fundamentalWeight > 0` when `type === "CRYPTO"` and `cryptoFundamentalScore` is present
  - Assert revenue-generating DeFi protocol scores higher than memecoin with identical price action

---

## 3. DEPENDENCY GRAPH

```
Phase 1 (Foundation)
  ├── SS-1 ──► requires Token Terminal / Dune API keys
  └── AA-2 ──► requires crypto-intelligence fields (already exist)

Phase 2 (Monte Carlo)
  ├── MC-1 ──► requires market regime state (already exist)
  └── MC-5 ──► requires Phase 1 completion for sector-pair data

Phase 3 (Data Pipeline)
  ├── CI-4 ──► requires CoinGecko / TokenUnlocks API
  ├── CI-6 ──► requires Dune / Arkham API
  └── CB-* ──► requires Phase 3 data sources

Phase 4 (Intelligence Hardening)
  ├── CI-7 ──► requires yield source data (may be manual initially)
  ├── CI-9 ──► requires oracle provider data
  └── CI-3 ──► requires GeckoTerminal slippage data (already exist)

Phase 5 (Prompt/Validation)
  └── All prompt changes ──► independent, can ship any time

Phase 6 (Testing)
  └── All tests ──► requires preceding phases for realistic mock data
```

---

## 4. QUICK WINS (Can Ship Independently in < 3 Days)

These require no external API keys or schema migrations and can be deployed immediately:

1. **PF-1:** Change `REGIME_STRESS_GAMMA` for crypto portfolios from 0.65 → 0.85 in `portfolio-fragility.ts`.
2. **SP-1:** Expand monitoring checklist to 5 items for crypto in `prompts/system.ts`.
3. **SP-2:** Add crypto banned phrases to `output-validation.ts`.
4. **CB-9:** Increase `CRYPTO_ABOUT` truncation from 80 → 200 chars in `context-builder.ts`.
5. **QC-1:** Add MEV / bridge / unlock / IL patterns to `query-classifier.ts` COMPLEX_PATTERNS.
6. **AA-1:** Add `cryptoIntelligence` to analytics API response payload.
7. **CG-2:** Add Memecoin / AI / RWA group categories in `grouping.ts`.

---

## 5. ESTIMATED TIMELINE

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Quick Wins | 3 days | Day 3 |
| Phase 1 — Foundation | 2 weeks | Day 17 |
| Phase 2 — Monte Carlo | 1 week | Day 24 |
| Phase 3 — Data Pipeline | 2 weeks | Day 38 |
| Phase 4 — Intelligence Hardening | 1 week | Day 45 |
| Phase 5 — Prompt & Behaviour | 1 week | Day 52 |
| Phase 6 — Testing | 1 week | Day 59 |
| **Total** | **~8.5 weeks** | **~2 months** |

**Critical path:** Phase 1 → Phase 3 → Phase 4. Phases 2, 5, and 6 can partially overlap with Phase 3 if resourcing allows.

---

*End of Priority Matrix & Implementation Plan*
