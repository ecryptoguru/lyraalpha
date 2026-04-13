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
    slug: "why-crypto-ai-tools-hallucinate-and-how-to-fix-it",
    title: "Why Crypto AI Tools Hallucinate On-Chain Metrics — And How to Fix It",
    description:
      "Generic LLMs confidently invent BTC hash rate trends, ETH gas metrics, and DeFi TVL figures that were never computed. Here's exactly why it happens and what a deterministic-first architecture actually solves.",
    date: "2026-03-20",
    tags: ["AI", "Crypto Intelligence", "On-Chain", "Architecture"],
    author: "LyraAlpha Research",
    category: "AI & Technology",
    featured: true,
    content: `
## The Hallucination Problem Is Structural, Not a Bug

Ask any general-purpose AI about Bitcoin's NVT ratio, Ethereum's staking yield, or Solana's validator decentralization score and it will generate a confident, detailed answer. Sometimes accurate. Often fabricated — with zero indication of which.

This is not a GPT failure. It's an architectural category error.

Language models predict plausible next tokens. In crypto analysis, plausible-sounding and on-chain-verified are two completely different things — and the gap between them can cost you real money.

---

## Why Generic Crypto AI Fails

**No on-chain data backbone.** A model that hasn't had structured blockchain metrics injected into its context before speaking will pattern-match from training data. "BTC hash rate is at an all-time high" may have been true at training time, months ago. It may not be true today.

**No auditability trail.** When a generic tool quotes a DeFi protocol's TVL at $2.4B and it's actually $890M, there is no computation log to audit. The model generated it, and it's unverifiable.

**No regime awareness.** A Trend score of 78 for ETH means something very different in a risk-on altcoin season versus a macro fragility regime where crypto correlates with high-beta equities and sells off with them. Generic models have no access to this regime context.

**Static training data.** Crypto moves 24/7. An AI model trained months ago has no knowledge of the current cycle state, whale accumulation patterns, or recent protocol exploits that changed TVL dynamics overnight.

---

## The Fix: Compute On-Chain First, Interpret Second

LyraAlpha's architecture enforces a strict two-phase pipeline specifically designed for crypto:

**Phase 1 — The Deterministic Engine** computes six structured signals before Lyra speaks: Trend, Momentum, Volatility, Liquidity, Trust (network health + on-chain activity), and Sentiment. For crypto assets, this means real hash rate data, active address counts, exchange flow metrics, and staking yield signals — all computed fresh before each analysis.

**Phase 2 — Lyra interprets what the engines computed.** She has access to DSE scores anchored to live on-chain data, crypto-specific regime context, and stress scenario replays. She cannot hallucinate Bitcoin's current NVT ratio because the NVT has already been computed and is sitting in her context.

This isn't AI-assisted crypto analysis. It's deterministic on-chain computation with AI interpretation layered on top.

---

## What This Changes for Crypto Investors

- Every Lyra response on BTC, ETH, SOL is anchored to computed on-chain signals — not predicted text
- Hash rate, active addresses, exchange netflow, and staking metrics are injected as computed facts — not retrieved from memory
- Crypto regime framing is always present — a bullish trend signal in a macro fragility regime is contextualized as fragile, not as a clean entry
- You can interrogate the analysis: "why is the Trust score for ETH 72 and not higher?" has a real, traceable answer in validator distribution and network health metrics

The goal is not to make AI more confident about crypto. It's to make AI answerable about crypto.

---

## Conclusion

Hallucination in crypto AI is not a minor inconvenience. In a market that moves 10% overnight on a single macro event, an AI citing stale or fabricated on-chain data is actively dangerous. The solution is to move computation out of the model and into deterministic engines that process live blockchain data — and only then allow the model to speak.

That's what LyraAlpha built. That's why it was built that way.
    `.trim(),
  },
  {
    slug: "crypto-market-regimes-how-to-read-the-cycle-before-it-reads-you",
    title: "Crypto Market Regimes: How to Read the Cycle Before It Reads You",
    description:
      "Bitcoin in a risk-on expansion and Bitcoin in a macro fragility regime look identical on a price chart — but they behave completely differently. Here's how regime-aware crypto analysis changes every decision.",
    date: "2026-03-15",
    tags: ["Market Regime", "Crypto Cycles", "Bitcoin", "Risk Management"],
    author: "LyraAlpha Research",
    category: "Market Intelligence",
    featured: true,
    content: `
## What Is a Crypto Market Regime?

A crypto market regime is the dominant structural state of the market at a given point in time. It determines how assets behave, how inter-crypto correlations shift, and how every on-chain signal should be weighted.

There are four regime states in crypto: **Risk-On** (expansion, altcoin season, strong BTC dominance trends), **Risk-Off** (contraction, capital rotation to stablecoins and BTC), **Transition** (regime change in progress — the most dangerous phase), and **Fragility** (elevated macro stress, high correlation with equities, potential cascade events).

A Momentum score of 72 for Solana means something very different in each of these states.

---

## Why Most Crypto Tools Are Regime-Blind

Most crypto analytics dashboards show you RSI, MACD, on-chain flow metrics, and funding rates — without any reference to the structural regime those signals exist within.

This creates classic crypto errors:

**Chasing an altcoin breakout in a fragility regime.** The signal says strong trend breakout. The regime says elevated systemic stress and tightening macro conditions. The correct read is extreme caution — but the dashboard shows you the breakout in isolation.

**Misreading BTC dominance signals.** Rising BTC dominance in a risk-on regime signals early altcoin season setup. Rising BTC dominance in a risk-off regime signals capital flight and portfolio de-risking. The same number, two completely opposite implications — and most tools show you the number without the context.

**Treating crypto correlations as stable.** In a normal risk-on regime, BTC, ETH, and large-cap alts have moderate positive correlation. In a macro fragility regime (2022 style), the entire asset class sells off as a single correlated unit. Diversification across L1s provides no protection when correlation approaches 1.

---

## How LyraAlpha Computes Crypto Regime

The deterministic engine computes regime at three levels simultaneously for every crypto asset:

**Macro Regime** — Fed posture, DXY dynamics, credit spreads, risk appetite signals, and stablecoin market cap flows (a real-time indicator of whether capital is entering or leaving the crypto ecosystem).

**Crypto Sector Regime** — Layer 1 vs Layer 2 rotation, DeFi TVL directional flow, NFT market sentiment, and BTC dominance trend.

**Asset Regime** — Individual token regime relative to its sector (L1, L2, DeFi, infrastructure) and the broader crypto macro state. A DeFi token can be in a local uptrend while the DeFi sector regime is in contraction — which means the trend is fighting the tide.

These three levels interact. Lyra's response to "should I add more SOL?" in a risk-on macro regime with L1s in expansion is different from the same question when macro is fragile and DeFi TVL is declining. The regime frames every answer.

---

## Practical Regime-Aware Crypto Analysis

When any crypto asset is opened in LyraAlpha:

1. All three regime layers are already computed before you ask a question
2. Lyra's analysis positions every on-chain signal — hash rate, active addresses, exchange netflow — within the regime frame
3. Comparative analysis ("BTC vs ETH vs SOL") shows which asset has the strongest regime alignment, not just the highest raw score
4. Stress scenario replays show how each asset behaved in historical regime transitions (2020 COVID crash, 2022 macro tightening, FTX contagion)

---

## The Regime Transition Problem

The most dangerous phase is transition — when a regime is changing but hasn't confirmed yet. This is when:

- On-chain signals go mixed (some bullish, some deteriorating)
- Funding rates flip negative while spot price holds
- Exchange outflows slow without reversing
- BTC dominance moves sideways without direction

Generic AI tools trained on price patterns will give you conflicting signals during transition. LyraAlpha's regime engine explicitly identifies transition states and flags them — so Lyra can tell you "the regime is transitioning, signal reliability is reduced, reduce position sizing accordingly" rather than generating a false conviction call.

---

## Conclusion

Crypto markets cycle through regimes faster than any other asset class. A bull market in 2021 became a fragility event by Q4 2022 within 12 months. Regime awareness isn't optional for crypto investors — it's the minimum necessary foundation for sound risk management. LyraAlpha builds it into every analysis, at every level, before Lyra speaks a single word.
    `.trim(),
  },
  {
    slug: "bitcoin-on-chain-signals-what-they-actually-measure",
    title: "Bitcoin On-Chain Signals: What They Actually Measure and Why They Matter",
    description:
      "Hash rate, NVT ratio, exchange netflow, SOPR — on-chain metrics are among the most powerful signals in crypto. Here's what each one actually measures, what it tells you, and how LyraAlpha uses them in structured analysis.",
    date: "2026-03-10",
    tags: ["Bitcoin", "On-Chain", "Hash Rate", "NVT", "SOPR", "Exchange Flows"],
    author: "LyraAlpha Research",
    category: "Markets",
    featured: true,
    content: `
## Why On-Chain Signals Are Unique to Crypto

Crypto is the only asset class where the ledger is public, real-time, and permanently auditable. Every BTC transaction, every wallet movement, every miner payout is recorded on-chain and queryable. This creates a category of analytical signal that simply doesn't exist for equities or commodities.

The problem is that raw on-chain data is overwhelming — hundreds of metrics, noisy, and easy to misinterpret without context. Here's a structured breakdown of the signals that actually matter and what they tell you.

---

## Hash Rate: The Network's Commitment Signal

**What it measures:** The total computational power currently being applied to mine Bitcoin, expressed in exahashes per second (EH/s).

**What it tells you:** Hash rate is a proxy for miner conviction. Miners are economically rational — they only mine when the revenue exceeds their electricity and hardware costs. A rising hash rate means more capital is being committed to Bitcoin security, which historically correlates with long-term price appreciation cycles.

**What to watch for:** Hash rate divergence from price. When BTC price falls but hash rate holds or rises, miners are holding through the drawdown — a bullish on-chain signal. When hash rate drops sharply alongside price, miner capitulation may be in progress, which often (not always) signals a local bottom.

**The caveat:** Hash rate is a lagging signal. It takes time for miners to deploy or shut down hardware. It confirms a trend more than it predicts one.

---

## NVT Ratio: Crypto's Version of P/E

**What it measures:** Network Value to Transactions ratio — Bitcoin's market cap divided by the daily on-chain transaction volume in USD. Think of it as a valuation multiple on network utility.

**What it tells you:** A high NVT means the network is valued richly relative to actual economic throughput. A low NVT suggests the network is undervalued relative to the economic activity it's processing.

**The signal:** NVT above ~150 has historically corresponded to overvaluation phases (2017 peak, early 2021). NVT below 25–30 has corresponded to accumulation phases with strong subsequent returns.

**The caveat:** NVT is a contextual signal, not a mechanical trigger. It works best in combination with regime context — a high NVT in a risk-on macro regime is less alarming than the same NVT in a fragility regime where capital is already de-risking.

---

## Exchange Netflow: Where the Bitcoin Is Moving

**What it measures:** The net flow of BTC into or out of centralised exchanges (Coinbase, Binance, Kraken, etc.) over a given period.

**What it tells you:** BTC flowing into exchanges suggests holders are preparing to sell (exchange wallets are staging areas for sell orders). BTC flowing out of exchanges to self-custody wallets suggests accumulation — coins being moved off exchanges are less likely to be sold short-term.

**The signal:** Sustained exchange outflows during price consolidation is one of the strongest on-chain signals for a supply squeeze. When selling pressure is falling (outflows) while demand is holding or rising, the setup for a price move is constructive.

**The caveat:** Large institutional custodians (Fidelity, BlackRock's ETF custodian) hold BTC on-chain but not at traditional exchange addresses. The ETF era has made simple exchange flow analysis less clean than it was in 2019–2021.

---

## SOPR: Profit and Loss of Coins Moved On-Chain

**What it measures:** Spent Output Profit Ratio — for every BTC moved on-chain, SOPR measures whether it was moved at a profit (SOPR > 1) or a loss (SOPR < 1) relative to when it was last moved.

**What it tells you:** SOPR above 1 means on-chain participants are, on average, selling at a profit. SOPR below 1 means they are capitulating — selling at a loss. 

**The key insight:** In bull markets, SOPR dipping below 1 briefly and bouncing back quickly is a buy signal — holders refuse to sell at a loss, reducing supply at those prices. In bear markets, SOPR bouncing up to 1 from below and failing to hold it is a sell signal — holders are using relief rallies to exit at breakeven.

**The caveat:** Long-term holder SOPR and short-term holder SOPR tell different stories. LTH-SOPR entering loss territory is more alarming than STH-SOPR doing the same, as long-term holders capitulating is a rare, high-conviction signal.

---

## Active Addresses: The Pulse of Network Adoption

**What it measures:** The number of unique Bitcoin addresses that sent or received a transaction on a given day.

**What it tells you:** Active addresses are a proxy for network adoption and user engagement. Rising active addresses during a price consolidation suggests organic demand is building. Declining active addresses alongside rising price suggests a speculative price move without fundamental support.

**The signal:** Active address count diverging from price (addresses falling while price rises) has historically preceded corrections. Active addresses rising while price is flat or falling suggests accumulation by new participants.

---

## How LyraAlpha Uses These Signals

LyraAlpha's deterministic engine doesn't surface these metrics in isolation. Every on-chain signal for Bitcoin and major crypto assets is:

1. **Computed fresh** before each analysis session — not pulled from static training data
2. **Weighted within the current regime** — a high NVT in a fragility regime triggers a different interpretation than the same NVT in a risk-on expansion
3. **Combined into the Trust score** — LyraAlpha's Trust dimension for crypto assets aggregates on-chain health signals (active addresses, netflow, miner behavior) into a single structured score that Lyra uses to frame network health

When you ask Lyra "is Bitcoin in an accumulation phase?" the answer is grounded in current hash rate trends, exchange netflow direction, SOPR behavior, and active address momentum — not predicted text from a training corpus.

---

## Conclusion

On-chain signals are the most powerful analytical edge available to crypto investors — but only when computed correctly, interpreted in context, and framed within the current market regime. Raw metrics without context produce noise. Structured computation with regime-aware interpretation produces intelligence. That's the distinction LyraAlpha is built on.
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
