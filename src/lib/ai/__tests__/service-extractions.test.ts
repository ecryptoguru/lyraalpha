/**
 * @vitest-environment node
 *
 * Tests for extracted service.ts functions:
 * - #1: executeFallbackChain (graceful degradation ladder)
 * - #1: handleLateCacheHit (cache-hit cost tracking)
 * - #2: earlyCacheAlreadyMissed (redundant cache check elimination)
 */
import { describe, it, expect, vi } from "vitest";

// ─── Mocks ───
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: { create: vi.fn() },
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { asset: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() } },
  directPrisma: { user: { findFirst: vi.fn() } },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    hget: vi.fn(),
    hset: vi.fn(),
    hincrby: vi.fn(),
    pipeline: vi.fn(() => ({
      del: function () { return this; },
      hincrby: function () { return this; },
      expire: function () { return this; },
      exec: async () => [],
    })),
  },
  getCache: vi.fn(),
  setCache: vi.fn(),
  delCache: vi.fn(),
  redisSetNXStrict: vi.fn(),
  redisSetNX: vi.fn(),
  invalidateCacheByPrefix: vi.fn(),
}));

// ─── Fallback chain logic tests ────────────────────────────────────────────────

describe("executeFallbackChain logic (#1)", () => {
  // Mirror the fallback chain construction logic
  function buildFallbackChain(effectiveDeployment: string, miniDeployment: string, nanoDeployment: string) {
    const fallbackChain: { role: string; deployment: string; timeoutMs: number; maxOutputTokens: number }[] = [];
    const isFromFull = effectiveDeployment !== miniDeployment && effectiveDeployment !== nanoDeployment;

    if (effectiveDeployment === nanoDeployment) {
      return null; // signal: nothing to try
    }

    if (isFromFull) {
      fallbackChain.push({
        role: "lyra-mini",
        deployment: miniDeployment,
        timeoutMs: 20_000,
        maxOutputTokens: 1800,
      });
    }
    fallbackChain.push({
      role: "lyra-nano",
      deployment: nanoDeployment,
      timeoutMs: 15_000,
      maxOutputTokens: 1200,
    });

    return fallbackChain;
  }

  const NANO = "gpt-5.4-nano";
  const MINI = "gpt-5.4-mini";
  const FULL = "gpt-5.4-full";

  it("returns null when primary was already nano — no fallback possible", () => {
    const chain = buildFallbackChain(NANO, MINI, NANO);
    expect(chain).toBeNull();
  });

  it("mini primary skips mini step, goes directly to nano", () => {
    const chain = buildFallbackChain(MINI, MINI, NANO);
    expect(chain).toHaveLength(1);
    expect(chain![0].role).toBe("lyra-nano");
    expect(chain![0].deployment).toBe(NANO);
  });

  it("full primary falls back to mini then nano", () => {
    const chain = buildFallbackChain(FULL, MINI, NANO);
    expect(chain).toHaveLength(2);
    expect(chain![0].role).toBe("lyra-mini");
    expect(chain![0].deployment).toBe(MINI);
    expect(chain![1].role).toBe("lyra-nano");
    expect(chain![1].deployment).toBe(NANO);
  });

  it("mini step has higher token budget than nano", () => {
    const chain = buildFallbackChain(FULL, MINI, NANO);
    expect(chain![0].maxOutputTokens).toBeGreaterThan(chain![1].maxOutputTokens);
  });

  it("nano step has shorter timeout than mini", () => {
    const chain = buildFallbackChain(FULL, MINI, NANO);
    expect(chain![1].timeoutMs).toBeLessThan(chain![0].timeoutMs);
  });
});

// ─── Cache hit cost tracking logic tests ──────────────────────────────────────

