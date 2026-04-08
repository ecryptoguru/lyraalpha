/**
 * @vitest-environment node
 *
 * Tests for the blog-digest cron job.
 *
 * Pagination contract from the actual streamSubscriberEmails generator:
 *   - Fetches SUBSCRIBER_PAGE_SIZE (500) rows per page
 *   - Stops when rows.length === 0 OR rows.length < PAGE_SIZE
 *   - Cursor = last row id; passed as { cursor: { id }, skip: 1 } on next call
 *   - Each page's emails (already filtered for null) are batched in groups of 50
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ─── vi.hoisted — vars must be defined before vi.mock factory hoisting ────────

const {
  mockBlogPostFindMany,
  mockUserPrefFindMany,
  mockSendBrevoEmail,
} = vi.hoisted(() => ({
  mockBlogPostFindMany: vi.fn(),
  mockUserPrefFindMany: vi.fn(),
  mockSendBrevoEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    blogPost: { findMany: mockBlogPostFindMany },
    userPreference: { findMany: mockUserPrefFindMany },
  },
}));

vi.mock("@/lib/email/brevo", () => ({
  sendBrevoEmail: mockSendBrevoEmail,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/lib/middleware/cron-auth", () => ({
  withCronAuthAndLogging: vi.fn().mockImplementation(
    (_req: unknown, _opts: unknown, handler: () => Promise<Response>) => handler(),
  ),
}));

vi.mock("@/lib/utils/html", () => ({
  escHtml: (s: string) => s,
}));

import { GET } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(): NextRequest {
  return new Request("https://lyraalpha.ai/api/cron/blog-digest", {
    method: "GET",
  }) as unknown as NextRequest;
}

function makePost(slug: string) {
  return {
    slug,
    title: `Article ${slug}`,
    description: "Description.",
    category: "AI & Technology",
    publishedAt: new Date(),
  };
}

/** Create a page of subscriber rows where every user has a valid email */
function makeEmailPage(count: number, startId = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `pref-${startId + i}`,
    user: { email: `user${startId + i}@example.com` },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: sendBrevoEmail succeeds
  mockSendBrevoEmail.mockResolvedValue(true);
});

// ─── No new posts ─────────────────────────────────────────────────────────────

describe("no new posts this week", () => {
  it("returns success with sent:0 and reason:no_new_posts", async () => {
    mockBlogPostFindMany.mockResolvedValueOnce([]);

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.sent).toBe(0);
    expect(body.reason).toBe("no_new_posts");
    expect(mockSendBrevoEmail).not.toHaveBeenCalled();
  });
});

// ─── Single page of subscribers ──────────────────────────────────────────────

describe("single page of subscribers (< PAGE_SIZE → stops after first call)", () => {
  it("sends to all 10 subscribers in one batch", async () => {
    mockBlogPostFindMany.mockResolvedValueOnce([makePost("article-one")]);
    // 10 rows < 500 PAGE_SIZE → generator stops, no second call
    mockUserPrefFindMany.mockResolvedValueOnce(makeEmailPage(10));

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.totalSent).toBe(10);
    expect(mockUserPrefFindMany).toHaveBeenCalledTimes(1);
  });

  it("sends email with blog-digest tag", async () => {
    mockBlogPostFindMany.mockResolvedValueOnce([makePost("article-one")]);
    mockUserPrefFindMany.mockResolvedValueOnce(makeEmailPage(5));

    await GET(makeReq());

    const callArgs = mockSendBrevoEmail.mock.calls[0][0];
    expect(callArgs.tags).toContain("blog-digest");
  });

  it("subject contains singular 'article' for 1 post", async () => {
    mockBlogPostFindMany.mockResolvedValueOnce([makePost("article-one")]);
    mockUserPrefFindMany.mockResolvedValueOnce(makeEmailPage(3));

    await GET(makeReq());

    const callArgs = mockSendBrevoEmail.mock.calls[0][0];
    expect(callArgs.subject).toContain("1 new article");
    expect(callArgs.subject).not.toContain("articles");
  });

  it("subject contains plural 'articles' for 2 posts", async () => {
    mockBlogPostFindMany.mockResolvedValueOnce([makePost("article-a"), makePost("article-b")]);
    mockUserPrefFindMany.mockResolvedValueOnce(makeEmailPage(2));

    await GET(makeReq());

    const callArgs = mockSendBrevoEmail.mock.calls[0][0];
    expect(callArgs.subject).toContain("2 new articles");
  });
});

// ─── Subscriber pagination ────────────────────────────────────────────────────

