import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { getUsageStats, type UsageRange } from "@/lib/services/admin.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-usage" });

const VALID_RANGES: UsageRange[] = ["7d", "30d", "90d"];

function parseRange(value: string | null): UsageRange {
  if (value && VALID_RANGES.includes(value as UsageRange)) {
    return value as UsageRange;
  }
  return "30d";
}

export async function GET(request: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const range = parseRange(request.nextUrl.searchParams.get("range"));
    const stats = await getUsageStats(range);
    const response = NextResponse.json(stats);
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=30");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch usage stats");
    return apiError("Failed to fetch usage stats", 500);
  }
}
