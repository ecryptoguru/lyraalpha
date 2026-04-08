import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";
import { apiError } from "@/lib/api-response";
const logger = createLogger({ service: "cron-expire-trials" });

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  return withCronAuthAndLogging(
    req,
    { logger, job: "expire-trials" },
    async () => {
      try {
        const now = new Date();

        const result = await prisma.user.updateMany({
          where: { trialEndsAt: { lt: now }, plan: { not: "STARTER" } },
          data: { plan: "STARTER", trialEndsAt: null },
        });

        logger.info({ count: result.count }, "Expired trials downgraded to STARTER");

        return NextResponse.json({ success: true, downgraded: result.count, timestamp: new Date().toISOString() });
      } catch (error) {
        logger.error({ err: sanitizeError(error) }, "Failed to expire trials");
        return apiError("Failed to expire trials", 500);
      }
    },
  );
}
