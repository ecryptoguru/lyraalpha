import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-support-retention" });

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/support-retention
 * - Auto-close conversations idle for 2+ days (no new messages)
 * - Hard-delete conversations (+ messages via cascade) older than 7 days
 * Runs daily at 03:30 UTC.
 */
export async function POST(request: NextRequest) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "support-retention" },
    async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const closed = await prisma.supportConversation.updateMany({
        where: {
          status: "OPEN",
          updatedAt: { lt: twoDaysAgo },
        },
        data: {
          status: "CLOSED",
          closedAt: now,
        },
      });

      const deleted = await prisma.supportConversation.deleteMany({
        where: {
          createdAt: { lt: sevenDaysAgo },
        },
      });

      logger.info(
        { closed: closed.count, deleted: deleted.count },
        "Support retention cron completed",
      );

      return NextResponse.json({
        ok: true,
        closed: closed.count,
        deleted: deleted.count,
      });
    },
  );
}

export async function GET(request: NextRequest) {
  return POST(request);
}
