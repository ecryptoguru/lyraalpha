/**
 * @vitest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asset: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

describe("GET /api/stocks/[symbol]/scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when asset is missing", async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(null as any);

    const req = new Request("http://localhost/api/stocks/BTC/scenarios");
    const res = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ symbol: "BTC" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: "Asset not found" });
  });

  it("returns 200 not_ready payload when scenarioData is missing", async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      symbol: "BTC",
      name: "Bitcoin",
      type: "CRYPTO",
      scenarioData: null,
    } as any);

    const req = new Request("http://localhost/api/stocks/BTC/scenarios");
    const res = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ symbol: "BTC" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ready).toBe(false);
    expect(json.status).toBe("not_ready");
    expect(json.symbol).toBe("BTC");
    expect(json.scenarios).toBeNull();
    expect(typeof json.message).toBe("string");
  });

  it("returns 200 ready payload with scenarios when scenarioData exists", async () => {
    const scenarioData = {
      bullCase: { expectedReturn: 3.2, regime: "RISK_ON", confidence: 62 },
      baseCase: { expectedReturn: 1.1, regimeProbabilities: { RISK_ON: 62, NEUTRAL: 30, DEFENSIVE: 8 } },
      bearCase: { expectedReturn: -4.7, regime: "RISK_OFF", confidence: 18 },
      var5: -6.4,
      es5: -10.2,
      fragility: 55,
      metadata: {
        currentRegime: "NEUTRAL",
        factorAlignment: { RISK_ON: 10, NEUTRAL: 0, DEFENSIVE: -10, RISK_OFF: -20, STRONG_RISK_ON: 20 },
        liquidityFragility: 40,
        risk: {
          method: "empirical",
          confidence: 0.95,
          horizon: "1D",
          sampleSize: 180,
          displayCapLossPct: -95,
        },
      },
      riskVariants: {
        "1D_95": {
          method: "empirical",
          confidence: 0.95,
          horizon: "1D",
          sampleSize: 180,
          displayCapLossPct: -95,
          varPct: -6.4,
          esPct: -10.2,
        },
      },
    };

    vi.mocked(prisma.asset.findUnique).mockResolvedValue({
      symbol: "BTC",
      name: "Bitcoin",
      type: "CRYPTO",
      scenarioData,
    } as any);

    const req = new Request("http://localhost/api/stocks/BTC/scenarios");
    const res = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ symbol: "BTC" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.ready).toBe(true);
    expect(json.symbol).toBe("BTC");
    expect(json.scenarios).toBeTruthy();
    expect(json.scenarios.riskVariants).toBeTruthy();

    const v = json.scenarios.riskVariants["1D_95"];
    expect(typeof v.varPct).toBe("number");
    expect(typeof v.esPct).toBe("number");
    expect(["empirical", "normal"]).toContain(v.method);
    expect([0.95, 0.99]).toContain(v.confidence);
    expect(["1D", "1W"]).toContain(v.horizon);
  });
});
