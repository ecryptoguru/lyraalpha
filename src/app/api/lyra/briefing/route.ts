import { NextRequest, NextResponse } from "next/server";
import { DailyBriefingService } from "@/lib/services/daily-briefing.service";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "lyra-briefing-api" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

/**
 * GET /api/lyra/briefing?region=US|IN
 * Returns the cached daily AI briefing for the requested region.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { searchParams } = new URL(req.url);
    const region = (searchParams.get("region") || "US").toUpperCase();

    if (region !== "US" && region !== "IN") {
      return apiError("Invalid region", 400);
    }

    const briefing = await DailyBriefingService.getBriefing(region);
    const status = await DailyBriefingService.getBriefingStatus(region);

    return NextResponse.json(
      {
        success: Boolean(briefing),
        briefing,
        status,
        message: briefing
          ? briefing.source === "live_fallback"
            ? "Using a fallback briefing while the cached morning brief catches up."
            : "Briefing loaded successfully."
          : "Briefing is currently unavailable.",
      },
      {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      },
    );
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Briefing API failed");
    return NextResponse.json({ success: false, error: "Failed to fetch briefing" }, { status: 500 });
  }
}
