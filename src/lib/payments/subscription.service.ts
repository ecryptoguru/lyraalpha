import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import type { PlanTier, PaymentProvider, SubscriptionStatus } from "@/generated/prisma/client";
import { invalidatePlanCache } from "@/lib/middleware/plan-gate";
import { resetMonthlyCredits } from "@/lib/services/credit.service";

const logger = createLogger({ service: "subscription-service" });

// ─── Plan Mapping ─────────────────────────────────────────────────────────────
// Memoized per provider — env vars are read once on first call, not on every
// resolvePlan() invocation. Cache is a module-level Map so it persists across
// requests in the same serverless instance.

const _planMapCache = new Map<PaymentProvider, Record<string, PlanTier>>();

function getPlanMap(provider: PaymentProvider): Record<string, PlanTier> {
  const cached = _planMapCache.get(provider);
  if (cached) return cached;

  const map: Record<string, PlanTier> = provider === "STRIPE"
    ? {
        [process.env.STRIPE_PRO_PRICE_ID ?? ""]:   "PRO",
        [process.env.STRIPE_ELITE_PRICE_ID ?? ""]: "ELITE",
      }
    : {
        [process.env.RAZORPAY_PRO_PLAN_ID ?? ""]:   "PRO",
        [process.env.RAZORPAY_ELITE_PLAN_ID ?? ""]: "ELITE",
      };

  _planMapCache.set(provider, map);
  return map;
}

export function resolvePlan(provider: PaymentProvider, priceOrPlanId: string): PlanTier {
  const map = getPlanMap(provider);
  const resolved = map[priceOrPlanId];
  if (!resolved) {
    logger.warn({ provider, priceOrPlanId }, "Unknown price/plan ID — defaulting to STARTER");
  }
  return resolved ?? "STARTER";
}

// ─── Audit Logging ────────────────────────────────────────────────────────────

export async function logBillingAudit(params: {
  userId: string;
  stripeEventId?: string;
  stripeObjectId?: string;
  eventType: string;
  previousState?: string;
  newState: string;
  amount?: number;
  currency?: string;
}): Promise<void> {
  try {
    await prisma.billingAuditLog.create({ data: params });
  } catch (err) {
    // Non-fatal — log and continue so audit failure never blocks fulfillment
    logger.error({ err: sanitizeError(err), params }, "Failed to write billing audit log");
  }
}

// ─── Idempotent Event Processing ──────────────────────────────────────────────

export async function isEventProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.paymentEvent.findUnique({
    where: { eventId },
    select: { id: true },
  });
  return !!existing;
}

export async function recordEvent(
  provider: PaymentProvider,
  eventId: string,
  eventType: string,
  userId: string | null,
  payload: unknown,
): Promise<void> {
  await prisma.paymentEvent.create({
    data: { provider, eventId, eventType, userId, payload: payload as object },
  });
}

// ─── Subscription Lifecycle ───────────────────────────────────────────────────

export async function activateSubscription(params: {
  userId: string;
  provider: PaymentProvider;
  providerSubId: string;
  plan: PlanTier;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  metadata?: Record<string, unknown>;
  eventId?: string;
}): Promise<void> {
  const { userId, provider, providerSubId, plan, currentPeriodStart, currentPeriodEnd, metadata, eventId } = params;

  // Run user upsert + subscription upsert in a transaction for atomicity.
  // User upsert uses a placeholder email so the webhook never fails P2025
  // when the Clerk user hasn't visited the dashboard yet.
  await prisma.$transaction([
    prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: `${userId}@stripe-webhook.pending`,
        plan,
        updatedAt: new Date(),
      },
      update: { plan, updatedAt: new Date() },
    }),
    prisma.subscription.upsert({
      where: { providerSubId },
      create: {
        userId,
        provider,
        providerSubId,
        status: "ACTIVE",
        plan,
        currentPeriodStart,
        currentPeriodEnd,
        metadata: metadata as object,
      },
      update: {
        status: "ACTIVE",
        plan,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        metadata: metadata as object,
      },
    }),
  ]);

  await logBillingAudit({
    userId,
    stripeEventId: eventId,
    stripeObjectId: providerSubId,
    eventType: "subscription.activated",
    newState: `ACTIVE (${plan})`,
  });

  // Reset monthly credits to the new plan's allocation.
  // Non-fatal — a credit reset failure must never block subscription activation.
  try {
    await resetMonthlyCredits(userId);
  } catch (err) {
    logger.error({ err: sanitizeError(err), userId, plan }, "Failed to reset monthly credits on activation");
  }

  invalidatePlanCache(userId);
  logger.info({ userId, provider, plan, providerSubId }, "Subscription activated");
}

