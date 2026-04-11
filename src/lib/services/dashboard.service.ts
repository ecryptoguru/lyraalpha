import { prisma } from "@/lib/prisma";
import { 
  calculateMultiHorizonRegime,
  interpretMultiHorizon
} from "@/lib/engines/multi-horizon-regime";
import { MarketContextSnapshot } from "@/lib/engines/market-regime";
import { unstable_cache } from "next/cache";
import { safeJsonParse } from "@/lib/utils/json";

/**
 * Get dashboard multi-horizon data.
 * Single source of truth: MarketRegime table (same as Browse Assets).
 * The stale MultiHorizonRegime table is bypassed entirely.
 */
export const getDashboardMultiHorizon = async (region: string = "US") => {
  // Always start from the freshest valid JSON row in MarketRegime
  const latestRow = await prisma.marketRegime.findFirst({
    where: { region, context: { startsWith: "{" } },
    orderBy: { date: "desc" },
    select: { context: true },
  });

  if (!latestRow?.context) return null;

  const current = safeJsonParse<MarketContextSnapshot>(latestRow.context);
  if (!current) return null;

  // Enrich with multi-horizon if enough history exists
  const multiHorizon = await calculateMultiHorizonRegime(region);

  if (multiHorizon) {
    return {
      current: multiHorizon.current,
      timeframes: {
        shortTerm: multiHorizon.shortTerm,
        mediumTerm: multiHorizon.mediumTerm,
        longTerm: multiHorizon.longTerm,
      },
      transition: {
        probability: multiHorizon.transitionProbability,
        direction: multiHorizon.transitionDirection,
        leadingIndicators: multiHorizon.leadingIndicators,
      },
      interpretation: interpretMultiHorizon(multiHorizon),
    };
  }

  return {
    current,
    timeframes: { shortTerm: current, mediumTerm: current, longTerm: current },
    transition: { probability: 50, direction: "STABLE" as const, leadingIndicators: [] },
    interpretation: null,
  };
};

/**
 * Get cached dashboard events
 * Wraps Prisma calls with Next.js caching
 */
export const getDashboardEvents = unstable_cache(
  async (limit: number = 5, type?: string) => {
    const events = await prisma.institutionalEvent.findMany({
      where: type ? { type } : undefined,
      take: limit,
      orderBy: { date: "desc" },
      include: {
        asset: {
          select: {
            symbol: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return events.map(event => ({
      ...event,
      date: event.date.toISOString(), // Serialize dates for Client Components
    }));
  },
  ["dashboard-events"],
  {
    revalidate: 60, // 1 minute cache for events
    tags: ["intelligence-feed"],
  }
);
