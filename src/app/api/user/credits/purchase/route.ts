import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import Stripe from "stripe";
import { getAppUrlFromRequest, requireEnv } from "@/lib/runtime-env";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "credits-purchase-api" });

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
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const body = await req.json();
    const { packageId } = body;

    if (!packageId) {
      return apiError("Package ID required", 400);
    }

    const creditPackage = await prisma.creditPackage.findUnique({
      where: { id: packageId, isActive: true },
    });

    if (!creditPackage) {
      return apiError("Invalid or inactive package", 400);
    }

    // Get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, email: true },
    });

    let customerId = user?.stripeCustomerId;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user?.email || "unknown@lyraalpha.ai",
        metadata: { userId },
      });
      customerId = customer.id;
      
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create Stripe checkout session for credit purchase
    const origin = getAppUrlFromRequest(req.url);

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: creditPackage.name,
              description: `${creditPackage.credits} credits${creditPackage.bonusCredits > 0 ? ` + ${creditPackage.bonusCredits} bonus` : ""}`,
            },
            unit_amount: Math.round(creditPackage.priceUsd * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/dashboard?credits=purchased&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?credits=cancelled`,
      metadata: {
        userId,
        packageId,
        credits: String(creditPackage.credits + creditPackage.bonusCredits),
      },
    });

    logger.info({ userId, packageId, sessionId: session.id }, "Stripe checkout session created");

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Credit purchase failed");
    return apiError("Purchase failed", 500);
  }
}

