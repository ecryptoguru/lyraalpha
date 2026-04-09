import { prisma } from "../prisma";
import {
  Sector,
  InclusionType,
  Prisma,
} from "@/generated/prisma/client";
import { CryptoMappingDTO } from "../types/discovery.dto";
import { withCache } from "@/lib/redis";
import { MarketContextSnapshot } from "@/lib/engines/market-regime";
import { getLatestSectorRegime } from "@/lib/engines/sector-regime";
import { DISCOVERY, SECTOR_REGIME } from "@/lib/engines/constants";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "discovery-service" });

export type Tier = "Strong" | "Moderate" | "Emerging" | "Peripheral";

export type StockMappingWithRelations = Prisma.StockSectorGetPayload<{
  include: {
    asset: {
      select: {
        symbol: true;
        name: true;
        type: true;
        currency: true;
        marketCap: true;
        peRatio: true;
        oneYearChange: true;
        technicalRating: true;
        analystRating: true;
        metadata: true;
        scores: {
          take: 6;
          orderBy: { date: "desc" };
          select: { type: true; value: true };
        };
      };
    };
    EvidenceReference: {
      select: { sourceType: true; title: true; url: true; excerpt: true };
    };
  };
}>;

export interface ClusteredStocks {
  sector: Sector;
  marketContext?: MarketContextSnapshot;
  sectorRegime?: {
    regime: string;
    regimeScore: number;
    participationRate: number;
    relativeStrength: number;
    rotationMomentum: number;
    leadershipScore: number;
  };
  tiers: {
    [key in Tier]: StockMappingWithRelations[];
  };
}

export class DiscoveryService {
  private static SEARCH_TTL_SECONDS = 3600;
  private static SECTOR_LIST_TTL_SECONDS = 7200;
  private static SECTOR_CLUSTER_TTL_SECONDS = 7200;
  /**
   * Calculates the Eligibility Score based on the 5-factor formula:
   * 0.30R + 0.20E + 0.20B + 0.15N + 0.15M
   */
  static calculateEligibilityScore(metrics: {
    relevance: number; // R
    freshness: number; // E
    strength: number; // B
    density: number; // N
    behavior: number; // M
  }): number {
    const w = DISCOVERY.ELIGIBILITY_WEIGHTS;
    return (
      w.RELEVANCE * metrics.relevance +
      w.FRESHNESS * metrics.freshness +
      w.STRENGTH * metrics.strength +
      w.DENSITY * metrics.density +
      w.BEHAVIOR * metrics.behavior
    );
  }

