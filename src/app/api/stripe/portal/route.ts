import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { getAppUrlFromRequest, requireEnv } from "@/lib/runtime-env";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "stripe-portal" });

// Lazy instance — avoids module-init crash if env var missing at compile time
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), { apiVersion: "2026-02-25.clover" });
  return _stripe;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return apiError("No Stripe customer found", 404);
    }

    // Always use APP_URL — never fall back to referer or hardcoded localhost
    const origin = getAppUrlFromRequest(req.url);

    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/dashboard/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error({ err: error }, "Failed to create Stripe portal session");
    return apiError("Internal Server Error", 500);
  }
}
