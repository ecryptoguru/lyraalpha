import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { _staticPosts } from "./posts.data";

const logger = createLogger({ service: "blog-posts" });

function computeReadingTime(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

function computeReadingTimeFromWordCount(wordCount: number): string {
  const minutes = Math.max(1, Math.round(wordCount / 200));
  return `${minutes} min read`;
}

export interface InternalLink {
  text: string;
  url: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readingTime: string;
  tags: string[];
  author: string;
  category: string;
  featured?: boolean;
  content: string;
  heroImageUrl?: string;
  metaDescription?: string;
  keywords?: string[];
  sourceAgent?: string;
  internalLinks?: InternalLink[];
}

export interface BlogPostSummary {
  slug: string;
  title: string;
  description: string;
  date: string;
  readingTime: string;
  tags: string[];
  author: string;
  category: string;
  featured?: boolean;
  heroImageUrl?: string;
  metaDescription?: string;
  keywords?: string[];
  sourceAgent?: string;
}


const _staticBlogPosts: BlogPost[] = _staticPosts.map((post) => ({
  ...post,
  readingTime: computeReadingTime(post.content),
}));

const _staticBlogSummaries: BlogPostSummary[] = _staticBlogPosts.map((post) => {
  const { content, ...rest } = post;
  void content;
  return rest;
});

// Select used for list/summary queries — no content field
const LIST_SELECT = {
  slug: true,
  title: true,
  description: true,
  publishedAt: true,
  tags: true,
  author: true,
  category: true,
  featured: true,
  heroImageUrl: true,
  metaDescription: true,
  keywords: true,
  sourceAgent: true,
  // word count approximated from DB via char length divided by avg word length
  // content is NOT fetched in list queries — use getPostBySlugAsync for full content
} as const;

// Select used for single post (full content) queries
const FULL_SELECT = {
  ...LIST_SELECT,
  content: true,
} as const;

function dbSummaryToSummary(dbPost: {
  slug: string;
  title: string;
  description: string;
  publishedAt: Date;
  tags: string[];
  author: string;
  category: string;
  featured: boolean;
  heroImageUrl: string | null;
  metaDescription: string | null;
  keywords: string[];
  sourceAgent: string | null;
}): BlogPostSummary {
  return {
    slug: dbPost.slug,
    title: dbPost.title,
    description: dbPost.description,
    date: dbPost.publishedAt.toISOString().split("T")[0],
    // Approximate reading time from description length as proxy for full content
    // Full blog content is typically ~15-25x the description length
    readingTime: computeReadingTimeFromWordCount(
      Math.round(dbPost.description.length / 5 * 20),
    ),
    tags: dbPost.tags,
    author: dbPost.author,
    category: dbPost.category,
    featured: dbPost.featured,
    heroImageUrl: dbPost.heroImageUrl ?? undefined,
    metaDescription: dbPost.metaDescription ?? undefined,
    keywords: dbPost.keywords,
    sourceAgent: dbPost.sourceAgent ?? undefined,
  };
}

function dbPostToBlogPost(dbPost: {
  slug: string;
  title: string;
  description: string;
  publishedAt: Date;
  tags: string[];
  author: string;
  category: string;
  featured: boolean;
  content: string;
  heroImageUrl: string | null;
  metaDescription: string | null;
  keywords: string[];
  sourceAgent: string | null;
}): BlogPost {
  return {
    slug: dbPost.slug,
    title: dbPost.title,
    description: dbPost.description,
    date: dbPost.publishedAt.toISOString().split("T")[0],
    readingTime: computeReadingTime(dbPost.content),
    tags: dbPost.tags,
    author: dbPost.author,
    category: dbPost.category,
    featured: dbPost.featured,
    content: dbPost.content,
    heroImageUrl: dbPost.heroImageUrl ?? undefined,
    metaDescription: dbPost.metaDescription ?? undefined,
    keywords: dbPost.keywords,
    sourceAgent: dbPost.sourceAgent ?? undefined,
  };
}

// ─── List queries (no content field) ──────────────────────────────────────────

async function fetchDbSummaries(): Promise<BlogPostSummary[]> {
  try {
    const rows = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: LIST_SELECT,
    });
    return rows.map(dbSummaryToSummary);
  } catch (err) {
    logger.error({ err }, "fetchDbSummaries DB error");
    return [];
  }
}