  /**
   * Calculates Event Freshness (E) using exponential decay:
   * E = 100 * exp(-0.03 * d)
   */
  static calculateFreshness(lastEventDate: Date): number {
    const diffTime = Math.abs(new Date().getTime() - lastEventDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const { BASE, LAMBDA } = DISCOVERY.FRESHNESS_DECAY;
    return Math.round(BASE * Math.exp(LAMBDA * diffDays));
  }

  /**
   * Calculates Narrative Density (N):
   * N = min(100, (companyMentions / sectorMedianMentions) * 50)
   */
  static calculateNarrativeDensity(mentions: number, median: number): number {
    return Math.min(100, Math.round((mentions / (median || 1)) * DISCOVERY.NARRATIVE_STRENGTH.SCALING));
  }

  /**
   * Maps a numeric score to a UI Alignment Tier.
   */
  static getTier(score: number): Tier {
    const t = DISCOVERY.TIER_THRESHOLDS;
    if (score >= t.STRONG) return "Strong";
    if (score >= t.MODERATE) return "Moderate";
    if (score >= t.EMERGING) return "Emerging";
    return "Peripheral";
  }

  static readonly PRIORITY_MAP: Record<InclusionType, number> = {
    EVENT_DRIVEN: 5,
    CORE_BUSINESS: 4,
    STRUCTURAL_STRENGTH: 3,
    STRATEGIC_ALIGNMENT: 2,
    NARRATIVE_SIGNAL: 1,
  };

  /**
   * Fetches stocks for a specific sector and clusters them into tiers.
   */
  static async getClusteredStocks(
    sectorSlug: string,
    region?: string,
  ): Promise<ClusteredStocks | null> {
    const cacheKey = `discovery:sector:${sectorSlug}:${region ?? "all"}`;
    return withCache(
      cacheKey,
      async () => {
        const sector = await prisma.sector.findUnique({
          where: { slug: sectorSlug },
        });

        if (!sector) return null;

        const sectorRegion = sector.slug.startsWith("india-") ? "IN" : "US";
        const latestRegime = await prisma.marketRegime.findFirst({
          where: { region: sectorRegion, context: { startsWith: "{" } },
          orderBy: { date: "desc" },
        });

        let marketContext: MarketContextSnapshot | undefined;
        if (latestRegime?.context) {
          try {
            marketContext = JSON.parse(latestRegime.context);
            if (marketContext && !marketContext.lastUpdated) {
              marketContext.lastUpdated = latestRegime.date.toISOString();
            }
          } catch (e) {
            logger.warn({ err: e }, "Failed to parse market regime context");
          }
        }

        let sectorRegime: ClusteredStocks["sectorRegime"];
        try {
          const regimeData = await getLatestSectorRegime(sector.id);
          if (regimeData) {
            sectorRegime = {
              regime: regimeData.regime,
              regimeScore: regimeData.regimeScore,
              participationRate: regimeData.participationRate,
              relativeStrength: regimeData.relativeStrength,
              rotationMomentum: regimeData.rotationMomentum,
              leadershipScore: regimeData.leadershipScore,
            };
          }
        } catch (e) {
          logger.warn({ err: e }, "Failed to fetch sector regime");
        }

        const stockMappings = await prisma.stockSector.findMany({
          where: {
            sectorId: sector.id,
            isActive: true,
            ...(region ? { asset: { region } } : {}),
          },
          include: {
            asset: {
              select: {
                symbol: true,
                name: true,
                type: true,
                currency: true,
                marketCap: true,
                peRatio: true,
                oneYearChange: true,
                technicalRating: true,
                analystRating: true,
                metadata: true,
                scores: {
                  take: 6,
                  orderBy: { date: "desc" },
                  select: { type: true, value: true },
                },
              },
            },
            EvidenceReference: {
              select: { sourceType: true, title: true, url: true, excerpt: true },
            },
          },
          orderBy: { eligibilityScore: "desc" },
        });

        const clustered: ClusteredStocks = {
          sector,
          marketContext,
          sectorRegime,
          tiers: {
            Strong: [],
            Moderate: [],
            Emerging: [],
            Peripheral: [],
          },
        };

        stockMappings.forEach((mapping: StockMappingWithRelations) => {
          let adjustedScore = mapping.eligibilityScore;

          if (sectorRegime) {
            const b = SECTOR_REGIME.BOOST_FACTORS;
            if (
              sectorRegime.regime === "STRONG_RISK_ON" &&
              sectorRegime.leadershipScore >= b.LEADERSHIP_THRESHOLD
            ) {
              adjustedScore = Math.min(100, adjustedScore * b.LEADING);
            } else if (
              sectorRegime.regime === "RISK_ON" &&
              sectorRegime.leadershipScore >= b.POSITIVE_THRESHOLD
            ) {
              adjustedScore = Math.min(100, adjustedScore * b.POSITIVE);
            } else if (sectorRegime.regime === "RISK_OFF") {
              adjustedScore = Math.max(0, adjustedScore * b.PENALTY);
            }
          }

          const tier = this.getTier(adjustedScore);
          clustered.tiers[tier].push(mapping);
        });

        return clustered;
      },
      this.SECTOR_CLUSTER_TTL_SECONDS,
    );
  }

  /**
   * Universal mapper from DB model to API DTO.
   */
  static mapToDTO(m: StockMappingWithRelations): CryptoMappingDTO {
    // Extract signals from latest scores
    const signals: Required<NonNullable<CryptoMappingDTO["signals"]>> = {
      trend: 0,
      momentum: 0,
      volatility: 0,
      liquidity: 0,
      sentiment: 0,
      trust: 0,
    };

    if (m.asset.scores) {
      m.asset.scores.forEach((s) => {
        const type = s.type.toLowerCase() as keyof typeof signals;
        if (type in signals) {
          signals[type] = s.value;
        }
      });
    }

    return {
      symbol: m.asset.symbol,
      name: m.asset.name,
      inclusionType: m.inclusionType,
      inclusionReason: m.inclusionReason,
      assetId: m.assetId,
      currency: m.asset.currency || "USD",
      scores: {
        relevance: m.relevanceScore,
        freshness: m.freshnessScore,
        strength: m.strengthScore,
        density: m.densityScore,
        behavior: m.behaviorScore,
        eligibility: m.eligibilityScore,
      },
      metrics: {
        marketCap: m.asset.marketCap,
        peRatio: m.asset.peRatio,
        oneYearChange: m.asset.oneYearChange,
        technicalRating: m.asset.technicalRating,
        analystRating: m.asset.analystRating,
      },
      type: m.asset.type,
      metadata: m.asset.metadata as Record<string, unknown> | null,
      signals, // Injected institutional signals
      evidence: m.EvidenceReference.map((e) => ({
        sourceType: e.sourceType,
        title: e.title,
        url: e.url,
        excerpt: e.excerpt,
      })),
      confidence: m.confidence,
      lastValidatedAt: m.lastValidatedAt?.toISOString() || null,
    };
  }

  /**
   * Fetches all sectors for the main discovery page.
   * When a region is provided, only sectors that contain at least one
   * active asset in that region are returned, and counts/leaders are
   * scoped to that region.
   */
  static async getAllSectors(region?: string) {
    const regionKey = region || "all";
    const cacheKey = `discovery:sectors:${regionKey}`;

    return withCache(
      cacheKey,
      async () => {
        const assetRegionFilter = region
          ? { asset: { region } }
          : {};

        const sectors = await prisma.sector.findMany({
          orderBy: { name: "asc" },
          where: region
            ? {
                stockSectors: {
                  some: {
                    isActive: true,
                    asset: { region },
                  },
                },
              }
            : undefined,
          include: {
            stockSectors: {
              where: { isActive: true, ...assetRegionFilter },
              take: 5,
              orderBy: { eligibilityScore: "desc" },
              include: {
                asset: { select: { symbol: true } },
              },
            },
            _count: {
              select: {
                stockSectors: {
                  where: { isActive: true, ...assetRegionFilter },
                },
              },
            },
            sectorRegimes: {
              take: 1,
              orderBy: { date: "desc" },
            },
          },
        });

        return sectors.map((s) => ({
          ...s,
          latestRegime: s.sectorRegimes[0] || null,
        }));
      },
      this.SECTOR_LIST_TTL_SECONDS,
    );
  }

  /**
   * Global search across sectors and assets.
   * Returns a list of suggested sectors and assets.
   */
  static async search(query: string, region?: string, global: boolean = false) {
    if (!query || query.length < 2) return { sectors: [], assets: [] };

    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `discovery:search:${global ? "global:" : ""}${normalizedQuery}:${region ?? "all"}`;

    return withCache(
      cacheKey,
      async () => {
        const sectorsPromise = prisma.sector.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { drivers: { contains: query, mode: "insensitive" } },
              { rationale: { contains: query, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, slug: true },
          take: 5,
        });

        if (global) {
          const [sectors, assets] = await Promise.all([
            sectorsPromise,
            prisma.asset.findMany({
              where: {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { symbol: { contains: query, mode: "insensitive" } },
                ],
                ...(region ? { region } : {}),
              },
              select: { name: true, symbol: true, type: true, sector: true },
              orderBy: { marketCap: { sort: "desc", nulls: "last" } },
              take: 5,
            }),
          ]);

          return {
            sectors,
            assets: assets.slice(0, 5).map((a) => ({
              symbol: a.symbol,
              name: a.name,
              type: a.type,
              sectorSlug: a.sector?.toLowerCase().replace(/\s+/g, '-') || "unassigned",
              sectorName: a.sector || "Unassigned",
            })),
          };
        }

        const [sectors, assetMappings] = await Promise.all([
          sectorsPromise,
          prisma.stockSector.findMany({
            where: {
              isActive: true,
              AND: [
                ...(region ? [{ asset: { region } }] : []),
                {
                  OR: [
                    { asset: { name: { contains: query, mode: "insensitive" } } },
                    { asset: { symbol: { contains: query, mode: "insensitive" } } },
                  ],
                },
              ],
            },
            include: {
              asset: { select: { name: true, symbol: true, type: true } },
              sector: { select: { slug: true, name: true } },
            },
            orderBy: { asset: { name: "asc" } },
            take: 30,
          }),
        ]);

        // Dedupe: one result per symbol (keep first sector mapping)
        const seen = new Set<string>();
        const deduped = assetMappings.filter((m) => {
          if (seen.has(m.asset.symbol)) return false;
          seen.add(m.asset.symbol);
          return true;
        });

        return {
          sectors,
          assets: deduped.slice(0, 5).map((m) => ({
            symbol: m.asset.symbol,
            name: m.asset.name,
            type: m.asset.type,
            sectorSlug: m.sector.slug,
            sectorName: m.sector.name,
          })),
        };
      },
      this.SEARCH_TTL_SECONDS,
    );
  }
}
