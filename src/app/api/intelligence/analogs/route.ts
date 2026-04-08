import { NextRequest, NextResponse } from "next/server";
import { findHistoricalAnalogs } from "@/lib/engines/historical-analog";
import { getCache, setCache } from "@/lib/redis";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "intelligence-analogs" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError("Unauthorized", 401);

  const region = req.nextUrl.searchParams.get("region") ?? "US";
  const cacheKey = `api:analogs:${region}`;

  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" },
      });
    }

    const result = await findHistoricalAnalogs(region);
    if (!result) {
      return NextResponse.json({ analogs: [], analogCount: 0, message: "No analogs found" });
    }

    await setCache(cacheKey, result, 3600);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" },
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error), region }, "Failed to fetch historical analogs");
    return apiError("Failed to fetch analogs", 500);
  }
}
