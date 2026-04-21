import { describe, expect, it } from "vitest";
import { calculateMultiAssetAnalysisCredits } from "./cost";

describe("calculateMultiAssetAnalysisCredits", () => {
  it("returns 0 for zero assets", () => {
    expect(calculateMultiAssetAnalysisCredits(0)).toBe(0);
  });

  it("returns 0 for negative input", () => {
    expect(calculateMultiAssetAnalysisCredits(-1)).toBe(0);
  });

  it("returns 0 for NaN", () => {
    expect(calculateMultiAssetAnalysisCredits(NaN)).toBe(0);
  });

  it("returns 0 for Infinity", () => {
    expect(calculateMultiAssetAnalysisCredits(Infinity)).toBe(0);
  });

  it("returns 5 for 1 asset (base price)", () => {
    expect(calculateMultiAssetAnalysisCredits(1)).toBe(5);
  });

  it("returns 8 for 2 assets (5 + 3)", () => {
    expect(calculateMultiAssetAnalysisCredits(2)).toBe(8);
  });

  it("returns 11 for 3 assets (5 + 2×3)", () => {
    expect(calculateMultiAssetAnalysisCredits(3)).toBe(11);
  });

  it("floors fractional input — 2.9 counts as 2 assets", () => {
    expect(calculateMultiAssetAnalysisCredits(2.9)).toBe(8);
  });

  it("returns 14 for 4 assets (5 + 3×3)", () => {
    expect(calculateMultiAssetAnalysisCredits(4)).toBe(14);
  });
});
