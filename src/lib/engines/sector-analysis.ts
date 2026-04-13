import { prisma } from "@/lib/prisma";
import { cacheStrategy } from "@/lib/cache";
import { ScoreType } from "@/generated/prisma/client";

export interface SectorScorePoint {
  value: number;
  assetId: string;
  type: ScoreType;
}

/**
 * Fetch sector scores with caching to reduce DB load on analytics pages.
 * Cache TTL: 5 minutes (300 seconds)
 */
export const getCachedSectorScores = (sectorId: string) => {
  return cacheStrategy(
    async () => {
      // 1. Get all active assets in sector
      const sectorAssets = await prisma.assetSector.findMany({
        where: { sectorId, isActive: true },
        select: { assetId: true },
      });

      if (sectorAssets.length === 0) return [];

      const assetIds = sectorAssets.map((a) => a.assetId);
      const scoreTypes: ScoreType[] = [
        "TREND",
        "MOMENTUM",
        "VOLATILITY",
        "SENTIMENT",
        "LIQUIDITY",
        "TRUST",
      ];

      // 2. Fetch distinct latest scores for these assets (last 7 days window)
      // Note: "distinct" on assetId/type ensures we don't get duplicate daily dumps if multiple exist
      const scores = await prisma.assetScore.findMany({
        where: {
          assetId: { in: assetIds },
          type: { in: scoreTypes },
          date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { value: true, assetId: true, type: true },
        orderBy: { date: "desc" },
        distinct: ["assetId", "type"],
      });

      return scores as SectorScorePoint[];
    },
    [`sector-scores-${sectorId}`],
    [`sector-${sectorId}`],
    300 // 5 minutes
  )();
};
