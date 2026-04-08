import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";
import { computeAllPortfoliosHealth } from "@/lib/services/portfolio.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "cron-portfolio-health" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  return withCronAuthAndLogging(
    req,
    { logger, job: "portfolio-health" },
    async () => {
      try {
        const result = await computeAllPortfoliosHealth();
        logger.info(result, "Portfolio health batch complete");
        return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
      } catch (error) {
        logger.error({ err: sanitizeError(error) }, "Portfolio health cron failed");
        return apiError("Cron job failed", 500);
      }
    },
  );
}
