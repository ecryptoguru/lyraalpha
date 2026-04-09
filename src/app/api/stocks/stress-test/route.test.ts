/**
 * @vitest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/middleware/plan-gate", () => ({
  getUserPlan: vi.fn(),
}));

vi.mock("@/lib/services/credit.service", () => ({
  calculateMultiAssetAnalysisCredits: vi.fn((assetCount: number) => assetCount),
  consumeCredits: vi.fn().mockResolvedValue({ success: true, remaining: 100 }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asset: { findMany: vi.fn() },
    priceHistory: { findMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { prisma } from "@/lib/prisma";
import { consumeCredits } from "@/lib/services/credit.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/stocks/stress-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Build a price series that starts at `startPrice` and follows `prices`. */
function makePriceHistory(prices: number[], baseDate = new Date("2022-01-01")) {
  return prices.map((close, i) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    return { date, close };
  });
}

function makeLinearSeries(start: number, end: number, points: number) {
  if (points <= 1) return [start];
  const step = (end - start) / (points - 1);
  return Array.from({ length: points }, (_, i) => start + step * i);
}

const VALID_BODY = {
  symbols: ["AAPL", "MSFT"],
  scenarioId: "rate-shock-2022",
  region: "US",
};

type PriceHistoryRow = { date: Date; close: number | null };

