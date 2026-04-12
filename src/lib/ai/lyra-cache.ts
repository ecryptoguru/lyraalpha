import { createHash } from "crypto";

export const EDU_CACHE_ENABLED = process.env.ENABLE_EDU_CACHE === "true";
export const EDU_CACHE_TTL = 24 * 60 * 60; // 24 hours
export const EDU_CACHE_PREFIX = "edu:";
export const MODEL_CACHE_PREFIX = "lyra:model:";

export const MODEL_CACHE_TTL: Record<string, number> = {
  SIMPLE:   4 * 60 * 60,  // 4h — educational, price-insensitive
  MODERATE: 2 * 60 * 60,  // 2h — mixed live + structural data
  COMPLEX:  20 * 60,      // 20min — deeply price/regime sensitive (tightened from 30min)
};

// Market-level (GLOBAL) responses are regime-sensitive and should expire faster.
// Asset-level responses can be cached slightly longer as fundamentals change less rapidly.
export const MARKET_LEVEL_CACHE_TTL_FACTOR = 0.5; // GLOBAL queries get 50% of standard TTL

export function getModelCacheTtl(tier: string, isMarketLevel = false): number {
  const base = MODEL_CACHE_TTL[tier] ?? 2 * 60 * 60;
  return isMarketLevel ? Math.floor(base * MARKET_LEVEL_CACHE_TTL_FACTOR) : base;
}

// Common stop words that don't affect meaning for educational queries.
// Stripping them before hashing raises cache hit rate for phrasing variants
// like "what is a P/E ratio" vs "what's the PE ratio" → same cache entry.
const EDU_STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "what", "whats", "how", "why", "when", "where", "who", "which", "whose",
  "do", "does", "did", "can", "could", "should", "would", "will", "may", "might",
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "up", "about",
  "into", "through", "during", "and", "or", "but", "so", "yet", "nor",
  "i", "me", "my", "you", "your", "it", "its", "this", "that", "these", "those",
  "tell", "explain", "describe", "define", "mean", "means", "please", "help",
]);

export function eduCacheKey(query: string, cacheScope?: string): string {
  const tokens = query
    .trim()
    .toLowerCase()
    .replace(/[''\u2018\u2019]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 0 && !EDU_STOP_WORDS.has(w));

  // Guard: if stop-word removal collapses the query to fewer than 2 meaningful tokens
  // fall back to raw lowercased query to prevent different queries hashing to the same key.
  const normalized = tokens.length >= 2 ? tokens.join(" ") : query.trim().toLowerCase();
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  return cacheScope ? `${EDU_CACHE_PREFIX}${cacheScope}:${hash}` : `${EDU_CACHE_PREFIX}${hash}`;
}

export function modelCacheKey(params: {
  modelFamily?: "gpt";
  tier: string;
  assetType: string;
  query: string;
  symbol?: string;  // differentiates asset-level (BTC-USD) vs market-level (GLOBAL) entries
  planTier?: string;
  responseMode?: "default" | "compare" | "stress-test" | "portfolio" | "macro-research";
}): string {
  const normalizedQuery = params.query.trim().toLowerCase().replace(/\s+/g, " ");
  const queryHash = createHash("sha256").update(normalizedQuery).digest("hex").slice(0, 32);
  const planTier = (params.planTier || "unknown").toLowerCase();
  const responseMode = (params.responseMode || "default").toLowerCase();
  // symbol dimension: distinguishes BTC-USD vs GLOBAL vs ETH-USD for same query text
  const symbolDim = params.symbol ? params.symbol.toUpperCase() : (params.assetType.toUpperCase() === "GLOBAL" ? "GLOBAL" : "asset");
  return `${MODEL_CACHE_PREFIX}gpt:${planTier}:${params.tier}:${params.assetType.toLowerCase()}:${symbolDim}:${responseMode}:${queryHash}`;
}

/**
 * L2: Guard-wrapped edu cache accessors.
 * These enforce EDU_CACHE_ENABLED internally so callers don't need to check the flag.
 */
export async function getEduCacheValue<T>(key: string): Promise<T | null> {
  if (!EDU_CACHE_ENABLED) return null;
  const { getCache } = await import("@/lib/redis");
  return getCache<T>(key);
}

export async function setEduCacheValue(key: string, value: unknown, ttl: number = EDU_CACHE_TTL): Promise<void> {
  if (!EDU_CACHE_ENABLED) return;
  const { setCache } = await import("@/lib/redis");
  await setCache(key, value, ttl);
}

export const ASSET_SYMBOLS_CACHE_KEY = "lyra:asset-symbols";
export const ASSET_SYMBOLS_CACHE_TTL = 60 * 60; // 1 hour
