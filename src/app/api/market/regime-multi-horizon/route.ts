import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateMultiHorizonRegime, interpretMultiHorizon } from "@/lib/engines/multi-horizon-regime";
import { MarketContextSnapshot } from "@/lib/engines/market-regime";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "multi-horizon-api" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const regionParam = searchParams.get("region");
    const region = regionParam === "IN" ? "IN" : "US";

    // Primary: read the freshest valid JSON context from MarketRegime.
    // This is the same table Browse Assets reads — guarantees identical data across all pages.
    const latestRow = await prisma.marketRegime.findFirst({
      where: { region, context: { startsWith: "{" } },
      orderBy: { date: "desc" },
      select: { context: true, date: true, state: true },
    });

    if (!latestRow?.context) {
      return NextResponse.json(
        { data: null, message: "Awaiting market context data" },
        { status: 200 },
      );
    }

    let current: MarketContextSnapshot;
    try {
      current = JSON.parse(latestRow.context) as MarketContextSnapshot;
    } catch {
      logger.error({ region }, "Failed to parse MarketRegime context JSON");
      return apiError("Internal Server Error", 500);
    }

    // Secondary: attempt multi-horizon enrichment if enough history exists
    const multiHorizon = await calculateMultiHorizonRegime(region);

    const dashboardData = multiHorizon
      ? {
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
        }
      : {
          // Fallback: wrap single snapshot in expected shape
          current,
          timeframes: { shortTerm: current, mediumTerm: current, longTerm: current },
          transition: { probability: 50, direction: "STABLE", leadingIndicators: [] },
          interpretation: null,
        };

    const response = NextResponse.json(dashboardData);
    response.headers.set("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Multi-horizon API failed");
    return apiError("Internal Server Error", 500);
  }
}
