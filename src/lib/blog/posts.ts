import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

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

const _staticPosts: Omit<BlogPost, "readingTime">[] = [
  {
    slug: "why-ai-finance-tools-hallucinate-and-how-to-fix-it",
    title: "Why AI Finance Tools Hallucinate — And What It Takes to Fix It",
    description:
      "Generic LLMs confidently invent metrics that were never computed. Here's exactly why that happens and what a deterministic-first architecture actually solves.",
    date: "2026-03-20",
    tags: ["AI", "Financial Intelligence", "LLMs", "Architecture"],
    author: "LyraAlpha Research",
    category: "AI & Technology",
    featured: true,
    content: `
## The Hallucination Problem Is Structural, Not a Bug

When you ask a general-purpose AI model about a crypto's PE ratio, momentum score, or volatility regime — it generates text that sounds like analysis. Sometimes it's right. Sometimes it fabricates a number with the same confidence it would use if it were correct.

This is not a GPT problem. It's not a Gemini problem. It's a category problem.

Language models are trained to predict plausible next tokens. In financial analysis, plausible-sounding and factually-grounded are two completely different things.

---

## Why Generic Finance AI Fails

**No deterministic backbone.** A model that hasn't had structured market signals computed and injected into its context will hallucinate them. "The crypto has strong momentum" is not a statement derived from data — it's a pattern-matched plausible string.

**No auditability.** When a generic tool says a protocol has a P/E of 22x and it's actually 34x, there is no trace. No computation log. No engine output to inspect. The model generated it, and it's gone.

**No regime awareness.** Asset performance means nothing in isolation. A 3% drawdown in a bull regime and the same drawdown in a fragility regime are fundamentally different signals. Generic models have no access to this context.

---

## The Fix: Compute First, Interpret Second

LyraAlpha's architecture enforces a strict two-phase pipeline:

**Phase 1 — The Deterministic Engine** computes six structured signals before any AI model is invoked: Trend, Momentum, Volatility, Liquidity, Trust (earnings quality + insider activity), and Sentiment. The Market Regime is also computed — macro-level, sector-level, and asset-level.

**Phase 2 — Lyra interprets what the engines computed.** She has access to DSE scores, regime context, ARCS data, and stress scenarios. She cannot hallucinate what the engine already measured because the measurements are already there.

This isn't AI-assisted financial analysis. It's deterministic computation with AI interpretation layered on top.

---

## What This Changes for You as an Investor

- Every Lyra response is anchored to computed signals — not predicted text
- Every metric cited is traceable to an engine output
- Regime framing is always present — so a bullish signal in a fragile macro regime is contextualized correctly
- You can interrogate the analysis: "why is the trend score 78 and not higher?" has a real answer

The goal is not to make AI more confident. It's to make AI answerable.

---

## Conclusion

Hallucination in financial AI is not a quirk. It's a direct consequence of using generative models as the primary analytical layer. The solution is to move computation out of the model and into deterministic engines — and only then allow the model to speak.

That's what we built. That's why we built it that way.
    `.trim(),
  },
  {
    slug: "market-regime-what-it-is-why-it-changes-everything",
    title: "Market Regime: What It Is and Why It Changes Everything About Your Analysis",
    description:
      "The same asset can be a strong buy and a clear avoid depending on the regime it's in. Most tools ignore regime entirely. Here's why that's a critical gap.",
    date: "2026-03-15",
    tags: ["Market Regime", "Analytics", "Portfolio", "Risk"],
    author: "LyraAlpha Research",
    category: "Market Intelligence",
    featured: true,
    content: `
## What Is a Market Regime?

A market regime is the dominant structural state of a market at a given point in time. It shapes how assets behave, how correlations change, and how every individual signal should be interpreted.

There are broadly four regime states: Risk-On (expansion), Risk-Off (contraction), Transition (regime change in progress), and Fragility (elevated stress, potential dislocation).

A Trend score of 75 means something very different depending on which regime you're in.

---

## Why Most Tools Get This Wrong

Most analytics platforms are regime-blind. They show you a momentum score, a RSI, a moving average crossover — without any reference to the structural state of the market those signals are being read in.

This leads to classic errors:

**Buying into a strength signal in a fragility regime.** The signal says strong trend. The regime says elevated systemic stress. The right read is much more cautious — but the tool shows you the signal in isolation.

**Treating cross-asset correlations as static.** In a risk-off regime, correlations between equities, commodities, and crypto shift dramatically. Tools that show historical correlation without regime context mislead you into thinking diversification is working when it isn't.

---

## How LyraAlpha Computes Regime

Our deterministic engine computes regime at three levels simultaneously:

**Macro Regime** — Fed posture, yield curve shape, credit spreads, global risk appetite signals.

**Sector Regime** — Sector rotation signals, earnings cycle positioning, relative strength within the macro context.

**Asset Regime** — Individual asset regime relative to its sector and the broader macro state.

These three levels interact. An asset can be in a local uptrend (asset regime: bullish) while the macro regime is fragile — which means the trend is fragile too. Lyra knows this. Her response to "should I add more NVDA?" in that context will reflect all three levels of regime, not just the asset signal.

---

## What This Means in Practice

When you open any asset in LyraAlpha:

1. The regime context is already computed before you ask a question
2. Lyra's analysis positions every signal within the regime frame
3. Comparative analysis ("NVDA vs TSLA") shows which asset has better regime alignment, not just raw score comparison

Regime awareness is not a feature. It's the foundation of sound analysis.

---

## Conclusion

Regime changes everything. A risk-on bullish signal is worth acting on. The same signal in a fragility regime deserves much more caution. Most tools can't tell the difference. LyraAlpha's architecture is built so that every response always reflects both.
    `.trim(),
  },
  {
    slug: "india-vs-us-investing-two-markets-one-analytical-system",
    title: "Investing Across India and the US: Two Markets, One Analytical System",
    description:
      "Most platforms force you to choose. LyraAlpha is built natively for both NSE/BSE and NYSE/NASDAQ — with separate data pipelines, regime framing, and currency context.",
    date: "2026-03-10",
    tags: ["India", "US Markets", "Multi-Market", "NSE", "NYSE"],
    author: "LyraAlpha Research",
    category: "Markets",
    featured: true,
    content: `
## Why Dual-Market Coverage Matters

India has 90M+ registered crypto investors. The US has 160M+ crypto exchange accounts. An increasing number of investors are active in both markets — yet almost no analytical tool is built for both natively.

"Natively" is the key word. There's a difference between a tool that supports both markets and one that is built for both from the ground up.

---

## What "Natively Built" Actually Means

**Separate EOD sync pipelines.** India's NSE/BSE data, corporate actions, regulatory filings, and sectoral indices have different cadences, formats, and data hygiene challenges than US NYSE/NASDAQ data. A single pipeline attempting to normalize both will introduce errors. We run separate pipelines for each.

**Separate currency pricing.** INR and USD are not just different units — they carry different macro contexts. RBI policy, INR/USD dynamics, and India's rate cycle are distinct from Fed policy and USD strength. Our pricing layer reflects this correctly in every score.

**Market-specific regime framing.** India's macro regime is driven by RBI posture, GST data, FII flows, and domestic consumption signals. The US macro regime reflects Fed posture, yield curve, credit spreads, and global risk appetite. A single regime label does not transfer cleanly between markets.

**Market-specific mutual funds.** India has one of the world's largest mutual fund ecosystems. 100% of India's mutual fund universe is covered in LyraAlpha. US mutual funds and ETFs are covered to a comparable level.

---

## Why This Matters for Your Portfolio

If you hold HDFC Bank, Infosys, and NVIDIA in the same portfolio — your analytical tool needs to understand:

- The Indian macro regime affecting HDFC Bank
- The US macro regime affecting NVIDIA
- How FII flows and USD/INR dynamics create cross-market correlation between your Indian and US positions

LyraAlpha's Portfolio Intelligence workflow reads your full portfolio as a system — across both markets simultaneously — and frames risk, regime alignment, and fragility across the complete picture.

---

## The Result

You get a portfolio view where HDFC Bank's analysis is rooted in Indian market context, NVIDIA's analysis is rooted in US market context, and the cross-market relationships between them are surfaced rather than ignored.

One system. Two markets. No compromises on analytical depth for either.
    `.trim(),
  },
];

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
    // Approximate reading time from description length as proxy; full
    // accuracy requires content — set when upgrading to full BlogPost
    readingTime: computeReadingTimeFromWordCount(
      Math.round(dbPost.description.length / 5) * 10,
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
      where: { status: "published" },
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
      where: { status: "published" },
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
      where: { status: "published", featured: true },
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
      where: { status: "published", category: { equals: category, mode: "insensitive" } },
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
      where: { status: "published" },
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
      where: { status: "published" },
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
      where: { slug, status: "published" },
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

// Legacy sync exports — used by components that haven't been converted yet.
// These only return static posts and are kept for backward compatibility.
export const blogPosts: BlogPost[] = _staticBlogPosts;

export function getPostBySlug(slug: string): BlogPost | undefined {
  return _staticBlogPosts.find((p) => p.slug === slug);
}

export function getFeaturedPosts(): BlogPostSummary[] {
  return _staticBlogSummaries.filter((p) => p.featured);
}

export function getRecentPosts(count = 3): BlogPostSummary[] {
  return _staticBlogSummaries.slice(0, count);
}
