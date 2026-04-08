# AMI 2.0 → InsightAlpha Integration Guide

> **For the AMI 2.0 agent team.** This document specifies exactly what changes are required in the Convex codebase to publish blog posts directly to the InsightAlpha app.

---

## Overview

The InsightAlpha app now accepts blog posts via a secure HMAC-signed webhook. When a `blog_post` content piece transitions to `published` status in AMI 2.0, a Convex action sends the content to InsightAlpha, which:

1. Upserts the post in the Supabase `BlogPost` table
2. Triggers ISR revalidation of `/blog`, `/blog/[slug]`, `/blog/category/[cat]`, and `/`
3. Sends Brevo email notifications to all blog subscribers
4. Returns the published slug for tracking

---

## 1. Environment Variables (Add to Convex)

```bash
# In your Convex project dashboard → Settings → Environment Variables
INSIGHTALPHA_WEBHOOK_URL=https://insightalpha.ai/api/webhooks/ami
AMI_WEBHOOK_SECRET=<shared-secret>   # Must match the value in InsightAlpha's .env
```

> Generate the shared secret with: `openssl rand -hex 32`
> Add the same value to InsightAlpha's environment as `AMI_WEBHOOK_SECRET`.

---

## 2. Webhook Endpoint Specification

**URL:** `POST https://insightalpha.ai/api/webhooks/ami`

**Security:** HMAC-SHA256 signature over the raw request body.

**Required header:**
```
x-ami-signature: <hex-digest>
```

**Signature algorithm (TypeScript):**
```typescript
import { createHmac } from "crypto";

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

const body = JSON.stringify(eventPayload);
const signature = signPayload(body, process.env.AMI_WEBHOOK_SECRET!);

await fetch(process.env.INSIGHTALPHA_WEBHOOK_URL!, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-ami-signature": signature,
  },
  body,
});
```

---

## 3. Event Payload Schema

### `blog_post.published` (primary event)

```typescript
interface BlogPostPublishedPayload {
  event: "blog_post.published" | "blog_post.updated" | "blog_post.archived";
  data: {
    contentId: string;         // Convex contentPieces._id — used for traceability
    title: string;             // Max 300 chars
    slug: string;              // Lowercase, hyphens only: /^[a-z0-9-]+$/, max 200 chars
    description: string;       // 1–2 sentence summary, max 500 chars
    content: string;           // Full markdown body, min 100 chars
    category: string;          // e.g. "AI & Technology", "Market Intelligence", "Markets"
    tags: string[];            // e.g. ["AI", "LLMs", "Portfolio"]
    keywords: string[];        // SEO keywords, e.g. ["ai finance", "llm hallucination"]
    metaDescription?: string;  // Max 160 chars — for SEO meta tag. Falls back to description.
    heroImageUrl?: string;     // Absolute HTTPS URL. Used as OG image. From Creative Studio.
    author?: string;           // Defaults to "InsightAlpha Research"
    featured?: boolean;        // Default false. Only one post should be featured at a time.
    sourceAgent?: string;      // e.g. "Long-Form Writer", "SEO Engine"
  };
}
```

**Validation rules enforced by InsightAlpha:**
- `slug` must match `/^[a-z0-9-]+$/` — no spaces, underscores, or uppercase
- `content` must be ≥ 100 characters
- `heroImageUrl` must be a valid HTTPS URL if provided
- `metaDescription` max 160 characters

**Expected response:**
```json
{ "success": true, "slug": "why-ai-finance-hallucinate", "event": "blog_post.published" }
```

**Error responses:**
- `401` — Invalid or missing signature
- `400` — Payload validation failed (details included)
- `500` — Handler error (safe to retry)

---

## 4. Convex-Side Implementation

### 4a. New action: `convex/agents/publishing.ts`

Create this file in the AMI 2.0 Convex project:

