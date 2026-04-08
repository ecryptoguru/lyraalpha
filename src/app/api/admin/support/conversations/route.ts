import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { listAdminSupportConversations } from "@/lib/services/support.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-support-conversations" });

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const { searchParams } = req.nextUrl;
    const limitParam = Number(searchParams.get("limit") ?? "50");
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 100);

    const cursorId = searchParams.get("cursor");
    const cursorUpdatedAt = searchParams.get("cursorUpdatedAt");
    const cursor =
      cursorId && cursorUpdatedAt
        ? { id: cursorId, updatedAt: new Date(cursorUpdatedAt) }
        : undefined;

    const result = await listAdminSupportConversations({ limit, cursor });

    return NextResponse.json(result);
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch support conversations");
    return apiError("Failed to fetch conversations", 500);
  }
}
