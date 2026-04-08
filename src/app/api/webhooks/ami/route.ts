import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { verifyAmiSignature } from "@/lib/blog/webhook-verify";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";
import { escHtml } from "@/lib/utils/html";

const logger = createLogger({ service: "ami-webhook" });

const SUBSCRIBER_PAGE_SIZE = 500;
const BATCH_SIZE = 50;

const BlogPostPublishedSchema = z.object({
  event: z.enum(["blog_post.published", "blog_post.updated", "blog_post.archived"]),
  data: z.object({
    contentId: z.string(),
    title: z.string().min(1).max(300),
    slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
    description: z.string().min(1).max(500),
    content: z.string().min(100),
    category: z.string().min(1).max(100),
    tags: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
    metaDescription: z.string().max(160).optional(),
    heroImageUrl: z
      .string()
      .url()
      .refine((u) => u.startsWith("https://"), { message: "heroImageUrl must be an HTTPS URL" })
      .optional(),
    author: z.string().default("LyraAlpha Research"),
    featured: z.boolean().default(false),
    sourceAgent: z.string().optional(),
  }),
});

type BlogPostPayload = z.infer<typeof BlogPostPublishedSchema>;

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

async function notifyBlogSubscribers(title: string, description: string, slug: string) {
  try {
    const url = `https://lyraalpha.ai/blog/${slug}`;
    const safeTitle = escHtml(title);
    const safeDesc = escHtml(description);
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#040816;color:#fff;padding:32px;border-radius:16px;">
        <p style="font-size:10px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#f59e0b;margin:0 0 16px;">LyraAlpha AI · New Article</p>
        <h1 style="font-size:22px;font-weight:300;line-height:1.4;color:#fff;margin:0 0 12px;">${safeTitle}</h1>
        <p style="font-size:14px;line-height:1.7;color:rgba(255,255,255,0.55);margin:0 0 24px;">${safeDesc}</p>
        <a href="${url}" style="display:inline-block;background:#f59e0b;color:#0a0a0a;font-weight:700;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;padding:12px 24px;border-radius:10px;text-decoration:none;">Read Article</a>
        <p style="margin:24px 0 0;font-size:11px;color:rgba(255,255,255,0.25);">You're receiving this because you subscribed to LyraAlpha AI blog updates. <a href="https://lyraalpha.ai/dashboard/settings" style="color:#f59e0b;">Manage preferences</a></p>
      </div>
    `;
    const subject = `New on LyraAlpha AI: ${title}`;
    let totalSent = 0;

    for await (const pageEmails of streamSubscriberEmails()) {
      for (let i = 0; i < pageEmails.length; i += BATCH_SIZE) {
        const batch = pageEmails.slice(i, i + BATCH_SIZE);
        await sendBrevoEmail({
          to: batch.map((email) => ({ email })),
          subject,
          htmlContent: html,
          tags: ["blog-notification", slug],
        });
        totalSent += batch.length;
      }
    }

    logger.info({ slug, totalSent }, "Blog subscriber notifications sent");
  } catch (err) {
    logger.warn({ err: sanitizeError(err), slug }, "Failed to send blog subscriber notifications");
  }
}

async function resolveSlug(requestedSlug: string, contentId: string): Promise<string> {
  const existing = await prisma.blogPost.findFirst({
    where: { slug: requestedSlug },
    select: { sourceContentId: true },
  });
  if (!existing || existing.sourceContentId === contentId) {
    return requestedSlug;
  }
  // Slug taken by a different post — append a short unique suffix
  const suffix = Date.now().toString(36);
  const unique = `${requestedSlug}-${suffix}`;
  logger.warn(
    { requestedSlug, contentId, resolvedSlug: unique },
    "Slug collision — appending suffix",
  );
  return unique;
}

async function handlePublished(payload: BlogPostPayload) {
  const { data } = payload;

  const finalSlug = await resolveSlug(data.slug, data.contentId);

  const blogFields = {
    slug: finalSlug,
    title: data.title,
    description: data.description,
    content: data.content,
    author: data.author,
    category: data.category,
    tags: data.tags,
    keywords: data.keywords,
    metaDescription: data.metaDescription,
    heroImageUrl: data.heroImageUrl,
    featured: data.featured,
    status: "published",
    sourceAgent: data.sourceAgent,
  };

  const blogPost = await prisma.blogPost.upsert({
    where: { sourceContentId: data.contentId },
    create: { ...blogFields, sourceContentId: data.contentId },
    update: blogFields,
    select: { id: true, slug: true },
  });

  // Revalidate blog pages for ISR
  revalidatePath("/blog");
  revalidatePath(`/blog/${blogPost.slug}`);
  revalidatePath("/");
  revalidatePath(
    `/blog/category/${data.category.toLowerCase().replace(/\s+/g, "-")}`,
  );

  logger.info(
    { slug: blogPost.slug, id: blogPost.id, event: payload.event },
    "Blog post upserted and pages revalidated",
  );

  // Notify subscribers async (don't block the response)
  if (payload.event === "blog_post.published") {
    void notifyBlogSubscribers(data.title, data.description, blogPost.slug);
  }

  return blogPost.slug;
}

async function handleArchived(payload: BlogPostPayload) {
  const updated = await prisma.blogPost.updateMany({
    where: { sourceContentId: payload.data.contentId },
    data: { status: "archived" },
  });
  // Fallback: if no record matched by sourceContentId (e.g. legacy post), try by slug
  if (updated.count === 0) {
    await prisma.blogPost.updateMany({
      where: { slug: payload.data.slug },
      data: { status: "archived" },
    });
  }
  revalidatePath("/blog");
  revalidatePath(`/blog/${payload.data.slug}`);
  revalidatePath("/");
  revalidatePath(
    `/blog/category/${payload.data.category.toLowerCase().replace(/\s+/g, "-")}`,
  );
  logger.info({ slug: payload.data.slug, contentId: payload.data.contentId }, "Blog post archived");
  return payload.data.slug;
}

export async function POST(req: NextRequest) {
  const secret = process.env.AMI_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("AMI_WEBHOOK_SECRET not configured");
    return apiError("Server misconfigured", 500);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-ami-signature") ?? "";

  if (!verifyAmiSignature(rawBody, signature, secret)) {
    logger.warn({ signature: signature.slice(0, 16) }, "AMI webhook signature verification failed");
    return apiError("Invalid signature", 401);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const validation = BlogPostPublishedSchema.safeParse(parsed);
  if (!validation.success) {
    logger.warn({ errors: validation.error.flatten() }, "AMI webhook payload validation failed");
    return apiError("Invalid payload", 400, validation.error.flatten());
  }

  const payload = validation.data;

  // Idempotency check — prevent duplicate processing (and duplicate Brevo sends) on retry storms
  const idempotencyKey = `ami:event:${payload.event}:${payload.data.contentId}`;
  try {
    const alreadyProcessed = await redis.get(idempotencyKey);
    if (alreadyProcessed) {
      logger.info(
        { key: idempotencyKey, slug: payload.data.slug },
        "AMI webhook duplicate — already processed within TTL window",
      );
      return NextResponse.json({ success: true, slug: payload.data.slug, event: payload.event, cached: true });
    }
  } catch (err) {
    // Redis unavailable — log and continue processing (fail open, not closed)
    logger.warn({ err: sanitizeError(err) }, "AMI webhook idempotency check failed — proceeding");
  }

  try {
    let slug: string;
    if (payload.event === "blog_post.archived") {
      slug = await handleArchived(payload);
    } else {
      slug = await handlePublished(payload);
    }

    // Mark as processed — TTL 1 hour. Set AFTER successful handling so retries after failures are not swallowed.
    try {
      await redis.set(idempotencyKey, "1", { ex: 3600 });
    } catch (err) {
      logger.warn({ err: sanitizeError(err) }, "AMI webhook idempotency mark failed — non-fatal");
    }

    return NextResponse.json({ success: true, slug, event: payload.event });
  } catch (err) {
    logger.error(
      { err: sanitizeError(err), slug: payload.data.slug, event: payload.event },
      "AMI webhook handler failed",
    );
    return apiError("Handler failed", 500);
  }
}