```typescript
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { createHmac } from "crypto";

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

export const publishToInsightAlpha = internalAction({
  args: {
    contentId: v.id("contentPieces"),
    title: v.string(),
    description: v.string(),
    content: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
    keywords: v.optional(v.array(v.string())),
    metaDescription: v.optional(v.string()),
    heroImageUrl: v.optional(v.string()),
    author: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    sourceAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const webhookUrl = process.env.INSIGHTALPHA_WEBHOOK_URL;
    const secret = process.env.AMI_WEBHOOK_SECRET;

    if (!webhookUrl || !secret) {
      throw new Error("INSIGHTALPHA_WEBHOOK_URL or AMI_WEBHOOK_SECRET not configured");
    }

    const slug = generateSlug(args.title);

    const payload = {
      event: "blog_post.published" as const,
      data: {
        contentId: args.contentId,
        title: args.title,
        slug,
        description: args.description,
        content: args.content,
        category: args.category,
        tags: args.tags,
        keywords: args.keywords ?? [],
        metaDescription: args.metaDescription,
        heroImageUrl: args.heroImageUrl,
        author: args.author ?? "InsightAlpha Research",
        featured: args.featured ?? false,
        sourceAgent: args.sourceAgent,
      },
    };

    const body = JSON.stringify(payload);
    const signature = signPayload(body, secret);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ami-signature": signature,
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`InsightAlpha webhook failed: ${response.status} ${text}`);
    }

    const result = (await response.json()) as { success: boolean; slug: string };
    return { slug: result.slug };
  },
});
```

### 4b. `contentPieces` schema additions

Add these fields to the `contentPieces` Convex table schema:

```typescript
// In convex/schema.ts, inside the contentPieces table definition:
publishedToApp: v.optional(v.boolean()),
appSlug: v.optional(v.string()),
appPublishedAt: v.optional(v.number()),   // Unix timestamp ms
```

### 4c. Trigger the action from the approval flow

In the existing mutation that transitions a `contentPiece` to `published` status:

```typescript
import { internal } from "./_generated/api";

// After updating status to "published":
if (contentPiece.type === "blog_post") {
  await ctx.scheduler.runAfter(0, internal.agents.publishing.publishToInsightAlpha, {
    contentId: contentPiece._id,
    title: contentPiece.title,
    description: contentPiece.summary ?? contentPiece.description,
    content: contentPiece.body,
    category: contentPiece.category ?? "Market Intelligence",
    tags: contentPiece.tags ?? [],
    keywords: contentPiece.seoKeywords,
    metaDescription: contentPiece.metaDescription,
    heroImageUrl: contentPiece.heroImageUrl,
    sourceAgent: contentPiece.generatedBy,
  });
}

// Then update the record with the returned slug:
// (Handle this in the action's return value or via a follow-up mutation)
```

---

## 5. Content Requirements for Blog Posts

The Long-Form Writer agent must produce content that satisfies these constraints before triggering the webhook:

| Field | Requirement |
|-------|-------------|
| `title` | Clear, specific, SEO-oriented. No clickbait. Max 300 chars. |
| `slug` | Auto-generated from title. Only `[a-z0-9-]`. |
| `description` | 1–2 sentences, 80–200 chars. Used in blog cards and email subjects. |
| `content` | Markdown. Min 800 words. Use `##` for H2 headings, `---` for section breaks, `**bold**` for emphasis. No HTML. |
| `metaDescription` | Unique, 120–160 chars. If omitted, falls back to `description`. |
| `category` | Must be one of: `"AI & Technology"`, `"Market Intelligence"`, `"Markets"`. Others will render with neutral styling. |
| `tags` | 3–8 tags. Title-cased. e.g. `["AI", "Market Regime", "Portfolio"]` |
| `keywords` | 3–10 lowercase SEO keywords. e.g. `["ai finance tool", "market regime analysis"]` |
| `heroImageUrl` | HTTPS URL. Ideally 1200×630px or 16:9. Used as OG image + blog post header. |

