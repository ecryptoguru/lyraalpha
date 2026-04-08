/**
 * @vitest-environment node
 *
 * Tests for the AMI webhook handler — covering:
 * - HMAC signature verification
 * - Zod payload validation (including HTTPS heroImageUrl check)
 * - Slug collision resolution
 * - handlePublished upsert via sourceContentId
 * - handleArchived with sourceContentId fallback to slug
 * - Redis idempotency guard (prevent duplicate sends)
 * - Subscriber notification only fires on blog_post.published
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => {
  const makeModel = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    $transaction: vi.fn(),
  });
  return {
    prisma: new Proxy({} as Record<string, ReturnType<typeof makeModel>>, {
      get(target, prop: string) {
        if (prop === "$transaction") return vi.fn();
        if (!(prop in target)) target[prop] = makeModel();
        return target[prop];
      },
    }),
  };
});

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  },
}));

vi.mock("@/lib/blog/webhook-verify", () => ({
  verifyAmiSignature: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/email/brevo", () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: (e: unknown) => e,
}));

vi.mock("@/lib/api-response", () => ({
  apiError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import type { NextRequest } from "next/server";
import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { verifyAmiSignature } from "@/lib/blog/webhook-verify";
import { sendBrevoEmail } from "@/lib/email/brevo";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SECRET = "test-webhook-secret";

// Cast to NextRequest — at runtime Next.js accepts any Request-compatible object.
// The extra NextRequest fields (cookies, nextUrl, etc.) are not used by the route handler.
function buildRequest(payload: unknown, secret = SECRET): NextRequest {
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  return new Request("https://lyraalpha.ai/api/webhooks/ami", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ami-signature": sig,
    },
    body,
  }) as unknown as NextRequest;
}

const PUBLISHED_PAYLOAD = {
  event: "blog_post.published",
  data: {
    contentId: "content-abc-123",
    title: "Test Article Title",
    slug: "test-article-title",
    description: "A good description of the article.",
    content: "This is the full content of the article. ".repeat(5),
    category: "AI & Technology",
    tags: ["AI", "Finance"],
    keywords: ["ai", "finance"],
    metaDescription: "Short meta description.",
    heroImageUrl: "https://cdn.example.com/img.webp",
    author: "LyraAlpha Research",
    featured: false,
    sourceAgent: "ami-2.0",
  },
};

const UPDATED_PAYLOAD = { ...PUBLISHED_PAYLOAD, event: "blog_post.updated" };

const ARCHIVED_PAYLOAD = {
  event: "blog_post.archived",
  data: { ...PUBLISHED_PAYLOAD.data },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AMI_WEBHOOK_SECRET = SECRET;
  // Default: signature valid, not already processed, DB upsert succeeds
  (verifyAmiSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue("OK");
  (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (prisma.blogPost.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "post-id-1",
    slug: "test-article-title",
  });
  (prisma.blogPost.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
  (prisma.userPreference.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

// ─── Environment guard ───────────────────────────────────────────────────────

describe("environment guard", () => {
  it("returns 500 when AMI_WEBHOOK_SECRET is not set", async () => {
    delete process.env.AMI_WEBHOOK_SECRET;
    const res = await POST(buildRequest(PUBLISHED_PAYLOAD));
    expect(res.status).toBe(500);
  });
});

// ─── Signature verification ───────────────────────────────────────────────────

describe("signature verification", () => {
  it("returns 401 when signature is invalid", async () => {
    (verifyAmiSignature as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    const res = await POST(buildRequest(PUBLISHED_PAYLOAD));
    expect(res.status).toBe(401);
  });

  it("proceeds when signature is valid", async () => {
    const res = await POST(buildRequest(PUBLISHED_PAYLOAD));
    expect(res.status).toBe(200);
  });
});

// ─── Payload validation ───────────────────────────────────────────────────────

describe("payload validation", () => {
  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("https://lyraalpha.ai/api/webhooks/ami", {
      method: "POST",
      headers: { "x-ami-signature": "sig" },
      body: "not-json{{{",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(buildRequest({ event: "blog_post.published", data: {} }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when heroImageUrl uses HTTP (not HTTPS)", async () => {
    const payload = {
      ...PUBLISHED_PAYLOAD,
      data: { ...PUBLISHED_PAYLOAD.data, heroImageUrl: "http://insecure.com/img.jpg" },
    };
    const res = await POST(buildRequest(payload));
    expect(res.status).toBe(400);
  });

  it("accepts a valid HTTPS heroImageUrl", async () => {
    const res = await POST(buildRequest(PUBLISHED_PAYLOAD));
    expect(res.status).toBe(200);
  });

  it("accepts a missing heroImageUrl (optional field)", async () => {
    const payload = {
      ...PUBLISHED_PAYLOAD,
      data: { ...PUBLISHED_PAYLOAD.data, heroImageUrl: undefined },
    };
    const res = await POST(buildRequest(payload));
    expect(res.status).toBe(200);
  });

  it("returns 400 for unknown event type", async () => {
    const res = await POST(buildRequest({ ...PUBLISHED_PAYLOAD, event: "blog_post.deleted" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is shorter than 100 chars", async () => {
    const payload = { ...PUBLISHED_PAYLOAD, data: { ...PUBLISHED_PAYLOAD.data, content: "Too short." } };
    const res = await POST(buildRequest(payload));
    expect(res.status).toBe(400);
  });

  it("returns 400 when slug contains uppercase letters", async () => {
    const payload = { ...PUBLISHED_PAYLOAD, data: { ...PUBLISHED_PAYLOAD.data, slug: "Bad-Slug" } };
    const res = await POST(buildRequest(payload));
    expect(res.status).toBe(400);
  });
});

// ─── Idempotency ──────────────────────────────────────────────────────────────

describe("Redis idempotency", () => {
  it("returns 200 with cached:true when already processed", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce("1");

    const res = await POST(buildRequest(PUBLISHED_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    // DB upsert should NOT be called
    expect(prisma.blogPost.upsert).not.toHaveBeenCalled();
  });

  it("sets idempotency key AFTER successful processing", async () => {
    await POST(buildRequest(PUBLISHED_PAYLOAD));

    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining("ami:event:blog_post.published:content-abc-123"),
      "1",
      { ex: 3600 },
    );
  });

  it("proceeds (fail-open) when Redis.get throws", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Redis down"));

    const res = await POST(buildRequest(PUBLISHED_PAYLOAD));
    expect(res.status).toBe(200);
    expect(prisma.blogPost.upsert).toHaveBeenCalled();
  });

  it("does not block processing when Redis.set throws after success", async () => {
    (redis.set as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Redis write fail"));

    const res = await POST(buildRequest(PUBLISHED_PAYLOAD));
    expect(res.status).toBe(200);
  });
});

// ─── Slug collision resolution ────────────────────────────────────────────────

describe("slug collision resolution", () => {
  it("uses the requested slug when no collision exists", async () => {
    (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await POST(buildRequest(PUBLISHED_PAYLOAD));

    const upsertCall = (prisma.blogPost.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upsertCall.create.slug).toBe("test-article-title");
  });

  it("uses the requested slug when existing post has same sourceContentId (update case)", async () => {
    (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sourceContentId: "content-abc-123", // same contentId → same post being updated
    });

    await POST(buildRequest(PUBLISHED_PAYLOAD));

    const upsertCall = (prisma.blogPost.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upsertCall.create.slug).toBe("test-article-title");
  });

  it("appends a suffix when slug is taken by a different post", async () => {
    (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sourceContentId: "different-content-id", // different post occupies the slug
    });
    (prisma.blogPost.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "post-id-2",
      slug: "test-article-title-suffix",
    });

    await POST(buildRequest(PUBLISHED_PAYLOAD));

    const upsertCall = (prisma.blogPost.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upsertCall.create.slug).toMatch(/^test-article-title-.+$/);
    expect(upsertCall.create.slug).not.toBe("test-article-title");
  });
});

// ─── handlePublished ─────────────────────────────────────────────────────────

describe("handlePublished", () => {
  it("upserts by sourceContentId (not slug)", async () => {
    await POST(buildRequest(PUBLISHED_PAYLOAD));

    const upsertCall = (prisma.blogPost.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upsertCall.where).toEqual({ sourceContentId: "content-abc-123" });
  });

  it("sets status=published on create and update", async () => {
    await POST(buildRequest(PUBLISHED_PAYLOAD));

    const upsertCall = (prisma.blogPost.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upsertCall.create.status).toBe("published");
    expect(upsertCall.update.status).toBe("published");
  });

  it("sets sourceContentId only in create block (not update)", async () => {
    await POST(buildRequest(PUBLISHED_PAYLOAD));

    const upsertCall = (prisma.blogPost.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(upsertCall.create.sourceContentId).toBe("content-abc-123");
    expect(upsertCall.update.sourceContentId).toBeUndefined();
  });

  it("returns 200 with slug and event in response body", async () => {
    const res = await POST(buildRequest(PUBLISHED_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.event).toBe("blog_post.published");
    expect(body.slug).toBeTruthy();
  });

  it("sends subscriber notification only for blog_post.published (not updated)", async () => {
    await POST(buildRequest(UPDATED_PAYLOAD));
    // Subscriber query should not be called for updates
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("triggers subscriber notification for blog_post.published", async () => {
    (prisma.userPreference.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "pref-1", user: { email: "user@example.com" } },
    ]);

    await POST(buildRequest(PUBLISHED_PAYLOAD));

    // Brevo send is void/async — wait a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(sendBrevoEmail).toHaveBeenCalled();
  });

  it("returns 500 when upsert throws", async () => {
    (prisma.blogPost.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB fail"));

    const res = await POST(buildRequest(PUBLISHED_PAYLOAD));
    expect(res.status).toBe(500);
  });
});

// ─── handleArchived ───────────────────────────────────────────────────────────

describe("handleArchived", () => {
  it("updates by sourceContentId first", async () => {
    (prisma.blogPost.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ count: 1 });

    await POST(buildRequest(ARCHIVED_PAYLOAD));

    const firstCall = (prisma.blogPost.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(firstCall.where.sourceContentId).toBe("content-abc-123");
    expect(firstCall.data.status).toBe("archived");
  });

  it("falls back to slug update when sourceContentId matches zero rows", async () => {
    (prisma.blogPost.updateMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ count: 0 })   // first call by sourceContentId: no match
      .mockResolvedValueOnce({ count: 1 });   // second call by slug: matches

    await POST(buildRequest(ARCHIVED_PAYLOAD));

    const calls = (prisma.blogPost.updateMany as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][0].where.slug).toBe("test-article-title");
  });

  it("does NOT make second slug-based call when sourceContentId already matched", async () => {
    (prisma.blogPost.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ count: 1 });

    await POST(buildRequest(ARCHIVED_PAYLOAD));

    expect(prisma.blogPost.updateMany).toHaveBeenCalledTimes(1);
  });

  it("does not notify subscribers on archive", async () => {
    await POST(buildRequest(ARCHIVED_PAYLOAD));

    await new Promise((r) => setTimeout(r, 10));
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("returns 200 with event=blog_post.archived", async () => {
    const res = await POST(buildRequest(ARCHIVED_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.event).toBe("blog_post.archived");
  });
});
