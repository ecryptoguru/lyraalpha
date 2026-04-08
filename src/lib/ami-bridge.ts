import { createHmac } from "crypto";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "ami-bridge" });

/**
 * Analytics report payload sent back to AMI 2.0.
 * Coordinate with AMI team to confirm accepted fields before enabling.
 */
export interface AmiAnalyticsReport {
  period: string;
  metrics: {
    totalPosts?: number;
    digestRecipients?: number;
    digestSentAt?: string;
    [key: string]: unknown;
  };
  reportUrl?: string;
}

/**
 * Send an analytics report back to the AMI 2.0 system.
 *
 * DISABLED BY DEFAULT — requires AMI_OUTBOUND_WEBHOOK_URL to be set.
 * Coordinate with AMI team to confirm the inbound URL and accepted schema
 * before enabling. This function is intentionally a no-op until configured.
 *
 * Usage: call from src/app/api/cron/blog-digest/route.ts after computing
 * digest stats, passing period and relevant metrics.
 */
export async function sendAnalyticsReport(report: AmiAnalyticsReport): Promise<void> {
  const webhookUrl = process.env.AMI_OUTBOUND_WEBHOOK_URL;
  const secret = process.env.AMI_WEBHOOK_SECRET;

  if (!webhookUrl) {
    // Not configured — no-op. Remove this guard once AMI inbound URL is confirmed.
    return;
  }

  if (!secret) {
    logger.warn("AMI_WEBHOOK_SECRET not set — skipping analytics report");
    return;
  }

  const body = JSON.stringify({
    event: "content_analytics.report",
    data: report,
  });

  const sig = createHmac("sha256", secret).update(body).digest("hex");

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ami-signature": sig,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn(
        { status: res.status, body: text.slice(0, 200) },
        "AMI analytics report rejected",
      );
      return;
    }

    logger.info({ period: report.period }, "AMI analytics report sent");
  } catch (err) {
    logger.warn({ err }, "AMI analytics report failed — non-fatal");
  }
}
