import { Redis } from "@upstash/redis";
import { createLogger } from "@/lib/logger";
import { timed } from "@/lib/telemetry";
import { logFireAndForgetError } from "@/lib/fire-and-forget";

const logger = createLogger({ service: "redis" });

type RedisLike =
  & Pick<Redis, "get" | "set" | "setex" | "del" | "scan" | "pipeline" | "hget" | "hgetall" | "hset" | "hdel" | "hincrby" | "expire" | "evalsha" | "incr">
  // `info` is exposed by the ioredis-compatible adapter but not typed on the Upstash REST client.
  // Declared optional so callers must null-check before invoking.
  & { info?: () => Promise<string> };

const globalForRedis = global as unknown as { redis: RedisLike | undefined };

// Cache env vars at module level — they're immutable per Vercel deploy.
const _REDIS_URL = process.env.UPSTASH_REDIS_REST_URL?.trim() || null;
const _REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || null;

function hasRedisEnv(): boolean {
  return Boolean(_REDIS_URL && _REDIS_TOKEN);
}

function createNoopRedis(): RedisLike {
  return {
    get: async () => null,
    set: async () => "OK",
    setex: async () => "OK",
    del: async () => 0,
    scan: async () => [0, []],
    pipeline: () => {
      const noopChain = {
        del: function () { return noopChain; },
        hincrby: function () { return noopChain; },
        expire: function () { return noopChain; },
        exec: async () => [] as unknown[],
      };
      return noopChain;
    },
    hget: async () => null,
    hgetall: async () => null,
    hset: async () => 0,
    hdel: async () => 0,
    hincrby: async () => 0,
    expire: async () => 0,
    evalsha: async () => null,
    incr: async () => 0,
  } as unknown as RedisLike;
}

function createRedisClient(): RedisLike {
  if (!hasRedisEnv()) {
    return createNoopRedis();
  }

  try {
    return new Redis({
      url: _REDIS_URL!,
      token: _REDIS_TOKEN!,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to initialize Upstash Redis client, falling back to noop cache");
    return createNoopRedis();
  }
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// ISO Date regex for reviving dates from JSON
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

function dateReviver(_key: string, value: unknown) {
  if (typeof value === "string" && DATE_REGEX.test(value)) {
    return new Date(value);
  }
  return value;
}

/**
 * Recursively walk an already-parsed object and convert ISO date strings to Date.
 * Handles the case where @upstash/redis auto-deserializes JSON, bypassing dateReviver.
 */
function reviveDates(value: unknown): unknown {
  if (typeof value === "string" && DATE_REGEX.test(value)) {
    return new Date(value);
  }
  if (Array.isArray(value)) {
    return value.map(reviveDates);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      result[key] = reviveDates(obj[key]);
    }
    return result;
  }
  return value;
}

const CACHE_LOG_ENABLED = process.env.CACHE_LOG === "true";
const CACHE_LOG_SAMPLE = Number(process.env.CACHE_LOG_SAMPLE || "0.01");

// Max concurrent in-flight keys before bypassing dedup — prevents unbounded memory
// accumulation in long-lived warm serverless instances under extreme concurrency.
const MAX_IN_FLIGHT_KEYS = 500;


function shouldLogCache(): boolean {
  return CACHE_LOG_ENABLED && Math.random() < CACHE_LOG_SAMPLE;
}

function logCache(key: string, hit: boolean) {
  if (!shouldLogCache()) return;
  const prefix = key.split(":")[0] || "cache";
  logger.debug({ key: prefix, hit }, "cache");
}

// Block 11: Weekly TTL on cache:stats so it never accumulates forever.
// 7 days × 24h × 3600s = 604800s. Reset via EXPIRE after each batch of writes.
const CACHE_STATS_KEY = "cache:stats";
const CACHE_STATS_WEEKLY_TTL = 7 * 24 * 60 * 60; // 7 days

function recordCacheMetric(hit: boolean, cacheKey?: string): void {
  const sampleRate = Number(process.env.CACHE_STATS_SAMPLE_RATE || "0");
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return;
  if (Math.random() > sampleRate) return;

  // Per-prefix tracking: derive prefix from key (e.g. "lyra", "edu", "emb", "plan")
  const prefix = cacheKey ? (cacheKey.split(":")[0] || "cache") : "cache";
  const hitField = `${prefix}:hit`;
  const missField = `${prefix}:miss`;
  const globalField = hit ? "hit" : "miss";

  const pipeline = redis.pipeline();
  pipeline.hincrby(CACHE_STATS_KEY, globalField, 1);
  pipeline.hincrby(CACHE_STATS_KEY, hit ? hitField : missField, 1);
  pipeline.expire(CACHE_STATS_KEY, CACHE_STATS_WEEKLY_TTL);
  pipeline.exec().catch((e) => logFireAndForgetError(e, "cache-stats"));
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await timed(
      "get",
      () => redis.get(key),
      { keyPrefix: key.split(":")[0] || "cache" },
    );
    if (data !== null && data !== undefined) {
      logCache(key, true);
      recordCacheMetric(true, key);
      // @upstash/redis auto-deserializes JSON on get() — if the value is already
      // a non-string (object, array, number, boolean), run date revival on it
      // since ISO date strings inside the object won't have been converted to Date.
      if (typeof data !== "string") {
        return reviveDates(data) as T;
      }
      try {
        return JSON.parse(data, dateReviver) as T;
      } catch {
        // If the string fails JSON.parse, it means Upstash already fully unwrapped
        // the string (e.g. plain text markdown), or it was a raw string insertion.
        // Return it directly instead of crashing or deleting the key.
        return data as unknown as T;
      }
    }
    logCache(key, false);
    recordCacheMetric(false, key);
    return null;
  } catch (error) {
    logger.warn({ key, err: error }, "Redis get failed");
    return null;
  }
}

export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds: number = 300,
): Promise<void> {
  try {
    // Always JSON.stringify before storing. @upstash/redis auto-serializes
    // objects/arrays but stores primitive strings as-is — meaning getCache's
    // JSON.parse would fail on plain string values (e.g. Markdown LLM responses).
    // Explicit stringify guarantees getCache can always JSON.parse the value back.
    const serialized = JSON.stringify(value);
    await timed(
      "setex",
      () => redis.setex(key, ttlSeconds, serialized),
      { keyPrefix: key.split(":")[0] || "cache", ttlSeconds },
    );
  } catch (error) {
    logger.warn({ key, err: error }, "Redis set failed");
  }
}

