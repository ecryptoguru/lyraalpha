import { NextResponse } from "next/server";
import { verifyRazorpayWebhook } from "@/lib/payments/webhook-verify";
import {
  isEventProcessed,
  recordEvent,
  activateSubscription,
  updateSubscriptionStatus,
  findUserByCustomerId,
  linkCustomerId,
  resolvePlan,
} from "@/lib/payments/subscription.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";

import { z } from "zod";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "razorpay-webhook" });

const RazorpayEventSchema = z.object({
  event: z.string(),
  payload: z.record(
    z.string(),
    z.object({
      entity: z.record(z.string(), z.unknown()),
    })
  ),
}).catchall(z.unknown());

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    logger.error("RAZORPAY_WEBHOOK_SECRET not configured");
    return apiError("Server misconfigured", 500);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  // 1. Verify signature
  const verification = verifyRazorpayWebhook(rawBody, signature, WEBHOOK_SECRET);
  if (!verification.valid || !verification.event) {
    logger.warn({ error: verification.error }, "Razorpay webhook verification failed");
    return apiError(verification.error ?? "Webhook verification failed", 400);
  }

  const parsedEvent = RazorpayEventSchema.safeParse(verification.event);
  if (!parsedEvent.success) {
    logger.warn({ error: parsedEvent.error }, "Razorpay webhook payload validation failed");
    return apiError("Invalid payload format", 400);
  }

  const event = parsedEvent.data;
  const eventType = event.event;
  const payload = event.payload;

  // Razorpay doesn't have a unique event ID — construct one from entity IDs.
  // For subscription.charged (renewals), prefer the payment entity ID so each
  // renewal cycle gets a distinct key. Falling back to subscription ID would
  // cause every renewal after the first to be silently dropped as a duplicate.
  const subEntity = payload?.subscription?.entity || {};
  const paymentEntity = payload?.payment?.entity || {};
  const entity = Object.keys(paymentEntity).length > 0 ? paymentEntity : subEntity;
  const entityId =
    (paymentEntity?.id as string) ||
    (entity?.id as string) ||
    "";
  const eventId = `rzp_${eventType}_${entityId}`;

  // 2. Idempotency check
  if (await isEventProcessed(eventId)) {
    logger.info({ eventId }, "Razorpay event already processed — skipping");
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    // 3. Handle event types
    switch (eventType) {
      case "subscription.activated":
      case "subscription.charged": {
        const sub = payload.subscription.entity;
        const subscriptionId = sub.id as string;
        const customerId = sub.customer_id as string;
        const planId = sub.plan_id as string;
        const currentStart = new Date((sub.current_start as number) * 1000);
        const currentEnd = new Date((sub.current_end as number) * 1000);
        const notes = sub.notes as Record<string, string> | null;
        const clerkUserId = notes?.clerk_user_id;

        // Link customer if we have a clerk user ID in notes
        if (clerkUserId && customerId) {
          await linkCustomerId(clerkUserId, "RAZORPAY", customerId);
        }

        const userId = clerkUserId || await findUserByCustomerId("RAZORPAY", customerId);
        if (!userId) {
          logger.warn({ customerId }, "No user found for Razorpay customer");
          break;
        }

        const plan = resolvePlan("RAZORPAY", planId);
        await activateSubscription({
          userId,
          provider: "RAZORPAY",
          providerSubId: subscriptionId,
          plan,
          currentPeriodStart: currentStart,
          currentPeriodEnd: currentEnd,
          metadata: { planId, razorpayStatus: sub.status },
        });
        break;
      }

      case "subscription.pending": {
        const sub = payload.subscription.entity;
        const subscriptionId = sub.id as string;
        await updateSubscriptionStatus(subscriptionId, "PAST_DUE");
        break;
      }

      case "subscription.halted":
      case "subscription.cancelled": {
        const sub = payload.subscription.entity;
        const subscriptionId = sub.id as string;
        await updateSubscriptionStatus(subscriptionId, "CANCELED");
        break;
      }

      case "payment.captured": {
        logger.info({ paymentId: entity.id }, "Razorpay payment captured");
        break;
      }

      case "payment.failed": {
        logger.warn({ paymentId: entity.id }, "Razorpay payment failed");
        break;
      }

      default:
        logger.debug({ eventType }, "Unhandled Razorpay event type");
    }

    // 4. Record event for idempotency
    const customerId = (entity.customer_id as string) || null;
    const userId = customerId ? await findUserByCustomerId("RAZORPAY", customerId) : null;
    await recordEvent("RAZORPAY", eventId, eventType, userId, { type: eventType, entityId });

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error({ err: sanitizeError(error), eventType, eventId }, "Razorpay webhook handler failed");
    return apiError("Handler failed", 500);
  }
}
