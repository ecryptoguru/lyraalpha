import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { PersonalBriefingService } from "@/lib/services/personal-briefing.service";
import { DailyBriefingService } from "@/lib/services/daily-briefing.service";
import { PersonalBriefingAiService } from "@/lib/services/personal-briefing-ai.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "personal-briefing-ai-api" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    const plan = await getUserPlan(userId);
    if (plan !== "ELITE" && plan !== "ENTERPRISE") {
      return apiError("Elite plan required", 403);
    }

    const url = new URL(request.url);
    const region = (url.searchParams.get("region") ?? "US").toUpperCase();
    const normalizedRegion = region === "IN" ? "IN" : "US";

    const [personalBriefing, dailyBriefing] = await Promise.all([
      PersonalBriefingService.getBriefing(userId),
      DailyBriefingService.getBriefing(normalizedRegion),
    ]);

    const memo = await PersonalBriefingAiService.getMemo(userId, {
      dailyBriefing,
      personalBriefing,
    });

    return NextResponse.json({ success: true, memo });
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Personal briefing AI API failed");
    return apiError("Internal error", 500);
  }
}
