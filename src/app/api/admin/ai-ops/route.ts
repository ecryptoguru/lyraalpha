import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { getAIOpsStats } from "@/lib/services/admin.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-ai-ops" });

export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const stats = await getAIOpsStats();
    const response = NextResponse.json(stats);
    // Short cache — this is near-real-time operational data.
    response.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=10");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch AI ops stats");
    return apiError("Failed to fetch AI ops stats", 500);
  }
}
