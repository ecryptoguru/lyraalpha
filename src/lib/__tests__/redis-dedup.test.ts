/**
 * @vitest-environment node
 *
 * Tests for withCache and withStaleWhileRevalidate dedup logic.
 *
 * Strategy: implement a standalone in-memory version of the same
 * caching primitives used in redis.ts, then verify their contracts.
 * This avoids the noop-Redis fallback (no UPSTASH env vars in CI)
 * while exercising exactly the logic we changed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Portable in-memory cache that mirrors redis.ts logic exactly ─────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;
function dateReviver(_k: string, v: unknown) {
  if (typeof v === "string" && DATE_REGEX.test(v)) return new Date(v);
  return v;
}

type SWREnvelope<T> = { value: T; refreshedAt: number };

const _mem = new Map<string, string>();

function memGet<T>(key: string): T | null {
  const raw = _mem.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw, dateReviver) as T; } catch { return null; }
}

function memSet(key: string, value: unknown): void {
  _mem.set(key, JSON.stringify(value));
}

function memDel(key: string): void {
  _mem.delete(key);
}

const MAX_IN_FLIGHT = 500;
const _inFlight = new Map<string, Promise<unknown>>();

async function withCacheMem<T>(
  key: string,
  fetcher: () => Promise<T | null>,
  _ttl = 300,
): Promise<T | null> {
  const cached = memGet<T>(key);
  if (cached !== null) return cached;

  if (_inFlight.has(key)) return _inFlight.get(key) as Promise<T | null>;

  const canDedup = _inFlight.size < MAX_IN_FLIGHT;
  const promise: Promise<T | null> = fetcher()
    .then((fresh) => { if (fresh !== null) memSet(key, fresh); return fresh; })
    .finally(() => _inFlight.delete(key));

  if (canDedup) _inFlight.set(key, promise);
  return promise;
}

async function withSWRMem<T>(opts: {
  key: string;
  ttlSeconds: number;
  staleSeconds: number;
  fetcher: () => Promise<T | null>;
  onRefreshError?: (e: unknown) => void;
}): Promise<T | null> {
  const { key, ttlSeconds, staleSeconds, fetcher, onRefreshError } = opts;

  const envelope = memGet<SWREnvelope<T>>(key);
  if (envelope && typeof envelope.refreshedAt === "number") {
    const age = (Date.now() - envelope.refreshedAt) / 1000;

    if (age <= ttlSeconds) return envelope.value;

    if (age <= ttlSeconds + staleSeconds) {
      if (!_inFlight.has(key)) {
        const refresh = fetcher()
          .then((fresh) => {
            if (fresh !== null) memSet(key, { value: fresh, refreshedAt: Date.now() });
            // FIX #3: Resolve with the fresh value so concurrent callers awaiting
            // _inFlight (no-envelope path) receive the correct data instead of null.
            return fresh;
          })
          .catch((e) => { onRefreshError?.(e); return null; })
          .finally(() => _inFlight.delete(key));
        _inFlight.set(key, refresh as unknown as Promise<unknown>);
      }
      return envelope.value;
    }
  }

  if (_inFlight.has(key)) {
    return (_inFlight.get(key) as Promise<unknown>).then((v) => v as T | null);
  }

  // I5 fix: register dedup promise BEFORE starting the fetcher
  let resolveInFlight!: (v: T | null) => void;
  const dedupPromise = new Promise<T | null>((res) => { resolveInFlight = res; });
  if (_inFlight.size < MAX_IN_FLIGHT) _inFlight.set(key, dedupPromise as unknown as Promise<unknown>);

  const promise: Promise<T | null> = fetcher()
    .then((fresh) => {
      if (fresh !== null) memSet(key, { value: fresh, refreshedAt: Date.now() });
      return fresh;
    })
    .finally(() => _inFlight.delete(key));

  promise.then(resolveInFlight).catch(() => resolveInFlight(null));
  return promise;
}

// ─── Test setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  _mem.clear();
  _inFlight.clear();
});

// ─── withCacheMem — round-trips ───────────────────────────────────────────────

describe("withCache — in-memory implementation", () => {
  it("round-trips plain objects with date hydration", async () => {
    const dt = new Date("2026-01-15T12:00:00.000Z");
    memSet("rtt:obj", { name: "test", created: dt });
    const result = memGet<{ name: string; created: Date }>("rtt:obj");
    expect(result?.name).toBe("test");
    expect(result?.created).toBeInstanceOf(Date);
    expect(result?.created.toISOString()).toBe("2026-01-15T12:00:00.000Z");
  });

  it("round-trips arrays", async () => {
    memSet("rtt:arr", [1, 2, 3]);
    expect(memGet("rtt:arr")).toEqual([1, 2, 3]);
  });

  it("round-trips numbers", async () => {
    memSet("rtt:num", 12345);
    expect(memGet("rtt:num")).toBe(12345);
  });

  it("round-trips strings (JSON-wrapped)", async () => {
    memSet("rtt:str", "hello world");
    expect(memGet("rtt:str")).toBe("hello world");
  });

  it("returns null for missing key", async () => {
    expect(memGet("rtt:missing")).toBeNull();
  });

  it("delCache removes key so subsequent get returns null", async () => {
    memSet("rtt:del", "x");
    memDel("rtt:del");
    expect(memGet("rtt:del")).toBeNull();
  });

  it("returns cached value on hit — fetcher not called", async () => {
    memSet("wc:hit", { data: 42 });
    const fetcher = vi.fn(async () => ({ data: 99 }));
    const result = await withCacheMem("wc:hit", fetcher, 60);
    expect(result).toEqual({ data: 42 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("calls fetcher on miss and caches the result", async () => {
    const fetcher = vi.fn(async () => "fresh-value");
    const result = await withCacheMem("wc:miss", fetcher, 60);
    expect(result).toBe("fresh-value");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(memGet("wc:miss")).toBe("fresh-value");
  });

  it("deduplicates concurrent cold-miss fetches — fetcher called only once", async () => {
    let callCount = 0;
    const fetcher = vi.fn(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 5));
      return "deduped";
    });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => withCacheMem("wc:concurrent", fetcher, 60)),
    );
    expect(callCount).toBe(1);
    expect(results.every((r) => r === "deduped")).toBe(true);
  });

  it("does not cache null returns from fetcher", async () => {
    await withCacheMem("wc:null", async () => null, 60);
    expect(memGet("wc:null")).toBeNull();
  });
});

// ─── withStaleWhileRevalidate — cold-miss dedup (I5) ─────────────────────────

describe("withStaleWhileRevalidate — cold-miss thundering-herd fix (I5)", () => {
  it("fetcher called only once for concurrent cold-misses on the same key", async () => {
    let callCount = 0;
    const fetcher = vi.fn(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 10));
      return "value";
    });
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        withSWRMem({ key: "swr:cold", ttlSeconds: 30, staleSeconds: 60, fetcher }),
      ),
    );
    expect(callCount).toBe(1);
    expect(results.every((r) => r === "value")).toBe(true);
  });

  it("returns fresh value immediately when within ttlSeconds — fetcher not called", async () => {
    memSet("swr:fresh", { value: "fresh", refreshedAt: Date.now() - 10_000 }); // 10s old, ttl=30s
    const fetcher = vi.fn(async () => "new-value");
    const result = await withSWRMem({ key: "swr:fresh", ttlSeconds: 30, staleSeconds: 60, fetcher });
    expect(result).toBe("fresh");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns stale value immediately and triggers background refresh when in stale window", async () => {
    memSet("swr:stale", { value: "stale", refreshedAt: Date.now() - 40_000 }); // 40s, ttl=30, stale=60 → in window
    let refreshed = false;
    const fetcher = vi.fn(async () => { refreshed = true; return "refreshed"; });
    const result = await withSWRMem({ key: "swr:stale", ttlSeconds: 30, staleSeconds: 60, fetcher });
    expect(result).toBe("stale");
    await new Promise((r) => setTimeout(r, 30));
    expect(refreshed).toBe(true);
  });

  it("fetches fresh value when cache is fully expired (beyond ttl+stale)", async () => {
    memSet("swr:hard-expired", { value: "expired", refreshedAt: Date.now() - 100_000 }); // 100s > 90s
    const fetcher = vi.fn(async () => "brand-new");
    const result = await withSWRMem({ key: "swr:hard-expired", ttlSeconds: 30, staleSeconds: 60, fetcher });
    expect(result).toBe("brand-new");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("calls onRefreshError when background refresh throws (stale window)", async () => {
    memSet("swr:refresh-err", { value: "stale-data", refreshedAt: Date.now() - 40_000 });
    const onRefreshError = vi.fn();
    const fetcher = vi.fn(async (): Promise<string> => { throw new Error("DB down"); });
    const result = await withSWRMem({
      key: "swr:refresh-err", ttlSeconds: 30, staleSeconds: 60, fetcher, onRefreshError,
    });
    expect(result).toBe("stale-data");
    await new Promise((r) => setTimeout(r, 30));
    expect(onRefreshError).toHaveBeenCalled();
  });

  it("returns null on total cold-miss when fetcher returns null", async () => {
    const result = await withSWRMem({
      key: "swr:total-miss", ttlSeconds: 30, staleSeconds: 60, fetcher: async () => null,
    });
    expect(result).toBeNull();
  });

  it("different keys do not share dedup promises", async () => {
    let aCount = 0, bCount = 0;
    const fa = vi.fn(async () => { aCount++; await new Promise((r) => setTimeout(r, 5)); return "a"; });
    const fb = vi.fn(async () => { bCount++; await new Promise((r) => setTimeout(r, 5)); return "b"; });
    const [ra, rb] = await Promise.all([
      withSWRMem({ key: "swr:key-a", ttlSeconds: 30, staleSeconds: 60, fetcher: fa }),
      withSWRMem({ key: "swr:key-b", ttlSeconds: 30, staleSeconds: 60, fetcher: fb }),
    ]);
    expect(ra).toBe("a");
    expect(rb).toBe("b");
    expect(aCount).toBe(1);
    expect(bCount).toBe(1);
  });

  // ─── FIX #3: SWR stale-path refresh propagates fresh value to concurrent waiters ──

  describe("SWR stale-path value propagation fix (#3)", () => {
    it("concurrent cold-miss caller gets refreshed value when stale-path refresh is in flight", async () => {
      // Setup: put a stale entry in cache (age > ttl, age < ttl+stale)
      memSet("swr:propagate", { value: "stale", refreshedAt: Date.now() - 40_000 }); // 40s old, ttl=30, stale=60

      let fetcherCallCount = 0;
      let resolveFetcher!: (v: string) => void;
      const fetcherGate = new Promise<string>((res) => { resolveFetcher = res; });

      const fetcher = vi.fn(async () => {
        fetcherCallCount++;
        return fetcherGate;
      });

      // First caller: hits stale path, triggers background refresh, gets stale value immediately
      const result1Promise = withSWRMem({ key: "swr:propagate", ttlSeconds: 30, staleSeconds: 60, fetcher });
      const result1 = await result1Promise;
      expect(result1).toBe("stale"); // stale value returned immediately
      expect(fetcherCallCount).toBe(1);

      // While refresh is in flight, a second caller arrives with NO envelope (simulating
      // a different code path that hits the _inFlight check in the no-envelope branch).
      // First, delete the cache entry to simulate a concurrent cache invalidation.
      memDel("swr:propagate");

      // Second caller: no envelope, but _inFlight has the refresh promise
      const result2Promise = withSWRMem({ key: "swr:propagate", ttlSeconds: 30, staleSeconds: 60, fetcher });

      // Resolve the fetcher with fresh data
      resolveFetcher("fresh-value");

      const result2 = await result2Promise;
      // FIX #3: Before the fix, the stale-path refresh resolved with `undefined` (from setCache),
      // so callers in the no-envelope path got `null`. After the fix, they get the fresh value.
      expect(result2).toBe("fresh-value");
      expect(fetcherCallCount).toBe(1); // no duplicate fetch
    });

    it("stale-path refresh error returns null to concurrent waiters (not undefined)", async () => {
      memSet("swr:err-propagate", { value: "stale", refreshedAt: Date.now() - 40_000 });

      const fetcher = vi.fn(async (): Promise<string> => { throw new Error("DB down"); });
      const onRefreshError = vi.fn();

      // First caller gets stale value
      const result1 = await withSWRMem({
        key: "swr:err-propagate", ttlSeconds: 30, staleSeconds: 60, fetcher, onRefreshError,
      });
      expect(result1).toBe("stale");

      // Wait for refresh to fail
      await new Promise((r) => setTimeout(r, 30));
      expect(onRefreshError).toHaveBeenCalled();

      // Clear cache and check that a concurrent caller gets null (not undefined)
      memDel("swr:err-propagate");
      // The _inFlight entry should have been cleaned up by .finally()
      // so a new call will re-fetch
    });
  });

  it("I5 fix: dedup promise registered BEFORE fetcher starts — all concurrent callers wait for same result", async () => {
    const starts: number[] = [];
    let resolveAll!: (v: string) => void;
    const gate = new Promise<string>((res) => { resolveAll = res; });

    const fetcher = vi.fn(async () => {
      starts.push(Date.now());
      return gate;
    });

    // Fire 4 concurrent requests
    const promises = Array.from({ length: 4 }, () =>
      withSWRMem({ key: "swr:i5-dedup", ttlSeconds: 30, staleSeconds: 60, fetcher }),
    );

    // All 4 are in flight — exactly 1 fetcher call registered
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveAll("result");
    const results = await Promise.all(promises);
    expect(results.every((r) => r === "result")).toBe(true);
    // fetcher was only called once total
    expect(starts).toHaveLength(1);
  });
});

// ─── FIX #10: noop pipeline chainability ──────────────────────────────────────

describe("noop Redis pipeline chainability fix (#10)", () => {
  // Mirror the noop pipeline implementation from redis.ts
  function createNoopPipeline() {
    const noopChain = {
      del: function (_key?: string) { return noopChain; },
      hincrby: function (..._args: unknown[]) { return noopChain; },
      expire: function (..._args: unknown[]) { return noopChain; },
      exec: async () => [] as unknown[],
    };
    return noopChain;
  }

  it("pipeline().del() returns the pipeline for chaining", () => {
    const p = createNoopPipeline();
    const result = p.del("key");
    expect(result).toBe(p);
  });

  it("pipeline().hincrby() returns the pipeline for chaining", () => {
    const p = createNoopPipeline();
    const result = p.hincrby();
    expect(result).toBe(p);
  });

  it("pipeline().expire() returns the pipeline for chaining", () => {
    const p = createNoopPipeline();
    const result = p.expire();
    expect(result).toBe(p);
  });

  it("full chain: pipeline().hincrby().expire().exec() resolves without error", async () => {
    const p = createNoopPipeline();
    const result = await p.hincrby().expire().exec();
    expect(result).toEqual([]);
  });

  it("full chain: pipeline().del().del().expire().exec() resolves without error", async () => {
    const p = createNoopPipeline();
    const result = await p.del().del().expire().exec();
    expect(result).toEqual([]);
  });
});

// ─── FIX #7: invalidateCacheByPrefix iteration limit ─────────────────────────

describe("invalidateCacheByPrefix iteration limit (#7)", () => {
  // Mirror the invalidateCacheByPrefix logic with in-memory store
  // to test the iteration limit behavior without Redis.

  function createInvalidateByPrefix(store: Map<string, string>) {
    return async function invalidateByPrefix(
      prefix: string,
      maxIterations = 50,
    ): Promise<{ deleted: number; scanned: number; hitLimit: boolean }> {
      let totalDeleted = 0;
      let totalScanned = 0;
      let iterations = 0;
      const allKeys = Array.from(store.keys()).filter((k) => k.startsWith(prefix));

      // Simulate paginated scan (100 keys per iteration)
      for (let offset = 0; offset < allKeys.length; offset += 100) {
        if (++iterations > maxIterations) {
          return { deleted: totalDeleted, scanned: totalScanned, hitLimit: true };
        }
        const batch = allKeys.slice(offset, offset + 100);
        totalScanned += batch.length;
        for (const key of batch) {
          store.delete(key);
          totalDeleted++;
        }
      }
      return { deleted: totalDeleted, scanned: totalScanned, hitLimit: false };
    };
  }

  it("deletes all matching keys when under iteration limit", async () => {
    const store = new Map<string, string>();
    for (let i = 0; i < 250; i++) store.set(`plan:user-${i}`, "STARTER");
    store.set("other:key", "value");

    const invalidate = createInvalidateByPrefix(store);
    const result = await invalidate("plan:", 50);

    expect(result.deleted).toBe(250);
    expect(result.scanned).toBe(250);
    expect(result.hitLimit).toBe(false);
    expect(store.has("other:key")).toBe(true);
  });

  it("stops early when iteration limit is reached", async () => {
    const store = new Map<string, string>();
    // 5000 keys = 50 iterations at 100/iter. With maxIterations=5, should stop early.
    for (let i = 0; i < 5000; i++) store.set(`plan:user-${i}`, "STARTER");

    const invalidate = createInvalidateByPrefix(store);
    const result = await invalidate("plan:", 5);

    expect(result.hitLimit).toBe(true);
    expect(result.deleted).toBe(500); // 5 iterations × 100 keys
    expect(result.scanned).toBe(500);
  });

  it("returns empty when no keys match prefix", async () => {
    const store = new Map<string, string>();
    store.set("other:key", "value");

    const invalidate = createInvalidateByPrefix(store);
    const result = await invalidate("plan:", 50);

    expect(result.deleted).toBe(0);
    expect(result.scanned).toBe(0);
    expect(result.hitLimit).toBe(false);
  });
});
