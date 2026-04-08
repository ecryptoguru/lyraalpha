import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { PersonalBriefingService } from "@/lib/services/personal-briefing.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "personal-briefing-api" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    const plan = await getUserPlan(userId);
    if (plan !== "ELITE" && plan !== "ENTERPRISE") {
      return apiError("Elite plan required", 403);
    }

    const result = await PersonalBriefingService.getBriefing(userId);

    const res = NextResponse.json(result);
    res.headers.set("Cache-Control", "private, max-age=3600");
    return res;
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Personal briefing API failed");
    return apiError("Internal error", 500);
  }
}