export async function updateSubscriptionStatus(
  providerSubId: string,
  status: SubscriptionStatus,
  cancelAtPeriodEnd?: boolean,
  eventId?: string,
): Promise<void> {
  // Single round-trip: update returns the fields we need for audit + downgrade logic.
  // Prisma throws P2025 when the record doesn't exist — catch it gracefully.
  let sub: { userId: string; plan: PlanTier } | null = null;
  try {
    const updateData: Record<string, unknown> = { status };
    if (cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = cancelAtPeriodEnd;

    sub = await prisma.subscription.update({
      where: { providerSubId },
      data: updateData,
      select: { userId: true, plan: true },
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") {
      logger.warn({ providerSubId }, "Subscription not found for status update — skipping");
      return;
    }
    throw err;
  }

  if (status === "CANCELED") {
    // Only downgrade user if they have no other active subscriptions
    const activeCount = await prisma.subscription.count({
      where: { userId: sub.userId, status: "ACTIVE", providerSubId: { not: providerSubId } },
    });

    if (activeCount === 0) {
      await prisma.user.update({
        where: { id: sub.userId },
        data: { plan: "STARTER", updatedAt: new Date() },
      });
      invalidatePlanCache(sub.userId);
      logger.info({ userId: sub.userId }, "User downgraded to STARTER after cancellation");
    }

    await logBillingAudit({
      userId: sub.userId,
      stripeEventId: eventId,
      stripeObjectId: providerSubId,
      eventType: "subscription.canceled",
      previousState: `ACTIVE (${sub.plan})`,
      newState: "CANCELED",
    });
  } else {
    await logBillingAudit({
      userId: sub.userId,
      stripeEventId: eventId,
      stripeObjectId: providerSubId,
      eventType: "subscription.status_updated",
      newState: status,
    });
  }

  logger.info({ providerSubId, status }, "Subscription status updated");
}

export async function renewSubscription(
  providerSubId: string,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  eventId?: string,
): Promise<void> {
  // Single round-trip: update and select userId for the audit log in one query.
  let sub: { userId: string } | null = null;
  try {
    sub = await prisma.subscription.update({
      where: { providerSubId },
      data: { status: "ACTIVE", currentPeriodStart, currentPeriodEnd },
      select: { userId: true },
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") {
      logger.warn({ providerSubId }, "renewSubscription: subscription not found, skipping");
      return;
    }
    throw err;
  }

  await logBillingAudit({
    userId: sub.userId,
    stripeEventId: eventId,
    stripeObjectId: providerSubId,
    eventType: "subscription.renewed",
    newState: "ACTIVE",
  });

  logger.info({ providerSubId }, "Subscription renewed");
}

// ─── Customer ID Linking ──────────────────────────────────────────────────────

export async function linkCustomerId(
  userId: string,
  provider: PaymentProvider,
  customerId: string,
): Promise<void> {
  try {
    const data = provider === "STRIPE"
      ? { stripeCustomerId: customerId }
      : { razorpayCustomerId: customerId };

    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email: `${userId}@stripe-webhook.pending`, updatedAt: new Date(), ...data },
      update: { ...data, updatedAt: new Date() },
    });

    logger.info({ userId, provider, customerId }, "Customer ID linked");
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId, provider }, "Failed to link customer ID");
  }
}

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

export async function findUserByCustomerId(
  provider: PaymentProvider,
  customerId: string,
): Promise<string | null> {
  const where = provider === "STRIPE"
    ? { stripeCustomerId: customerId }
    : { razorpayCustomerId: customerId };

  const user = await prisma.user.findFirst({ where, select: { id: true } });
  return user?.id ?? null;
}
