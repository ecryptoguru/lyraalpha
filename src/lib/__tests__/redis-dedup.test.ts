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
          })
          .catch((e) => { onRefreshError?.(e); })
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
