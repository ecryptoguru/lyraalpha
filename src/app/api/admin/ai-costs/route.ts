import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { getAICostStats } from "@/lib/services/admin.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-ai-costs" });

export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const stats = await getAICostStats();
    const response = NextResponse.json(stats);
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=30");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch AI cost stats");
    return apiError("Failed to fetch AI cost stats", 500);
  }
}
