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
  canAccessAssetType: vi.fn(),
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
import { getUserPlan, canAccessAssetType } from "@/lib/middleware/plan-gate";
import { AssetService } from "@/lib/services/asset.service";
import { consumeCredits } from "@/lib/services/credit.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(symbols: string) {
  return new NextRequest(`http://localhost/api/stocks/compare?symbols=${symbols}`);
}

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    type: "STOCK",
    price: 185.5,
    changePercent: 1.2,
    currency: "USD",
    sector: "Technology",
    industry: "Consumer Electronics",
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
    vi.mocked(canAccessAssetType).mockReturnValue(true);
  });

  // ── Auth & Plan Gating ────────────────────────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);
    const res = await GET(makeRequest("AAPL,MSFT"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 for STARTER plan", async () => {
    vi.mocked(getUserPlan).mockResolvedValue("STARTER" as any);
    const res = await GET(makeRequest("AAPL,MSFT"));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Elite plan required");
  });

  it("returns 403 for PRO plan", async () => {
    vi.mocked(getUserPlan).mockResolvedValue("PRO" as any);
    const res = await GET(makeRequest("AAPL,MSFT"));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Elite plan required");
  });

  it("allows ENTERPRISE plan", async () => {
    vi.mocked(getUserPlan).mockResolvedValue("ENTERPRISE" as any);
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "AAPL" }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "MSFT" }) as any);
    const res = await GET(makeRequest("AAPL,MSFT"));
    expect(res.status).toBe(200);
  });

  // ── Input Validation ──────────────────────────────────────────────────────

  it("returns 400 when fewer than 2 symbols provided", async () => {
    const res = await GET(makeRequest("AAPL"));
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
    const res = await GET(makeRequest("AAPL,MSFT,GOOGL,AMZN,TSLA,NVDA,META"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Compare supports a maximum of 3 assets.");
    expect(AssetService.getAssetBySymbol).not.toHaveBeenCalled();
  });

  it("normalises symbols to uppercase", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "AAPL" }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "MSFT" }) as any);
    const res = await GET(makeRequest("aapl,msft"));
    expect(res.status).toBe(200);
    expect(AssetService.getAssetBySymbol).toHaveBeenCalledWith("AAPL");
    expect(AssetService.getAssetBySymbol).toHaveBeenCalledWith("MSFT");
  });

  it("trims whitespace from symbols", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "AAPL" }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "MSFT" }) as any);
    const res = await GET(makeRequest(" AAPL , MSFT "));
    expect(res.status).toBe(200);
    expect(AssetService.getAssetBySymbol).toHaveBeenCalledWith("AAPL");
    expect(AssetService.getAssetBySymbol).toHaveBeenCalledWith("MSFT");
  });

  // ── Response Shape ────────────────────────────────────────────────────────

  it("returns correct response shape for two valid assets", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "AAPL" }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "MSFT", avgTrendScore: 82, avgMomentumScore: 71 }) as any);

    const res = await GET(makeRequest("AAPL,MSFT"));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json).toHaveProperty("symbols");
    expect(json).toHaveProperty("assets");
    expect(json.assets).toHaveLength(2);

    const aapl = json.assets.find((a: any) => a.symbol === "AAPL");
    expect(aapl).toBeDefined();
    expect(aapl.scores).toMatchObject({
      trend: 78,
      momentum: 65,
      volatility: 55,
      liquidity: 90,
      sentiment: 70,
      trust: 88,
      compatibility: 72,
    });
    expect(aapl.signalStrength).toMatchObject({ score: 74, label: "STRONG", confidence: "HIGH" });
    expect(aapl.factorAlignment).toMatchObject({ score: 68, regimeFit: "GOOD", dominantFactor: "MOMENTUM" });
    expect(aapl.performance).toMatchObject({ "1D": 1.2, "1W": 3.4, "1M": -2.1, "3M": 8.7, "1Y": 22.3 });
    expect(aapl.valuation).toMatchObject({ peRatio: 28.5, priceToBook: 45.2, roe: 1.47, marketCap: "2.9T" });
  });

  it("returns error entry for unknown symbol without crashing", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "AAPL" }) as any)
      .mockResolvedValueOnce(null as any);

    const res = await GET(makeRequest("AAPL,FAKEXYZ"));
    expect(res.status).toBe(200);
    const json = await res.json();
    const fake = json.assets.find((a: any) => a.symbol === "FAKEXYZ");
    expect(fake).toBeDefined();
    expect(fake.error).toBe("Not found");
  });

  it("does not spend credits when no accessible assets remain after plan filtering", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "BTC-USD", type: "CRYPTO" }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "ETH-USD", type: "CRYPTO" }) as any);
    vi.mocked(canAccessAssetType).mockReturnValue(false);

    const res = await GET(makeRequest("BTC-USD,ETH-USD"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.assets).toEqual([
      { symbol: "BTC-USD", error: "Plan restriction" },
      { symbol: "ETH-USD", error: "Plan restriction" },
    ]);
    expect(consumeCredits).not.toHaveBeenCalled();
  });

  it("returns 402 with remaining credits when balance is insufficient", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "AAPL" }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "MSFT" }) as any);
    vi.mocked(consumeCredits).mockResolvedValueOnce({ success: false, remaining: 1 } as any);

    const res = await GET(makeRequest("AAPL,MSFT"));
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.error).toBe("Insufficient credits");
    expect(json.remaining).toBe(1);
    expect(json.message).toContain("requires 2 credits");
  });

  it("returns plan restriction error for inaccessible asset type", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "AAPL" }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "BTC-USD", type: "CRYPTO" }) as any);
    vi.mocked(canAccessAssetType)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const res = await GET(makeRequest("AAPL,BTC-USD"));
    expect(res.status).toBe(200);
    const json = await res.json();
    const btc = json.assets.find((a: any) => a.symbol === "BTC-USD");
    expect(btc.error).toBe("Plan restriction");
  });

  // ── Null / Missing Fields ─────────────────────────────────────────────────

  it("handles null signalStrength gracefully", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "AAPL", signalStrength: null }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "MSFT" }) as any);

    const res = await GET(makeRequest("AAPL,MSFT"));
    const json = await res.json();
    const aapl = json.assets.find((a: any) => a.symbol === "AAPL");
    expect(aapl.signalStrength).toBeNull();
  });

  it("handles null factorAlignment gracefully", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "AAPL", factorAlignment: null }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "MSFT" }) as any);

    const res = await GET(makeRequest("AAPL,MSFT"));
    const json = await res.json();
    const aapl = json.assets.find((a: any) => a.symbol === "AAPL");
    expect(aapl.factorAlignment).toBeNull();
  });

  it("handles null performanceData gracefully — all perf fields null", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "AAPL", performanceData: null }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "MSFT" }) as any);

    const res = await GET(makeRequest("AAPL,MSFT"));
    const json = await res.json();
    const aapl = json.assets.find((a: any) => a.symbol === "AAPL");
    expect(aapl.performance).toEqual({ "1D": null, "1W": null, "1M": null, "3M": null, "1Y": null });
  });

  it("handles null metadata gracefully — all valuation fields null", async () => {
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(makeAsset({ symbol: "AAPL", metadata: null }) as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "MSFT" }) as any);

    const res = await GET(makeRequest("AAPL,MSFT"));
    const json = await res.json();
    const aapl = json.assets.find((a: any) => a.symbol === "AAPL");
    expect(aapl.valuation).toEqual({ peRatio: null, priceToBook: null, roe: null, marketCap: null });
  });

  // ── Score Accuracy ────────────────────────────────────────────────────────

  it("scores are passed through without mutation", async () => {
    const asset = makeAsset({
      symbol: "AAPL",
      avgTrendScore: 99,
      avgMomentumScore: 1,
      avgVolatilityScore: 50,
      avgLiquidityScore: 75,
      avgSentimentScore: 33,
      avgTrustScore: 88,
      compatibilityScore: 62,
    });
    vi.mocked(AssetService.getAssetBySymbol)
      .mockResolvedValueOnce(asset as any)
      .mockResolvedValueOnce(makeAsset({ symbol: "MSFT" }) as any);

    const res = await GET(makeRequest("AAPL,MSFT"));
    const json = await res.json();
    const aapl = json.assets.find((a: any) => a.symbol === "AAPL");
    expect(aapl.scores.trend).toBe(99);
    expect(aapl.scores.momentum).toBe(1);
    expect(aapl.scores.volatility).toBe(50);
    expect(aapl.scores.liquidity).toBe(75);
    expect(aapl.scores.sentiment).toBe(33);
    expect(aapl.scores.trust).toBe(88);
    expect(aapl.scores.compatibility).toBe(62);
  });

  // ── Error Handling ────────────────────────────────────────────────────────

  it("returns 500 when AssetService throws", async () => {
    vi.mocked(AssetService.getAssetBySymbol).mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest("AAPL,MSFT"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal error");
  });
});
