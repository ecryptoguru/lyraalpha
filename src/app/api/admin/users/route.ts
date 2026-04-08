import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { getUsersStats } from "@/lib/services/admin.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-users" });

export async function GET(request: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  const { searchParams } = request.nextUrl;
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "50", 10) || 50, 1), 100);

  try {
    const stats = await getUsersStats(page, pageSize);
    const response = NextResponse.json(stats);
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=30");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch users stats");
    return apiError("Failed to fetch users stats", 500);
  }
}