export async function delCache(key: string): Promise<void> {
  try {
    await timed(
      "del",
      () => redis.del(key),
      { keyPrefix: key.split(":")[0] || "cache" },
    );
  } catch (error) {
    logger.warn({ key, err: error }, "Redis del failed");
  }
}

/**
 * Atomic SET NX (set-if-not-exists) with expiry.
 * Returns true if the key was set (lock acquired), false if it already existed.
 *
 * IMPORTANT: On Redis failure, returns TRUE (fail-open). This is the safe default
 * for idempotency checks — if Redis is down, we must NOT silently drop webhook
 * events (Clerk retries on non-2xx; a 200 with duplicate=true means the event is
 * never retried). Use `redisSetNXStrict` when you want fail-closed semantics.
 */
export async function redisSetNX(key: string, ttlSeconds: number): Promise<boolean> {
  try {
    const nx = await (redis as unknown as { set(k: string, v: string, opts: { nx: boolean; ex: number }): Promise<string | null> })
      .set(key, "1", { nx: true, ex: ttlSeconds });
    return nx === "OK";
  } catch {
    // Redis unavailable — fail-open so webhook idempotency checks don't drop events.
    return true;
  }
}

/**
 * Strict variant of `redisSetNX` that returns false on Redis failure.
 *
 * Use this for in-flight request deduplication (LLM thundering-herd prevention)
 * where blocking a request on Redis outage is preferable to allowing parallel
 * LLM calls that could overwhelm the model provider.
 */
export async function redisSetNXStrict(key: string, ttlSeconds: number): Promise<boolean> {
  try {
    const nx = await (redis as unknown as { set(k: string, v: string, opts: { nx: boolean; ex: number }): Promise<string | null> })
      .set(key, "1", { nx: true, ex: ttlSeconds });
    return nx === "OK";
  } catch {
    // Redis unavailable — fail-closed to prevent thundering herd on LLM calls.
    return false;
  }
}