### Markdown formatting rules

```markdown
## Section Heading

Paragraph text here. Use **bold** for emphasis on key terms.

- List item one
- List item two
- List item three

---

## Next Section
```

- Use `##` for top-level headings (renders as `<h2>`)
- Use `# ` (single hash) for sub-headings (renders as `<h3>`)
- Use `---` for horizontal rules between major sections
- Use `**text**` for bold emphasis
- Do NOT use tables, code blocks, or HTML — the renderer does not support them

---

## 6. Event Types

| Event | When to send | Effect on InsightAlpha |
|-------|-------------|----------------------|
| `blog_post.published` | First publish of a new post | Upserts post, ISR revalidation, Brevo notifications sent |
| `blog_post.updated` | Content edited after publish | Upserts post, ISR revalidation, no new Brevo notification |
| `blog_post.archived` | Post removed from public view | Sets `status: "archived"`, removes from blog listing, ISR revalidation |

---

## 7. Error Handling & Retry Strategy

```typescript
// Recommended retry wrapper for publishToInsightAlpha:
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 5000, 15000];

async function publishWithRetry(ctx, args, attempt = 0): Promise<{ slug: string }> {
  try {
    return await ctx.runAction(internal.agents.publishing.publishToInsightAlpha, args);
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      return publishWithRetry(ctx, args, attempt + 1);
    }
    // Log failure — do not block content approval flow
    console.error("publishToInsightAlpha failed after retries:", err);
    return { slug: "" };
  }
}
```

**Idempotency:** The InsightAlpha webhook uses `slug` as the unique key (upsert). Duplicate events for the same slug are safe — they will update the existing post.

**Do not block the approval flow:** Wrap the action call in `ctx.scheduler.runAfter(0, ...)` so a webhook failure does not prevent the content piece from being marked as published in Convex.

---

## 8. Testing the Integration Locally

1. Start InsightAlpha locally: `npm run dev` (runs on `localhost:3000`)
2. Set Convex env vars to point to localhost:
   ```bash
   INSIGHTALPHA_WEBHOOK_URL=http://localhost:3000/api/webhooks/ami
   AMI_WEBHOOK_SECRET=test-secret-do-not-use-in-production
   ```
3. Set the same secret in InsightAlpha's `.env.local`:
   ```bash
   AMI_WEBHOOK_SECRET=test-secret-do-not-use-in-production
   ```
4. Trigger the action manually via Convex dashboard or a test mutation
5. Verify in InsightAlpha logs and at `localhost:3000/blog`

**Test payload for manual curl testing:**
```bash
SECRET="test-secret-do-not-use-in-production"
BODY='{"event":"blog_post.published","data":{"contentId":"test123","title":"Test Blog Post from AMI","slug":"test-blog-post-from-ami","description":"A test post to verify the webhook integration is working correctly.","content":"## Introduction\n\nThis is a test post generated to verify the AMI to InsightAlpha webhook bridge.\n\n---\n\n## Section Two\n\nMore content here to satisfy the minimum length requirement for blog posts. The integration should upsert this into the BlogPost table and trigger ISR revalidation.","category":"AI & Technology","tags":["AI","Testing"],"keywords":["ami integration test"],"author":"AMI Test Agent","featured":false,"sourceAgent":"Test Runner"}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
curl -X POST http://localhost:3000/api/webhooks/ami \
  -H "Content-Type: application/json" \
  -H "x-ami-signature: $SIG" \
  -d "$BODY"
```

Expected response: `{"success":true,"slug":"test-blog-post-from-ami","event":"blog_post.published"}`

---

## 9. Email Ownership — Who Sends What

This project uses Brevo for all email delivery. Ownership is split cleanly:

