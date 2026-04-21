export function calculateMultiAssetAnalysisCredits(assetCount: number) {
  if (!Number.isFinite(assetCount) || assetCount <= 0) return 0;
  const count = Math.floor(assetCount);
  return 5 + Math.max(0, count - 1) * 3;
}