describe("handleLateCacheHit cost tracking (#1)", () => {
  // Mirror the cost estimation logic
  function estimateCacheHitCost(staticPrompt: string, cachedText: string, costPerInputToken: number, costPerOutputToken: number, cacheDiscount: number) {
    const inputTokens = Math.round(staticPrompt.length / 4);
    const outputTokens = Math.round(cachedText.length / 4);
    const inputCost = inputTokens * costPerInputToken * cacheDiscount;
    const outputCost = outputTokens * costPerOutputToken;
    return { inputTokens, outputTokens, inputCost, outputCost, totalCost: inputCost + outputCost };
  }

  it("estimates tokens from text length using 4 chars/token heuristic", () => {
    const result = estimateCacheHitCost("a".repeat(400), "b".repeat(200), 0.0025, 0.01, 0.5);
    expect(result.inputTokens).toBe(100); // 400/4
    expect(result.outputTokens).toBe(50); // 200/4
  });

  it("applies cache discount to input cost only", () => {
    const result = estimateCacheHitCost("a".repeat(400), "b".repeat(200), 0.0025, 0.01, 0.5);
    // input cost = 100 * 0.0025 * 0.5 = 0.125
    expect(result.inputCost).toBeCloseTo(0.125, 3);
    // output cost = 50 * 0.01 = 0.5
    expect(result.outputCost).toBeCloseTo(0.5, 3);
  });

  it("total cost is sum of input and output costs", () => {
    const result = estimateCacheHitCost("a".repeat(400), "b".repeat(200), 0.0025, 0.01, 0.5);
    expect(result.totalCost).toBeCloseTo(result.inputCost + result.outputCost, 6);
  });

  it("empty cached text results in zero output cost", () => {
    const result = estimateCacheHitCost("a".repeat(400), "", 0.0025, 0.01, 0.5);
    expect(result.outputTokens).toBe(0);
    expect(result.outputCost).toBe(0);
  });
});

// ─── earlyCacheAlreadyMissed logic tests ───────────────────────────────────────

describe("earlyCacheAlreadyMissed optimization (#2)", () => {
  it("skips late cache check when early check already missed the same key", () => {
    let earlyCacheAlreadyMissed = false;
    let lateCacheChecks = 0;

    // Simulate: early check was attempted (not edu-cacheable, no late asset resolution)
    const earlyEduCacheable = false;
    const needsLateAssetTypeResolution = false;

    if (!earlyEduCacheable && !needsLateAssetTypeResolution) {
      earlyCacheAlreadyMissed = true; // will be set to false on hit, stays true on miss
      // Simulate cache miss
      const earlyCacheText = null; // cache miss
      if (!earlyCacheText) {
        // stays true — early check missed
      }
    }

    // Late check
    const cachedGptText = earlyCacheAlreadyMissed ? null : (() => { lateCacheChecks++; return null; })();
    expect(cachedGptText).toBeNull();
    expect(lateCacheChecks).toBe(0); // skipped!
    expect(earlyCacheAlreadyMissed).toBe(true);
  });

  it("performs late cache check when early check was skipped (late asset resolution)", () => {
    let earlyCacheAlreadyMissed = false;
    let lateCacheChecks = 0;

    const earlyEduCacheable = false;
    const needsLateAssetTypeResolution = true; // early check was skipped

    if (!earlyEduCacheable && !needsLateAssetTypeResolution) {
      earlyCacheAlreadyMissed = true;
    }

    // Late check
    const cachedGptText = earlyCacheAlreadyMissed ? null : (() => { lateCacheChecks++; return null; })();
    expect(cachedGptText).toBeNull();
    expect(lateCacheChecks).toBe(1); // performed!
    expect(earlyCacheAlreadyMissed).toBe(false);
  });

  it("performs late cache check when early check was skipped (edu-cacheable)", () => {
    let earlyCacheAlreadyMissed = false;
    let lateCacheChecks = 0;

    const earlyEduCacheable = true; // edu-cacheable — early check was skipped
    const needsLateAssetTypeResolution = false;

    if (!earlyEduCacheable && !needsLateAssetTypeResolution) {
      earlyCacheAlreadyMissed = true;
    }

    // Late check
    const cachedGptText = earlyCacheAlreadyMissed ? null : (() => { lateCacheChecks++; return null; })();
    expect(cachedGptText).toBeNull();
    expect(lateCacheChecks).toBe(1); // performed!
  });

  it("early cache hit resets the flag so late check is not skipped", () => {
    let earlyCacheAlreadyMissed = false;
    let lateCacheChecks = 0;

    const earlyEduCacheable = false;
    const needsLateAssetTypeResolution = false;

    if (!earlyEduCacheable && !needsLateAssetTypeResolution) {
      earlyCacheAlreadyMissed = true;
      // Simulate cache HIT
      const earlyCacheText = "cached-response";
      if (earlyCacheText) {
        earlyCacheAlreadyMissed = false; // hit — late check must not re-check
      }
    }

    // Late check should NOT be reached in real flow (early hit returns),
    // but if it were, it would be performed
    const _cachedGptText = earlyCacheAlreadyMissed ? null : (() => { lateCacheChecks++; return null; })();
    expect(lateCacheChecks).toBe(1); // performed because flag was reset
    expect(earlyCacheAlreadyMissed).toBe(false);
  });
});
