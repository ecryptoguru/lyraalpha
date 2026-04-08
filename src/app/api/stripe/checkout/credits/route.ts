import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getCreditPackages } from "@/lib/services/credit.service";
import { getCreditPackStripePriceId, type UpgradeRegion } from "@/lib/billing/upgrade-pricing";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getAppUrlFromRequest, requireEnv } from "@/lib/runtime-env";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "stripe-credits-checkout" });
let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), { apiVersion: "2026-01-28.clover" });
  }
  return stripe;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    const userContext = await currentUser();

    if (!userId || !userContext) {
      return apiError("Unauthorized", 401);
    }

    const { packageId, region } = await req.json();

    if (!packageId) {
      return apiError("Missing packageId", 400);
    }

    const packages = await getCreditPackages();
    const selectedPackage = packages.find((p) => p.id === packageId);

    if (!selectedPackage) {
      return apiError("Invalid package", 400);
    }

    const purchaseRegion = (region === "IN" ? "IN" : "US") as UpgradeRegion;
    const stripePriceId = getCreditPackStripePriceId(selectedPackage, purchaseRegion);

    if (!stripePriceId) {
      return apiError("This package is not available for purchase yet", 400);
    }

    const origin = getAppUrlFromRequest(req.url);
    const successUrl = `${origin}/dashboard/upgrade?checkout=credits_success&package=${encodeURIComponent(selectedPackage.name)}`;
    const cancelUrl = `${origin}/dashboard/upgrade#credit-packages`;

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    let customerId = dbUser?.stripeCustomerId;

    if (!customerId) {
      const email = userContext.emailAddresses[0]?.emailAddress;
      const name = `${userContext.firstName || ""} ${userContext.lastName || ""}`.trim() || undefined;

      const customer = await getStripe().customers.create({
        email,
        name,
        metadata: { userId },
      });
      customerId = customer.id;

      // Persist immediately so webhook findUserByCustomerId works even if
      // the webhook fires before checkout.session.completed links the customer.
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId, updatedAt: new Date() },
      });
      logger.info({ userId, customerId }, "Stripe customer created and saved");
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        credits: String(selectedPackage.credits + selectedPackage.bonusCredits),
        userId,
        region: purchaseRegion,
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new Error("No session URL returned from Stripe");
    }

    logger.info(
      { userId, packageId, packageName: selectedPackage.name },
      "Credit package checkout session created"
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to create credit checkout session");
    return apiError("Failed to create checkout session", 500);
  }
}
