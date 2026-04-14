/**
 * Ensures a User row exists in the DB for the given Clerk userId.
 * Fetches the real email from Clerk rather than using a @pending.com placeholder.
 * Safe to call concurrently — uses upsert.
 */
import { clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@/generated/prisma/client";
import { CreditTransactionType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { isAuthBypassEnabled } from "@/lib/runtime-env";
import { grantCreditsInTransaction } from "@/lib/services/credit.service";

const logger = createLogger({ service: "ensure-user" });

export async function ensureUserExists(userId: string): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, plan: true },
  });

  // Fetch real email from Clerk (non-blocking — falls back to placeholder on error)
  let email = `${userId}@pending.com`;
  let fetchedFromClerk = false;

  // Skip Clerk API call when the row already has a real email — Clerk webhook
  // sets the real email on user.created, so this is a no-op for existing users.
  const emailIsReal = existing && !existing.email.endsWith("@pending.com") && !existing.email.endsWith("@unknown.com");
  if (emailIsReal) return;

  // Skip Clerk API call for dev bypass user
  const isDevUser = userId === "test-user-id" || isAuthBypassEnabled();
  if (!isDevUser) {
    try {
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      const primary = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      );
      if (primary?.emailAddress) {
        email = primary.emailAddress;
        fetchedFromClerk = true;
      }
    } catch (err) {
      logger.warn({ userId, err }, "Could not fetch Clerk email; using placeholder");
    }
  }

  // All new users start as ELITE during Beta.
  const createPlanTier = "ELITE";

  // If we couldn't fetch a real email from Clerk and the row already exists,
  // do NOT risk overwriting any data (plan/email) with placeholders.
  if (existing && !fetchedFromClerk) {
    return;
  }

  const SIGNUP_BONUS_CREDITS = 300;
  const SIGNUP_BONUS_REF = `signup-bonus:${userId}`;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email,
          plan: createPlanTier,
          credits: 0,
          monthlyCreditsBalance: 0,
          bonusCreditsBalance: 0,
          purchasedCreditsBalance: 0,
          totalCreditsEarned: 0,
          totalCreditsSpent: 0,
          updatedAt: new Date(),
        },
        update: {
          // Only update email if it's still a placeholder
          ...(email !== `${userId}@pending.com`
            ? { email, updatedAt: new Date() }
            : {}),
        },
      });

      // Grant signup bonus if not yet received — same logic as Clerk webhook.
      // This handles the SSR path where the user hits the dashboard before
      // the Clerk webhook processes. The Clerk webhook will also try, but
      // totalCreditsEarned === 0 check prevents double-grant.
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { totalCreditsEarned: true },
      });
      if (user && user.totalCreditsEarned === 0) {
        await grantCreditsInTransaction(
          tx,
          userId,
          SIGNUP_BONUS_CREDITS,
          CreditTransactionType.BONUS,
          "Beta sign-up bonus — welcome to LyraAlpha!",
          SIGNUP_BONUS_REF,
          { countTowardEarned: true },
        );
        logger.info({ userId, credits: SIGNUP_BONUS_CREDITS }, "Sign-up bonus granted via ensureUserExists");
      }
    });
  } catch (err) {
    // P2002 = unique constraint violation — the Clerk webhook already created this
    // user row (with the same email) before this upsert ran. Treat as a no-op.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      logger.info({ userId }, "ensureUserExists: row already created by webhook, skipping");
      return;
    }
    throw err;
  }
}
