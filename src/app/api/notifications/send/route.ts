import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "push-send" });

let _webpushReady = false;
async function getWebPush() {
  const webpush = (await import("web-push")).default;
  if (!_webpushReady) {
    const email = process.env.VAPID_EMAIL;
    const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privKey = process.env.VAPID_PRIVATE_KEY;
    if (!email || !pubKey || !privKey) {
      throw new Error("VAPID environment variables are not configured");
    }
    webpush.setVapidDetails(email, pubKey, privKey);
    _webpushReady = true;
  }
  return webpush;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError("Unauthorized", 401);

  try {
    const { title, body, icon, url, type, symbol } = await req.json();

    const pref = await prisma.userPreference.findUnique({
      where: { userId },
      select: { pushNotifications: true, pushSubscriptionJson: true },
    });
    if (!pref?.pushNotifications || !pref.pushSubscriptionJson) {
      return apiError("No push subscription", 404);
    }

    const webpush = await getWebPush();
    const subscription = JSON.parse(pref.pushSubscriptionJson);
    const payload = JSON.stringify({ title, body, icon: icon ?? "/logo.png", url: url ?? "/dashboard" });

    await webpush.sendNotification(subscription, payload);

    prisma.notification.create({
      data: {
        userId,
        type: type ?? "push",
        title,
        body,
        symbol: symbol ?? null,
      },
    }).catch(() => {});

    logger.info({ userId }, "Push notification sent");
    return NextResponse.json({ success: true });
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 410 || statusCode === 404) {
      logger.warn({ userId }, "Stale push subscription detected — clearing from DB");
      await prisma.userPreference.upsert({
        where: { userId },
        update: { pushNotifications: false, pushSubscriptionJson: null },
        create: { userId, pushNotifications: false, pushSubscriptionJson: null },
      }).catch(() => {});
      return apiError("Push subscription expired. Please re-enable notifications.", 410);
    }
    logger.error({ err: sanitizeError(error) }, "Push send failed");
    return apiError("Failed to send notification", 500);
  }
}
