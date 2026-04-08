import { NextResponse } from "next/server";
import { verifyStripeWebhook } from "@/lib/payments/webhook-verify";
import {
  isEventProcessed,
  recordEvent,
  activateSubscription,
  updateSubscriptionStatus,
  renewSubscription,
  findUserByCustomerId,
  linkCustomerId,
  resolvePlan,
  logBillingAudit,
} from "@/lib/payments/subscription.service";
import { addCredits } from "@/lib/services/credit.service";
import { invalidatePlanCache } from "@/lib/middleware/plan-gate";
import { CreditTransactionType } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";
import { sanitizeError, createTimer } from "@/lib/logger/utils";
import Stripe from "stripe";
import { requireEnv } from "@/lib/runtime-env";

import { z } from "zod";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "stripe-webhook" });

const StripeEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
}).catchall(z.unknown());

// ─── Lazy Stripe instance ─────────────────────────────────────────────────────
// Instantiated on first use so module-level init never crashes on missing env var.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), { apiVersion: "2026-01-28.clover" });
  }
  return _stripe;
}

// ─── Helper: extract billing period from subscription ─────────────────────────
// In API version 2026-01-28.clover, current_period_start/end live on items.data[0],
// not on the subscription root. Falls back to root for forward-compat.
function getSubPeriod(sub: Stripe.Subscription): { start: Date; end: Date } {
  const item = sub.items?.data?.[0] as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  } | undefined;

  const rawStart = item?.current_period_start
    ?? (sub as unknown as { current_period_start?: number }).current_period_start;
  const rawEnd = item?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end;

  return {
    start: rawStart ? new Date(rawStart * 1000) : new Date(),
    end:   rawEnd   ? new Date(rawEnd   * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };
}

// ─── Helper: resolve userId — DB lookup first, Stripe metadata fallback ───────
// Handles the race condition where checkout.session.completed fires before
// customer.subscription.created has linked the customer ID in our DB.
async function resolveUserId(customerId: string): Promise<string | null> {
  const fromDb = await findUserByCustomerId("STRIPE", customerId);
  if (fromDb) return fromDb;

  try {
    const customer = await getStripe().customers.retrieve(customerId);
    if (!customer.deleted) {
      const userId = (customer as Stripe.Customer).metadata?.userId;
      if (userId) {
        logger.info({ customerId, userId }, "Resolved userId from Stripe customer metadata");
        return userId;
      }
    }
  } catch (err) {
    logger.warn({ customerId, err: sanitizeError(err) }, "Failed to retrieve Stripe customer for metadata fallback");
  }

  return null;
}

// ─── Helper: activate subscription from a retrieved Stripe sub object ─────────
async function activateFromSub(
  sub: Stripe.Subscription,
  userId: string,
  eventId: string,
): Promise<void> {
  const priceId = sub.items.data[0]?.price?.id ?? "";
  const plan = resolvePlan("STRIPE", priceId);
  const { start, end } = getSubPeriod(sub);

  await activateSubscription({
    userId,
    provider: "STRIPE",
    providerSubId: sub.id,
    plan,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    metadata: { priceId, stripeStatus: sub.status },
    eventId,
  });

  logger.info({ userId, plan, subscriptionId: sub.id }, "Subscription activated");
}

