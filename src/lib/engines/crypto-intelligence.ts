import { PrismaClient } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";
import { DefiLlamaService } from "@/lib/services/defillama.service";
import { GeckoTerminalService, PoolLiquiditySummary } from "@/lib/services/gecko-terminal.service";

const logger = createLogger({ service: "crypto-intelligence" });

// ─── Types ──────────────────────────────────────────────────────────

export interface NetworkActivityScore {
  score: number; // 0-100
  devActivity: number; // 0-100 sub-score
  tvlHealth: number; // 0-100 sub-score
  communityEngagement: number; // 0-100 sub-score
  onChainActivity: number; // 0-100 sub-score (from GeckoTerminal txns)
  drivers: string[];
}

export interface HolderStabilityScore {
  score: number; // 0-100
  supplyConcentration: number; // 0-100 (inverted — high = more distributed)
  buyPressure: number; // 0-100 (from buy/sell ratio)
  marketCapToFDV: number; // 0-100 (higher = less dilution risk)
  priceStability: number; // 0-100 (lower volatility = more stable)
  drivers: string[];
}

export interface LiquidityRiskScore {
  score: number; // 0-100 (higher = more liquid, lower risk)
  volumeToMcap: number; // 0-100
  dexLiquidity: number; // 0-100 (from GeckoTerminal pool depth)
  exchangePresence: number; // 0-100 (pool count + DEX diversity)
  poolConcentration: number; // 0-100 (inverted — high = well distributed)
  drivers: string[];
  poolSummary: PoolLiquiditySummary | null;
}

export interface CryptoStructuralRisk {
  dependencyRisk: { score: number; level: string; description: string };
  governanceRisk: { score: number; level: string; description: string };
  maturityRisk: { score: number; level: string; description: string };
  overallLevel: "low" | "moderate" | "high" | "critical";
}

export interface EnhancedCryptoTrust {
  score: number; // 0-100
  components: {
    protocolAge: { score: number; weight: number };
    devActivity: { score: number; weight: number };
    governanceTransparency: { score: number; weight: number };
    dependencyRisk: { score: number; weight: number };
    communityStrength: { score: number; weight: number };
    baseTrust: { score: number; weight: number };
  };
  level: "very-high" | "high" | "moderate" | "low" | "very-low";
}

export interface CryptoIntelligenceResult {
  networkActivity: NetworkActivityScore;
  holderStability: HolderStabilityScore;
  liquidityRisk: LiquidityRiskScore;
  structuralRisk: CryptoStructuralRisk;
  enhancedTrust: EnhancedCryptoTrust;
  tvlData: {
    tvl: number | null;
    tvlChange7d: number | null;
    protocolCount: number | null;
    category: string | null;
    isChain: boolean;
  } | null;
  computedAt: string;
}

// ─── CoinGecko Metadata Shape (from Asset.metadata.coingecko) ───────

interface CGMeta {
  categories?: string[];
  genesisDate?: string | null;
  hashingAlgorithm?: string | null;
  marketCapRank?: number;
  fullyDilutedValuation?: number | null;
  circulatingSupply?: number;
  totalSupply?: number | null;
  maxSupply?: number | null;
  sentimentVotesUpPercentage?: number;
  sentimentVotesDownPercentage?: number;
  watchlistUsers?: number;
  developer?: {
    forks?: number;
    stars?: number;
    subscribers?: number;
    totalIssues?: number;
    closedIssues?: number;
    pullRequestsMerged?: number;
    commitCount4Weeks?: number;
  } | null;
  community?: {
    redditSubscribers?: number;
    telegramUsers?: number | null;
  } | null;
  priceChangePercentage7d?: number;
  priceChangePercentage30d?: number;
  priceChangePercentage60d?: number;
  priceChangePercentage200d?: number;
}

// ─── Core Engine ────────────────────────────────────────────────────

