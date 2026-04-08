import { describe, it, expect } from "vitest";
import { calculateMultiAssetAnalysisCredits, getCreditCost } from "../credit.service";

describe("Credit System", () => {
  describe("getCreditCost", () => {
    it("returns 1 for SIMPLE queries", () => {
      expect(getCreditCost("SIMPLE")).toBe(1);
    });

    it("returns 3 for MODERATE queries", () => {
      expect(getCreditCost("MODERATE")).toBe(3);
    });

    it("returns 5 for COMPLEX queries", () => {
      expect(getCreditCost("COMPLEX")).toBe(5);
    });
  });

  describe("calculateMultiAssetAnalysisCredits", () => {
    it("charges 5 credits for the first asset and 3 for each additional asset", () => {
      expect(calculateMultiAssetAnalysisCredits(0)).toBe(0);
      expect(calculateMultiAssetAnalysisCredits(1)).toBe(5);
      expect(calculateMultiAssetAnalysisCredits(2)).toBe(8);
      expect(calculateMultiAssetAnalysisCredits(3)).toBe(11);
      expect(calculateMultiAssetAnalysisCredits(4)).toBe(14);
      expect(calculateMultiAssetAnalysisCredits(5)).toBe(17);
    });
  });
});
