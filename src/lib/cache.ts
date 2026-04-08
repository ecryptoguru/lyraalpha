import { unstable_cache } from "next/cache";

/**
 * Cache wrapper for high-latency database queries.
 * @param fn The data fetching function
 * @param keys Key parts for the cache key
 * @param tags Revalidation tags
 * @param ttl Time to live in seconds (default 60)
 */
export function cacheStrategy<T>(
  fn: () => Promise<T>,
  keys: string[],
  tags: string[],
  ttl: number = 60
): () => Promise<T> {
  return unstable_cache(fn, keys, {
    revalidate: ttl,
    tags: tags,
  });
}