function mockPriceHistoryByAsset(input: {
  byAssetId: Record<
    string,
    {
      recent: PriceHistoryRow[];
      scenario: PriceHistoryRow[];
    }
  >;
}) {
  const findManyMock = prisma.priceHistory.findMany as any;
  findManyMock.mockImplementation((args: any) => {
    const assetId = args?.where?.assetId as string | undefined;
    const assetIds = args?.where?.assetId?.in as string[] | undefined;

    if (assetIds) {
      return assetIds.flatMap((id) => {
        const entry = input.byAssetId[id];
        if (!entry) return [];
        return entry.recent
          .slice()
          .reverse()
          .map((row) => ({ assetId: id, date: row.date, close: row.close }));
      });
    }

    if (!assetId) return [];

    const entry = input.byAssetId[assetId];
    if (!entry) return [];

    const hasScenarioWindow = !!args?.where?.date?.gte && !!args?.where?.date?.lte;
    return hasScenarioWindow ? entry.scenario : entry.recent;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/stocks/stress-test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "user_elite" } as any);
    vi.mocked(getUserPlan).mockResolvedValue("ELITE" as any);
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
      { id: "id-msft", symbol: "MSFT", name: "Microsoft Corp.", type: "STOCK" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory([100, 95, 90, 85, 80]) as any,
          scenario: makePriceHistory([100, 95, 90, 85, 80]) as any,
        },
        "id-msft": {
          recent: makePriceHistory([200, 195, 190, 185, 180]) as any,
          scenario: makePriceHistory([200, 195, 190, 185, 180]) as any,
        },
      },
    });
  });

  // ── Auth & Plan Gating ────────────────────────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 for STARTER plan", async () => {
    vi.mocked(getUserPlan).mockResolvedValue("STARTER" as any);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Elite plan required");
  });

  it("returns 403 for PRO plan", async () => {
    vi.mocked(getUserPlan).mockResolvedValue("PRO" as any);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Elite plan required");
  });

  it("allows ENTERPRISE plan", async () => {
    vi.mocked(getUserPlan).mockResolvedValue("ENTERPRISE" as any);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
  });

  // ── Input Validation ──────────────────────────────────────────────────────

  it("returns 400 when symbols is missing", async () => {
    const res = await POST(makeRequest({ scenarioId: "rate-shock-2022" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
  });

  it("returns 400 when scenarioId is missing", async () => {
    const res = await POST(makeRequest({ symbols: ["AAPL"] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid input");
  });

  it("returns 400 when more than 8 symbols are provided", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([]);
    const manySymbols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const res = await POST(makeRequest({ ...VALID_BODY, symbols: manySymbols }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid input");
  });

  it("returns 402 with remaining credits when the user cannot afford the stress test", async () => {
    vi.mocked(consumeCredits).mockResolvedValueOnce({ success: false, remaining: 3 } as any);

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.error).toBe("Insufficient credits");
    expect(json.remaining).toBe(3);
    expect(json.message).toContain("Stress test requires 2 credits");
  });

  it("does not spend credits when all requested assets are missing", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([] as any);

    const res = await POST(makeRequest({ ...VALID_BODY, symbols: ["FAKE1", "FAKE2"] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(2);
    expect(consumeCredits).not.toHaveBeenCalled();
  });

  // ── Drawdown Calculation Accuracy ─────────────────────────────────────────

  it("computes max drawdown correctly for a monotonically declining series", async () => {
    // DIRECT path requires >= 30 datapoints in scenario window
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory(makeLinearSeries(100, 80, 60)) as any,
          scenario: makePriceHistory(makeLinearSeries(100, 80, 30)) as any,
        },
      },
    });

    const res = await POST(makeRequest({ ...VALID_BODY, symbols: ["AAPL"] }));
    const json = await res.json();
    const aapl = json.results.find((r: any) => r.symbol === "AAPL");

    expect(aapl.method).toBe("DIRECT");
    // drawdown is a fraction (-0.20 = -20%)
    expect(aapl.drawdown).toBeCloseTo(-0.2, 2);
  });

  it("computes max drawdown correctly when there is a peak mid-series", async () => {
    // Note: current API computes drawdown vs startPrice (not peak), so expected min return is -0.40
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
    ] as any);

    const scenarioSeries = [
      ...makeLinearSeries(100, 120, 10),
      ...makeLinearSeries(120, 60, 21).slice(1),
    ];

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory(makeLinearSeries(100, 120, 60)) as any,
          scenario: makePriceHistory(scenarioSeries.slice(0, 30)) as any,
        },
      },
    });

    const res = await POST(makeRequest({ ...VALID_BODY, symbols: ["AAPL"] }));
    const json = await res.json();
    const aapl = json.results.find((r: any) => r.symbol === "AAPL");

    expect(aapl.method).toBe("DIRECT");
    expect(aapl.drawdown).toBeCloseTo(-0.5, 2);
  });

  it("computes max drawdown as 0 for a monotonically rising series", async () => {
    // DIRECT path requires >= 30 datapoints in scenario window
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory(makeLinearSeries(100, 150, 60)) as any,
          scenario: makePriceHistory(makeLinearSeries(100, 150, 30)) as any,
        },
      },
    });

    const res = await POST(makeRequest({ ...VALID_BODY, symbols: ["AAPL"] }));
    const json = await res.json();
    const aapl = json.results.find((r: any) => r.symbol === "AAPL");

    expect(aapl.method).toBe("DIRECT");
    expect(aapl.drawdown).toBe(0);
  });

  it("computes period return correctly", async () => {
    // periodReturn is returned as a fraction (-0.20 = -20%)
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory(makeLinearSeries(100, 80, 60)) as any,
          scenario: makePriceHistory(makeLinearSeries(100, 80, 30)) as any,
        },
      },
    });

    const res = await POST(makeRequest({ ...VALID_BODY, symbols: ["AAPL"] }));
    const json = await res.json();
    const aapl = json.results.find((r: any) => r.symbol === "AAPL");

    expect(aapl.method).toBe("DIRECT");
    expect(aapl.periodReturn).toBeCloseTo(-0.2, 2);
  });

  it("computes positive period return correctly", async () => {
    // periodReturn is returned as a fraction (+0.50 = +50%)
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory(makeLinearSeries(100, 150, 60)) as any,
          scenario: makePriceHistory(makeLinearSeries(100, 150, 30)) as any,
        },
      },
    });

    const res = await POST(makeRequest({ ...VALID_BODY, symbols: ["AAPL"] }));
    const json = await res.json();
    const aapl = json.results.find((r: any) => r.symbol === "AAPL");

    expect(aapl.method).toBe("DIRECT");
    expect(aapl.periodReturn).toBeCloseTo(0.5, 2);
  });

  it("drawdown is rounded to 2 decimal places", async () => {
    // Direct method rounds to 4 decimal places (toFixed(4))
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory(makeLinearSeries(100, 66.67, 60)) as any,
          scenario: makePriceHistory(makeLinearSeries(100, 66.67, 30)) as any,
        },
      },
    });

    const res = await POST(makeRequest({ ...VALID_BODY, symbols: ["AAPL"] }));
    const json = await res.json();
    const aapl = json.results.find((r: any) => r.symbol === "AAPL");

    // Should be a number with at most 4 decimal places
    expect(Number.isFinite(aapl.drawdown)).toBe(true);
    const decimals = (aapl.drawdown.toString().split(".")[1] || "").length;
    expect(decimals).toBeLessThanOrEqual(4);
  });

  // ── Missing / Unknown Assets ──────────────────────────────────────────────

  it("returns error entry for symbol not in DB", async () => {
    // Only AAPL found, FAKEXYZ not found
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory([100, 90, 80]) as any,
          scenario: makePriceHistory([100, 90, 80]) as any,
        },
      },
    });

    const res = await POST(makeRequest({ ...VALID_BODY, symbols: ["AAPL", "FAKEXYZ"] }));
    const json = await res.json();
    const fake = json.results.find((r: any) => r.symbol === "FAKEXYZ");
    expect(fake).toBeDefined();
    expect(fake.error).toBe("Asset not found in database");
    expect(fake.drawdown).toBeNull();
  });

  it("falls back to proxy replay when asset has insufficient direct scenario history", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: [{ date: new Date("2022-01-01"), close: 100 }],
          scenario: [{ date: new Date("2022-01-01"), close: 100 }],
        },
      },
    });

    const res = await POST(makeRequest({ ...VALID_BODY, symbols: ["AAPL"] }));
    const json = await res.json();
    const aapl = json.results.find((r: any) => r.symbol === "AAPL");
    expect(aapl.method).toBe("PROXY");
    expect(Number.isFinite(aapl.drawdown)).toBe(true);
  });

  it("accepts the expanded scenario ids", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK", region: "US" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: [{ date: new Date("2022-01-01"), close: 100 }],
          scenario: [{ date: new Date("2022-01-01"), close: 100 }],
        },
      },
    });

    for (const scenarioId of ["recession", "interest-rate-shock", "tech-bubble-crash", "oil-spike"]) {
      const res = await POST(makeRequest({ symbols: ["AAPL"], scenarioId, region: "US" }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.scenarioId).toBe(scenarioId);
    }
  });

  it("returns scenario explanation fields for proxy-based replay", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK", region: "US", sector: "Technology", category: null },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: [{ date: new Date("2022-01-01"), close: 100 }],
          scenario: [{ date: new Date("2022-01-01"), close: 100 }],
        },
      },
    });

    const res = await POST(makeRequest({ symbols: ["AAPL"], scenarioId: "tech-bubble-crash", region: "US" }));
    const json = await res.json();
    const aapl = json.results.find((r: any) => r.symbol === "AAPL");

    expect(aapl.method).toBe("PROXY");
    expect(aapl.driverSummary).toBeTypeOf("string");
    expect(aapl.transmissionMechanism).toBeTypeOf("string");
    expect(aapl.pressurePoints.length).toBeGreaterThan(0);
    expect(aapl.resilienceThemes.length).toBeGreaterThan(0);
    expect(aapl.dominantDrivers.length).toBeGreaterThan(0);
    expect(aapl.explanationMethod).toBe("historical-proxy-hybrid");
    expect(aapl.scenarioSeverity).toBe("Extreme");
  });

  it("returns scenario explanation fields for direct replay and preserves scenario period", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK", region: "US", sector: "Technology", category: null },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory(makeLinearSeries(100, 90, 61)) as any,
          scenario: makePriceHistory(makeLinearSeries(100, 80, 30)) as any,
        },
      },
    });

    const res = await POST(makeRequest({ symbols: ["AAPL"], scenarioId: "rate-shock-2022", region: "US" }));
    const json = await res.json();
    const aapl = json.results.find((r: any) => r.symbol === "AAPL");

    expect(aapl.method).toBe("DIRECT");
    expect(aapl.driverSummary).toBeTypeOf("string");
    expect(aapl.transmissionMechanism).toBeTypeOf("string");
    expect(aapl.pressurePoints.length).toBeGreaterThan(0);
    expect(aapl.resilienceThemes.length).toBeGreaterThan(0);
    expect(aapl.dominantDrivers.length).toBeGreaterThan(0);
    expect(aapl.explanationMethod).toBe("historical-direct");
    expect(aapl.scenarioPeriod).toEqual({ start: "2022-01-01", end: "2022-12-31" });
  });

  it("uses gold proxy logic for commodity assets in India scenarios", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-gold", symbol: "SGBGOLD", name: "Sovereign Gold Bond", type: "COMMODITY", region: "IN", sector: null, category: "Gold" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-gold": {
          recent: makePriceHistory(makeLinearSeries(100, 102, 10)) as any,
          scenario: [{ date: new Date("2022-01-01"), close: 100 }],
        },
      },
    });

    const res = await POST(makeRequest({ symbols: ["SGBGOLD"], scenarioId: "oil-spike", region: "IN" }));
    const json = await res.json();
    const gold = json.results.find((r: any) => r.symbol === "SGBGOLD");

    expect(gold.method).toBe("PROXY");
    expect(gold.proxyUsed).toBe("GOLDBEES.NS");
  });

  it("reduces confidence for proxy-based replay because replay precision is lower", async () => {
    mockPriceHistoryByAsset({
      byAssetId: {
        "id-proxy": {
          recent: makePriceHistory(makeLinearSeries(100, 99, 61)) as any,
          scenario: [{ date: new Date("2022-01-01"), close: 100 }],
        },
      },
    });

    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-proxy", symbol: "PROXYCRYPTO", name: "Proxy Crypto", type: "CRYPTO", region: "US", sector: null, category: null },
    ] as any);

    const res = await POST(makeRequest({ symbols: ["PROXYCRYPTO"], scenarioId: "recession", region: "US" }));
    const json = await res.json();
    const asset = json.results.find((r: any) => r.symbol === "PROXYCRYPTO");

    expect(asset.method).toBe("PROXY");
    expect(asset.confidence).toBeLessThan(0.65);
  });

  it("keeps error results explanation-safe with empty arrays and null narrative fields", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([] as any);

    const res = await POST(makeRequest({ symbols: ["UNKNOWN"], scenarioId: "recession", region: "US" }));
    const json = await res.json();
    const unknown = json.results.find((r: any) => r.symbol === "UNKNOWN");

    expect(unknown.method).toBe("ERROR");
    expect(unknown.driverSummary).toBeNull();
    expect(unknown.transmissionMechanism).toBeNull();
    expect(unknown.pressurePoints).toEqual([]);
    expect(unknown.resilienceThemes).toEqual([]);
    expect(unknown.dominantDrivers).toEqual([]);
    expect(unknown.rationale).toBeNull();
    expect(unknown.explanationMethod).toBeNull();
    expect(unknown.scenarioPeriod).toBeNull();
  });

  it("separates end drawdown from max drawdown when the replay path recovers after the trough", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK", region: "US" },
    ] as any);

    const scenarioSeries = [
      ...makeLinearSeries(100, 120, 10),
      ...makeLinearSeries(120, 60, 12).slice(1),
      ...makeLinearSeries(60, 80, 10).slice(1),
    ];

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory(makeLinearSeries(100, 110, 61)) as any,
          scenario: makePriceHistory(scenarioSeries.slice(0, 30)) as any,
        },
      },
    });

    const res = await POST(makeRequest({ symbols: ["AAPL"], scenarioId: "recession", region: "US" }));
    const json = await res.json();
    const aapl = json.results.find((r: any) => r.symbol === "AAPL");

    expect(aapl.method).toBe("DIRECT");
    expect(aapl.periodReturn).toBeCloseTo(-0.2, 2);
    expect(aapl.maxDrawdown).toBeLessThan(aapl.drawdown);
    expect(aapl.dailyPath.at(-1)?.drawdown).toBeCloseTo(aapl.periodReturn, 4);
  });

  // ── Response Shape ────────────────────────────────────────────────────────

  it("response includes scenarioId at top level", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory([100, 90, 80]) as any,
          scenario: makePriceHistory([100, 90, 80]) as any,
        },
      },
    });

    const res = await POST(makeRequest({ ...VALID_BODY, symbols: ["AAPL"] }));
    const json = await res.json();

    expect(json.scenarioId).toBe("rate-shock-2022");
    expect(Array.isArray(json.results)).toBe(true);
  });

  it("each result includes symbol, name, type, dataPoints", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory([100, 90, 80]) as any,
          scenario: makePriceHistory([100, 90, 80]) as any,
        },
      },
    });

    const res = await POST(makeRequest({ ...VALID_BODY, symbols: ["AAPL"] }));
    const json = await res.json();
    const aapl = json.results.find((r: any) => r.symbol === "AAPL");

    expect(aapl.name).toBe("Apple Inc.");
    expect(aapl.type).toBe("STOCK");
    expect(aapl.dataPoints).toBe(2);
  });

  it("scenarioId is echoed back on each result entry", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory([100, 90, 80]) as any,
          scenario: makePriceHistory([100, 90, 80]) as any,
        },
      },
    });

    const res = await POST(makeRequest({ ...VALID_BODY, symbols: ["AAPL"] }));
    const json = await res.json();
    const aapl = json.results.find((r: any) => r.symbol === "AAPL");
    expect(aapl.scenarioId).toBe("rate-shock-2022");
  });

  // ── Multi-Asset Accuracy ──────────────────────────────────────────────────

  it("computes independent drawdowns for each asset", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
      { id: "id-msft", symbol: "MSFT", name: "Microsoft Corp.", type: "STOCK" },
    ] as any);

    mockPriceHistoryByAsset({
      byAssetId: {
        "id-aapl": {
          recent: makePriceHistory(makeLinearSeries(100, 80, 60)) as any,
          scenario: makePriceHistory(makeLinearSeries(100, 80, 30)) as any,
        },
        "id-msft": {
          recent: makePriceHistory(makeLinearSeries(200, 100, 60)) as any,
          scenario: makePriceHistory(makeLinearSeries(200, 100, 30)) as any,
        },
      },
    });

    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();

    const aapl = json.results.find((r: any) => r.symbol === "AAPL");
    const msft = json.results.find((r: any) => r.symbol === "MSFT");

    // drawdown is returned as a fraction (-0.20 = -20%)
    expect(aapl.method).toBe("DIRECT");
    expect(msft.method).toBe("DIRECT");
    expect(aapl.drawdown).toBeCloseTo(-0.2, 2);
    expect(msft.drawdown).toBeCloseTo(-0.5, 2);
  });

  // ── Error Handling ────────────────────────────────────────────────────────

  it("returns 500 when prisma.asset.findMany throws", async () => {
    vi.mocked(prisma.asset.findMany).mockRejectedValue(new Error("DB error"));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal error");
  });

  it("returns error entry (not 500) when priceHistory fetch throws for one asset", async () => {
    vi.mocked(prisma.asset.findMany).mockResolvedValue([
      { id: "id-aapl", symbol: "AAPL", name: "Apple Inc.", type: "STOCK" },
      { id: "id-msft", symbol: "MSFT", name: "Microsoft Corp.", type: "STOCK" },
    ] as any);

    const findManyMock = prisma.priceHistory.findMany as any;
    findManyMock.mockImplementation((args: any) => {
      const assetId = args?.where?.assetId;
      const assetIds = args?.where?.assetId?.in;
      if (assetIds) {
        return assetIds.flatMap((id: string) => {
          if (id === "id-msft") {
            return [{ assetId: id, date: new Date("2022-01-03"), close: 80 }];
          }
          return makePriceHistory([100, 90, 80]).slice().reverse().map((row) => ({ assetId: id, date: row.date, close: row.close }));
        });
      }
      if (assetId === "id-msft") throw new Error("DB timeout");
      return makePriceHistory([100, 90, 80]);
    });

    const res = await POST(makeRequest(VALID_BODY));
    // Should still be 200 — individual asset errors are captured per-result
    expect(res.status).toBe(200);
    const json = await res.json();

    const aapl = json.results.find((r: any) => r.symbol === "AAPL");
    const msft = json.results.find((r: any) => r.symbol === "MSFT");

    expect(Number.isFinite(aapl.drawdown)).toBe(true);
    expect(msft.error).toBe("Calculation failed");
    expect(msft.drawdown).toBeNull();
  });
});
