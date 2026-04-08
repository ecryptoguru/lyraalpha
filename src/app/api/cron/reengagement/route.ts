import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBrevoEmail } from "@/lib/email/brevo";
import {
  buildReengagementNudge1Email,
  buildReengagementNudge2Email,
  buildWinbackEmail,
  buildOnboardingReminderEmail,
} from "@/lib/email/templates";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";
import { getUserCredits } from "@/lib/services/credit.service";

const logger = createLogger({ service: "cron-reengagement" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

export async function GET(req: NextRequest) {
  return withCronAuthAndLogging(
    req,
    { logger, job: "reengagement" },
    async () => {
      const results = {
        nudge1: { sent: 0, failed: 0 },
        nudge2: { sent: 0, failed: 0 },
        winback: { sent: 0, failed: 0 },
        onboarding: { sent: 0, failed: 0 },
      };

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      try {
        const BATCH_SIZE = 200;
        let cursor: string | undefined;

        while (true) {
          const batch = await prisma.user.findMany({
            select: {
              id: true,
              email: true,
              credits: true,
              preferences: {
                select: {
                  emailNotifications: true,
                  reengagementNudge1SentAt: true,
                  reengagementNudge2SentAt: true,
                  winbackEmailSentAt: true,
                  onboardingStep: true,
                  onboardingCompleted: true,
                  createdAt: true,
                },
              },
              sessions: {
                select: { lastActivityAt: true },
                orderBy: { lastActivityAt: "desc" },
                take: 1,
              },
            },
            take: BATCH_SIZE,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { id: "asc" },
          });

          if (batch.length === 0) break;

          for (const user of batch) {
            if (!user.preferences?.emailNotifications) continue;

            const lastActivity = user.sessions[0]?.lastActivityAt;
            const createdAt = user.preferences?.createdAt;
            const prefs = user.preferences;

            if (lastActivity && lastActivity < sevenDaysAgo && !prefs.reengagementNudge1SentAt) {
              try {
                const email = buildReengagementNudge1Email({});
                await sendBrevoEmail({
                  to: [{ email: user.email }],
                  subject: email.subject,
                  htmlContent: email.html,
                  textContent: email.text,
                });
                await prisma.userPreference.update({
                  where: { userId: user.id },
                  data: { reengagementNudge1SentAt: now },
                });
                results.nudge1.sent++;
              } catch (err) {
                logger.error({ err: sanitizeError(err), userId: user.id }, "nudge1 email failed");
                results.nudge1.failed++;
              }
            }

            if (
              lastActivity &&
              lastActivity < fourteenDaysAgo &&
              prefs.reengagementNudge1SentAt &&
              !prefs.reengagementNudge2SentAt
            ) {
              try {
                const creditsRemaining = await getUserCredits(user.id);
                const email = buildReengagementNudge2Email({
                  creditsRemaining,
                });
                await sendBrevoEmail({
                  to: [{ email: user.email }],
                  subject: email.subject,
                  htmlContent: email.html,
                  textContent: email.text,
                });
                await prisma.userPreference.update({
                  where: { userId: user.id },
                  data: { reengagementNudge2SentAt: now },
                });
                results.nudge2.sent++;
              } catch (err) {
                logger.error({ err: sanitizeError(err), userId: user.id }, "nudge2 email failed");
                results.nudge2.failed++;
              }
            }

            if (lastActivity && lastActivity < thirtyDaysAgo && !prefs.winbackEmailSentAt) {
              try {
                const email = buildWinbackEmail({ bonusCredits: 10 });
                await sendBrevoEmail({
                  to: [{ email: user.email }],
                  subject: email.subject,
                  htmlContent: email.html,
                  textContent: email.text,
                });
                await prisma.userPreference.update({
                  where: { userId: user.id },
                  data: { winbackEmailSentAt: now },
                });
                results.winback.sent++;
              } catch (err) {
                logger.error({ err: sanitizeError(err), userId: user.id }, "winback email failed");
                results.winback.failed++;
              }
            }

            if (
              createdAt &&
              createdAt < twoDaysAgo &&
              !prefs.onboardingCompleted &&
              prefs.onboardingStep < 5
            ) {
              try {
                const email = buildOnboardingReminderEmail({
                  step: prefs.onboardingStep || 0,
                });
                await sendBrevoEmail({
                  to: [{ email: user.email }],
                  subject: email.subject,
                  htmlContent: email.html,
                  textContent: email.text,
                });
                results.onboarding.sent++;
              } catch (err) {
                logger.error(
                  { err: sanitizeError(err), userId: user.id },
                  "onboarding reminder email failed",
                );
                results.onboarding.failed++;
              }
            }
          }

          cursor = batch[batch.length - 1].id;
          if (batch.length < BATCH_SIZE) break;
        }

        return NextResponse.json({
          success: true,
          results,
          timestamp: now.toISOString(),
        });
      } catch (error) {
        logger.error({ err: sanitizeError(error) }, "Re-engagement cron failed");
        return NextResponse.json(
          { error: "Failed to run re-engagement" },
          { status: 500 },
        );
      }
    },
  );
}
