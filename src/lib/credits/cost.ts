export function calculateMultiAssetAnalysisCredits(assetCount: number) {
  if (assetCount <= 0) return 0;
  return 5 + Math.max(0, assetCount - 1) * 3;
}
