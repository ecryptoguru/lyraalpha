/**
 * Centralized cache key generation utilities.
 * Provides consistent cache key naming across the application.
 */

export class CacheKeys {
  /**
   * Generate asset-related cache keys
   * @param symbol Asset symbol (will be uppercased)
   * @param type Cache type (analytics, scores, metadata, etc.)
   * @param suffix Optional suffix for additional context
   */
  static asset(symbol: string, type: 'analytics' | 'scores' | 'metadata', suffix?: string): string {
    const normalized = symbol.toUpperCase();
    return `asset:${type}:${normalized}${suffix ? `:${suffix}` : ''}`;
  }

  /**
   * Generate discovery cache keys
   * @param sectorSlug Optional sector slug
   * @param type Discovery type (feed, explain, search)
   */
  static discovery(sectorSlug?: string, type: 'feed' | 'explain' | 'search' = 'feed'): string {
    if (sectorSlug) {
      return `discovery:${type}:${sectorSlug}`;
    }
    return `discovery:${type}`;
  }

  /**
   * Generate intelligence cache keys
   * @param type Intelligence type (feed, calendars, analogs)
   * @param params Optional parameters for the cache key
   */
  static intelligence(type: 'feed' | 'calendars' | 'analogs', params?: Record<string, string>): string {
    const base = `intelligence:${type}`;
    if (params) {
      const paramString = Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      return `${base}?${paramString}`;
    }
    return base;
  }

  /**
   * Generate macro research cache keys
   * @param region Region code (US, IN, etc.)
   */
  static macroResearch(region: string): string {
    return `macro:research:${region}`;
  }

  /**
   * Generate market regime cache keys
   * @param region Region code (US, IN, etc.)
   * @param assetId Optional asset ID for asset-specific regimes
   */
  static marketRegime(region: string, assetId?: string): string {
    if (assetId) {
      return `regime:${region}:${assetId}`;
    }
    return `regime:${region}`;
  }

  /**
   * Generate sector cache keys
   * @param sectorSlug Sector slug
   * @param type Sector data type (regime, feed, etc.)
   */
  static sector(sectorSlug: string, type: 'regime' | 'feed' = 'regime'): string {
    return `sector:${type}:${sectorSlug}`;
  }

  /**
   * Generate user cache keys
   * @param userId User ID
   * @param type User data type (plan, preferences, etc.)
   */
  static user(userId: string, type: 'plan' | 'preferences' | 'progress'): string {
    return `user:${type}:${userId}`;
  }

  /**
   * Generate rate limit cache keys
   * @param userId User ID
   * @param type Rate limit type (chat, api, etc.)
   */
  static rateLimit(userId: string, type: 'chat' | 'api'): string {
    return `ratelimit:${type}:${userId}`;
  }

  /**
   * Generate AI model cache keys
   * @param model Model name
   * @param promptHash Optional prompt hash for prompt-specific caching
   */
  static aiModel(model: string, promptHash?: string): string {
    if (promptHash) {
      return `ai:model:${model}:${promptHash}`;
    }
    return `ai:model:${model}`;
  }
}
