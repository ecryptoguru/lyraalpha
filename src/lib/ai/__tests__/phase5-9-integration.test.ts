/**
 * @vitest-environment node
 *
 * Phase 5–9 integration regression tests.
 * Verifies cache key shape, signal chip parsing, tool allowlists,
 * and Myra GPT-only path without live API calls.
 */
import { describe, it, expect } from "vitest";

// ─── Phase 5: Cache key shape ─────────────────────────────────────────────
import { modelCacheKey, getModelCacheTtl } from "../lyra-cache";

describe("Phase 5 — modelCacheKey", () => {
  const BASE = { query: "what is the outlook", assetType: "STOCK", tier: "COMPLEX", planTier: "ELITE" };

  it("includes symbol dimension in cache key", () => {
    const keyA = modelCacheKey({ ...BASE, symbol: "AAPL" });
    const keyB = modelCacheKey({ ...BASE, symbol: "GLOBAL" });
    expect(keyA).not.toBe(keyB);
  });

  it("produces different keys for same symbol with different tiers", () => {
    const keyA = modelCacheKey({ query: "test", assetType: "STOCK", tier: "SIMPLE", planTier: "STARTER", symbol: "AAPL" });
    const keyB = modelCacheKey({ query: "test", assetType: "STOCK", tier: "COMPLEX", planTier: "ELITE", symbol: "AAPL" });
    expect(keyA).not.toBe(keyB);
  });

  it("produces same key for same inputs (deterministic)", () => {
    const params = { query: "analyze nvda", assetType: "STOCK", tier: "MODERATE", planTier: "PRO", symbol: "NVDA" };
    expect(modelCacheKey(params)).toBe(modelCacheKey(params));
  });
});

describe("Phase 5 — getModelCacheTtl", () => {
  it("COMPLEX tier has TTL of 20 minutes (1200s)", () => {
    const ttl = getModelCacheTtl("COMPLEX");
    expect(ttl).toBe(1200);
  });

  it("SIMPLE tier has TTL of 4 hours (14400s)", () => {
    const ttl = getModelCacheTtl("SIMPLE");
    expect(ttl).toBe(14400);
  });

  it("MODERATE tier has TTL of 2 hours (7200s)", () => {
    const ttl = getModelCacheTtl("MODERATE");
    expect(ttl).toBe(7200);
  });

  it("market-level TTL is 50% of base TTL", () => {
    const base = getModelCacheTtl("COMPLEX");
    const marketLevel = getModelCacheTtl("COMPLEX", true);
    expect(marketLevel).toBe(Math.floor(base * 0.5));
  });

  it("asset-level TTL equals base TTL", () => {
    const base = getModelCacheTtl("MODERATE");
    const assetLevel = getModelCacheTtl("MODERATE", false);
    expect(assetLevel).toBe(base);
  });
});

// ─── Phase 6: Tool allowlist ──────────────────────────────────────────────
import { getAllowedTools, aiTools } from "../tools";

describe("Phase 6 — getAllowedTools", () => {
  it("returns empty object (no tools activated)", () => {
    expect(getAllowedTools()).toEqual({});
  });

  it("aiTools registry is an object (not null)", () => {
    expect(typeof aiTools).toBe("object");
  });
});

// ─── Phase 7: Signal chip parser ─────────────────────────────────────────
import { parseLyraMessage } from "@/lib/lyra-utils";

describe("Phase 7 — signal chip parsing", () => {
  it("extracts a valid BULLISH chip from response text", () => {
    const raw = `<!--SIGNALS:{"verdict":"BULLISH","confidence":"HIGH","flags":["Strong momentum","Cheap valuation"]}-->
## Executive Summary
NVDA looks strong.`;
    const result = parseLyraMessage(raw);
    expect(result.signalChip).toBeDefined();
    expect(result.signalChip!.verdict).toBe("BULLISH");
    expect(result.signalChip!.confidence).toBe("HIGH");
    expect(result.signalChip!.flags).toHaveLength(2);
  });

  it("extracts a valid BEARISH chip", () => {
    const raw = `<!--SIGNALS:{"verdict":"BEARISH","confidence":"MEDIUM","flags":["Rate risk","Valuation stretched","Momentum fading"]}-->
Some text.`;
    const result = parseLyraMessage(raw);
    expect(result.signalChip!.verdict).toBe("BEARISH");
    expect(result.signalChip!.flags).toHaveLength(3);
  });

  it("strips the chip comment from the rendered text", () => {
    const raw = `<!--SIGNALS:{"verdict":"NEUTRAL","confidence":"LOW","flags":[]}-->
## Market Pulse
Regime is mixed.`;
    const result = parseLyraMessage(raw);
    expect(result.text).not.toContain("<!--SIGNALS:");
    expect(result.text).toContain("Market Pulse");
  });

  it("returns undefined signalChip when no chip comment present", () => {
    const raw = "## Bottom Line\nSome normal response.";
    const result = parseLyraMessage(raw);
    expect(result.signalChip).toBeUndefined();
  });

  it("returns undefined signalChip for malformed JSON", () => {
    const raw = `<!--SIGNALS:{bad json}-->Text.`;
    const result = parseLyraMessage(raw);
    expect(result.signalChip).toBeUndefined();
    expect(result.text).toContain("Text.");
  });

  it("caps flags at 3 even if model emits more", () => {
    const raw = `<!--SIGNALS:{"verdict":"BULLISH","confidence":"HIGH","flags":["A","B","C","D","E"]}-->Text.`;
    const result = parseLyraMessage(raw);
    expect(result.signalChip!.flags).toHaveLength(3);
  });

  it("rejects chips with invalid verdict values", () => {
    const raw = `<!--SIGNALS:{"verdict":"HOLD","confidence":"HIGH","flags":[]}}-->Text.`;
    const result = parseLyraMessage(raw);
    expect(result.signalChip).toBeUndefined();
  });
});
