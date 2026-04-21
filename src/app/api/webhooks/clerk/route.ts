import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { upsertBrevoContact, sendBrevoEmail } from "@/lib/email/brevo";
import { grantCreditsInTransaction } from "@/lib/services/credit.service";
import { CreditTransactionType } from "@/generated/prisma/enums";
import { buildWelcomeEmail } from "@/lib/email/templates";
import { invalidatePlanCache } from "@/lib/middleware/plan-gate";
import { isPrivilegedEmail } from "@/lib/auth";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { redisSetNX, delCache } from "@/lib/redis";

const logger = createLogger({ service: "clerk-webhook" });

// Idempotency: track processed svix-id values for 24h to prevent Clerk retries
// from causing duplicate user creation/updates. 24h covers webhook retry windows.
const WEBHOOK_IDEMPOTENCY_TTL = 24 * 60 * 60;

const ClerkUserEventSchema = z.object({
  data: z.object({
    id: z.string(),
    email_addresses: z.array(
      z.object({
        email_address: z.string(),
        id: z.string(),
      })
    ).optional().default([]),
    primary_email_address_id: z.string().optional(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    unsafe_metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  type: z.string(),
});

type ClerkUserEvent = z.infer<typeof ClerkUserEventSchema>;

// Idempotency check — acquire lock for this svix-id. If already locked, this is a duplicate.
async function isClerkWebhookDuplicate(svixId: string): Promise<boolean> {
  const lockKey = `clerk:webhook:${svixId}`;
  const acquired = await redisSetNX(lockKey, WEBHOOK_IDEMPOTENCY_TTL);
  // If acquire failed (key exists), this is a duplicate
  return !acquired;
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    logger.error("CLERK_WEBHOOK_SECRET not set");
    return apiError("Server misconfigured", 500);
  }

  // Get Svix headers for verification
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.warn("Missing svix headers");
    return apiError("Missing headers", 400);
  }

  // Verify webhook signature
  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let event: ClerkUserEvent;
  try {
    const rawEvent = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    event = ClerkUserEventSchema.parse(rawEvent);
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Webhook verification failed");
    return apiError("Invalid signature or invalid payload", 400);
  }

  const { type, data } = event;

  // Idempotency: check if we've already processed this svix-id
  if (await isClerkWebhookDuplicate(svixId)) {
    logger.info({ svixId, type }, "Duplicate Clerk webhook — skipping (already processed)");
    return NextResponse.json({ success: true, duplicate: true });
  }

  try {
    switch (type) {
      case "user.created": {
        const primaryEmail = data.email_addresses.find(
          (e) => e.id === data.primary_email_address_id,
        );
        const email = primaryEmail?.email_address || `${data.id}@unknown.com`;
        const firstName = data.first_name || undefined;
        const lastName = data.last_name || undefined;

        const isAdmin = isPrivilegedEmail(email);
        // All new sign-ups get ELITE plan + 300 beta credits
        const plan = "ELITE" as const;
        const SIGNUP_BONUS_CREDITS = 300;
        // Unique referenceId for dedup — prevents double-grant if two webhooks race
        const SIGNUP_BONUS_REF = `signup-bonus:${data.id}`;

        // Atomically upsert user + grant bonus credits in a single transaction.
        // The referenceId on the CreditTransaction acts as a dedup key — if a
        // concurrent webhook already granted the bonus, the second grant still
        // creates a lot but the totalCreditsEarned increment is idempotent because
        // we check totalCreditsEarned === 0 inside the tx.
        try {
          await prisma.$transaction(async (tx) => {
            await tx.user.upsert({
              where: { id: data.id },
              create: {
                id: data.id,
                email,
                plan,
                credits: 0,
                monthlyCreditsBalance: 0,
                bonusCreditsBalance: 0,
                purchasedCreditsBalance: 0,
                totalCreditsEarned: 0,
                totalCreditsSpent: 0,
                updatedAt: new Date(),
              },
              update: {
                email,
                ...(isAdmin ? { plan: "ELITE" as const } : {}),
                updatedAt: new Date(),
              },
            });

            // Grant bonus credits only if not yet received (totalCreditsEarned === 0)
            const user = await tx.user.findUnique({
              where: { id: data.id },
              select: { totalCreditsEarned: true },
            });
            if (user && user.totalCreditsEarned === 0) {
              await grantCreditsInTransaction(
                tx,
                data.id,
                SIGNUP_BONUS_CREDITS,
                CreditTransactionType.BONUS,
                "Beta sign-up bonus — welcome to LyraAlpha!",
                SIGNUP_BONUS_REF,
                { countTowardEarned: true },
              );
              logger.info({ userId: data.id, credits: SIGNUP_BONUS_CREDITS }, "Sign-up bonus credits granted");
            }
          });
        } catch (creditErr) {
          // P2002 = unique constraint violation — concurrent webhook already created the user.
          // This is safe to swallow since the upsert is idempotent and the bonus credit grant
          // is guarded by totalCreditsEarned === 0.
          if (typeof creditErr === "object" && creditErr !== null && (creditErr as { code?: string }).code === "P2002") {
            logger.warn({ userId: data.id, email }, "User created webhook hit unique constraint; continuing without failing event");
          } else {
            logger.error({ err: sanitizeError(creditErr), userId: data.id }, "Failed to create user or grant sign-up bonus credits — re-throwing so Clerk retries");
            throw creditErr;
          }
        }

        const welcome = buildWelcomeEmail({ firstName });
        await upsertBrevoContact({
          email,
          firstName,
          lastName,
          attributes: { SOURCE: "clerk_webhook" },
        });

        // Check if welcome email was already sent (prevents double-send on webhook retry)
        const existingPref = await prisma.userPreference.findUnique({
          where: { userId: data.id },
          select: { welcomeEmailSentAt: true },
        });
        const alreadySentWelcome = Boolean(existingPref?.welcomeEmailSentAt);

        let welcomeSent = false;
        if (!alreadySentWelcome) {
          welcomeSent = await sendBrevoEmail({
            to: [{ email, name: [firstName, lastName].filter(Boolean).join(" ") || undefined }],
            subject: welcome.subject,
            htmlContent: welcome.html,
            textContent: welcome.text,
            tags: ["onboarding", "welcome"],
          });

          if (!welcomeSent) {
            logger.warn({ userId: data.id, email }, "Welcome email failed to send — user will not receive onboarding email");
          }
        } else {
          logger.info({ userId: data.id }, "Welcome email already sent — skipping on retry");
        }

        await prisma.userPreference.upsert({
          where: { userId: data.id },
          create: {
            userId: data.id,
            preferredRegion: "US",
            experienceLevel: "BEGINNER",
            interests: ["CRYPTO"],
            onboardingCompleted: false,
            blogSubscribed: true,
            ...(welcomeSent ? { welcomeEmailSentAt: new Date() } : {}),
          },
          update: {
            ...(welcomeSent ? { welcomeEmailSentAt: new Date() } : {}),
          },
        });

        logger.info({ userId: data.id, email, plan }, "User created via webhook");
        break;
      }

      case "user.updated": {
        const primaryEmail = data.email_addresses.find(
          (e) => e.id === data.primary_email_address_id,
        );
        if (primaryEmail) {
          const emailAddress = primaryEmail.email_address;
          const isAdmin = isPrivilegedEmail(emailAddress);

          const existingUser = await prisma.user.findUnique({
            where: { id: data.id },
            select: { plan: true, totalCreditsEarned: true }
          });

          const preservedPlan = existingUser?.plan === "ELITE" || isAdmin;
          const needsSignupBonus = !existingUser; // user.updated arrived before user.created

          // Use upsert — webhooks can arrive out of order (updated before created)
          try {
            await prisma.$transaction(async (tx) => {
              await tx.user.upsert({
                where: { id: data.id },
                create: {
                  id: data.id,
                  email: emailAddress,
                  plan: "ELITE" as const,
                  trialEndsAt: null,
                  credits: 0,
                  monthlyCreditsBalance: 0,
                  bonusCreditsBalance: 0,
                  purchasedCreditsBalance: 0,
                  totalCreditsEarned: 0,
                  totalCreditsSpent: 0,
                  updatedAt: new Date(),
                },
                update: {
                  email: emailAddress,
                  // Never downgrade a user who is already ELITE; admin always gets ELITE
                  ...(isAdmin
                    ? { plan: "ELITE" as const, trialEndsAt: null }
                    : preservedPlan
                      ? {} // already ELITE — do not touch plan or trialEndsAt
                      : {}),
                  updatedAt: new Date(),
                },
              });

              // If this webhook created the user (out-of-order), grant signup bonus
              // user.created will also try, but totalCreditsEarned === 0 check prevents double-grant
              if (needsSignupBonus) {
                const user = await tx.user.findUnique({
                  where: { id: data.id },
                  select: { totalCreditsEarned: true },
                });
                if (user && user.totalCreditsEarned === 0) {
                  await grantCreditsInTransaction(
                    tx,
                    data.id,
                    300,
                    CreditTransactionType.BONUS,
                    "Beta sign-up bonus — welcome to LyraAlpha!",
                    `signup-bonus:${data.id}`,
                    { countTowardEarned: true },
                  );
                  logger.info({ userId: data.id, credits: 300 }, "Sign-up bonus granted via user.updated (out-of-order webhook)");
                }
              }
            });
          } catch (error) {
            if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
              logger.warn({ userId: data.id, email: emailAddress }, "User updated webhook hit unique constraint; continuing without failing event");
            } else {
              throw error;
            }
          }
          void invalidatePlanCache(data.id);
          logger.info({ userId: data.id, preservedPlan }, "User updated via webhook");
        }
        break;
      }

      case "user.deleted": {
        // GDPR: anonymize PII and purge all user-generated content
        // Use a proper transaction so any failure rolls back the entire deletion.
        // This prevents partial deletion state where some tables are cleaned and others aren't.
        await prisma.$transaction(async (tx) => {
          // Anonymize the User row — keep the row so FK cascades don't break,
          // but scrub all PII fields
          await tx.user.updateMany({
            where: { id: data.id },
            data: {
              email: `deleted-${data.id}@removed.invalid`,
              plan: "STARTER",
              trialEndsAt: null,
              credits: 0,
              monthlyCreditsBalance: 0,
              bonusCreditsBalance: 0,
              purchasedCreditsBalance: 0,
              totalCreditsEarned: 0,
              totalCreditsSpent: 0,
            },
          });
          // Parallelize independent deletes — none depend on each other.
          // This reduces ~20 sequential DB round-trips to ~3-4 concurrent batches,
          // well within the 30s transaction timeout.
          await Promise.all([
            // AI & content
            tx.aIRequestLog.deleteMany({ where: { userId: data.id } }),
            tx.lyraFeedback.deleteMany({ where: { userId: data.id } }),
            tx.userMemoryNote.deleteMany({ where: { userId: data.id } }),
            // Portfolio & watchlist
            tx.watchlistItem.deleteMany({ where: { userId: data.id } }),
            tx.portfolio.deleteMany({ where: { userId: data.id } }),
            // Preferences & notifications
            tx.userPreference.deleteMany({ where: { userId: data.id } }),
            tx.notification.deleteMany({ where: { userId: data.id } }),
            // Billing & credits
            tx.creditTransaction.deleteMany({ where: { userId: data.id } }),
            tx.creditLot.deleteMany({ where: { userId: data.id } }),
            tx.subscription.deleteMany({ where: { userId: data.id } }),
            tx.billingAuditLog.deleteMany({ where: { userId: data.id } }),
            tx.paymentEvent.deleteMany({ where: { userId: data.id } }),
            // Gamification & XP
            tx.pointTransaction.deleteMany({ where: { userId: data.id } }),
            tx.userProgress.deleteMany({ where: { userId: data.id } }),
            tx.userBadge.deleteMany({ where: { userId: data.id } }),
            tx.xPTransaction.deleteMany({ where: { userId: data.id } }),
            tx.xPRedemption.deleteMany({ where: { userId: data.id } }),
            tx.learningCompletion.deleteMany({ where: { userId: data.id } }),
            // Sessions & activity
            tx.userSession.deleteMany({ where: { userId: data.id } }),
            tx.userActivityEvent.deleteMany({ where: { userId: data.id } }),
            // Referrals (user can be referrer or referee)
            tx.referral.deleteMany({ where: { referrerId: data.id } }),
            tx.referral.deleteMany({ where: { refereeId: data.id } }),
            // Support
            tx.supportMessage.deleteMany({ where: { senderId: data.id } }),
            tx.supportConversation.deleteMany({ where: { userId: data.id } }),
          ]);
        }, { timeout: 30_000, maxWait: 5_000 });
        // Invalidate plan cache so stale ELITE isn't served
        void invalidatePlanCache(data.id);
        logger.info({ userId: data.id }, "User deleted — PII anonymized and content purged");
        break;
      }

      default:
        logger.debug({ type }, "Unhandled webhook event type");
    }
  } catch (error) {
    // Release idempotency lock on failure so Clerk retries are not silently dropped.
    // Without this, a transient DB/Prisma error permanently blocks the svix-id.
    try { await delCache(`clerk:webhook:${svixId}`); } catch { /* non-fatal */ }
    logger.error({ err: sanitizeError(error), type, userId: data.id }, "Webhook handler failed — lock released for retry");
    return apiError("Handler failed", 500);
  }

  return NextResponse.json({ success: true });
}
