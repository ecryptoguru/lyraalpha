import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { DashboardHomeService } from "@/lib/services/dashboard-home.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "dashboard-home-api" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const region = (req.nextUrl.searchParams.get("region") || "US").toUpperCase();
    if (region !== "US" && region !== "IN") {
      return apiError("Invalid region", 400);
    }

    const plan = await getUserPlan(userId);
    const home = await DashboardHomeService.getHome(userId, region, plan);

    return NextResponse.json(home, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Dashboard home API failed");
    return apiError("Failed to fetch dashboard home", 500);
  }
}
