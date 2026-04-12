import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "push-subscribe" });

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("Request body must be valid JSON", 400);
    }
    const { subscription, enabled } = body as { subscription?: unknown; enabled?: boolean };

    await prisma.userPreference.upsert({
      where: { userId },
      update: {
        pushNotifications: enabled ?? true,
        pushSubscriptionJson: subscription ? JSON.stringify(subscription) : null,
      },
      create: {
        userId,
        pushNotifications: enabled ?? true,
        pushSubscriptionJson: subscription ? JSON.stringify(subscription) : null,
      },
    });

    logger.info({ userId, enabled }, "Push subscription updated");
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Push subscribe failed");
    return apiError("Failed to update subscription", 500);
  }
}

export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    await prisma.userPreference.upsert({
      where: { userId },
      update: { pushNotifications: false, pushSubscriptionJson: null },
      create: { userId, pushNotifications: false, pushSubscriptionJson: null },
    });

    logger.info({ userId }, "Push subscription removed");
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Push unsubscribe failed");
    return apiError("Failed to unsubscribe", 500);
  }
}
