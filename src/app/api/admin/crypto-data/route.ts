import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { getCryptoDataSourceStats } from "@/lib/services/admin.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-crypto-data" });

export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const stats = await getCryptoDataSourceStats();
    const response = NextResponse.json(stats);
    response.headers.set("Cache-Control", "private, max-age=120, stale-while-revalidate=60");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch crypto data source stats");
    return apiError("Failed to fetch crypto data source stats", 500);
  }
}
