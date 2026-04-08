import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { createLogger } from "@/lib/logger";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";
import { escHtml } from "@/lib/utils/html";
import { sendAnalyticsReport } from "@/lib/ami-bridge";

const logger = createLogger({ service: "blog-digest-cron" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

const BATCH_SIZE = 50;
const SUBSCRIBER_PAGE_SIZE = 500;

async function* streamSubscriberEmails(): AsyncGenerator<string[]> {
  let cursor: string | undefined;
  while (true) {
    const rows = await prisma.userPreference.findMany({
      where: { blogSubscribed: true },
      select: { id: true, user: { select: { email: true } } },
      orderBy: { id: "asc" },
      take: SUBSCRIBER_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    const emails = rows
      .map((r) => r.user?.email)
      .filter((e): e is string => Boolean(e));
    yield emails;
    if (rows.length < SUBSCRIBER_PAGE_SIZE) break;
    cursor = rows[rows.length - 1].id;
  }
}

export async function GET(req: NextRequest) {
  return withCronAuthAndLogging(req, { logger, job: "blog-digest" }, async () => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentPosts = await prisma.blogPost.findMany({
      where: { status: "published", publishedAt: { gte: oneWeekAgo } },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, title: true, description: true, category: true, publishedAt: true },
      take: 5,
    });

    if (recentPosts.length === 0) {
      logger.info("No new posts this week — skipping digest");
      return NextResponse.json({ success: true, sent: 0, reason: "no_new_posts" });
    }

    const BASE_URL = "https://lyraalpha.ai";
    const postItems = recentPosts
      .map(
        (p) => `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.35);">${escHtml(p.category)}</p>
          <a href="${BASE_URL}/blog/${p.slug}" style="font-size:16px;font-weight:600;color:#fff;text-decoration:none;line-height:1.4;">${escHtml(p.title)}</a>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">${escHtml(p.description)}</p>
          <a href="${BASE_URL}/blog/${p.slug}" style="display:inline-block;margin-top:10px;font-size:11px;font-weight:700;color:#f59e0b;text-decoration:none;letter-spacing:0.08em;">Read article →</a>
        </td>
      </tr>`,
      )
      .join("");

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#040816;color:#fff;padding:32px;border-radius:16px;">
        <p style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#f59e0b;margin:0 0 8px;">LyraAlpha AI · Weekly Digest</p>
        <h1 style="font-size:24px;font-weight:300;color:#fff;margin:0 0 8px;">What we wrote this week</h1>
        <p style="font-size:13px;color:rgba(255,255,255,0.4);margin:0 0 24px;">${recentPosts.length} new article${recentPosts.length > 1 ? "s" : ""} from the LyraAlpha AI journal.</p>
        <table style="width:100%;border-collapse:collapse;">
          ${postItems}
        </table>
        <div style="margin-top:24px;text-align:center;">
          <a href="${BASE_URL}/blog" style="display:inline-block;background:#f59e0b;color:#0a0a0a;font-weight:700;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;padding:12px 28px;border-radius:10px;text-decoration:none;">View all articles</a>
        </div>
        <p style="margin:24px 0 0;font-size:11px;color:rgba(255,255,255,0.22);text-align:center;">
          You're receiving this because you subscribed to LyraAlpha AI blog updates.
          <a href="${BASE_URL}/dashboard/settings" style="color:#f59e0b;">Manage preferences</a>
        </p>
      </div>`;

    const subject = `LyraAlpha AI — ${recentPosts.length} new article${recentPosts.length > 1 ? "s" : ""} this week`;
    let totalSent = 0;
    let pageCount = 0;

    for await (const pageEmails of streamSubscriberEmails()) {
      pageCount++;
      if (pageEmails.length === 0) continue;

      for (let i = 0; i < pageEmails.length; i += BATCH_SIZE) {
        const batch = pageEmails.slice(i, i + BATCH_SIZE);
        const ok = await sendBrevoEmail({
          to: batch.map((email) => ({ email })),
          subject,
          htmlContent: html,
          tags: ["blog-digest"],
        });
        if (ok) totalSent += batch.length;
      }
    }

    logger.info({ postCount: recentPosts.length, totalSent, pageCount }, "Blog digest sent");

    // Report analytics back to AMI 2.0 (non-blocking, no-op if AMI_OUTBOUND_WEBHOOK_URL not set)
    void sendAnalyticsReport({
      period: oneWeekAgo.toISOString().split("T")[0] + "_to_" + new Date().toISOString().split("T")[0],
      metrics: {
        totalPosts: recentPosts.length,
        digestRecipients: totalSent,
        digestSentAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, postCount: recentPosts.length, totalSent });
  });
}
