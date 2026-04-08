import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { WeeklyIntelligenceReportService } from "@/lib/services/weekly-intelligence-report.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "weekly-report-api" });

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") === "IN" ? "IN" : "US";
    const plan = await getUserPlan(userId);
    const report = await WeeklyIntelligenceReportService.getReport(userId, region, plan);

    return NextResponse.json({ report });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch weekly report");
    return apiError("Failed to fetch weekly report", 500);
  }
}
