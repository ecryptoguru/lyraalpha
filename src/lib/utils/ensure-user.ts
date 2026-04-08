/**
 * Ensures a User row exists in the DB for the given Clerk userId.
 * Fetches the real email from Clerk rather than using a @pending.com placeholder.
 * Safe to call concurrently — uses upsert.
 */
import { clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { isAuthBypassEnabled } from "@/lib/runtime-env";

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

  // All new users start as STARTER. Upgrade plans manually via the admin dashboard.
  const createPlanTier = "STARTER";

  // If we couldn't fetch a real email from Clerk and the row already exists,
  // do NOT risk overwriting any data (plan/email) with placeholders.
  if (existing && !fetchedFromClerk) {
    return;
  }

  try {
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email, credits: 50, plan: createPlanTier, updatedAt: new Date() },
      update: {
        // Only update email if it's still a placeholder
        ...(email !== `${userId}@pending.com`
          ? { email, updatedAt: new Date() }
          : {}),
      },
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
