import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getCache } from "@/lib/redis";
import { IntelligenceCalendarsSchema, parseSearchParams } from "@/lib/schemas";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "api-calendars" });

export const dynamic = "force-dynamic";

/**
 * GET /api/intelligence/calendars?type=earnings|economic|ipo
 * Returns calendar data from Redis cache.
 * Note: Traditional calendars (earnings, IPO, economic) not applicable to crypto assets.
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(searchParams, IntelligenceCalendarsSchema);
    if (!parsed.success) {
      return apiError("Invalid parameters", 400);
    }
    const { type } = parsed.data;

    let data: unknown = null;
    let cacheKey = "";

    switch (type) {
      case "economic":
        cacheKey = "calendar:economic";
        data = await getCache(cacheKey);
        break;
      case "ipo":
        cacheKey = "calendar:ipo";
        data = await getCache(cacheKey);
        break;
      case "market_news":
        cacheKey = "news:market";
        data = await getCache(cacheKey);
        break;
      default:
        cacheKey = "calendar:economic";
        data = await getCache(cacheKey);
    }

    return NextResponse.json({
      success: true,
      type,
      data: data || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch calendar data");
    return NextResponse.json(
      { success: false, error: "Failed to fetch calendar data" },
      { status: 500 },
    );
  }
}
