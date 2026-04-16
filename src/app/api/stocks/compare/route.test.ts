/**
 * @vitest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/middleware/plan-gate", () => ({
  getUserPlan: vi.fn(),
}));

vi.mock("@/lib/services/asset.service", () => ({
  AssetService: {
    getAssetBySymbol: vi.fn(),
  },
}));

vi.mock("@/lib/services/credit.service", () => ({
  calculateMultiAssetAnalysisCredits: vi.fn((assetCount: number) => assetCount),
  consumeCredits: vi.fn().mockResolvedValue({ success: true, remaining: 100 }),
}));

import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { AssetService } from "@/lib/services/asset.service";
import { consumeCredits } from "@/lib/services/credit.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(symbols: string) {
  return new NextRequest(`http://localhost/api/stocks/compare?symbols=${symbols}`);
}

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "BTC-USD",
    name: "Bitcoin",
    type: "CRYPTO",
    price: 104000,
    changePercent: 2.35,
    currency: "USD",
    sector: null,
    industry: null,
    avgTrendScore: 78,
    avgMomentumScore: 65,
    avgVolatilityScore: 55,
    avgLiquidityScore: 90,
    avgSentimentScore: 70,
    avgTrustScore: 88,
    compatibilityScore: 72,
    signalStrength: { score: 74, label: "STRONG", confidence: "HIGH" },
    factorAlignment: { score: 68, regimeFit: "GOOD", dominantFactor: "MOMENTUM" },
    performanceData: { returns: { "1D": 1.2, "1W": 3.4, "1M": -2.1, "3M": 8.7, "1Y": 22.3 } },
    metadata: { trailingPE: 28.5, priceToBook: 45.2, returnOnEquity: 1.47, marketCap: "2.9T" },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/stocks/compare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "user_elite" } as any);
    vi.mocked(getUserPlan).mockResolvedValue("ELITE" as any);
  });

  // ── Auth & Plan Gating ────────────────────────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);
    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 for STARTER plan", async () => {
    vi.mocked(getUserPlan).mockResolvedValue("STARTER" as any);
    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Elite plan required");
  });

  it("returns 403 for PRO plan", async () => {
    vi.mocked(getUserPlan).mockResolvedValue("PRO" as any);
    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Elite plan required");
  });

  it("allows ENTERPRISE plan", async () => {
    vi.mocked(getUserPlan).mockResolvedValue("ENTERPRISE" as any);
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "BTC-USD" }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "ETH-USD" }) as any);
    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    expect(res.status).toBe(200);
  });

  // ── Input Validation ──────────────────────────────────────────────────────

  it("returns 400 when fewer than 2 symbols provided", async () => {
    const res = await GET(makeRequest("BTC-USD"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("At least 2 symbols required");
  });

  it("returns 400 when symbols param is empty", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("At least 2 symbols required");
  });

  it("returns 400 when more than 3 symbols are provided", async () => {
    const res = await GET(makeRequest("BTC-USD,ETH-USD,SOL-USD,BNB-USD,XRP-USD,ADA-USD,DOGE-USD"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Compare supports a maximum of 3 assets.");
    expect(AssetService.getAssetBySymbol).not.toHaveBeenCalled();
  });

  it("normalises symbols to uppercase", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "BTC-USD" }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "ETH-USD" }) as any);
    const res = await GET(makeRequest("btc-usd,eth-usd"));
    expect(res.status).toBe(200);
    expect(AssetService.getAssetBySymbol).toHaveBeenCalledWith("BTC-USD");
    expect(AssetService.getAssetBySymbol).toHaveBeenCalledWith("ETH-USD");
  });

  it("trims whitespace from symbols", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "BTC-USD" }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "ETH-USD" }) as any);
    const res = await GET(makeRequest(" BTC-USD , ETH-USD "));
    expect(res.status).toBe(200);
    expect(AssetService.getAssetBySymbol).toHaveBeenCalledWith("BTC-USD");
    expect(AssetService.getAssetBySymbol).toHaveBeenCalledWith("ETH-USD");
  });

  // ── Response Shape ────────────────────────────────────────────────────────

  it("returns correct response shape for two valid assets", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "BTC-USD" }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "ETH-USD", avgTrendScore: 82, avgMomentumScore: 71 }) as any);

    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json).toHaveProperty("symbols");
    expect(json).toHaveProperty("assets");
    expect(json.assets).toHaveLength(2);

    const asset = json.assets.find((a: any) => a.symbol === "BTC-USD");
    expect(asset).toBeDefined();
    expect(asset.scores).toMatchObject({
      trend: 78,
      momentum: 65,
      volatility: 55,
      liquidity: 90,
      sentiment: 70,
      trust: 88,
      compatibility: 72,
    });
    expect(asset.signalStrength).toMatchObject({ score: 74, label: "STRONG", confidence: "HIGH" });
    expect(asset.factorAlignment).toMatchObject({ score: 68, regimeFit: "GOOD", dominantFactor: "MOMENTUM" });
    expect(asset.performance).toMatchObject({ "1D": 1.2, "1W": 3.4, "1M": -2.1, "3M": 8.7, "1Y": 22.3 });
    expect(asset.valuation).toMatchObject({ peRatio: 28.5, priceToBook: 45.2, roe: 1.47, marketCap: "2.9T" });
  });

  it("returns error entry for unknown symbol without crashing", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "BTC-USD" }) as any)
      .mockResolvedValueOnce(null as any);

    const res = await GET(makeRequest("BTC-USD,FAKEXYZ"));
    expect(res.status).toBe(200);
    const json = await res.json();
    const fake = json.assets.find((a: any) => a.symbol === "FAKEXYZ");
    expect(fake).toBeDefined();
    expect(fake.error).toBe("Not found");
  });

  it("returns 402 with remaining credits when balance is insufficient", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "BTC-USD" }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "ETH-USD" }) as any);
    vi.mocked(consumeCredits).mockResolvedValueOnce({ success: false, remaining: 1 } as any);

    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.error).toBe("Insufficient credits");
    expect(json.remaining).toBe(1);
    expect(json.message).toContain("requires 2 credits");
  });

  // ── Null / Missing Fields ─────────────────────────────────────────────────

  it("handles null signalStrength gracefully", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "BTC-USD", signalStrength: null }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "ETH-USD" }) as any);

    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    const json = await res.json();
    const asset = json.assets.find((a: any) => a.symbol === "BTC-USD");
    expect(asset.signalStrength).toBeNull();
  });

  it("handles null factorAlignment gracefully", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "BTC-USD", factorAlignment: null }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "ETH-USD" }) as any);

    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    const json = await res.json();
    const asset = json.assets.find((a: any) => a.symbol === "BTC-USD");
    expect(asset.factorAlignment).toBeNull();
  });

  it("handles null performanceData gracefully — all perf fields null", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "BTC-USD", performanceData: null }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "ETH-USD" }) as any);

    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    const json = await res.json();
    const asset = json.assets.find((a: any) => a.symbol === "BTC-USD");
    expect(asset.performance).toEqual({ "1D": null, "1W": null, "1M": null, "3M": null, "1Y": null });
  });

  it("handles null metadata gracefully — all valuation fields null", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "BTC-USD", metadata: null }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "ETH-USD" }) as any);

    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    const json = await res.json();
    const asset = json.assets.find((a: any) => a.symbol === "BTC-USD");
    expect(asset.valuation).toEqual({ peRatio: null, priceToBook: null, roe: null, marketCap: null });
  });

  // ── Score Accuracy ────────────────────────────────────────────────────────

  it("scores are passed through without mutation", async () => {
    const mockAsset = makeAsset({
      symbol: "BTC-USD",
      avgTrendScore: 99,
      avgMomentumScore: 1,
      avgVolatilityScore: 50,
      avgLiquidityScore: 75,
      avgSentimentScore: 33,
      avgTrustScore: 88,
      compatibilityScore: 62,
    });
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(mockAsset as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "ETH-USD" }) as any);

    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    const json = await res.json();
    const found = json.assets.find((a: any) => a.symbol === "BTC-USD");
    expect(found.scores.trend).toBe(99);
    expect(found.scores.momentum).toBe(1);
    expect(found.scores.volatility).toBe(50);
    expect(found.scores.liquidity).toBe(75);
    expect(found.scores.sentiment).toBe(33);
    expect(found.scores.trust).toBe(88);
    expect(found.scores.compatibility).toBe(62);
  });

  // ── Error Handling ────────────────────────────────────────────────────────

  it("returns 500 when AssetService throws", async () => {
    vi.mocked(AssetService.getAssetBySymbol).mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal error");
  });
});