interface AssetData {
  metadata: Record<string, unknown> | null;
  marketCap: number | null;
  volume: number | null;
  avgTrustScore: number | null;
  price: number | null;
  changePercent: number | null;
}

export class CryptoIntelligenceEngine {
  /**
   * Compute crypto intelligence. Accepts optional pre-fetched asset data
   * to avoid a redundant DB query when called from market-sync.
   */
  static async compute(
    prisma: PrismaClient,
    assetId: string,
    symbol: string,
    coingeckoId: string | null,
    preloadedAsset?: AssetData,
  ): Promise<CryptoIntelligenceResult | null> {
    try {
      // Use preloaded data or fetch from DB
      const asset = preloadedAsset ?? await prisma.asset.findUnique({
        where: { id: assetId },
        select: {
          metadata: true,
          marketCap: true,
          volume: true,
          avgTrustScore: true,
          price: true,
          changePercent: true,
        },
      });

      if (!asset) return null;

      const meta = (asset.metadata as Record<string, unknown>) || {};
      const cg = (meta.coingecko as CGMeta) || {};

      // Fetch DefiLlama + GeckoTerminal in parallel (independent APIs)
      const [tvlData, poolSummary] = await Promise.all([
        coingeckoId
          ? DefiLlamaService.getTVLData(coingeckoId).catch(() => null)
          : Promise.resolve(null),
        coingeckoId
          ? GeckoTerminalService.getPoolSummaryForCoinGeckoId(coingeckoId).catch(() => null)
          : Promise.resolve(null),
      ]);

      const marketCap = asset.marketCap ?? 0;
      const volume = asset.volume || 0;

      // 1. Network Activity Score
      const networkActivity = this.computeNetworkActivity(cg, tvlData, poolSummary);

      // 2. Holder Stability Score
      const holderStability = this.computeHolderStability(cg, poolSummary, marketCap);

      // 3. Liquidity Risk Score
      const liquidityRisk = this.computeLiquidityRisk(marketCap, volume, poolSummary);

      // 4. Structural Risk
      const structuralRisk = this.computeStructuralRisk(cg);

      // 5. Enhanced Trust
      const enhancedTrust = this.computeEnhancedTrust(cg, structuralRisk, asset.avgTrustScore);

      return {
        networkActivity,
        holderStability,
        liquidityRisk,
        structuralRisk,
        enhancedTrust,
        tvlData,
        computedAt: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn({ symbol, err: String(err) }, "Crypto intelligence computation failed");
      return null;
    }
  }

  // ─── Network Activity Score ─────────────────────────────────────

  static computeNetworkActivity(
    cg: CGMeta,
    tvlData: CryptoIntelligenceResult["tvlData"],
    poolSummary: PoolLiquiditySummary | null,
  ): NetworkActivityScore {
    const drivers: string[] = [];

    // Dev Activity (30% weight)
    let devScore = 30; // default neutral
    if (cg.developer) {
      const commits = cg.developer.commitCount4Weeks ?? 0;
      const stars = cg.developer.stars ?? 0;
      const prsMerged = cg.developer.pullRequestsMerged ?? 0;

      // Commits: 0→0, 50→50, 100+→80, 200+→100
      const commitScore = Math.min(100, commits * 1.2);
      // Stars: 0→0, 1000→50, 5000→80, 10000+→100
      const starScore = Math.min(100, Math.sqrt(stars) * 3.16);
      // PRs: 0→0, 50→50, 200+→100
      const prScore = Math.min(100, prsMerged * 0.5);

      devScore = Math.round(commitScore * 0.5 + starScore * 0.3 + prScore * 0.2);

      if (commits > 100) drivers.push(`Active dev: ${commits} commits/4wk`);
      else if (commits < 10) drivers.push("Low dev activity");
      if (stars > 5000) drivers.push(`${stars} GitHub stars`);
    } else {
      drivers.push("No developer data available");
    }

    // TVL Health (25% weight)
    let tvlScore = 30;
    if (tvlData?.tvl) {
      // TVL: $0→0, $10M→30, $100M→50, $1B→70, $10B+→100
      tvlScore = Math.min(100, Math.round(Math.log10(Math.max(1, tvlData.tvl)) * 12 - 30));
      tvlScore = Math.max(0, tvlScore);
      if (tvlData.tvlChange7d && tvlData.tvlChange7d > 5) drivers.push(`TVL growing +${tvlData.tvlChange7d.toFixed(0)}% 7d`);
      if (tvlData.tvlChange7d && tvlData.tvlChange7d < -10) drivers.push(`TVL declining ${tvlData.tvlChange7d.toFixed(0)}% 7d`);
      if (tvlData.protocolCount && tvlData.protocolCount > 100) drivers.push(`${tvlData.protocolCount} protocols on chain`);
    }

    // Community Engagement (25% weight)
    let communityScore = 30;
    const sentiment = cg.sentimentVotesUpPercentage ?? 50;
    const watchlist = cg.watchlistUsers ?? 0;
    const reddit = cg.community?.redditSubscribers ?? 0;

    // Sentiment: 0-100 maps directly
    const sentimentScore = Math.round(sentiment);
    // Watchlist: 0→0, 10K→40, 50K→60, 200K+→100
    const watchlistScore = Math.min(100, Math.round(Math.sqrt(watchlist) * 0.22));
    // Reddit: 0→0, 100K→50, 500K→80, 1M+→100
    const redditScore = Math.min(100, Math.round(Math.sqrt(reddit) * 0.1));

    communityScore = Math.round(sentimentScore * 0.4 + watchlistScore * 0.35 + redditScore * 0.25);
    if (sentiment > 70) drivers.push(`Strong sentiment: ${sentiment.toFixed(0)}% positive`);
    if (watchlist > 100000) drivers.push(`${(watchlist / 1000).toFixed(0)}K watchlist users`);

    // On-Chain Activity (20% weight) — from GeckoTerminal
    let onChainScore = 30;
    if (poolSummary) {
      const totalTxns = poolSummary.totalBuys24h + poolSummary.totalSells24h;
      // Txns: 0→0, 100→30, 1000→60, 10000+→100
      onChainScore = Math.min(100, Math.round(Math.log10(Math.max(1, totalTxns)) * 25));
      if (totalTxns > 5000) drivers.push(`${totalTxns.toLocaleString()} DEX txns/24h`);
      if (poolSummary.dexCount > 3) drivers.push(`Active on ${poolSummary.dexCount} DEXs`);
    }

    const score = Math.round(
      devScore * 0.30 +
      tvlScore * 0.25 +
      communityScore * 0.25 +
      onChainScore * 0.20,
    );

    return {
      score: clamp(score),
      devActivity: clamp(devScore),
      tvlHealth: clamp(tvlScore),
      communityEngagement: clamp(communityScore),
      onChainActivity: clamp(onChainScore),
      drivers,
    };
  }

  // ─── Holder Stability Score ─────────────────────────────────────

  static computeHolderStability(
    cg: CGMeta,
    poolSummary: PoolLiquiditySummary | null,
    marketCap: number,
  ): HolderStabilityScore {
    const drivers: string[] = [];

    // Supply Concentration (30% weight) — inverted: more distributed = higher score
    let supplyConcentration = 50;
    const circulating = cg.circulatingSupply ?? 0;
    const total = cg.totalSupply ?? circulating;
    const max = cg.maxSupply ?? total;

    if (total > 0 && circulating > 0) {
      const circulatingRatio = circulating / total;
      // High circulating ratio = more distributed = higher score
      supplyConcentration = Math.round(circulatingRatio * 80 + 10);
      if (circulatingRatio < 0.3) drivers.push(`Only ${(circulatingRatio * 100).toFixed(0)}% circulating — dilution risk`);
      if (circulatingRatio > 0.8) drivers.push("Well-distributed supply");
    }
    if (max && max > 0 && total && total > max * 0.9) {
      supplyConcentration = Math.min(100, supplyConcentration + 10);
      drivers.push("Near max supply");
    }

    // Buy Pressure (25% weight) — from GeckoTerminal buy/sell ratio
    let buyPressure = 50;
    if (poolSummary) {
      const ratio = poolSummary.buyToSellRatio;
      // ratio 0.5→20, 1.0→50, 1.5→75, 2.0+→90
      buyPressure = Math.round(Math.min(100, ratio * 50));
      if (ratio > 1.3) drivers.push(`Strong buy pressure: ${ratio.toFixed(2)}x buy/sell`);
      if (ratio < 0.7) drivers.push(`Sell pressure: ${ratio.toFixed(2)}x buy/sell`);
    }

    // Market Cap to FDV (25% weight) — higher ratio = less future dilution
    let mcapToFdv = 50;
    const fdv = cg.fullyDilutedValuation ?? 0;
    if (marketCap > 0 && fdv > 0) {
      const ratio = marketCap / fdv;
      mcapToFdv = Math.round(ratio * 100);
      if (ratio < 0.3) drivers.push(`MCap/FDV: ${(ratio * 100).toFixed(0)}% — significant dilution ahead`);
      if (ratio > 0.8) drivers.push("Minimal dilution risk");
    }

    // Price Stability (20% weight) — lower recent volatility = higher score
    let priceStability = 50;
    const change30d = Math.abs(cg.priceChangePercentage30d ?? 0);
    const change7d = Math.abs(cg.priceChangePercentage7d ?? 0);
    // Blend 30d (70%) and 7d (30%) for more responsive stability signal
    const blendedVolatility = change30d * 0.7 + change7d * 0.3;
    priceStability = Math.round(Math.max(5, 100 - blendedVolatility * 1.8));
    if (change7d > 20) drivers.push(`High 7d volatility: ${change7d.toFixed(0)}%`);
    if (change30d < 10 && change7d < 10) drivers.push("Stable price action");

    const score = Math.round(
      supplyConcentration * 0.30 +
      buyPressure * 0.25 +
      mcapToFdv * 0.25 +
      priceStability * 0.20,
    );

    return {
      score: clamp(score),
      supplyConcentration: clamp(supplyConcentration),
      buyPressure: clamp(buyPressure),
      marketCapToFDV: clamp(mcapToFdv),
      priceStability: clamp(priceStability),
      drivers,
    };
  }

  // ─── Liquidity Risk Score ───────────────────────────────────────

  static computeLiquidityRisk(
    marketCap: number,
    volume: number,
    poolSummary: PoolLiquiditySummary | null,
  ): LiquidityRiskScore {
    const drivers: string[] = [];

    // Volume/MCap ratio (35% weight)
    let volumeToMcap = 30;
    if (marketCap > 0 && volume > 0) {
      const ratio = volume / marketCap;
      // ratio 0.001→10, 0.01→30, 0.05→60, 0.1→80, 0.2+→100
      volumeToMcap = Math.round(Math.min(100, ratio * 500));
      if (ratio > 0.1) drivers.push(`High volume/mcap: ${(ratio * 100).toFixed(1)}%`);
      if (ratio < 0.01) drivers.push("Low trading volume relative to market cap");
    }

    // DEX Liquidity (30% weight) — from GeckoTerminal
    let dexLiquidity = 20;
    if (poolSummary) {
      const reserve = poolSummary.totalReserveUsd;
      // $0→0, $100K→20, $1M→40, $10M→60, $100M→80, $1B+→100
      dexLiquidity = Math.min(100, Math.round(Math.log10(Math.max(1, reserve)) * 14 - 30));
      dexLiquidity = Math.max(0, dexLiquidity);
      if (reserve > 10_000_000) drivers.push(`$${(reserve / 1e6).toFixed(0)}M DEX liquidity`);
      if (reserve < 500_000) drivers.push("Thin DEX liquidity");
    }

    // Exchange Presence (20% weight) — pool count + DEX diversity
    let exchangePresence = 20;
    if (poolSummary) {
      const poolScore = Math.min(100, poolSummary.totalPools * 5);
      const dexScore = Math.min(100, poolSummary.dexCount * 15);
      exchangePresence = Math.round(poolScore * 0.5 + dexScore * 0.5);
      if (poolSummary.dexCount >= 5) drivers.push(`Listed on ${poolSummary.dexCount} DEXs`);
    }

    // Pool Concentration (15% weight) — inverted: well-distributed = higher score
    let poolConcentration = 50;
    if (poolSummary) {
      const conc = poolSummary.top3PoolConcentration;
      // 100% concentrated→10, 80%→30, 50%→60, 30%→80
      poolConcentration = Math.round(Math.max(10, 100 - conc * 0.9));
      if (conc > 90) drivers.push("Liquidity concentrated in few pools");
      if (conc < 50) drivers.push("Well-distributed pool liquidity");
    }

    const score = Math.round(
      volumeToMcap * 0.35 +
      dexLiquidity * 0.30 +
      exchangePresence * 0.20 +
      poolConcentration * 0.15,
    );

    return {
      score: clamp(score),
      volumeToMcap: clamp(volumeToMcap),
      dexLiquidity: clamp(dexLiquidity),
      exchangePresence: clamp(exchangePresence),
      poolConcentration: clamp(poolConcentration),
      drivers,
      poolSummary,
    };
  }

  // ─── Structural Risk ───────────────────────────────────────────

  static computeStructuralRisk(
    cg: CGMeta,
  ): CryptoStructuralRisk {
    // Dependency Risk: single-chain vs multi-chain
    let depScore = 50;
    let depDesc = "Unknown chain dependency";
    const categories = cg.categories || [];
    const isL1 = categories.some(c => c?.toLowerCase().includes("layer 1") || c?.toLowerCase().includes("smart contract"));
    const isMultiChain = categories.some(c => c?.toLowerCase().includes("cross-chain") || c?.toLowerCase().includes("interoperability"));

    if (isL1) {
      depScore = 20; // L1s have low dependency risk
      depDesc = "Layer 1 — independent chain, low dependency risk";
    } else if (isMultiChain) {
      depScore = 30;
      depDesc = "Multi-chain/cross-chain — moderate dependency diversification";
    } else {
      depScore = 60;
      depDesc = "Single-chain token — dependent on host chain health";
    }

    // Governance Risk: based on developer transparency
    let govScore = 50;
    let govDesc = "Limited governance data";
    if (cg.developer) {
      const commits = cg.developer.commitCount4Weeks ?? 0;
      const closedRatio = (cg.developer.totalIssues ?? 0) > 0
        ? (cg.developer.closedIssues ?? 0) / (cg.developer.totalIssues ?? 1)
        : 0;

      if (commits > 50 && closedRatio > 0.7) {
        govScore = 20;
        govDesc = "Active development, responsive issue management";
      } else if (commits > 10) {
        govScore = 40;
        govDesc = "Moderate development activity";
      } else {
        govScore = 70;
        govDesc = "Low development activity — governance concerns";
      }
    }

    // Maturity Risk: based on genesis date
    let matScore = 50;
    let matDesc = "Unknown project age";
    if (cg.genesisDate) {
      const ageMs = Date.now() - new Date(cg.genesisDate).getTime();
      const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears > 5) {
        matScore = 15;
        matDesc = `Established project (${ageYears.toFixed(1)} years)`;
      } else if (ageYears > 2) {
        matScore = 35;
        matDesc = `Maturing project (${ageYears.toFixed(1)} years)`;
      } else if (ageYears > 0.5) {
        matScore = 60;
        matDesc = `Young project (${ageYears.toFixed(1)} years)`;
      } else {
        matScore = 85;
        matDesc = `Very new project (<6 months)`;
      }
    }

    const avgRisk = (depScore + govScore + matScore) / 3;
    const overallLevel: CryptoStructuralRisk["overallLevel"] =
      avgRisk >= 70 ? "critical" :
      avgRisk >= 50 ? "high" :
      avgRisk >= 30 ? "moderate" : "low";

    return {
      dependencyRisk: { score: depScore, level: riskLevel(depScore), description: depDesc },
      governanceRisk: { score: govScore, level: riskLevel(govScore), description: govDesc },
      maturityRisk: { score: matScore, level: riskLevel(matScore), description: matDesc },
      overallLevel,
    };
  }

