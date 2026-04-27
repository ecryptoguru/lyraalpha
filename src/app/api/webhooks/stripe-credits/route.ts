import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import Stripe from "stripe";
import { requireEnv } from "@/lib/runtime-env";
import { grantCreditsInTransaction } from "@/lib/services/credit.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "stripe-credits-webhook" });

let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      apiVersion: "2026-02-25.clover",
    });
  }
  return stripe;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return apiError("Missing signature", 400);
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error({ err }, "Stripe signature verification failed");
    return apiError("Invalid signature", 400);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, packageId, credits } = session.metadata || {};

      if (!userId || !credits) {
        logger.warn({ sessionId: session.id }, "Missing metadata in checkout session");
        return NextResponse.json({ received: true });
      }

      const creditAmount = parseInt(credits, 10);
      if (isNaN(creditAmount) || creditAmount <= 0) {
        logger.error({ credits, sessionId: session.id }, "Invalid credit amount in metadata");
        return NextResponse.json({ received: true });
      }

      // Idempotency: check if this session was already processed
      const alreadyProcessed = await prisma.creditTransaction.findFirst({
        where: { referenceId: session.id },
      });

      if (alreadyProcessed) {
        logger.info({ sessionId: session.id }, "Webhook already processed, skipping");
        return NextResponse.json({ received: true });
      }

      await prisma.$transaction(async (tx) => {
        await grantCreditsInTransaction(
          tx,
          userId,
          creditAmount,
          "PURCHASE" as never,
          "Purchased credits via Stripe",
          session.id,
        );
      });

      logger.info({ userId, packageId, credits: creditAmount, sessionId: session.id }, "Credit purchase fulfilled");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error({ err: sanitizeError(error), eventType: event.type }, "Stripe webhook processing failed");
    return apiError("Webhook processing failed", 500);
  }
}
