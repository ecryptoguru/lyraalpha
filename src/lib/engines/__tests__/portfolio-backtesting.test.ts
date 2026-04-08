/**
 * @vitest-environment node
 *
 * Portfolio Backtesting Engine — accuracy & correctness tests.
 * Uses deterministic price series with known expected outputs.
 */
import { describe, it, expect } from "vitest";
import { computePortfolioBacktest, type BacktestHoldingInput } from "../portfolio-backtesting";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDates(n: number, startYear = 2023): string[] {
  const dates: string[] = [];
  const d = new Date(`${startYear}-01-02`);
  while (dates.length < n) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().split("T")[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function linearPriceHistory(
  dates: string[],
  start: number,
  dailyReturn: number,
): { date: string; close: number }[] {
  return dates.map((date, i) => ({
    date,
    close: start * Math.pow(1 + dailyReturn, i),
  }));
}

function flatPriceHistory(
  dates: string[],
  price: number,
): { date: string; close: number }[] {
  return dates.map((date) => ({ date, close: price }));
}

const DATES_60 = makeDates(60);
const DATES_300 = makeDates(300);

// ─── Boundary Conditions ──────────────────────────────────────────────────────

describe("Portfolio Backtesting Engine — boundary conditions", () => {
  it("returns empty result for empty holdings", () => {
    const result = computePortfolioBacktest([], flatPriceHistory(DATES_60, 100));
    expect(result.dataPoints).toHaveLength(0);
    expect(result.cumulativeReturn).toBeNull();
    expect(result.dataCount).toBe(0);
  });

  it("returns empty result when benchmark history is too short (<20)", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: flatPriceHistory(DATES_60, 100),
    };
    const result = computePortfolioBacktest([holding], flatPriceHistory(DATES_60.slice(0, 10), 100));
    expect(result.dataPoints).toHaveLength(0);
  });

  it("returns empty result when common dates < 20", () => {
    const datesA = makeDates(30, 2023);
    const datesB = makeDates(30, 2024); // no overlap
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: flatPriceHistory(datesA, 100),
    };
    const result = computePortfolioBacktest([holding], flatPriceHistory(datesB, 100));
    expect(result.dataPoints).toHaveLength(0);
  });

  it("returns correct benchmark label for US region", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: flatPriceHistory(DATES_60, 100),
    };
    const result = computePortfolioBacktest([holding], flatPriceHistory(DATES_60, 100), "US");
    expect(result.benchmarkLabel).toBe("S&P 500 (SPY)");
  });

  it("returns correct benchmark label for IN region", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: flatPriceHistory(DATES_60, 100),
    };
    const result = computePortfolioBacktest([holding], flatPriceHistory(DATES_60, 100), "IN");
    expect(result.benchmarkLabel).toBe("Nifty 50");
  });
});

// ─── Indexing & Cumulative Return ─────────────────────────────────────────────