/**
 * Fetch Redis INFO output (only available on real Upstash/ioredis clients, not noop).
 * Returns parsed key-value map or null if INFO is not available.
 */
export async function redisInfo(): Promise<Record<string, string> | null> {
  try {
    if (typeof redis.info !== "function") {
      return null;
    }
    const info = await redis.info();
    const lines = info.split("\r\n");
    const infoMap: Record<string, string> = {};
    for (const line of lines) {
      const [key, val] = line.split(":");
      if (key && val) infoMap[key] = val;
    }
    return infoMap;
  } catch {
    return null;
  }
}

export async function invalidateCacheByPrefix(prefix: string): Promise<number> {
  try {
    let cursor = 0;
    let totalDeleted = 0;
    let totalScanned = 0;
    let iterations = 0;
    // Configurable via env — caps at ~N*100 keys to prevent serverless timeout on large keyspaces.
    // Default 50 (5000 keys) is safe for Vercel 10s function limit; increase for long-running workers.
    const MAX_ITERATIONS = Number(process.env.REDIS_SCAN_MAX_ITERATIONS) || 50;
    do {
      if (++iterations > MAX_ITERATIONS) {
        logger.warn({ prefix, totalDeleted, totalScanned, maxIterations: MAX_ITERATIONS }, "invalidateCacheByPrefix: SCAN iteration limit reached — some keys may remain stale. Increase REDIS_SCAN_MAX_ITERATIONS if this recurs.");
        break;
      }
      const [nextCursor, keys] = await timed(
        "scan",
        () => redis.scan(cursor, { match: `${prefix}*`, count: 100 }),
        { keyPrefix: prefix, cursor },
      );
      const next = typeof nextCursor === "number" ? nextCursor : Number(nextCursor);
      cursor = Number.isFinite(next) ? next : 0;
      totalScanned += keys.length;
      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        for (const key of keys) pipeline.del(key as string);
        await timed(
          "pipeline.exec",
          () => pipeline.exec(),
          { keyPrefix: prefix, keys: keys.length },
        );
        totalDeleted += keys.length;
      }
    } while (cursor !== 0);
    return totalDeleted;
  } catch (error) {
    logger.warn({ prefix, err: error }, "Redis invalidate failed");
    return 0;
  }
}

// ─── L4: Pipeline health metrics ────────────────────────────────────────────
// General-purpose metric recorder for pipeline events beyond cache stats.
// Tracks counts per event type per day with weekly expiry.
const PIPELINE_METRICS_PREFIX = "metrics:pipeline";
const PIPELINE_METRICS_TTL = 7 * 24 * 60 * 60; // 7 days

/**
 * Record a pipeline health metric (e.g. "ai_request", "sync_error", "compression_hit").
 * Fire-and-forget — never blocks the caller or throws.
 */
export function recordPipelineMetric(event: string, increment = 1): void {
  const sampleRate = Number(process.env.PIPELINE_METRICS_SAMPLE_RATE || "1");
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return;
  if (sampleRate < 1 && Math.random() > sampleRate) return;

  const day = new Date().toISOString().slice(0, 10);
  const key = `${PIPELINE_METRICS_PREFIX}:${day}`;
  const pipeline = redis.pipeline();
  pipeline.hincrby(key, event, increment);
  pipeline.expire(key, PIPELINE_METRICS_TTL);
  pipeline.exec().catch((e) => logFireAndForgetError(e, "pipeline-metrics"));
}

// In-flight request deduplication: if multiple concurrent requests miss the cache
// for the same key simultaneously, only one fetcher runs — the rest await the same
// promise. Prevents thundering herd on cache expiry under load.
const _inFlight = new Map<string, Promise<unknown>>();

