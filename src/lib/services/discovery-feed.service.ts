import type { PlanTier } from "@/lib/ai/config";
import { getPlanLimit, isElitePlan } from "@/lib/middleware/plan-gate";
import { prisma } from "@/lib/prisma";
import { withCache } from "@/lib/redis";
import type { Prisma } from "@/generated/prisma/client";

type DiscoveryInflection = {
  scoreType: string;
  momentum: number;
  trend: string;
  percentileRank: number;
};

export interface DiscoveryFeedResponse {
  items: Array<{
    id: string;
    symbol: string;
    displaySymbol: string;
    name: string;
    type: string;
    drs: number;
    archetype: string;
    headline: string;
    context: string;
    inflections: DiscoveryInflection[] | null;
    isEliteOnly: boolean;
    locked: boolean;
    computedAt: string;
    price: number | null;
    changePercent: number | null;
    currency: string | null;
    scores: Record<string, number>;
  }>;
  total: number;
  totalVisible: number;
  totalAll?: number;
  plan: PlanTier;
  planCap: number;
  region: string;
  availableTypes: Record<string, number>;
  hasMore: boolean;
  upgradeHint?: string;
}

function normalizeInflections(value: unknown): DiscoveryInflection[] | null {
  if (!Array.isArray(value)) return null;

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const candidate = item as Partial<DiscoveryInflection>;
    if (
      typeof candidate.scoreType !== "string" ||
      typeof candidate.momentum !== "number" ||
      typeof candidate.trend !== "string" ||
      typeof candidate.percentileRank !== "number"
    ) {
      return [];
    }

    return [
      {
        scoreType: candidate.scoreType,
        momentum: candidate.momentum,
        trend: candidate.trend,
        percentileRank: candidate.percentileRank,
      },
    ];
  });
}

export async function getDiscoveryFeedData({
  typeFilter,
  region,
  requestedLimit,
  offset,
  plan,
}: {
  typeFilter: string;
  region: string;
  requestedLimit: number;
  offset: number;
  plan: PlanTier;
}): Promise<DiscoveryFeedResponse> {
  const planCap = getPlanLimit(plan, "discovery_feed");
  const limit = Math.min(requestedLimit, planCap);
  const isElite = isElitePlan(plan);

  const cacheKey = `discovery:feed:${region}:${typeFilter}:${limit}:${offset}:${plan}`;

  const data = await withCache(
    cacheKey,
    async () => {
      const baseWhere: Prisma.DiscoveryFeedItemWhereInput = {
        isSuppressed: false,
        ...(typeFilter !== "all" && { assetType: typeFilter.toUpperCase() as "CRYPTO" }),
        asset: {
          // Crypto assets are global (region: null) and should appear in all region views
          OR: [
            { region },
            { region: null },
          ],
        },
      };

      const where: Prisma.DiscoveryFeedItemWhereInput = { ...baseWhere };

      const [items, total, typeGroups] = await Promise.all([
        prisma.discoveryFeedItem.findMany({
          where,
          orderBy: [{ drs: "desc" }, { computedAt: "desc" }],
          take: limit,
          skip: offset,
          select: {
            id: true,
            symbol: true,
            assetName: true,
            assetType: true,
            drs: true,
            archetype: true,
            headline: true,
            context: true,
            inflections: true,
            scores: true,
            price: true,
            changePercent: true,
            currency: true,
            isEliteOnly: true,
            computedAt: true,
          },
        }),
        prisma.discoveryFeedItem.count({ where }),
        prisma.discoveryFeedItem.groupBy({
          by: ["assetType"],
          where: baseWhere,
          _count: {
            _all: true,
          },
        }),
      ]);

      const availableTypes = typeGroups.reduce<Record<string, number>>((acc, group) => {
        acc[group.assetType] = group._count._all;
        return acc;
      }, {});

      const visibleTotal = Math.min(total, planCap);

      return {
        items: items.map((item) => {
          const locked = item.isEliteOnly && !isElite;
          return {
            id: item.id,
            symbol: item.symbol,
            displaySymbol: locked ? "???" : item.symbol,
            name: locked ? "Elite Discovery" : item.assetName,
            type: String(item.assetType),
            drs: item.drs,
            archetype: item.archetype,
            headline: locked ? "Unlock Elite to see this cross-asset pattern" : item.headline,
            context: locked ? "This discovery item requires an Elite plan to view." : item.context,
            inflections: locked ? null : normalizeInflections(item.inflections),
            isEliteOnly: item.isEliteOnly,
            locked,
            computedAt: item.computedAt.toISOString(),
            price: locked ? null : item.price,
            changePercent: locked ? null : item.changePercent,
            currency: locked ? null : item.currency,
            scores: locked ? {} : ((item.scores as Record<string, number>) ?? {}),
          };
        }),
        total: visibleTotal,
        totalVisible: visibleTotal,
        ...(isElite ? { totalAll: total } : {}),
        plan,
        planCap,
        region,
        availableTypes,
        hasMore: offset + limit < visibleTotal,
      };
    },
    600,
  );

  if (data) {
    return data;
  }

  return {
    items: [],
    total: 0,
    totalVisible: 0,
    plan,
    planCap,
    region,
    availableTypes: {},
    hasMore: false,
  };
}