describe("Portfolio Backtesting Engine — indexing and cumulative return", () => {
  it("portfolio and benchmark both start at 100 (indexed)", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_60, 100, 0.001),
    };
    const result = computePortfolioBacktest(
      [holding],
      linearPriceHistory(DATES_60, 200, 0.0005),
    );
    expect(result.dataPoints[0].portfolioValue).toBeCloseTo(100, 1);
    expect(result.dataPoints[0].benchmarkValue).toBeCloseTo(100, 1);
  });

  it("flat portfolio has zero cumulative return", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: flatPriceHistory(DATES_60, 100),
    };
    const result = computePortfolioBacktest(
      [holding],
      flatPriceHistory(DATES_60, 300),
    );
    expect(result.cumulativeReturn).toBeCloseTo(0, 3);
  });

  it("cumulative return matches final indexed value", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_60, 100, 0.002),
    };
    const result = computePortfolioBacktest(
      [holding],
      flatPriceHistory(DATES_60, 100),
    );
    const lastPoint = result.dataPoints[result.dataPoints.length - 1];
    // cumulativeReturn = (finalIndexed - 100) / 100
    expect(result.cumulativeReturn).toBeCloseTo((lastPoint.portfolioValue - 100) / 100, 3);
  });

  it("alpha = portfolio cumulative return - benchmark cumulative return", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_60, 100, 0.003),
    };
    const result = computePortfolioBacktest(
      [holding],
      linearPriceHistory(DATES_60, 100, 0.001),
    );
    const expectedAlpha = result.cumulativeReturn! - result.benchmarkCumulativeReturn!;
    expect(result.alpha).toBeCloseTo(expectedAlpha, 3);
  });

  it("outperforming portfolio has positive alpha", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_60, 100, 0.003), // 0.3%/day
    };
    const result = computePortfolioBacktest(
      [holding],
      linearPriceHistory(DATES_60, 100, 0.001), // 0.1%/day
    );
    expect(result.alpha).toBeGreaterThan(0);
  });

  it("underperforming portfolio has negative alpha", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_60, 100, 0.001),
    };
    const result = computePortfolioBacktest(
      [holding],
      linearPriceHistory(DATES_60, 100, 0.003),
    );
    expect(result.alpha).toBeLessThan(0);
  });
});

// ─── Max Drawdown ─────────────────────────────────────────────────────────────

describe("Portfolio Backtesting Engine — max drawdown", () => {
  it("monotonically rising portfolio has near-zero max drawdown", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_60, 100, 0.005),
    };
    const result = computePortfolioBacktest(
      [holding],
      flatPriceHistory(DATES_60, 100),
    );
    expect(result.maxDrawdown).toBeCloseTo(0, 2);
  });

  it("max drawdown is non-positive (convention: loss is negative)", () => {
    const dates = DATES_300;
    // Price rises then falls sharply
    const priceHistory = [
      ...dates.slice(0, 150).map((date, i) => ({ date, close: 100 + i })),
      ...dates.slice(150).map((date, i) => ({ date, close: 249 - i * 1.5 })),
    ];
    const holding: BacktestHoldingInput = { symbol: "A", weight: 1, priceHistory };
    const result = computePortfolioBacktest(
      [holding],
      flatPriceHistory(dates, 100),
    );
    expect(result.maxDrawdown).toBeLessThanOrEqual(0);
  });
});

// ─── Period Stats ─────────────────────────────────────────────────────────────

describe("Portfolio Backtesting Engine — period stats", () => {
  it("produces period stats for 1M, 3M, 6M, 1Y when data is sufficient", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_300, 100, 0.001),
    };
    const result = computePortfolioBacktest(
      [holding],
      linearPriceHistory(DATES_300, 100, 0.0005),
    );
    const periods = result.periodStats.map((p) => p.period);
    expect(periods).toContain("1M");
    expect(periods).toContain("3M");
    expect(periods).toContain("6M");
    expect(periods).toContain("1Y");
  });

  it("period alpha = period portfolio return - period benchmark return", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_300, 100, 0.002),
    };
    const result = computePortfolioBacktest(
      [holding],
      linearPriceHistory(DATES_300, 100, 0.001),
    );
    for (const stat of result.periodStats) {
      expect(stat.alpha).toBeCloseTo(stat.portfolioReturn - stat.benchmarkReturn, 3);
    }
  });

  it("does not produce 1Y period stats when data < 252 days", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_60, 100, 0.001),
    };
    const result = computePortfolioBacktest(
      [holding],
      linearPriceHistory(DATES_60, 100, 0.0005),
    );
    const periods = result.periodStats.map((p) => p.period);
    expect(periods).not.toContain("1Y");
  });
});

// ─── Rolling Sharpe ───────────────────────────────────────────────────────────

