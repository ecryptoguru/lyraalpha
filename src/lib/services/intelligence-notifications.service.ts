import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { safeJsonParse } from "@/lib/utils/json";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { normalizeNotificationPreferences } from "@/lib/notification-preferences";
import type { DashboardHomeData } from "@/lib/services/dashboard-home.service";
import type { WeeklyIntelligenceReport } from "@/lib/services/weekly-intelligence-report.service";
import type { PushSubscription as WebPushSubscription } from "web-push";

const logger = createLogger({ service: "intelligence-notifications" });

export type IntelligenceNotificationType =
  | "morning_intelligence"
  | "portfolio_risk"
  | "opportunity_alert"
  | "narrative_change"
  | "shock_warning"
  | "weekly_report_ready";

export type IntelligenceNotificationSeverity = "low" | "medium" | "high";

export interface IntelligenceNotificationEvent {
  type: IntelligenceNotificationType;
  severity: IntelligenceNotificationSeverity;
  title: string;
  body: string;
  href: string;
  dedupeKey: string;
  symbol?: string | null;
  emailSubject?: string;
}

export interface DeliveryResult {
  stored: boolean;
  pushSent: boolean;
  emailSent: boolean;
  suppressed: boolean;
}

const DEFAULT_TTLS: Record<IntelligenceNotificationType, number> = {
  morning_intelligence: 18 * 60 * 60,
  portfolio_risk: 3 * 24 * 60 * 60,
  opportunity_alert: 5 * 24 * 60 * 60,
  narrative_change: 5 * 24 * 60 * 60,
  shock_warning: 3 * 24 * 60 * 60,
  weekly_report_ready: 6 * 24 * 60 * 60,
};

function shouldUseNewsCadence(type: IntelligenceNotificationType): boolean {
  return type === "opportunity_alert" || type === "narrative_change" || type === "morning_intelligence";
}

function isTypeEnabled(
  prefs: {
    morningIntelligence?: boolean | null;
    portfolioAlerts?: boolean | null;
    opportunityAlerts?: boolean | null;
    narrativeAlerts?: boolean | null;
    shockWarnings?: boolean | null;
    weeklyReports?: boolean | null;
  } | null | undefined,
  type: IntelligenceNotificationType,
): boolean {
  switch (type) {
    case "morning_intelligence":
      return prefs?.morningIntelligence ?? true;
    case "portfolio_risk":
      return prefs?.portfolioAlerts ?? true;
    case "opportunity_alert":
      return prefs?.opportunityAlerts ?? true;
    case "narrative_change":
      return prefs?.narrativeAlerts ?? true;
    case "shock_warning":
      return prefs?.shockWarnings ?? true;
    case "weekly_report_ready":
      return prefs?.weeklyReports ?? true;
    default:
      return true;
  }
}

async function shouldSuppress(userId: string, event: IntelligenceNotificationEvent): Promise<boolean> {
  try {
    const key = `notif:event:${userId}:${event.dedupeKey}`;
    const existing = await redis.get(key);
    return Boolean(existing);
  } catch {
    return false;
  }
}

async function reserveDedupe(userId: string, event: IntelligenceNotificationEvent): Promise<void> {
  try {
    const key = `notif:event:${userId}:${event.dedupeKey}`;
    await redis.setex(key, DEFAULT_TTLS[event.type], "1");
  } catch {
    logger.warn({ userId, type: event.type }, "failed to reserve notification dedupe key");
  }
}

async function getWebPush() {
  const webpush = (await import("web-push")).default;
  const email = process.env.VAPID_EMAIL;
  const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privKey = process.env.VAPID_PRIVATE_KEY;
  if (!email || !pubKey || !privKey) {
    throw new Error("VAPID environment variables are not configured");
  }
  webpush.setVapidDetails(email, pubKey, privKey);
  return webpush;
}

function buildEmailHtml(event: IntelligenceNotificationEvent) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const href = /^https?:\/\//.test(event.href) ? event.href : `${appUrl}${event.href}`;
  return {
    subject: event.emailSubject ?? event.title,
    text: `${event.title}\n\n${event.body}\n\nOpen: ${href}`,
    html: `<div style="font-family: Inter, Arial, sans-serif; color: #111827; line-height: 1.6;"><p style="font-size:12px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:#f59e0b;">${event.type.replace(/_/g, " ")}</p><h2 style="margin:8px 0;">${event.title}</h2><p>${event.body}</p><a href="${href}" style="display:inline-block; margin-top:12px; background:#f59e0b; color:#111827; text-decoration:none; padding:10px 16px; border-radius:8px; font-weight:700;">Open in LyraAlpha AI</a></div>`,
  };
}

export function buildWeeklyReportReadyEvent(report: WeeklyIntelligenceReport): IntelligenceNotificationEvent {
  return {
    type: "weekly_report_ready",
    severity: report.biggestRisk ? "medium" : "low",
    title: report.headline,
    body: report.summary,
    href: report.href,
    dedupeKey: `weekly-report:${report.region}:${report.generatedAt.slice(0, 10)}`,
    symbol: null,
    emailSubject: `Weekly intelligence report: ${report.headline}`,
  };
}