/**
 * Higher-order function to wrap any fetcher with a cache.
 * Automatically handles serialization/deserialization and date hydration.
 * Includes in-flight deduplication to prevent thundering herd on cache miss.
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T | null>,
  ttlSeconds: number = 300,
): Promise<T | null> {
  // 1. Try Cache
  const cached = await getCache<T>(key);
  if (cached !== null) return cached;

  // 2. Deduplicate concurrent fetches for the same key
  if (_inFlight.has(key)) {
    return _inFlight.get(key) as Promise<T | null>;
  }

  // 3. Fetch fresh data, store in cache, clean up in-flight entry
  // Register inFlight BEFORE calling fetcher to close the dedup window
  // Bypass dedup if map is at capacity to prevent memory accumulation
  const canDedup = _inFlight.size < MAX_IN_FLIGHT_KEYS;
  let resolveInFlight!: (v: T | null) => void;
  const dedupPromise = new Promise<T | null>((res) => { resolveInFlight = res; });
  if (canDedup) _inFlight.set(key, dedupPromise as unknown as Promise<unknown>);

  const promise = fetcher()
    .then((fresh) => {
      if (fresh !== null) {
        setCache(key, fresh, ttlSeconds).catch((e) => logFireAndForgetError(e, "withCache-backfill"));
      }
      return fresh;
    })
    .finally(() => {
      _inFlight.delete(key);
    });

  promise.then(resolveInFlight).catch(() => resolveInFlight(null));
  return promise;
}

type StaleWhileRevalidateOptions<T> = {
  key: string;
  ttlSeconds: number;
  staleSeconds: number;
  fetcher: () => Promise<T | null>;
  onRefreshError?: (error: unknown) => void;
};

type StaleWhileRevalidateEnvelope<T> = {
  value: T;
  refreshedAt: number;
};

export async function withStaleWhileRevalidate<T>(
  options: StaleWhileRevalidateOptions<T>,
): Promise<T | null> {
  const { key, ttlSeconds, staleSeconds, fetcher, onRefreshError } = options;

  const envelope = await getCache<StaleWhileRevalidateEnvelope<T>>(key);
  if (envelope && typeof envelope.refreshedAt === "number") {
    const ageSeconds = (Date.now() - envelope.refreshedAt) / 1000;
    if (ageSeconds <= ttlSeconds) return envelope.value;

    if (ageSeconds <= ttlSeconds + staleSeconds) {
      if (!_inFlight.has(key)) {
        const refreshPromise = fetcher()
          .then((fresh) => {
            if (fresh !== null) {
              const newEnvelope: StaleWhileRevalidateEnvelope<T> = {
                value: fresh,
                refreshedAt: Date.now(),
              };
              const hardTtlSeconds = Math.max(1, ttlSeconds + staleSeconds);
              setCache(key, newEnvelope, hardTtlSeconds).catch((e) => logFireAndForgetError(e, "swr-stale-backfill"));
            }
            // Resolve with the fresh value so concurrent callers awaiting
            // _inFlight (no-envelope path) receive the correct data instead of null.
            return fresh;
          })
          .catch((e) => {
            onRefreshError?.(e);
            return null;
          })
          .finally(() => {
            _inFlight.delete(key);
          });

        _inFlight.set(key, refreshPromise as unknown as Promise<unknown>);
      }

      return envelope.value;
    }
  }

  if (_inFlight.has(key)) {
    return (_inFlight.get(key) as Promise<unknown>).then((v) => v as T | null);
  }

  // Set _inFlight BEFORE the async work so concurrent callers see it immediately
  // and are correctly deduplicated rather than spawning duplicate fetchers.
  let resolveInFlight!: (v: T | null) => void;
  const dedupPromise = new Promise<T | null>((res) => { resolveInFlight = res; });
  if (_inFlight.size < MAX_IN_FLIGHT_KEYS) _inFlight.set(key, dedupPromise as unknown as Promise<unknown>);

  const promise: Promise<T | null> = fetcher()
    .then((fresh) => {
      if (fresh !== null) {
        const newEnvelope: StaleWhileRevalidateEnvelope<T> = {
          value: fresh,
          refreshedAt: Date.now(),
        };
        const hardTtlSeconds = Math.max(1, ttlSeconds + staleSeconds);
        setCache(key, newEnvelope, hardTtlSeconds).catch((e) => logFireAndForgetError(e, "swr-backfill"));
      }
      return fresh;
    })
    .finally(() => {
      _inFlight.delete(key);
    });

  promise.then(resolveInFlight).catch(() => resolveInFlight(null));
  return promise;
}
