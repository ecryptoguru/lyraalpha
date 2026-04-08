import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "notifications-api" });

const NOTIFICATION_META: Record<string, { href: string; severity: "low" | "medium" | "high" }> = {
  morning_intelligence: { href: "/dashboard", severity: "medium" },
  portfolio_risk: { href: "/dashboard/portfolio", severity: "high" },
  opportunity_alert: { href: "/dashboard/discovery", severity: "medium" },
  narrative_change: { href: "/dashboard#market-intelligence", severity: "medium" },
  shock_warning: { href: "/dashboard/stress-test", severity: "high" },
  weekly_report_ready: { href: "/dashboard?view=weekly-report", severity: "low" },
  push: { href: "/dashboard", severity: "medium" },
};

export const dynamic = "force-dynamic";

// GET — fetch notifications for current user
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        symbol: true,
        read: true,
        createdAt: true,
      },
    });

    const alerts = notifications.map((notification) => {
      const meta = NOTIFICATION_META[notification.type] ?? { href: "/dashboard", severity: "low" as const };

      return {
        ...notification,
        href: meta.href,
        severity: meta.severity,
      };
    });

    const unreadCount = alerts.filter((n) => !n.read).length;

    return NextResponse.json({ alerts, unreadCount });
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Notifications GET failed");
    return apiError("Internal error", 500);
  }
}

// PATCH — mark all as read
export async function PATCH() {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Notifications PATCH failed");
    return apiError("Internal error", 500);
  }
}