  // ─── Enhanced Trust Model ───────────────────────────────────────

  static computeEnhancedTrust(
    cg: CGMeta,
    structuralRisk: CryptoStructuralRisk,
    baseTrustScore: number | null,
  ): EnhancedCryptoTrust {
    // 1. Protocol Age (15%)
    // Many top coins (ETH, BTC) lack genesisDate in CoinGecko — use market cap rank as proxy
    let ageScore = 40; // neutral default
    if (cg.genesisDate) {
      const ageYears = (Date.now() - new Date(cg.genesisDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      ageScore = Math.min(100, Math.round(ageYears * 15));
    } else if (cg.marketCapRank && cg.marketCapRank <= 20) {
      ageScore = 70; // top-20 coins without genesis date are established
    } else if (cg.marketCapRank && cg.marketCapRank <= 50) {
      ageScore = 55;
    }

    // 2. Dev Activity (20%)
    // Many top coins return null developer data — use market cap rank as fallback
    let devScore = 40; // neutral default (was 30, too punishing for missing data)
    if (cg.developer) {
      const commits = cg.developer.commitCount4Weeks ?? 0;
      devScore = Math.min(100, Math.round(commits * 1.2));
    } else if (cg.marketCapRank && cg.marketCapRank <= 10) {
      devScore = 60; // top-10 coins are assumed to have active dev even without CG data
    } else if (cg.marketCapRank && cg.marketCapRank <= 30) {
      devScore = 45;
    }

    // 3. Governance Transparency (15%) — inverted from risk
    const govScore = Math.max(0, 100 - structuralRisk.governanceRisk.score);

    // 4. Dependency Risk (15%) — inverted from risk
    const depScore = Math.max(0, 100 - structuralRisk.dependencyRisk.score);

    // 5. Community Strength (15%)
    let communityScore = 30;
    const watchlist = cg.watchlistUsers ?? 0;
    const sentiment = cg.sentimentVotesUpPercentage ?? 50;
    communityScore = Math.round(
      Math.min(100, Math.sqrt(watchlist) * 0.22) * 0.5 +
      sentiment * 0.5,
    );

    // 6. Base Trust Score (20%) — from existing DSE trust engine
    const baseScore = baseTrustScore ?? 50;

    // Weighted composite
    const components = {
      protocolAge: { score: clamp(ageScore), weight: 0.15 },
      devActivity: { score: clamp(devScore), weight: 0.20 },
      governanceTransparency: { score: clamp(govScore), weight: 0.15 },
      dependencyRisk: { score: clamp(depScore), weight: 0.15 },
      communityStrength: { score: clamp(communityScore), weight: 0.15 },
      baseTrust: { score: clamp(Math.round(baseScore)), weight: 0.20 },
    };

    const score = Math.round(
      Object.values(components).reduce((sum, c) => sum + c.score * c.weight, 0),
    );

    const level: EnhancedCryptoTrust["level"] =
      score >= 80 ? "very-high" :
      score >= 65 ? "high" :
      score >= 45 ? "moderate" :
      score >= 25 ? "low" : "very-low";

    return { score: clamp(score), components, level };
  }
}

// ─── Utilities ──────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function riskLevel(score: number): string {
  if (score >= 70) return "high";
  if (score >= 40) return "moderate";
  return "low";
}
