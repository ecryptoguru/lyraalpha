/**
 * Shared query utilities for common asset lookups.
 * Consolidates repeated database query patterns to reduce code duplication.
 */

import { prisma } from "@/lib/prisma";
import { withCache } from "@/lib/redis";

const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Get asset by symbol with caching.
 * @param symbol Asset symbol (case-insensitive)
 * @returns Asset or null if not found
 */
export async function getAssetBySymbol(symbol: string) {
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `asset:symbol:${upperSymbol}`;

  return withCache(
    cacheKey,
    () => prisma.asset.findUnique({
      where: { symbol: upperSymbol },
    }),
    CACHE_TTL_SECONDS,
  );
}

/**
 * Get asset by ID with caching.
 * @param id Asset ID
 * @returns Asset or null if not found
 */
export async function getAssetById(id: string) {
  const cacheKey = `asset:id:${id}`;

  return withCache(
    cacheKey,
    () => prisma.asset.findUnique({
      where: { id },
    }),
    CACHE_TTL_SECONDS,
  );
}

/**
 * Get asset by CoinGecko ID with caching.
 * @param coingeckoId CoinGecko ID
 * @returns Asset or null if not found
 */
export async function getAssetByCoingeckoId(coingeckoId: string) {
  const cacheKey = `asset:coingecko:${coingeckoId}`;

  return withCache(
    cacheKey,
    () => prisma.asset.findFirst({
      where: { coingeckoId },
    }),
    CACHE_TTL_SECONDS,
  );
}

/**
 * Invalidate cache for an asset by symbol.
 * @param symbol Asset symbol
 */
export async function invalidateAssetCache(symbol: string) {
  const upperSymbol = symbol.toUpperCase();
  const { invalidateCacheByPrefix } = await import("@/lib/redis");
  await invalidateCacheByPrefix(`asset:symbol:${upperSymbol}`);
  await invalidateCacheByPrefix(`asset:id:`);
  await invalidateCacheByPrefix(`asset:coingecko:`);
}