### InsightAlpha App (this codebase) owns:
| Email | Trigger | Route |
|-------|---------|-------|
| Welcome email | User signs up via Clerk | `/api/webhooks/clerk` |
| New blog post notification | AMI publishes a blog post | `/api/webhooks/ami` |
| Weekly blog digest | Every Monday 10:00 UTC | `/api/cron/blog-digest` |
| Re-engagement nudge 1 | 7 days inactive | `/api/cron/reengagement` |
| Re-engagement nudge 2 | 14 days inactive | `/api/cron/reengagement` |
| Win-back email | 30 days inactive | `/api/cron/reengagement` |
| Onboarding reminder | 2 days, onboarding incomplete | `/api/cron/reengagement` |
| Weekly intelligence report | Every Monday | `/api/cron/weekly-report` |
| Credit / billing receipts | Stripe checkout | `/api/stripe/...` |
| Support / Myra responses | User initiates chat | Inline in chat routes |

**Rule:** Any email that requires access to Prisma user data, billing state, or session context is owned by InsightAlpha.

### AMI 2.0 Marketing Agent owns:
| Email | Trigger |
|-------|----------|
| Social post drafts for approval | Content generation cycle |
| LinkedIn/X campaign copy | Campaign scheduler |
| Waitlist nurture sequences | ICP-scored prospect in pipeline |
| Cold outreach sequences | LinkedIn Discovery agent |
| Newsletter broadcast (non-blog) | AMI editorial calendar |
| Influencer / partner outreach | Partnership agent |

**Rule:** Any email that is outbound marketing, prospect-facing, or part of a campaign sequence is owned by AMI. AMI has its own Brevo API key and contact lists — it does NOT share the InsightAlpha app's `BREVO_API_KEY`.

### The boundary in practice
- Blog subscriber notifications (people who opted in via InsightAlpha) → **InsightAlpha sends** (it has the subscriber list in Prisma)
- Cold/warm prospect nurture → **AMI sends** (it owns the ICP pipeline in Convex)
- If AMI wants to send to InsightAlpha's subscriber list → AMI triggers the InsightAlpha webhook; InsightAlpha does the actual send

---

## 10. Future Event Types (Reserved)

These are planned but not yet implemented on the InsightAlpha side. Do not send them yet.

| Event | Purpose |
|-------|---------|
| `social_post.approved` | Store social post copy for share cards |
| `competitor_brief.published` | Surface competitor intel on admin dashboard |
| `content_analytics.report` | Feed performance data back to AMI |
| `pql_alert` | Flag product-qualified leads for admin review |
| `churn_alert` | Flag at-risk users for admin review |

---

## 11. InsightAlpha Files Changed (Reference)

| File | What changed |
|------|-------------|
| `prisma/schema.prisma` | Added `BlogPost` model |
| `src/lib/blog/posts.ts` | Refactored to hybrid static+DB (async `getAllPosts`, `getPostBySlugAsync`, etc.) |
| `src/lib/blog/webhook-verify.ts` | HMAC signing/verification utilities |
| `src/app/api/webhooks/ami/route.ts` | Webhook receiver — validates, upserts, revalidates, notifies |
| `src/app/blog/page.tsx` | Async server component, pulls from DB |
| `src/app/blog/[slug]/page.tsx` | Hero image OG, share button, Lyra CTA, reading progress |
| `src/app/blog/category/[category]/page.tsx` | Programmatic category landing pages |
| `src/app/blog/feed.xml/route.ts` | RSS 2.0 feed |
| `src/app/api/cron/blog-digest/route.ts` | Weekly subscriber digest email |
| `src/app/sitemap.ts` | Includes DB posts + category pages |
| `src/components/blog/BlogReadingProgress.tsx` | Amber scroll progress bar |
| `src/components/blog/BlogShareButton.tsx` | Share card for blog posts |
| `src/components/blog/BlogSidebar.tsx` | Tags, trending widget, Lyra/waitlist CTA |

---

*Last updated: March 2026 · InsightAlpha Engineering*
