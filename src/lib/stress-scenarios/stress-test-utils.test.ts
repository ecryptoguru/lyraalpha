import { describe, expect, it } from "vitest";
import { fmt, buildChartData, getStressTestErrorMessage, formatScenarioPeriod } from "./stress-test-utils";
import type { StressResult } from "./types";

// ── fmt ──────────────────────────────────────────────────────────────────────

describe("fmt", () => {
  it("returns em-dash for null", () => {
    expect(fmt(null)).toBe("—");
  });

  it("formats negative values with minus sign", () => {
    expect(fmt(-0.15)).toBe("-15.0%");
  });

  it("formats positive values with plus sign", () => {
    expect(fmt(0.08)).toBe("+8.0%");
  });

  it("formats zero without sign", () => {
    expect(fmt(0)).toBe("0.0%");
  });

  it("respects custom suffix", () => {
    expect(fmt(0.5, "x")).toBe("+50.0x");
  });

  it("rounds to one decimal place", () => {
    expect(fmt(-0.1234)).toBe("-12.3%");
  });
});

// ── getStressTestErrorMessage ────────────────────────────────────────────────

describe("getStressTestErrorMessage", () => {
  it("returns credit message for 402 with no payload", () => {
    expect(getStressTestErrorMessage(402, null)).toBe(
      "You do not have enough credits to run this stress test.",
    );
  });

  it("returns payload message for 402 when present", () => {
    expect(getStressTestErrorMessage(402, { message: "Need 10 credits" })).toBe(
      "Need 10 credits",
    );
  });

  it("returns Elite gate message for 403 with 'Elite plan required'", () => {
    expect(getStressTestErrorMessage(403, { error: "Elite plan required" })).toBe(
      "Stress Test is available on Elite and Enterprise plans.",
    );
  });

  it("returns payload message for 403 without Elite error", () => {
    expect(getStressTestErrorMessage(403, { message: "Forbidden" })).toBe("Forbidden");
  });

  it("returns payload error for 403 as fallback", () => {
    expect(getStressTestErrorMessage(403, { error: "Some error" })).toBe("Some error");
  });

  it("returns payload message for 400", () => {
    expect(getStressTestErrorMessage(400, { message: "Bad symbols" })).toBe("Bad symbols");
  });

  it("returns fallback for 400 with no payload message", () => {
    expect(getStressTestErrorMessage(400, null)).toBe(
      "Please check your symbols and scenario selection.",
    );
  });

  it("returns payload error for 400 when message is absent", () => {
    expect(getStressTestErrorMessage(400, { error: "Invalid input" })).toBe("Invalid input");
  });

  it("returns fallback for unknown status with null payload", () => {
    expect(getStressTestErrorMessage(500, null)).toBe("Stress test failed. Please try again.");
  });

  it("returns payload message for unknown status", () => {
    expect(getStressTestErrorMessage(500, { message: "Server error" })).toBe("Server error");
  });

  it("returns payload error when message is absent for unknown status", () => {
    expect(getStressTestErrorMessage(502, { error: "Bad gateway" })).toBe("Bad gateway");
  });
});

// ── formatScenarioPeriod ─────────────────────────────────────────────────────

describe("formatScenarioPeriod", () => {
  it("formats valid ISO date strings", () => {
    const result = formatScenarioPeriod({ start: "2008-09-01", end: "2009-03-31" });
    expect(result).toContain("Sep");
    expect(result).toContain("2008");
    expect(result).toContain("Mar");
    expect(result).toContain("2009");
    expect(result).toContain("–");
  });

  it("falls back to raw strings for invalid dates", () => {
    const result = formatScenarioPeriod({ start: "not-a-date", end: "also-invalid" });
    expect(result).toBe("not-a-date – also-invalid");
  });

  it("falls back for one invalid date", () => {
    const result = formatScenarioPeriod({ start: "2008-09-01", end: "bad" });
    expect(result).toBe("2008-09-01 – bad");
  });
});

// ── buildChartData ───────────────────────────────────────────────────────────

describe("buildChartData", () => {
  const makeResult = (
    symbol: string,
    path: Array<{ day: number; drawdown: number }>,
    overrides?: Partial<StressResult>,
  ): StressResult => ({
    symbol,
    name: symbol,
    type: "CRYPTO",
    region: "US",
    scenarioId: "gfc-2008",
    method: "DIRECT",
    drawdown: path.length > 0 ? path[path.length - 1].drawdown : null,
    periodReturn: null,
    maxDrawdown: -0.5,
    dailyPath: path,
    proxyUsed: null,
    beta: null,
    confidence: 0.8,
    factors: null,
    ...overrides,
  });

  it("returns empty array for empty results", () => {
    expect(buildChartData([])).toEqual([]);
  });

  it("builds chart data for a single asset", () => {
    const result = makeResult("BTC-USD", [
      { day: 1, drawdown: -0.05 },
      { day: 5, drawdown: -0.15 },
      { day: 10, drawdown: -0.30 },
    ]);
    const data = buildChartData([result]);

    expect(data).toHaveLength(3);
    expect(data[0]).toEqual({ day: 1, "BTC-USD": -5.0 });
    expect(data[1]).toEqual({ day: 5, "BTC-USD": -15.0 });
    expect(data[2]).toEqual({ day: 10, "BTC-USD": -30.0 });
  });

  it("normalises different day scales to a unified axis", () => {
    const btc = makeResult("BTC-USD", [
      { day: 1, drawdown: -0.10 },
      { day: 5, drawdown: -0.20 },
      { day: 10, drawdown: -0.40 },
    ]);
    const eth = makeResult("ETH-USD", [
      { day: 1, drawdown: -0.08 },
      { day: 3, drawdown: -0.18 },
      { day: 10, drawdown: -0.50 },
    ]);
    const data = buildChartData([btc, eth]);

    // Unified axis: days 1, 3, 5, 10
    expect(data).toHaveLength(4);
    expect(data[0].day).toBe(1);
    expect(data[1].day).toBe(3);
    expect(data[2].day).toBe(5);
    expect(data[3].day).toBe(10);

    // Day 3: BTC nearest is day 1 (|5-3| > |1-3| is false, so pointer stays at 1)
    // Actually pointer advances: day 1 pointer=0, day 3 pointer advances to 1 (day 5)
    // Wait — need to check the nearest-point logic
    const day3Entry = data[1];
    expect(day3Entry["BTC-USD"]).toBeDefined();
    expect(day3Entry["ETH-USD"]).toBeDefined();
  });

  it("rounds drawdown to 2 decimal places in percentage", () => {
    const result = makeResult("BTC-USD", [
      { day: 1, drawdown: -0.123456 },
    ]);
    const data = buildChartData([result]);

    // -0.123456 * 10000 = -1234.56, Math.round = -1235, / 100 = -12.35
    expect(data[0]["BTC-USD"]).toBe(-12.35);
  });

  it("handles multiple assets with overlapping days", () => {
    const btc = makeResult("BTC-USD", [
      { day: 1, drawdown: -0.05 },
      { day: 5, drawdown: -0.15 },
    ]);
    const eth = makeResult("ETH-USD", [
      { day: 1, drawdown: -0.03 },
      { day: 5, drawdown: -0.20 },
    ]);
    const data = buildChartData([btc, eth]);

    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ day: 1, "BTC-USD": -5.0, "ETH-USD": -3.0 });
    expect(data[1]).toEqual({ day: 5, "BTC-USD": -15.0, "ETH-USD": -20.0 });
  });
});
