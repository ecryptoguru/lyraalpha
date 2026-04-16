/**
 * @vitest-environment node
 * Tests for the blog posts data layer — getAllPosts, getPostBySlugAsync,
 * getRecentPostsAsync, getFeaturedPostsAsync, getPostsByCategory,
 * getAllCategories, getAllSlugs, getAllTags, formatDate.
 *
 * Strategy: mock @/lib/prisma per-test to exercise DB-first paths and
 * static fallback paths independently.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Prisma mock ──────────────────────────────────────────────────────────────
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
  });
  return {
    prisma: new Proxy({} as Record<string, ReturnType<typeof makeModel>>, {
      get(target, prop: string) {
        if (!(prop in target)) target[prop] = makeModel();
        return target[prop];
      },
    }),
  };
});

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { prisma } from "@/lib/prisma";
import {
  getAllPosts,
  getPostBySlugAsync,
  getRecentPostsAsync,
  getFeaturedPostsAsync,
  getPostsByCategory,
  getAllCategories,
  getAllSlugs,
  getAllTags,
  formatDate,
} from "../posts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDbRow(overrides: Partial<{
  slug: string; title: string; description: string; publishedAt: Date;
  tags: string[]; author: string; category: string; featured: boolean;
  heroImageUrl: string | null; metaDescription: string | null;
  keywords: string[]; sourceAgent: string | null; content: string;
}> = {}) {
  return {
    slug: "test-slug",
    title: "Test Post",
    description: "A test description",
    publishedAt: new Date("2026-03-15T00:00:00Z"),
    tags: ["AI", "Finance"],
    author: "LyraAlpha Research",
    category: "AI & Technology",
    featured: false,
    heroImageUrl: null,
    metaDescription: null,
    keywords: ["ai", "finance"],
    sourceAgent: null,
    content: "This is the full article content with enough words to read.",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getAllPosts ──────────────────────────────────────────────────────────────

describe("getAllPosts", () => {
  it("returns DB posts merged with static fallbacks, sorted newest-first", async () => {
    const dbRow = makeDbRow({
      slug: "db-post-2026",
      title: "DB Post",
      // Must be newer than every static post for the newest-first assertion to hold
      publishedAt: new Date("2027-01-15T00:00:00Z"),
    });
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([dbRow]);

    const posts = await getAllPosts();
    expect(posts.length).toBeGreaterThan(0);
    // DB post should sort newest-first
    expect(posts[0].slug).toBe("db-post-2026");
    // date is formatted as ISO date string
    expect(posts[0].date).toBe("2027-01-15");
  });

  it("falls back to static posts when DB throws", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB down"));

    const posts = await getAllPosts();
    expect(posts.length).toBeGreaterThan(0);
    // all static posts have known slugs
    expect(posts.some((p) => p.slug === "why-crypto-ai-tools-hallucinate-and-how-to-fix-it")).toBe(true);
  });

  it("deduplicates DB posts that share slug with static posts", async () => {
    // return a DB post with same slug as a static one — static should be excluded
    const staticSlug = "why-crypto-ai-tools-hallucinate-and-how-to-fix-it";
    const dbRow = makeDbRow({ slug: staticSlug, publishedAt: new Date("2026-03-20T00:00:00Z") });
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([dbRow]);

    const posts = await getAllPosts();
    const matches = posts.filter((p) => p.slug === staticSlug);
    expect(matches).toHaveLength(1);
    // the DB version should win
    expect(matches[0].author).toBe(dbRow.author);
  });

  it("does not fetch content field in list query", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await getAllPosts();

    const call = (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.select).toBeDefined();
    expect(call.select.content).toBeUndefined();
  });

  it("readingTime is a non-empty string", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([makeDbRow()]);

    const posts = await getAllPosts();
    expect(posts[0].readingTime).toMatch(/\d+ min read/);
  });
});

// ─── getPostBySlugAsync ───────────────────────────────────────────────────────

describe("getPostBySlugAsync", () => {
  it("returns a full BlogPost with content from DB", async () => {
    const row = makeDbRow({ content: "Full article content here." });
    (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(row);

    const post = await getPostBySlugAsync("test-slug");
    expect(post).toBeDefined();
    expect(post?.content).toBe("Full article content here.");
    expect(post?.readingTime).toMatch(/\d+ min read/);
  });

  it("queries by slug AND status=published", async () => {
    (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await getPostBySlugAsync("some-slug");

    const call = (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.slug).toBe("some-slug");
    expect(call.where.status).toBe("PUBLISHED");
  });

  it("fetches content field in full query", async () => {
    (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await getPostBySlugAsync("some-slug");

    const call = (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.select.content).toBe(true);
  });

  it("falls back to static post when DB returns null", async () => {
    (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const post = await getPostBySlugAsync("why-crypto-ai-tools-hallucinate-and-how-to-fix-it");
    expect(post).toBeDefined();
    expect(post?.slug).toBe("why-crypto-ai-tools-hallucinate-and-how-to-fix-it");
  });

  it("returns undefined for completely unknown slug with DB returning null", async () => {
    (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const post = await getPostBySlugAsync("does-not-exist-anywhere");
    expect(post).toBeUndefined();
  });

  it("falls back to static post when DB throws", async () => {
    (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("timeout"));

    const post = await getPostBySlugAsync("why-crypto-ai-tools-hallucinate-and-how-to-fix-it");
    expect(post?.slug).toBe("why-crypto-ai-tools-hallucinate-and-how-to-fix-it");
  });

  it("maps heroImageUrl null to undefined on the returned object", async () => {
    (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeDbRow({ heroImageUrl: null }),
    );

    const post = await getPostBySlugAsync("test-slug");
    expect(post?.heroImageUrl).toBeUndefined();
  });

  it("preserves heroImageUrl when present", async () => {
    (prisma.blogPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeDbRow({ heroImageUrl: "https://cdn.example.com/img.png" }),
    );

    const post = await getPostBySlugAsync("test-slug");
    expect(post?.heroImageUrl).toBe("https://cdn.example.com/img.png");
  });
});

// ─── getRecentPostsAsync ──────────────────────────────────────────────────────

describe("getRecentPostsAsync", () => {
  it("returns DB rows without content field", async () => {
    const rows = [makeDbRow({ slug: "r1" }), makeDbRow({ slug: "r2" })];
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rows);

    const posts = await getRecentPostsAsync(2);
    expect(posts).toHaveLength(2);
    expect((posts[0] as unknown as Record<string, unknown>).content).toBeUndefined();
  });

  it("requests count+1 rows (to allow caller to exclude current slug)", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await getRecentPostsAsync(3);

    const call = (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.take).toBe(4); // count + 1
  });

  it("falls back to static posts when DB returns empty array", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const posts = await getRecentPostsAsync(3);
    expect(posts.length).toBeGreaterThan(0);
  });

  it("falls back to static posts when DB throws", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB error"));

    const posts = await getRecentPostsAsync(3);
    expect(posts.length).toBeGreaterThan(0);
  });
});

// ─── getFeaturedPostsAsync ────────────────────────────────────────────────────

describe("getFeaturedPostsAsync", () => {
  it("filters by featured:true AND status:published", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await getFeaturedPostsAsync();

    const call = (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.status).toBe("PUBLISHED");
    expect(call.where.featured).toBe(true);
  });

  it("returns mapped summaries from DB", async () => {
    const row = makeDbRow({ featured: true, slug: "featured-slug" });
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([row]);

    const posts = await getFeaturedPostsAsync();
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe("featured-slug");
    expect(posts[0].featured).toBe(true);
  });

  it("falls back to static featured posts when DB returns empty", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const posts = await getFeaturedPostsAsync();
    expect(posts.every((p) => p.featured)).toBe(true);
  });
});

// ─── getPostsByCategory ───────────────────────────────────────────────────────

describe("getPostsByCategory", () => {
  it("queries DB with insensitive category match", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await getPostsByCategory("AI & Technology");

    const call = (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.category).toEqual({ equals: "AI & Technology", mode: "insensitive" });
    expect(call.where.status).toBe("PUBLISHED");
  });

  it("returns DB posts when available", async () => {
    const row = makeDbRow({ category: "Markets" });
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([row]);

    const posts = await getPostsByCategory("Markets");
    expect(posts).toHaveLength(1);
    expect(posts[0].category).toBe("Markets");
  });

  it("falls back to static posts filtered by category when DB returns empty", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const posts = await getPostsByCategory("Markets");
    expect(posts.every((p) => p.category.toLowerCase() === "markets")).toBe(true);
  });
});

// ─── getAllCategories ─────────────────────────────────────────────────────────

describe("getAllCategories", () => {
  it("uses distinct query and merges with static categories", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { category: "New Category" },
    ]);

    const cats = await getAllCategories();
    expect(cats).toContain("New Category");
    // static categories also included
    expect(cats).toContain("AI & Technology");
  });

  it("uses distinct:['category'] in the query", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await getAllCategories();

    const call = (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.distinct).toEqual(["category"]);
    expect(call.select).toEqual({ category: true });
  });

  it("deduplicates categories that appear in both DB and static posts", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { category: "AI & Technology" },
    ]);

    const cats = await getAllCategories();
    const count = cats.filter((c) => c === "AI & Technology").length;
    expect(count).toBe(1);
  });

  it("falls back to static categories when DB throws", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB error"));

    const cats = await getAllCategories();
    expect(cats.length).toBeGreaterThan(0);
  });
});

// ─── getAllSlugs ──────────────────────────────────────────────────────────────

describe("getAllSlugs", () => {
  it("returns DB slugs then static slugs (no content fetched)", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { slug: "db-only-post" },
    ]);

    const slugs = await getAllSlugs();
    expect(slugs).toContain("db-only-post");
    // Static slugs not already in DB should also appear
    expect(slugs).toContain("why-crypto-ai-tools-hallucinate-and-how-to-fix-it");
  });

  it("selects only slug column", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await getAllSlugs();

    const call = (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.select).toEqual({ slug: true });
  });

  it("deduplicates slugs between DB and static posts", async () => {
    const staticSlug = "why-crypto-ai-tools-hallucinate-and-how-to-fix-it";
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { slug: staticSlug },
    ]);

    const slugs = await getAllSlugs();
    const count = slugs.filter((s) => s === staticSlug).length;
    expect(count).toBe(1);
  });
});

// ─── getAllTags ───────────────────────────────────────────────────────────────

describe("getAllTags", () => {
  it("returns a deduplicated array of all tags", async () => {
    (prisma.blogPost.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      makeDbRow({ tags: ["AI", "Custom-Tag"] }),
    ]);

    const tags = await getAllTags();
    expect(tags).toContain("AI");
    expect(tags).toContain("Custom-Tag");
    const aiCount = tags.filter((t) => t === "AI").length;
    expect(aiCount).toBe(1);
  });
});

// ─── formatDate ──────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a YYYY-MM-DD string into a readable date in UTC", () => {
    const result = formatDate("2026-03-15");
    expect(result).toContain("2026");
    expect(result).toContain("March");
    expect(result).toContain("15");
  });

  it("handles month boundaries correctly", () => {
    expect(formatDate("2026-01-01")).toContain("January");
    expect(formatDate("2026-12-31")).toContain("December");
  });
});