export async function POST(req: Request) {
  const timer = createTimer();
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    logger.error("STRIPE_WEBHOOK_SECRET not configured");
    return apiError("Server misconfigured", 500);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  // 1. Verify signature + replay protection
  const verification = verifyStripeWebhook(rawBody, signature, WEBHOOK_SECRET);
  if (!verification.valid || !verification.event) {
    logger.warn({ error: verification.error }, "Stripe webhook verification failed");
    return apiError(verification.error ?? "Webhook verification failed", 400);
  }

  const parsedEvent = StripeEventSchema.safeParse(verification.event);
  if (!parsedEvent.success) {
    logger.warn({ error: parsedEvent.error }, "Stripe webhook payload validation failed");
    return apiError("Invalid payload format", 400);
  }

  const event = parsedEvent.data;
  const eventId = event.id;
  const eventType = event.type;

  // 2. Idempotency — skip already-processed events
  if (await isEventProcessed(eventId)) {
    logger.info({ eventId }, "Stripe event already processed — skipping");
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Track resolved userId for recordEvent at the end (avoids a second DB lookup)
  let resolvedUserId: string | null = null;

  try {
    const obj = event.data.object;

    switch (eventType) {

      // ── Canonical Stripe fulfillment path ──────────────────────────────────
      // checkout.session.completed → fast-path activate (single API call with expand)
      // invoice.paid               → keep provisioned on every renewal (idempotent)
      // invoice.payment_failed     → mark past_due
      // customer.subscription.*    → handle plan changes / cancellations
      // ───────────────────────────────────────────────────────────────────────

      case "checkout.session.completed": {
        const sessionId      = obj.id as string;
        const customerId     = obj.customer as string;
        const clientRefId    = obj.client_reference_id as string | null;
        const mode           = obj.mode as string;
        const paymentIntentId = obj.payment_intent as string | null;
        const sessionMetadata = obj.metadata as Record<string, string> | null;
        // subscription may already be expanded on the webhook event object
        const rawSub         = obj.subscription as Stripe.Subscription | string | null;

        resolvedUserId = clientRefId;

        // Link customer → user in DB (upsert — safe to call even if already linked)
        if (clientRefId && customerId) {
          await linkCustomerId(clientRefId, "STRIPE", customerId);
        }

        if (mode === "subscription" && clientRefId) {
          // Use the subscription object already on the event when available.
          // Fall back to a single API call only when the field is a bare ID string.
          let sub: Stripe.Subscription | null = null;
          if (rawSub && typeof rawSub !== "string") {
            sub = rawSub;
          } else {
            const subId = typeof rawSub === "string" ? rawSub : null;
            if (subId) {
              sub = await getStripe().subscriptions.retrieve(subId);
            } else {
              // Last resort: retrieve session with subscription expanded
              const session = await getStripe().checkout.sessions.retrieve(sessionId, {
                expand: ["subscription"],
              });
              sub = typeof session.subscription === "string"
                ? await getStripe().subscriptions.retrieve(session.subscription)
                : session.subscription as Stripe.Subscription | null;
            }
          }

          if (!sub) {
            logger.warn({ sessionId }, "No subscription on completed session");
            break;
          }

          // Let activation errors propagate to the outer catch so recordEvent
          // is still called and the event is not silently lost.
          await activateFromSub(sub, clientRefId, eventId);
          void invalidatePlanCache(clientRefId);
        }

        // One-time credit purchase
        if (mode === "payment" && sessionMetadata?.packageId && clientRefId) {
          const credits = parseInt(sessionMetadata.credits ?? "0", 10);
          if (credits > 0) {
            await addCredits(
              clientRefId,
              credits,
              CreditTransactionType.PURCHASE,
              `Purchased ${sessionMetadata.packageName ?? sessionMetadata.packageId}`,
              paymentIntentId ?? eventId,
            );
            logger.info({ userId: clientRefId, credits, packageId: sessionMetadata.packageId }, "Credit package fulfilled");
          }
        }

        logger.info({ customerId, clientRefId, mode }, "Checkout session completed");
        break;
      }

      // invoice.paid — fires on every successful charge (initial + renewals).
      // activateSubscription is idempotent (upsert) so safe to call every time.
      case "invoice.paid": {
        const subscriptionId = obj.subscription as string | null;
        const customerId     = obj.customer as string;

        if (!subscriptionId) break;

        const userId = await resolveUserId(customerId);
        resolvedUserId = userId;

        if (!userId) {
          logger.warn({ customerId }, "invoice.paid: no user found");
          break;
        }

        const sub = await getStripe().subscriptions.retrieve(subscriptionId);
        await activateFromSub(sub, userId, eventId);
        void invalidatePlanCache(userId);
        logger.info({ userId, subscriptionId }, "Subscription provisioned via invoice.paid");
        break;
      }

      // invoice.payment_failed — mark past_due, customer needs to update payment method
      case "invoice.payment_failed": {
        const subscriptionId = obj.subscription as string | null;
        const customerId     = obj.customer as string;

        // Parallelise independent operations: user lookup + status update
        const [userId] = await Promise.all([
          findUserByCustomerId("STRIPE", customerId),
          subscriptionId
            ? updateSubscriptionStatus(subscriptionId, "PAST_DUE", undefined, eventId)
            : Promise.resolve(),
        ]);
        resolvedUserId = userId;

        logger.warn({ customerId, subscriptionId }, "Invoice payment failed — marked PAST_DUE");
        break;
      }

      // customer.subscription.created — fallback path if checkout.session.completed
      // didn't fire or failed. Also handles subscriptions created outside Checkout.
      case "customer.subscription.created":
      // customer.subscription.updated — plan changes, trial end, cancel scheduling
      case "customer.subscription.updated": {
        const customerId     = obj.customer as string;
        const subscriptionId = obj.id as string;
        const status         = obj.status as string;
        const cancelAtPeriodEnd = obj.cancel_at_period_end as boolean;

        const userId = await resolveUserId(customerId);
        resolvedUserId = userId;

        if (!userId) {
          logger.warn({ customerId, eventType }, "No user found for Stripe customer — skipping");
          break;
        }

        if (status === "active" || status === "trialing") {
          // Retrieve fresh sub to get correct period dates (API v2026: dates on items)
          const sub = await getStripe().subscriptions.retrieve(subscriptionId);
          await activateFromSub(sub, userId, eventId);
        } else if (status === "canceled") {
          await updateSubscriptionStatus(subscriptionId, "CANCELED", undefined, eventId);
        } else if (status === "past_due") {
          await updateSubscriptionStatus(subscriptionId, "PAST_DUE", undefined, eventId);
        } else if (status === "incomplete") {
          await updateSubscriptionStatus(subscriptionId, "INCOMPLETE", undefined, eventId);
        }

        // cancelAtPeriodEnd flag — subscription still active but scheduled to cancel
        if (cancelAtPeriodEnd && status !== "canceled") {
          await updateSubscriptionStatus(subscriptionId, "ACTIVE", true, eventId);
        }

        void invalidatePlanCache(userId);
        break;
      }

      // customer.subscription.deleted — hard cancel at period end
      case "customer.subscription.deleted": {
        const subscriptionId = obj.id as string;
        const customerId     = obj.customer as string;
        resolvedUserId = await findUserByCustomerId("STRIPE", customerId);
        await updateSubscriptionStatus(subscriptionId, "CANCELED", undefined, eventId);
        if (resolvedUserId) void invalidatePlanCache(resolvedUserId);
        logger.info({ subscriptionId }, "Subscription deleted — marked CANCELED");
        break;
      }

      // invoice.payment_succeeded — kept for belt-and-suspenders period tracking.
      // invoice.paid is the canonical path; this handles edge cases where invoice.paid
      // doesn't fire (e.g. zero-amount invoices on trial conversions).
      case "invoice.payment_succeeded": {
        const subscriptionId = obj.subscription as string | null;
        const customerId     = obj.customer as string;
        resolvedUserId = await findUserByCustomerId("STRIPE", customerId);

        if (subscriptionId) {
          const periodStart = new Date((obj.period_start as number) * 1000);
          const periodEnd   = new Date((obj.period_end   as number) * 1000);
          // Only call renewSubscription (not activateSubscription) to avoid
          // double-writing on the same cycle as invoice.paid
          await renewSubscription(subscriptionId, periodStart, periodEnd, eventId);
        }
        break;
      }

      case "charge.refunded": {
        const customerId     = obj.customer as string;
        const amountRefunded = obj.amount_refunded as number;
        const currency       = obj.currency as string;
        const userId = await findUserByCustomerId("STRIPE", customerId);
        resolvedUserId = userId;

        if (userId) {
          await logBillingAudit({
            userId,
            stripeEventId: eventId,
            stripeObjectId: obj.id as string,
            eventType,
            newState: "REFUNDED",
            amount: amountRefunded,
            currency,
          });
          logger.info({ customerId, amountRefunded }, "Charge refunded");
        }
        break;
      }

      case "charge.dispute.created": {
        const customerId = obj.customer as string;
        const userId = await findUserByCustomerId("STRIPE", customerId);
        resolvedUserId = userId;

        if (userId) {
          await logBillingAudit({
            userId,
            stripeEventId: eventId,
            stripeObjectId: obj.id as string,
            eventType,
            newState: "DISPUTED",
          });
        }
        logger.warn({ customerId, disputeId: obj.id, userId }, "Charge dispute created — action required");
        break;
      }

      default:
        logger.debug({ eventType }, "Unhandled Stripe event type");
    }

    // 3. Record event for idempotency — use already-resolved userId to avoid extra DB call
    await recordEvent("STRIPE", eventId, eventType, resolvedUserId, { id: eventId, type: eventType });

    logger.info({ eventType, eventId, durationMs: timer.end() }, "Stripe webhook processed");
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error({ err: sanitizeError(error), eventType, eventId, durationMs: timer.end() }, "Stripe webhook handler failed");
    return apiError("Handler failed", 500);
  }
}
