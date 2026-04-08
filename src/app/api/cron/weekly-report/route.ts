import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { WeeklyIntelligenceReportService } from "@/lib/services/weekly-intelligence-report.service";
import { buildWeeklyReportReadyEvent, deliverIntelligenceNotification } from "@/lib/services/intelligence-notifications.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "cron-weekly-report" });
const BATCH_SIZE = 100;
const BATCH_CONCURRENCY = 5;

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  return withCronAuthAndLogging(
    req,
    { logger, job: "weekly-report" },
    async () => {
      const results = {
        processed: 0,
        sent: 0,
        suppressed: 0,
        failed: 0,
      };

      let cursor: string | undefined;

      try {
        while (true) {
          const users = await prisma.user.findMany({
            select: {
              id: true,
              preferences: {
                select: {
                  preferredRegion: true,
                  emailNotifications: true,
                  pushNotifications: true,
                  pushSubscriptionJson: true,
                  weeklyReports: true,
                },
              },
            },
            where: {
              preferences: {
                is: {
                  weeklyReports: true,
                  OR: [
                    { emailNotifications: true },
                    {
                      pushNotifications: true,
                      pushSubscriptionJson: {
                        not: null,
                      },
                    },
                  ],
                },
              },
            },
            take: BATCH_SIZE,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { id: "asc" },
          });

          if (users.length === 0) break;

          for (let index = 0; index < users.length; index += BATCH_CONCURRENCY) {
            const chunk = users.slice(index, index + BATCH_CONCURRENCY);

            await Promise.all(
              chunk.map(async (user) => {
                results.processed += 1;

                try {
                  const region = user.preferences?.preferredRegion === "IN" ? "IN" : "US";
                  const plan = await getUserPlan(user.id);
                  const report = await WeeklyIntelligenceReportService.getReport(user.id, region, plan);
                  const delivery = await deliverIntelligenceNotification(
                    user.id,
                    buildWeeklyReportReadyEvent(report),
                  );

                  if (delivery.suppressed) results.suppressed += 1;
                  else if (delivery.stored || delivery.pushSent || delivery.emailSent) results.sent += 1;
                } catch (error) {
                  results.failed += 1;
                  logger.error({ err: sanitizeError(error), userId: user.id }, "weekly report delivery failed");
                }
              }),
            );
          }

          cursor = users[users.length - 1].id;
          if (users.length < BATCH_SIZE) break;
        }

        return NextResponse.json({
          success: true,
          results,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error({ err: sanitizeError(error) }, "weekly report cron failed");
        return apiError("Failed to run weekly report delivery", 500);
      }
    },
  );
}
