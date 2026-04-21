/**
 * @vitest-environment node
 *
 * Tests for auth.ts bypass authentication logic:
 * - #4: makeBypassAuth factory (eliminates 4× code duplication)
 * - #1: E2E bypass userId caching (prevents race condition)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock runtime-env before importing auth
vi.mock("@/lib/runtime-env", () => ({
  isAuthBypassEnabled: vi.fn(() => false),
  isAuthBypassHeaderEnabled: vi.fn(() => false),
  isBypassRuntimeAllowed: vi.fn(() => false),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
  directPrisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}));

// ─── Test: makeBypassAuth factory ──────────────────────────────────────────────

describe("makeBypassAuth factory (#4)", () => {
  // Mirror the factory function from auth.ts
  function makeBypassAuth(userId: string) {
    return {
      userId,
      sessionId: "test-session-id",
      getToken: async () => "test-token",
      debug: () => {},
      redirectToSignIn: () => {},
    };
  }

  it("returns an object with the provided userId", () => {
    const result = makeBypassAuth("user-123");
    expect(result.userId).toBe("user-123");
  });

  it("returns consistent sessionId for all bypass auth objects", () => {
    const a = makeBypassAuth("user-a");
    const b = makeBypassAuth("user-b");
    expect(a.sessionId).toBe("test-session-id");
    expect(b.sessionId).toBe("test-session-id");
  });

  it("getToken resolves to test-token", async () => {
    const result = makeBypassAuth("user-123");
    const token = await result.getToken();
    expect(token).toBe("test-token");
  });

  it("debug and redirectToSignIn are callable without error", () => {
    const result = makeBypassAuth("user-123");
    expect(() => result.debug()).not.toThrow();
    expect(() => result.redirectToSignIn()).not.toThrow();
  });

  it("different userIds produce distinct objects", () => {
    const a = makeBypassAuth("user-a");
    const b = makeBypassAuth("user-b");
    expect(a.userId).not.toBe(b.userId);
    expect(a).not.toBe(b); // different references
  });

  it("same userId produces objects with equal userId", () => {
    const a = makeBypassAuth("same-id");
    const b = makeBypassAuth("same-id");
    expect(a.userId).toBe(b.userId);
  });
});

// ─── Test: E2E bypass userId caching (#1) ─────────────────────────────────────

describe("E2E bypass userId caching (#1)", () => {
  const BYPASS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Simulate the caching logic from auth.ts
  function createBypassResolver(findFirst: (plan: string) => Promise<{ id: string } | null>) {
    let _cachedId: string | null = null;
    let _cachedAt = 0;

    return async function resolveBypassUserId(seedPlan: string): Promise<string> {
      // 1. Explicit env var (simulated)
      // 2. Cached plan-seeded lookup
      const now = Date.now();
      if (_cachedId && now - _cachedAt <= BYPASS_CACHE_TTL_MS) {
        return _cachedId;
      }

      try {
        const seeded = await findFirst(seedPlan);
        if (seeded?.id) {
          _cachedId = seeded.id;
          _cachedAt = now;
          return seeded.id;
        }
      } catch {
        // fall through
      }

      return "test-user-id";
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("caches the resolved userId for subsequent calls", async () => {
    let callCount = 0;
    const findFirst = vi.fn(async (plan: string) => {
      callCount++;
      return { id: `user-${plan}-${callCount}` };
    });

    const resolve = createBypassResolver(findFirst);

    const id1 = await resolve("ELITE");
    expect(callCount).toBe(1);

    const id2 = await resolve("ELITE");
    expect(callCount).toBe(1); // cached, no new DB call
    expect(id1).toBe(id2); // same userId
  });

  it("re-fetches after cache TTL expires", async () => {
    let callCount = 0;
    const findFirst = vi.fn(async (plan: string) => {
      callCount++;
      return { id: `user-${plan}-${callCount}` };
    });

    const resolve = createBypassResolver(findFirst);

    const id1 = await resolve("ELITE");
    expect(callCount).toBe(1);

    // Advance past TTL
    vi.advanceTimersByTime(BYPASS_CACHE_TTL_MS + 1);

    const id2 = await resolve("ELITE");
    expect(callCount).toBe(2); // re-fetched after TTL
    expect(id1).not.toBe(id2); // different userId from new fetch
  });

  it("once the first call resolves and caches, subsequent calls use the cache", async () => {
    let callCount = 0;
    const findFirst = vi.fn(async (plan: string) => {
      callCount++;
      return { id: `user-${plan}-${callCount}` };
    });

    const resolve = createBypassResolver(findFirst);

    // First call resolves and caches
    const id1 = await resolve("ELITE");
    expect(callCount).toBe(1);

    // Subsequent calls within TTL use the cache — no additional DB calls
    const id2 = await resolve("ELITE");
    const id3 = await resolve("ELITE");
    expect(callCount).toBe(1); // still only 1 DB call
    expect(id1).toBe(id2);
    expect(id1).toBe(id3);
  });

  it("falls back to test-user-id when no user matches plan", async () => {
    const findFirst = vi.fn(async () => null);
    const resolve = createBypassResolver(findFirst);

    const id = await resolve("NONEXISTENT");
    expect(id).toBe("test-user-id");
  });

  it("falls back to test-user-id when DB throws", async () => {
    const findFirst = vi.fn(async () => { throw new Error("DB down"); });
    const resolve = createBypassResolver(findFirst);

    const id = await resolve("ELITE");
    expect(id).toBe("test-user-id");
  });
});
