/**
 * Database query builder utilities.
 * Provides reusable Prisma query patterns for consistent data fetching.
 */

import { cryptoAssetSelect } from "@/lib/services/asset.service";

export class AssetQueryBuilder {
  /**
   * Build a query for crypto asset analytics data
   * Excludes stock-specific fields for better performance
   */
  static forCryptoAnalytics() {
    return {
      select: cryptoAssetSelect,
      where: { type: "CRYPTO" } as const,
    };
  }

  /**
   * Build a query for discovery feed data
   * Includes sector and latest scores
   */
  static forDiscovery() {
    return {
      include: {
        asset: {
          select: {
            symbol: true,
            name: true,
            type: true,
            price: true,
            changePercent: true,
            currency: true,
            lastPriceUpdate: true,
            marketCap: true,
            compatibilityScore: true,
            compatibilityLabel: true,
            assetGroup: true,
            avgTrendScore: true,
            avgMomentumScore: true,
            avgVolatilityScore: true,
            avgLiquidityScore: true,
            avgSentimentScore: true,
            avgTrustScore: true,
            scores: {
              take: 6,
              orderBy: { date: "desc" as const },
              select: { type: true, value: true },
            },
          },
        },
        sector: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
          },
        },
      },
    } as const;
  }

  /**
   * Build a query for asset with price history
   * Includes recent price history for charts
   */
  static withPriceHistory(days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return {
      select: {
        ...cryptoAssetSelect,
        priceHistory: {
          where: { date: { gte: since } },
          orderBy: { date: "asc" as const },
          take: days,
        },
      },
    } as const;
  }

  /**
   * Build a query for asset with full scores
   * Includes all score types for comprehensive analysis
   */
  static withFullScores(days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return {
      select: {
        ...cryptoAssetSelect,
        scores: {
          where: { date: { gte: since } },
          orderBy: { date: "desc" as const },
        },
      },
    } as const;
  }

  /**
   * Build a query for asset sector mappings
   * Includes sector details and eligibility scores
   */
  static forSectorMapping() {
    return {
      include: {
        sector: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            isPremium: true,
          },
        },
      },
    } as const;
  }
}

export class SectorQueryBuilder {
  /**
   * Build a query for sector with regime data
   * Includes latest sector regime information
   */
  static withRegime() {
    return {
      include: {
        sectorRegimes: {
          orderBy: { date: "desc" as const },
          take: 1,
        },
      },
    } as const;
  }

  /**
   * Build a query for sector with asset counts
   * Includes count of active assets in the sector
   */
  static withAssetCounts() {
    return {
      include: {
        stockSectors: {
          where: { isActive: true },
          select: { assetId: true },
        },
      },
    } as const;
  }

  /**
   * Build a query for sector list for discovery
   * Optimized for discovery feed display
   */
  static forDiscovery() {
    return {
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        isPremium: true,
        displayOrder: true,
      },
      orderBy: { displayOrder: "asc" as const },
    } as const;
  }
}

export class ScoreQueryBuilder {
  /**
   * Build a query for recent scores by type
   * @param assetId Asset ID
   * @param scoreType Score type to filter
   * @param days Number of days to look back
   */
  static recentByType(assetId: string, scoreType: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return {
      where: {
        assetId,
        type: scoreType as string,
        date: { gte: since },
      },
      orderBy: { date: "desc" as const },
    } as const;
  }

  /**
   * Build a query for latest scores across all types
   * @param assetId Asset ID
   */
  static latestAllTypes(assetId: string) {
    return {
      where: { assetId },
      orderBy: { date: "desc" as const },
      take: 6, // One for each score type
    } as const;
  }
}