describe("Portfolio Backtesting Engine — rolling Sharpe", () => {
  it("produces rolling Sharpe periods when data > 60 days", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_300, 100, 0.001),
    };
    const result = computePortfolioBacktest(
      [holding],
      flatPriceHistory(DATES_300, 100),
    );
    expect(result.rollingSharpePeriods.length).toBeGreaterThan(0);
  });

  it("rolling Sharpe is positive for consistently rising portfolio", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_300, 100, 0.003),
    };
    const result = computePortfolioBacktest(
      [holding],
      flatPriceHistory(DATES_300, 100),
    );
    const allPositive = result.rollingSharpePeriods.every((p) => p.sharpe > 0);
    expect(allPositive).toBe(true);
  });

  it("no rolling Sharpe periods when data < 60 days", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_60, 100, 0.001),
    };
    const result = computePortfolioBacktest(
      [holding],
      flatPriceHistory(DATES_60, 100),
    );
    expect(result.rollingSharpePeriods).toHaveLength(0);
  });
});

// ─── Date Alignment ───────────────────────────────────────────────────────────

describe("Portfolio Backtesting Engine — date alignment", () => {
  it("only uses dates present in both holdings and benchmark", () => {
    const allDates = DATES_60;
    const holdingDates = allDates.filter((_, i) => i % 2 === 0); // every other day
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: flatPriceHistory(holdingDates, 100),
    };
    const result = computePortfolioBacktest(
      [holding],
      flatPriceHistory(allDates, 100),
    );
    // dataCount should be <= holdingDates.length
    expect(result.dataCount).toBeLessThanOrEqual(holdingDates.length);
  });

  it("multi-holding alignment uses intersection of all date sets", () => {
    const datesA = DATES_60;
    const datesB = DATES_60.slice(5); // B starts 5 days later
    const holdingA: BacktestHoldingInput = {
      symbol: "A",
      weight: 0.5,
      priceHistory: flatPriceHistory(datesA, 100),
    };
    const holdingB: BacktestHoldingInput = {
      symbol: "B",
      weight: 0.5,
      priceHistory: flatPriceHistory(datesB, 200),
    };
    const result = computePortfolioBacktest(
      [holdingA, holdingB],
      flatPriceHistory(DATES_60, 300),
    );
    // Common dates = datesB (55 dates), all present in benchmark
    expect(result.dataCount).toBeLessThanOrEqual(datesB.length);
    expect(result.dataCount).toBeGreaterThan(0);
  });

  it("weight normalization: raw weights produce same result as unit weights", () => {
    const holding1: BacktestHoldingInput = {
      symbol: "A",
      weight: 3000,
      priceHistory: linearPriceHistory(DATES_60, 100, 0.001),
    };
    const holding2: BacktestHoldingInput = {
      symbol: "A",
      weight: 0.3,
      priceHistory: linearPriceHistory(DATES_60, 100, 0.001),
    };
    const r1 = computePortfolioBacktest([holding1], flatPriceHistory(DATES_60, 100));
    const r2 = computePortfolioBacktest([holding2], flatPriceHistory(DATES_60, 100));
    expect(r1.cumulativeReturn).toBeCloseTo(r2.cumulativeReturn!, 3);
  });
});

// ─── Data Point Structure ─────────────────────────────────────────────────────

describe("Portfolio Backtesting Engine — data point structure", () => {
  it("first data point has zero portfolio and benchmark return", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_60, 100, 0.002),
    };
    const result = computePortfolioBacktest(
      [holding],
      linearPriceHistory(DATES_60, 100, 0.001),
    );
    expect(result.dataPoints[0].portfolioReturn).toBe(0);
    expect(result.dataPoints[0].benchmarkReturn).toBe(0);
  });

  it("dataCount matches number of data points", () => {
    const holding: BacktestHoldingInput = {
      symbol: "A",
      weight: 1,
      priceHistory: linearPriceHistory(DATES_60, 100, 0.001),
    };
    const result = computePortfolioBacktest(
      [holding],
      flatPriceHistory(DATES_60, 100),
    );
    expect(result.dataCount).toBe(result.dataPoints.length);
  });
});
