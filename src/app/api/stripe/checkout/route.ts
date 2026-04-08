import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { auth } from "@/lib/auth";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { getPlanStripePriceId, type UpgradeRegion } from "@/lib/billing/upgrade-pricing";
import { getAppUrlFromRequest, isAuthBypassEnabled, requireEnv } from "@/lib/runtime-env";

const logger = createLogger({ service: "stripe-checkout" });

// Lazy instance — avoids module-init crash if env var missing at compile time
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), { apiVersion: "2026-01-28.clover" });
  return _stripe;
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    const userContext = isAuthBypassEnabled()
      ? { emailAddresses: [{ emailAddress: "test@insightalpha.ai" }], firstName: "Test", lastName: "User" }
      : await currentUser();

    if (!userContext) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    const url = new URL(req.url);
    const plan = url.searchParams.get("plan");

    if (plan !== "pro" && plan !== "elite") {
      return NextResponse.redirect(new URL("/dashboard/upgrade", req.url));
    }

    const region = (url.searchParams.get("region") === "IN" ? "IN" : "US") as UpgradeRegion;
    const priceId = getPlanStripePriceId(region, plan);

    if (!priceId) {
      logger.error({ plan, region }, "Missing Stripe price IDs in environment");
      return new NextResponse("Server configuration error", { status: 500 });
    }

    const origin = getAppUrlFromRequest(req.url);
    const successUrl = `${origin}/dashboard/upgrade?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${origin}/dashboard/upgrade?checkout=canceled`;

    // Look up existing customer — single query selects only what we need
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, email: true },
    });

    let customerId = dbUser?.stripeCustomerId ?? null;

    if (!customerId) {
      // Resolve email: prefer Clerk, fall back to DB record
      const email = (userContext.emailAddresses[0]?.emailAddress ?? dbUser?.email) || undefined;
      const name  = `${userContext.firstName ?? ""} ${userContext.lastName ?? ""}`.trim() || undefined;

      const customer = await getStripe().customers.create({
        email,
        name,
        metadata: { userId },
      });
      customerId = customer.id;

      // Persist immediately so webhook findUserByCustomerId works even if
      // customer.subscription.created fires before checkout.session.completed
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId, updatedAt: new Date() },
      });

      logger.info({ userId, customerId }, "Stripe customer created and saved");
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        userId,
        region,
        plan,
      },
    });

    if (!session.url) throw new Error("No session URL returned from Stripe");

    logger.info({ userId, plan, sessionId: session.id }, "Checkout session created");
    return NextResponse.redirect(session.url);
  } catch (error) {
    logger.error({ err: error }, "Failed to create Stripe checkout session");
    return NextResponse.redirect(new URL("/dashboard/upgrade?error=checkout_failed", req.url));
  }
}
