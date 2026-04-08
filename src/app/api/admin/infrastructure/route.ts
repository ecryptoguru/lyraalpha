import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { getInfraStats } from "@/lib/services/admin.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-infrastructure" });

export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const stats = await getInfraStats();
    const response = NextResponse.json(stats);
    response.headers.set("Cache-Control", "private, max-age=120, stale-while-revalidate=60");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch infrastructure stats");
    return apiError("Failed to fetch infrastructure stats", 500);
  }
}
