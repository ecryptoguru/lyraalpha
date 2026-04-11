import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { upsertBrevoContact, sendBrevoEmail } from "@/lib/email/brevo";
import { grantCreditsInTransaction } from "@/lib/services/credit.service";
import { buildWelcomeEmail } from "@/lib/email/templates";
import { invalidatePlanCache } from "@/lib/middleware/plan-gate";
import { isPrivilegedEmail } from "@/lib/auth";
import { z } from "zod";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "clerk-webhook" });

const ClerkUserEventSchema = z.object({
  data: z.object({
    id: z.string(),
    // Optional: user.deleted events omit email fields
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
        // All new sign-ups get ELITE plan + 500 bonus credits
        const plan = "ELITE" as const;
        const SIGNUP_BONUS_CREDITS = 500;

        await prisma.user.upsert({
          where: { id: data.id },
          create: {
            id: data.id,
            email,
            plan,
            credits: SIGNUP_BONUS_CREDITS,
            monthlyCreditsBalance: 0,
            bonusCreditsBalance: SIGNUP_BONUS_CREDITS,
            purchasedCreditsBalance: 0,
            totalCreditsEarned: SIGNUP_BONUS_CREDITS,
            totalCreditsSpent: 0,
            updatedAt: new Date(),
          },
          update: {
            email,
            ...(isAdmin ? { plan: "ELITE" as const } : {}),
            updatedAt: new Date(),
          },
        });

        // Grant 500 bonus credits as a proper credit lot (3-month expiry)
        // only on first creation — upsert update path skips this
        try {
          const existingUser = await prisma.user.findUnique({
            where: { id: data.id },
            select: { totalCreditsEarned: true },
          });
          // Only grant if this is a fresh signup (totalCreditsEarned matches the bonus)
          if (existingUser && existingUser.totalCreditsEarned === SIGNUP_BONUS_CREDITS) {
            await prisma.$transaction(async (tx) => {
              await grantCreditsInTransaction(
                tx,
                data.id,
                SIGNUP_BONUS_CREDITS,
                "BONUS" as never,
                "Sign-up bonus — welcome to LyraAlpha!",
                undefined,
                { countTowardEarned: false }, // already counted in upsert
              );
            });
            logger.info({ userId: data.id, credits: SIGNUP_BONUS_CREDITS }, "Sign-up bonus credits granted");
          }
        } catch (creditErr) {
          logger.error({ err: sanitizeError(creditErr), userId: data.id }, "Failed to grant sign-up bonus credits — user created but credits may not be available");
        }

        const welcome = buildWelcomeEmail({ firstName });
        await upsertBrevoContact({
          email,
          firstName,
          lastName,
          attributes: { SOURCE: "clerk_webhook" },
        });

        const welcomeSent = await sendBrevoEmail({
          to: [{ email, name: [firstName, lastName].filter(Boolean).join(" ") || undefined }],
          subject: welcome.subject,
          htmlContent: welcome.html,
          textContent: welcome.text,
          tags: ["onboarding", "welcome"],
        });

        if (!welcomeSent) {
          logger.warn({ userId: data.id, email }, "Welcome email failed to send — user will not receive onboarding email");
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

          // Check if user already exists and has been upgraded (via user.created coupon logic).
          // Coupon application is intentionally NOT re-processed here — user.created handles
          // coupon redemption atomically with usedCount increment. Re-applying it here without
          // the same transaction would create a TOCTOU race that bypasses maxUses limits.
          const existingUser = await prisma.user.findUnique({
            where: { id: data.id },
            select: { plan: true }
          });

          const preservedPlan = existingUser?.plan === "ELITE" || isAdmin;

          // Use upsert — webhooks can arrive out of order (updated before created)
          try {
            await prisma.user.upsert({
              where: { id: data.id },
              create: {
                id: data.id,
                email: emailAddress,
                plan: "ELITE" as const,
                trialEndsAt: null,
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
        // GDPR: anonymize PII and purge user-generated content
        await prisma.$transaction([
          prisma.user.updateMany({
            where: { id: data.id },
            data: { email: `deleted-${data.id}@removed.invalid` },
          }),
          prisma.aIRequestLog.deleteMany({ where: { userId: data.id } }),
          prisma.watchlistItem.deleteMany({ where: { userId: data.id } }),
          prisma.portfolio.deleteMany({ where: { userId: data.id } }),
          prisma.userPreference.deleteMany({ where: { userId: data.id } }),
          prisma.creditTransaction.deleteMany({ where: { userId: data.id } }),
          prisma.supportMessage.deleteMany({ where: { senderId: data.id } }),
          prisma.supportConversation.deleteMany({ where: { userId: data.id } }),
        ]);
        logger.info({ userId: data.id }, "User deleted — PII anonymized and content purged");
        break;
      }

      default:
        logger.debug({ type }, "Unhandled webhook event type");
    }
  } catch (error) {
    logger.error({ err: sanitizeError(error), type, userId: data.id }, "Webhook handler failed");
    return apiError("Handler failed", 500);
  }

  return NextResponse.json({ success: true });
}
