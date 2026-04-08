import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { getRevenueStats } from "@/lib/services/admin.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-revenue" });

export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const stats = await getRevenueStats();
    const response = NextResponse.json(stats);
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=30");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch revenue stats");
    return apiError("Failed to fetch revenue stats", 500);
  }
}