export async function getAllPosts(): Promise<BlogPostSummary[]> {
  const dbPosts = await fetchDbSummaries();
  const dbSlugs = new Set(dbPosts.map((p) => p.slug));
  const staticFallbacks = _staticBlogSummaries.filter((p) => !dbSlugs.has(p.slug));
  return [...dbPosts, ...staticFallbacks].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export async function getRecentPostsAsync(count = 3): Promise<BlogPostSummary[]> {
  try {
    const rows = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: count + 1, // +1 to allow caller to filter out current slug
      select: LIST_SELECT,
    });
    if (rows.length > 0) return rows.map(dbSummaryToSummary);
  } catch (err) {
    logger.error({ err }, "getRecentPostsAsync DB error");
  }
  return _staticBlogSummaries.slice(0, count + 1);
}

export async function getFeaturedPostsAsync(): Promise<BlogPostSummary[]> {
  try {
    const rows = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED", featured: true },
      orderBy: { publishedAt: "desc" },
      select: LIST_SELECT,
    });
    if (rows.length > 0) return rows.map(dbSummaryToSummary);
  } catch (err) {
    logger.error({ err }, "getFeaturedPostsAsync DB error");
  }
  return _staticBlogSummaries.filter((p) => p.featured);
}

export async function getPostsByCategory(category: string): Promise<BlogPostSummary[]> {
  try {
    const rows = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED", category: { equals: category, mode: "insensitive" } },
      orderBy: { publishedAt: "desc" },
      select: LIST_SELECT,
    });
    if (rows.length > 0) return rows.map(dbSummaryToSummary);
  } catch (err) {
    logger.error({ err }, "getPostsByCategory DB error");
  }
  return _staticBlogSummaries.filter(
    (p) => p.category.toLowerCase() === category.toLowerCase(),
  );
}

export async function getAllCategories(): Promise<string[]> {
  try {
    const rows = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      select: { category: true },
      distinct: ["category"],
    });
    const dbCategories = rows.map((r) => r.category);
    const staticCategories = _staticBlogSummaries.map((p) => p.category);
    return Array.from(new Set([...dbCategories, ...staticCategories]));
  } catch (err) {
    logger.error({ err }, "getAllCategories DB error");
    return Array.from(new Set(_staticBlogSummaries.map((p) => p.category)));
  }
}

export async function getAllTags(): Promise<string[]> {
  const all = await getAllPosts();
  return Array.from(new Set(all.flatMap((p) => p.tags)));
}

export async function getAllSlugs(): Promise<string[]> {
  try {
    const rows = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true },
      orderBy: { publishedAt: "desc" },
    });
    const dbSlugs = rows.map((r) => r.slug);
    const staticSlugs = _staticBlogSummaries
      .filter((p) => !dbSlugs.includes(p.slug))
      .map((p) => p.slug);
    return [...dbSlugs, ...staticSlugs];
  } catch (err) {
    logger.error({ err }, "getAllSlugs DB error");
    return _staticBlogSummaries.map((p) => p.slug);
  }
}

// ─── Full post query (includes content) ───────────────────────────────────────

export async function getPostBySlugAsync(slug: string): Promise<BlogPost | undefined> {
  try {
    const dbPost = await prisma.blogPost.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: FULL_SELECT,
    });
    if (dbPost) return dbPostToBlogPost(dbPost);
  } catch (err) {
    logger.error({ err, slug }, "getPostBySlugAsync DB error");
  }
  return _staticBlogPosts.find((p) => p.slug === slug);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Static sync accessors — return the bundled static post set.
// For async/DB-backed reads, use the `*Async` variants above.

export function getPostBySlug(slug: string): BlogPost | undefined {
  return _staticBlogPosts.find((p) => p.slug === slug);
}

export function getFeaturedPosts(): BlogPostSummary[] {
  return _staticBlogSummaries.filter((p) => p.featured);
}

export function getRecentPosts(count = 3): BlogPostSummary[] {
  return _staticBlogSummaries.slice(0, count);
}

/**
 * Returns the full bundled static post set.
 * Intended for seed scripts and tooling; app code should use the `*Async`
 * variants that read from the database.
 */
export function getAllStaticPosts(): BlogPost[] {
  return _staticBlogPosts;
}
