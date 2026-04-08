import { describe, test, expect } from "vitest";
import {
  cn,
  formatMarketCap,
  formatCompactNumber,
  formatPrice,
  getCurrencyConfig,
  computeRangePositionPercent,
  humanizeRegimeLabel,
  resolveAnalyticsSyncError,
  wait
} from "../utils";

describe("Utils Library", () => {
  describe("cn", () => {
    test("merges tailwind classes correctly", () => {
      expect(cn("px-2 py-1", "bg-red-500", "px-4")).toBe("py-1 bg-red-500 px-4");
      expect(cn("px-2", null, undefined, "py-1")).toBe("px-2 py-1");
    });
  });

  describe("formatMarketCap", () => {
    test("formats US values", () => {
      expect(formatMarketCap(1500000)).toBe("$1.50M");
      expect(formatMarketCap(2800000000)).toBe("$2.80B");
      expect(formatMarketCap(1500000000000)).toBe("$1.50T");
    });

    test("formats IN values correctly", () => {
      expect(formatMarketCap(150000, "₹", "IN")).toBe("₹1.50 Lac");
      expect(formatMarketCap(50000000, "₹", "IN")).toBe("₹5 Cr");
      expect(formatMarketCap(1500000000000, "₹", "IN")).toBe("₹1.50 Lac Cr");
    });

    test("handles edge cases", () => {
      expect(formatMarketCap(null)).toBe("—");
      expect(formatMarketCap(undefined)).toBe("—");
      expect(formatMarketCap("—")).toBe("—");
      expect(formatMarketCap("invalid")).toBe("—");
    });
  });

  describe("formatCompactNumber", () => {
    test("formats with region US", () => {
      expect(formatCompactNumber(1500000)).toBe("$1.50M");
      expect(formatCompactNumber(1500, { isCurrency: false })).toBe("1,500");
    });

    test("formats with region IN", () => {
      expect(formatCompactNumber(150000, { isCurrency: false, region: "IN" })).toBe("1.50 Lac");
      expect(formatCompactNumber(50000000, { region: "IN", symbol: "₹" })).toBe("₹5 Cr");
    });
  });

  describe("formatPrice", () => {
    test("formats US price", () => {
      expect(formatPrice(1234.56)).toBe("$1,234.56");
      expect(formatPrice(1234.5, { decimals: 3 })).toBe("$1,234.500");
    });

    // Node locale formatting might differ slightly, checking core logic
    test("handles empty values", () => {
      expect(formatPrice(null)).toBe("—");
      expect(formatPrice(undefined)).toBe("—");
    });
  });

  describe("getCurrencyConfig", () => {
    test("returns IN for INR", () => {
      expect(getCurrencyConfig("INR")).toEqual({ symbol: "₹", region: "IN" });
    });
    
    test("returns US for USD and others", () => {
      expect(getCurrencyConfig("USD")).toEqual({ symbol: "$", region: "US" });
      expect(getCurrencyConfig("EUR")).toEqual({ symbol: "$", region: "US" });
    });
  });

  describe("computeRangePositionPercent", () => {
    test("calculates correct percentage", () => {
      expect(computeRangePositionPercent(150, 100, 200)).toBe(50);
      expect(computeRangePositionPercent(100, 100, 200)).toBe(0);
      expect(computeRangePositionPercent(200, 100, 200)).toBe(100);
    });

    test("handles out of bounds", () => {
      expect(computeRangePositionPercent(50, 100, 200)).toBe(0);
      expect(computeRangePositionPercent(250, 100, 200)).toBe(100);
    });

    test("handles zero span", () => {
      expect(computeRangePositionPercent(100, 100, 100)).toBe(50);
    });
  });

  describe("humanizeRegimeLabel", () => {
    test("maps known labels", () => {
      expect(humanizeRegimeLabel("STRONG_RISK_ON")).toBe("Market Rising Strongly");
      expect(humanizeRegimeLabel("CRISIS")).toBe("Market Under Stress");
    });

    test("title cases unknown labels", () => {
      expect(humanizeRegimeLabel("unknown_regime")).toBe("Unknown Regime");
    });
  });

  describe("resolveAnalyticsSyncError", () => {
    test("preserves previous error if analytics exist", () => {
      expect(resolveAnalyticsSyncError("Old error", true, new Error("New error"))).toBe("Old error");
    });

    test("returns new error message if no analytics", () => {
      expect(resolveAnalyticsSyncError(null, false, new Error("Failed sync"))).toBe("Failed sync");
    });

    test("returns generic fallback if not an error instance", () => {
      expect(resolveAnalyticsSyncError(null, false, "String error")).toBe("Synchronization cycle interrupted");
    });
  });

  describe("wait", () => {
    test("resolves after timeout", async () => {
      const start = Date.now();
      await wait(50);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(40); // allow small timing variance
    });
  });
});
