import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { getCreditStats } from "@/lib/services/admin.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-credits" });

export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const data = await getCreditStats();
    return NextResponse.json(data);
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Admin credits stats failed");
    return apiError("Failed to load credit stats", 500);
  }
}
