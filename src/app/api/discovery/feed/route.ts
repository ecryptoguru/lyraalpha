import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { DiscoveryFeedSchema, parseSearchParams } from "@/lib/schemas";
import { getDiscoveryFeedData } from "@/lib/services/discovery-feed.service";
import { apiError } from "@/lib/api-response";
import { rateLimitMarketData } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/rate-limit/utils";
import { isRateLimitBypassEnabled } from "@/lib/runtime-env";

const logger = createLogger({ service: "discovery-feed-api" });

export const maxDuration = 30;
export const preferredRegion = "bom1";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(searchParams, DiscoveryFeedSchema);
    if (!parsed.success) {
      return apiError("Invalid parameters", 400);
    }

    const { type: typeFilter, region, limit: requestedLimit, offset } = parsed.data;
    const { userId } = await auth();
    const plan = userId ? await getUserPlan(userId) : "STARTER";

    // Rate limiting
    const isTest = isRateLimitBypassEnabled();
    if (!isTest) {
      const identifier = userId || getClientIp(request);
      const rateLimitError = await rateLimitMarketData(identifier, userId || undefined);
      if (rateLimitError) {
        logger.warn({ identifier, userId }, "Rate limit exceeded for discovery feed");
        return rateLimitError;
      }
    }

    const data = await getDiscoveryFeedData({
      typeFilter,
      region,
      requestedLimit,
      offset,
      plan,
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Discovery feed fetch failed");
    return NextResponse.json(
      { error: "Failed to fetch discovery feed" },
      { status: 500 },
    );
  }
}
