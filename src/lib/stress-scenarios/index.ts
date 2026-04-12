import { US_SCENARIOS } from "./us";
import type { ScenarioDefinition, ScenarioProxyPath, StressScenarioId, SupportedStressAssetType } from "./types";

export * from "./types";

export const ALL_SCENARIOS: ScenarioDefinition[] = [...US_SCENARIOS];

export const STRESS_SCENARIO_IDS = [...new Set(ALL_SCENARIOS.map((scenario) => scenario.id))] as StressScenarioId[];

export function getScenario(id: StressScenarioId | string, region: "US" | "IN"): ScenarioDefinition | undefined {
  return ALL_SCENARIOS.find((s) => s.id === id && s.region === region);
}

function normalizeType(assetType: string): SupportedStressAssetType {
  if (assetType === "CRYPTO" || assetType === "DEFI" || assetType === "NFTS" || assetType === "LAYER1" || assetType === "LAYER2") {
    return assetType;
  }

  return "CRYPTO";
}

function pickProxy(paths: ScenarioProxyPath[], candidates: string[]) {
  for (const candidate of candidates) {
    const found = paths.find((path) => path.proxy === candidate);
    if (found) return found;
  }

  return paths[0];
}

// Map asset type/region to the best proxy path within a scenario
export function getBestProxyPath(
  scenario: ScenarioDefinition,
  assetType: string,
  symbol: string,
): ScenarioProxyPath {
  const paths = scenario.proxyPaths;
  const normalizedType = normalizeType(assetType);

  // Exact symbol match first (if asset IS one of the proxies)
  const exactMatch = paths.find(
    (p) => p.proxy.toUpperCase() === symbol.toUpperCase(),
  );
  if (exactMatch) return exactMatch;

  if (scenario.region === "US") {
    if (normalizedType === "CRYPTO") {
      return pickProxy(paths, ["BTC-USD", "ETH-USD", "SOL-USD"]);
    }
    return pickProxy(paths, ["BTC-USD", "ETH-USD", "SOL-USD"]);
  }

  if (scenario.region === "IN") {
    return pickProxy(paths, ["BTC-USD", "ETH-USD", "SOL-USD"]);
  }

  return paths[0];
}

// Compute a simple beta estimate from recent daily returns vs the proxy's known annualized vol.
// Beta = asset_annualized_vol / proxy_annualized_vol, clamped to [0.2, 2.5].
// Proxy annualized vols are approximate historical averages for each asset class.
const PROXY_ANNUALIZED_VOLS: Record<string, number> = {
  "BTC-USD":    0.75,
  "ETH-USD":    0.80,
  "SOL-USD":    0.90,
  "BNB-USD":    0.70,
  "XRP-USD":    0.85,
};

export function estimateBeta(
  assetDailyReturns: number[],
  proxySymbol: string,
): number {
  if (!assetDailyReturns.length) return 1.0;

  const assetDailyVol = stdDev(assetDailyReturns);
  const assetAnnualVol = assetDailyVol * Math.sqrt(252);

  const proxyAnnualVol = PROXY_ANNUALIZED_VOLS[proxySymbol] ?? 0.20;

  const rawBeta = assetAnnualVol / proxyAnnualVol;

  // Clamp between 0.2 and 2.5 to avoid extreme outliers
  return Math.max(0.2, Math.min(2.5, rawBeta));
}

function stdDev(arr: number[]): number {
  if (!arr.length) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}