export function buildDashboardNotificationEvents(home: DashboardHomeData): IntelligenceNotificationEvent[] {
  const events: IntelligenceNotificationEvent[] = [];

  if (home.dailyBriefing?.marketOverview) {
    events.push({
      type: "morning_intelligence",
      severity: home.dailyBriefing.risksToWatch?.length ? "medium" : "low",
      title: `${home.region} morning intelligence is ready`,
      body: home.dailyBriefing.marketOverview,
      href: "/dashboard",
      dedupeKey: `morning-intelligence:${home.region}:${home.generatedAt.slice(0, 10)}`,
      emailSubject: `${home.region} morning intelligence brief`,
    });
  }

  if (home.portfolioPreview?.alertHeadline && home.portfolioPreview.alertBody) {
    events.push({
      type: "portfolio_risk",
      severity: home.portfolioPreview.healthBand === "High Risk" || home.portfolioPreview.healthBand === "Fragile" ? "high" : "medium",
      title: home.portfolioPreview.alertHeadline,
      body: home.portfolioPreview.alertBody,
      href: "/dashboard/portfolio",
      dedupeKey: `portfolio-risk:${home.portfolioPreview.id}:${home.portfolioPreview.updatedAt}`,
    });
  }

  const topOpportunity = home.discoveryPreview[0];
  if (topOpportunity && !topOpportunity.locked) {
    events.push({
      type: "opportunity_alert",
      severity: topOpportunity.newToday ? "medium" : "low",
      title: `${topOpportunity.symbol} is on the radar`,
      body: `${topOpportunity.headline} ${topOpportunity.whySurfaced}`,
      href: "/dashboard/discovery",
      dedupeKey: `opportunity:${topOpportunity.id}:${topOpportunity.computedAt}`,
      symbol: topOpportunity.symbol,
    });
  }

  if (home.narrativePreview) {
    events.push({
      type: "narrative_change",
      severity: home.narrativePreview.strengthLabel === "Accelerating" ? "medium" : "low",
      title: home.narrativePreview.title,
      body: home.narrativePreview.signal
        ? `${home.narrativePreview.summary} ${home.narrativePreview.signal}`
        : home.narrativePreview.summary,
      href: "/dashboard#market-intelligence",
      dedupeKey: `narrative:${home.narrativePreview.title}:${home.generatedAt.slice(0, 10)}`,
    });
  }

  const shockBody = home.portfolioPreview?.stressBody ?? home.dailyBriefing?.risksToWatch?.[0] ?? null;
  if (shockBody) {
    events.push({
      type: "shock_warning",
      severity: "high",
      title: home.portfolioPreview?.stressHeadline ?? "A shock scenario deserves attention",
      body: shockBody,
      href: "/dashboard/stress-test",
      dedupeKey: `shock-warning:${home.portfolioPreview?.id ?? home.region}:${home.generatedAt.slice(0, 10)}`,
    });
  }

  if (home.weeklyReport) {
    events.push({
      type: "weekly_report_ready",
      severity: home.weeklyReport.biggestRisk ? "medium" : "low",
      title: home.weeklyReport.headline,
      body: home.weeklyReport.summary,
      href: home.weeklyReport.href,
      dedupeKey: `weekly-preview:${home.region}:${home.generatedAt.slice(0, 10)}`,
      emailSubject: `Weekly intelligence report: ${home.weeklyReport.headline}`,
    });
  }

  return events;
}

export async function deliverIntelligenceNotification(userId: string, event: IntelligenceNotificationEvent): Promise<DeliveryResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      preferences: {
        select: {
          emailNotifications: true,
          pushNotifications: true,
          pushSubscriptionJson: true,
          newsAlerts: true,
          morningIntelligence: true,
          portfolioAlerts: true,
          opportunityAlerts: true,
          narrativeAlerts: true,
          shockWarnings: true,
          weeklyReports: true,
        },
      },
    },
  });

  if (!user) {
    return { stored: false, pushSent: false, emailSent: false, suppressed: true };
  }

  const prefs = normalizeNotificationPreferences(user.preferences ?? undefined);
  const allowNews = shouldUseNewsCadence(event.type) ? prefs.newsAlerts : true;
  const allowType = isTypeEnabled(prefs, event.type);

  if (!allowType || !allowNews) {
    return { stored: false, pushSent: false, emailSent: false, suppressed: true };
  }

  const suppressed = await shouldSuppress(userId, event);
  if (suppressed) {
    return { stored: false, pushSent: false, emailSent: false, suppressed: true };
  }

  await prisma.notification.create({
    data: {
      userId,
      type: event.type,
      title: event.title,
      body: event.body,
      symbol: event.symbol ?? null,
    },
  });

  await reserveDedupe(userId, event);

  let pushSent = false;
  let emailSent = false;

  if (prefs.pushNotifications && user.preferences?.pushSubscriptionJson) {
    try {
      const webpush = await getWebPush();
      const subscription = safeJsonParse<WebPushSubscription>(user.preferences.pushSubscriptionJson);
      if (!subscription) {
        logger.warn({ userId }, "Invalid push subscription JSON");
        return { pushSent: false, emailSent, stored: false, suppressed: false };
      }
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: event.title,
          body: event.body,
          icon: "/logo.png",
          url: event.href,
        }),
      );
      pushSent = true;
    } catch (error) {
      logger.warn({ userId, err: sanitizeError(error), type: event.type }, "push delivery failed");
    }
  }

  if (prefs.emailNotifications && user.email) {
    const email = buildEmailHtml(event);
    emailSent = await sendBrevoEmail({
      to: [{ email: user.email }],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
      tags: ["intelligence-notification", event.type],
    });
  }

  return {
    stored: true,
    pushSent,
    emailSent,
    suppressed: false,
  };
}