describe("subscriber pagination", () => {
  it("pages through full+full+partial pages and sums all recipients", async () => {
    // PAGE_SIZE=500: 500+500 are full pages → loop continues; 300 < 500 → stops
    mockBlogPostFindMany.mockResolvedValueOnce([makePost("pagination-article")]);
    mockUserPrefFindMany
      .mockResolvedValueOnce(makeEmailPage(500, 0))    // full page → continue
      .mockResolvedValueOnce(makeEmailPage(500, 500))  // full page → continue
      .mockResolvedValueOnce(makeEmailPage(300, 1000)); // partial → stop

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.totalSent).toBe(1300);
    expect(mockUserPrefFindMany).toHaveBeenCalledTimes(3);
  });

  it("stops immediately after an empty first page", async () => {
    mockBlogPostFindMany.mockResolvedValueOnce([makePost("empty-subs-article")]);
    mockUserPrefFindMany.mockResolvedValueOnce([]);

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.totalSent).toBe(0);
    expect(mockUserPrefFindMany).toHaveBeenCalledTimes(1);
  });

  it("passes cursor from last row of first page to second query", async () => {
    const page1 = makeEmailPage(500, 0);  // full page → sets cursor
    const page2 = makeEmailPage(100, 500); // partial → stops

    mockBlogPostFindMany.mockResolvedValueOnce([makePost("cursor-article")]);
    mockUserPrefFindMany
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    await GET(makeReq());

    const calls = mockUserPrefFindMany.mock.calls;
    // First call: no cursor
    expect(calls[0][0].cursor).toBeUndefined();
    // Second call: cursor is last id from page1 with skip:1
    expect(calls[1][0].cursor).toEqual({ id: page1[499].id });
    expect(calls[1][0].skip).toBe(1);
  });

  it("stops after partial page without making an extra empty-check call", async () => {
    // 300 rows < PAGE_SIZE(500) → break immediately — only 1 subscriber query
    mockBlogPostFindMany.mockResolvedValueOnce([makePost("short-page")]);
    mockUserPrefFindMany.mockResolvedValueOnce(makeEmailPage(300, 0));

    await GET(makeReq());

    expect(mockUserPrefFindMany).toHaveBeenCalledTimes(1);
  });

  it("batches exactly 50 per sendBrevoEmail call (120 subs → 3 calls)", async () => {
    // 120 subscribers on one partial page → 50 + 50 + 20 = 3 batches
    mockBlogPostFindMany.mockResolvedValueOnce([makePost("batch-article")]);
    mockUserPrefFindMany.mockResolvedValueOnce(makeEmailPage(120, 0));

    await GET(makeReq());

    expect(mockSendBrevoEmail).toHaveBeenCalledTimes(3);
    // First batch has 50 recipients
    const firstBatchTo = mockSendBrevoEmail.mock.calls[0][0].to;
    expect(firstBatchTo).toHaveLength(50);
    // Last batch has 20
    const lastBatchTo = mockSendBrevoEmail.mock.calls[2][0].to;
    expect(lastBatchTo).toHaveLength(20);
  });

  it("filters rows where user or email is null — does not count them in totalSent", async () => {
    // Mix of valid and invalid rows in a partial page
    const mixedPage = [
      { id: "pref-0", user: { email: "valid@example.com" } },
      { id: "pref-1", user: null },
      { id: "pref-2", user: { email: null } },
      { id: "pref-3", user: { email: "also-valid@example.com" } },
    ];

    mockBlogPostFindMany.mockResolvedValueOnce([makePost("mixed-article")]);
    mockUserPrefFindMany.mockResolvedValueOnce(mixedPage);

    const res = await GET(makeReq());
    const body = await res.json();

    // Only 2 valid emails
    expect(body.totalSent).toBe(2);
    expect(mockSendBrevoEmail).toHaveBeenCalledTimes(1);
    const sentTo = mockSendBrevoEmail.mock.calls[0][0].to;
    expect(sentTo).toHaveLength(2);
    expect(sentTo[0].email).toBe("valid@example.com");
    expect(sentTo[1].email).toBe("also-valid@example.com");
  });
});

// ─── Response structure ───────────────────────────────────────────────────────

describe("response structure", () => {
  it("includes postCount and totalSent in success response", async () => {
    mockBlogPostFindMany.mockResolvedValueOnce([makePost("art-1"), makePost("art-2")]);
    mockUserPrefFindMany.mockResolvedValueOnce(makeEmailPage(25));

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.postCount).toBe(2);
    expect(body.totalSent).toBe(25);
  });

  it("does not count failed sends (sendBrevoEmail returns false)", async () => {
    mockBlogPostFindMany.mockResolvedValueOnce([makePost("failed-send")]);
    mockUserPrefFindMany.mockResolvedValueOnce(makeEmailPage(10));
    mockSendBrevoEmail.mockResolvedValueOnce(false); // batch fails

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.totalSent).toBe(0);
  });
});
