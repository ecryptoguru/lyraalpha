/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { CryptoIntelligenceEngine } from "../crypto-intelligence";
import type { PoolLiquiditySummary } from "@/lib/services/gecko-terminal.service";

function makePoolSummary(partial: Partial<PoolLiquiditySummary> = {}): PoolLiquiditySummary {
  return {
    totalPools: partial.totalPools ?? 10,
    totalReserveUsd: partial.totalReserveUsd ?? 10_000_000,
    totalVolume24h: partial.totalVolume24h ?? 5_000_000,
    totalBuys24h: partial.totalBuys24h ?? 1000,
    totalSells24h: partial.totalSells24h ?? 900,
    totalBuyers24h: partial.totalBuyers24h ?? 500,
    totalSellers24h: partial.totalSellers24h ?? 450,
    topPoolReserve: partial.topPoolReserve ?? 2_000_000,
    topPoolName: partial.topPoolName ?? "TestPool/WETH",
    top3PoolConcentration: partial.top3PoolConcentration ?? 40,
    avgPoolReserve: partial.avgPoolReserve ?? 1_000_000,
    dexCount: partial.dexCount ?? 4,
    buyToSellRatio: partial.buyToSellRatio ?? 1.1,
    ...partial,
  };
}

describe("CryptoIntelligenceEngine", () => {
  describe("computeNetworkActivity", () => {
    it("returns reasonable default scores with no data", () => {
      const result = CryptoIntelligenceEngine.computeNetworkActivity({}, null, null);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.drivers.length).toBeGreaterThanOrEqual(1);
    });

    it("weights on-chain activity higher than GitHub stars (CI-1)", () => {
      // Same moderate dev activity, but one has strong on-chain and the other has none.
      // On-chain should be the differentiator, not GitHub vanity metrics.
      const strongOnChain = CryptoIntelligenceEngine.computeNetworkActivity(
        { developer: { commitCount4Weeks: 30, stars: 2000, pullRequestsMerged: 15 } },
        null,
        makePoolSummary({ totalBuys24h: 25000, totalSells24h: 20000 }),
      );

      const weakOnChain = CryptoIntelligenceEngine.computeNetworkActivity(
        { developer: { commitCount4Weeks: 30, stars: 2000, pullRequestsMerged: 15 } },
        null,
        makePoolSummary({ totalBuys24h: 50, totalSells24h: 40 }),
      );

      // Same dev profile — on-chain delta should drive a meaningful score gap
      expect(strongOnChain.score).toBeGreaterThan(weakOnChain.score + 10);
      expect(strongOnChain.onChainActivity).toBeGreaterThan(weakOnChain.onChainActivity);
    });
  });

  describe("computeHolderStability", () => {
    it("uses on-chain Gini data when available (CI-6)", () => {
      const withGini = CryptoIntelligenceEngine.computeHolderStability(
        { circulatingSupply: 1000, totalSupply: 2000 },
        null,
        1_000_000,
        0.75, // high Gini = concentrated
        60,   // top10 = 60%
      );

      const withoutGini = CryptoIntelligenceEngine.computeHolderStability(
        { circulatingSupply: 1000, totalSupply: 2000 },
        null,
        1_000_000,
        null,
        null,
      );

      // With Gini=0.75 (high concentration), supply concentration should be low
      expect(withGini.supplyConcentration).toBeLessThan(50);
      // Without Gini data, fallback to circulating/total = 50%
      expect(withoutGini.supplyConcentration).toBeLessThanOrEqual(55);
    });

    it("penalizes low marketCap/FDV ratio (high dilution risk)", () => {
      // MCap = 1M, FDV = 100M → 1% ratio → severe dilution risk
      const result = CryptoIntelligenceEngine.computeHolderStability(
        { fullyDilutedValuation: 100_000_000 },
        null,
        1_000_000,
        null,
        null,
      );

      expect(result.marketCapToFDV).toBeLessThan(30);
    });
  });

  describe("computeLiquidityRisk", () => {
    it("scores active tokens with volume-to-mcap ratio in mid-range, not always 100 (HB-3)", () => {
      const mcap = 1_000_000_000;
      const volume = mcap * 0.03; // 3% ratio
      const result = CryptoIntelligenceEngine.computeLiquidityRisk(mcap, volume, null);

      // Should not be 100 (was the pre-fix bug where any positive ratio hit 100)
      expect(result.score).toBeLessThan(100);
      expect(result.volumeToMcap).toBeLessThan(100);
    });

    it("caps volumeToMcap near upper bound for extremely high ratio tokens", () => {
      const result = CryptoIntelligenceEngine.computeLiquidityRisk(1_000_000, 500_000_000, null);
      expect(result.volumeToMcap).toBeGreaterThanOrEqual(90);
      expect(result.volumeToMcap).toBeLessThanOrEqual(95);
    });

    it("uses poolSummary data when available", () => {
      const result = CryptoIntelligenceEngine.computeLiquidityRisk(
        10_000_000_000,
        500_000_000,
        makePoolSummary({ totalReserveUsd: 100_000_000, totalVolume24h: 200_000_000, totalPools: 50, dexCount: 8 }),
      );

      expect(result.dexLiquidity).toBeGreaterThan(50);
      expect(result.exchangePresence).toBeGreaterThan(50);
    });
  });

  describe("computeStructuralRisk", () => {
    it("calibrates MEV from binary category to continuous score using pool data (CI-3)", () => {
      const result = CryptoIntelligenceEngine.computeStructuralRisk(
        { categories: ["Decentralized Exchange"] },
        1_000_000_000,
        [],
        makePoolSummary({ totalReserveUsd: 500_000, totalPools: 2, dexCount: 1, top3PoolConcentration: 95 }),
        null,
        null,
      );

      // DeFi base=70 + thin liquidity + concentrated pools = elevated MEV
      expect(result.mevExposure.score).toBeGreaterThan(70);
    });

    it("mevExposure decreases with broad DEX distribution", () => {
      const result = CryptoIntelligenceEngine.computeStructuralRisk(
        { categories: ["Decentralized Exchange"] },
        1_000_000_000,
        [],
        makePoolSummary({ totalReserveUsd: 500_000_000, totalPools: 40, dexCount: 8, top3PoolConcentration: 30 }),
        null,
        null,
      );

      // DeFi base=70 but broad distribution reduces it
      expect(result.mevExposure.score).toBeLessThan(70);
    });

    it("uses unlock calendar data when available (CI-4)", () => {
      const now = new Date();
      const future = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      const result = CryptoIntelligenceEngine.computeStructuralRisk(
        { totalSupply: 1_000_000_000 },
        5_000_000_000,
        [
          { unlockDate: future, amount: 120_000_000, percentOfSupply: 0.12, category: "team" },
        ],
        null,
        null,
        null,
      );

      // 12% unlock in 15 days → 0.12 * 500 = 60 → score > 50
      expect(result.unlockPressure.score).toBeGreaterThan(50);
    });

    it("classifies staking yield sustainability correctly (CI-7)", () => {
      const feeBacked = CryptoIntelligenceEngine.computeStructuralRisk(
        {}, 1_000_000_000, [], null,
        { source: "protocol fees", apr: 5.0, sustainable: true },
        null,
      );

      const ponzi = CryptoIntelligenceEngine.computeStructuralRisk(
        {}, 1_000_000_000, [], null,
        { source: "reflexive ponzi", apr: 200.0, sustainable: false },
        null,
      );

      expect(feeBacked.yieldSustainability.score).toBeLessThan(30);
      expect(ponzi.yieldSustainability.score).toBeGreaterThan(80);
    });

    it("assesses oracle risk for DeFi protocols (CI-9)", () => {
      const result = CryptoIntelligenceEngine.computeStructuralRisk(
        { categories: ["Lending Protocol"], marketCapRank: 200 },
        50_000_000,
        [],
        makePoolSummary({ totalReserveUsd: 2_000_000 }),
        null,
        null,
      );

      // Lending + small cap + low liquidity = elevated oracle risk
      expect(result.oracleRisk.score).toBeGreaterThan(50);
    });

    it("returns low oracle risk for L1 assets", () => {
      const result = CryptoIntelligenceEngine.computeStructuralRisk(
        { categories: ["Layer 1"] },
        500_000_000_000,
        [],
        null,
        null,
        null,
      );

      expect(result.oracleRisk.score).toBeLessThan(20);
    });

    it("scores inflation risk from emission schedule (CI-5)", () => {
      const lowInflation = CryptoIntelligenceEngine.computeStructuralRisk(
        {}, 1_000_000_000, [], null, null,
        { nextYearInflationPct: 0.5 },
      );

      const highInflation = CryptoIntelligenceEngine.computeStructuralRisk(
        {}, 1_000_000_000, [], null, null,
        { nextYearInflationPct: 25 },
      );

      expect(lowInflation.inflationRisk.score).toBeLessThan(30);
      expect(highInflation.inflationRisk.score).toBeGreaterThan(80);
    });

    it("falls back to max supply ratio for inflation when no emission data", () => {
      const result = CryptoIntelligenceEngine.computeStructuralRisk(
        { totalSupply: 15_000_000, maxSupply: 21_000_000 },
        1_000_000_000, [], null, null, null,
      );

      // ~29% remaining → moderate-high inflation risk
      expect(result.inflationRisk.score).toBeGreaterThan(25);
    });
  });

  describe("computeEnhancedTrust", () => {
    it("penalizes very young projects (MB-5)", () => {
      const recent = CryptoIntelligenceEngine.computeEnhancedTrust(
        { genesisDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
        {
          dependencyRisk: { score: 50, level: "moderate", description: "" },
          governanceRisk: { score: 50, level: "moderate", description: "" },
          maturityRisk: { score: 80, level: "high", description: "" },
          unlockPressure: { score: 50, level: "moderate", description: "" },
          mevExposure: { score: 50, level: "moderate", description: "" },
          bridgeDependency: { score: 50, level: "moderate", description: "" },
          yieldSustainability: { score: 50, level: "moderate", description: "" },
          oracleRisk: { score: 50, level: "moderate", description: "" },
          inflationRisk: { score: 50, level: "moderate", description: "" },
          overallLevel: "high",
        },
        70,
      );

      const established = CryptoIntelligenceEngine.computeEnhancedTrust(
        { genesisDate: "2015-07-30" },
        {
          dependencyRisk: { score: 20, level: "low", description: "" },
          governanceRisk: { score: 20, level: "low", description: "" },
          maturityRisk: { score: 15, level: "low", description: "" },
          unlockPressure: { score: 20, level: "low", description: "" },
          mevExposure: { score: 40, level: "moderate", description: "" },
          bridgeDependency: { score: 10, level: "low", description: "" },
          yieldSustainability: { score: 20, level: "low", description: "" },
          oracleRisk: { score: 10, level: "low", description: "" },
          inflationRisk: { score: 20, level: "low", description: "" },
          overallLevel: "low",
        },
        85,
      );

      expect(recent.components.protocolAge.score).toBeLessThan(established.components.protocolAge.score);
      expect(recent.score).toBeLessThan(established.score);
    });
  });
});
