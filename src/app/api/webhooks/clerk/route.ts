import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { upsertBrevoContact, sendBrevoEmail } from "@/lib/email/brevo";
import { buildWelcomeEmail } from "@/lib/email/templates";
import { invalidatePlanCache } from "@/lib/middleware/plan-gate";
import { isPrivilegedEmail } from "@/lib/auth";
import { grantCreditsInTransaction } from "@/lib/services/credit.service";
import { isAllowedPrelaunchCoupon, normalizePrelaunchCoupon } from "@/lib/config/prelaunch";
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
    unsafe_metadata: z.object({ coupon_code: z.string().optional() }).catchall(z.unknown()).optional(),
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

        // SECURITY NOTE: unsafe_metadata is user-writable in Clerk — any user can self-set
        // coupon_code before sign-up. This is intentional (sign-up coupon flow), but the
        // code must be valid, active, and within maxUses as verified below. The atomic
        // transaction below increments usedCount inside the same tx to prevent TOCTOU abuse.
        const couponCode = normalizePrelaunchCoupon(data.unsafe_metadata?.coupon_code);
        let plan: "STARTER" | "ELITE" = "STARTER";
        let trialEndsAt: Date | null = null;
        let promoCredits = 0;
        let promoDurationDays = 0;
        let promoId: string | null = null;

        const isAdmin = isPrivilegedEmail(email);
        if (isAdmin) {
          plan = "ELITE";
        } else if (couponCode) {
          if (isAllowedPrelaunchCoupon(couponCode)) {
            // Hardcoded prelaunch coupon (ELITE15, ELITE30) — not DB-managed, no usedCount.
            // Grant 30-day Elite trial with 500 bonus credits.
            plan = "ELITE";
            trialEndsAt = new Date();
            trialEndsAt.setDate(trialEndsAt.getDate() + 30);
            promoCredits = 500;
            promoDurationDays = 30;
            logger.info({ userId: data.id, code: couponCode }, "Applied hardcoded prelaunch coupon");
          } else {
            // DB promo: do a lightweight pre-flight check (isActive + expiresAt only).
            // maxUses is re-validated atomically inside the transaction below to prevent TOCTOU.
            const promoPreFlight = await prisma.promoCode.findUnique({
              where: { code: couponCode },
              select: { id: true, isActive: true, expiresAt: true, durationDays: true, bonusCredits: true },
            });
            if (
              promoPreFlight?.isActive &&
              (!promoPreFlight.expiresAt || promoPreFlight.expiresAt > new Date())
            ) {
              plan = "ELITE";
              trialEndsAt = new Date();
              trialEndsAt.setDate(trialEndsAt.getDate() + promoPreFlight.durationDays);
              promoCredits = promoPreFlight.bonusCredits ?? 50;
              promoDurationDays = promoPreFlight.durationDays;
              promoId = promoPreFlight.id;
              logger.info({ userId: data.id, code: couponCode, days: promoPreFlight.durationDays, credits: promoCredits }, "Applied trial promo code (pending atomic tx confirmation)");
            } else {
              logger.warn({ userId: data.id, code: couponCode }, "Invalid or expired promo code used at sign-up");
            }
          }
        }

        // For DB promo codes, key by promoId. For hardcoded coupons (no promoId), key by couponCode.
        const promoGrantReferenceId = promoCredits > 0
          ? (promoId ? `clerk-signup-promo:${promoId}:${data.id}` : `clerk-signup-prelaunch:${couponCode}:${data.id}`)
          : null;

        // Single atomic transaction: prevents TOCTOU race on limited-use coupons
        await prisma.$transaction(async (tx) => {
          const existingPromoGrant = promoGrantReferenceId
            ? await tx.creditTransaction.findFirst({
                where: {
                  userId: data.id,
                  referenceId: promoGrantReferenceId,
                },
                select: { id: true },
              })
            : null;

          const shouldGrantPromoCredits = Boolean(promoCredits > 0 && !existingPromoGrant);

          if (promoId && !existingPromoGrant) {
            // Atomically re-validate maxUses and increment inside the transaction.
            // The WHERE clause compares usedCount < maxUses at the DB level, so two
            // concurrent sign-ups cannot both succeed when only one use remains.
            const affected = await tx.$executeRaw`
              UPDATE "PromoCode"
              SET "usedCount" = "usedCount" + 1
              WHERE id = ${promoId}
                AND "isActive" = true
                AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
            `;
            if (affected === 0) {
              // Race: another concurrent request already consumed the last use.
              // Roll back by throwing — Prisma will abort the whole transaction.
              throw new Error(`PROMO_EXHAUSTED:${promoId}`);
            }
          }

          await tx.user.upsert({
            where: { id: data.id },
            create: {
              id: data.id,
              email,
              plan,
              trialEndsAt,
              ...(shouldGrantPromoCredits
                ? {
                    credits: 0,
                    monthlyCreditsBalance: 0,
                    bonusCreditsBalance: 0,
                    purchasedCreditsBalance: 0,
                    totalCreditsEarned: 0,
                  }
                : {}),
              updatedAt: new Date(),
            } as never,
            update: {
              email,
              ...(isAdmin ? { plan: "ELITE" as const, trialEndsAt: null } : {}),
              ...(plan === "ELITE" && !isAdmin
                ? {
                    plan: "ELITE" as const,
                    trialEndsAt,
                  }
                : {}),
              ...(shouldGrantPromoCredits
                ? {
                    credits: 0,
                    monthlyCreditsBalance: 0,
                    bonusCreditsBalance: 0,
                    purchasedCreditsBalance: 0,
                    totalCreditsEarned: 0,
                    totalCreditsSpent: 0,
                  }
                : {}),
              updatedAt: new Date(),
            },
          });

          if (shouldGrantPromoCredits) {
            await grantCreditsInTransaction(
              tx,
              data.id,
              promoCredits,
              "ADJUSTMENT",
              `Promo trial credits — ${couponCode ?? "PROMO"} (${promoDurationDays}-day Elite)`,
              promoGrantReferenceId ?? undefined,
            );
          }
        });

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
            interests: ["STOCKS", "ETF"],
            onboardingCompleted: false,
            blogSubscribed: true,
            ...(welcomeSent ? { welcomeEmailSentAt: new Date() } : {}),
          },
          update: {
            ...(welcomeSent ? { welcomeEmailSentAt: new Date() } : {}),
          },
        });

        if (!isAdmin && !promoId) {
          logger.info({ userId: data.id, email }, "Created starter user without promo access; coupon redemption remains required at sign-in");
        }

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
                plan: isAdmin ? "ELITE" : "STARTER",
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
