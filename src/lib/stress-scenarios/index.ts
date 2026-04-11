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

function looksLikeGold(symbol: string, name?: string | null, category?: string | null) {
  const haystack = `${symbol} ${name ?? ""} ${category ?? ""}`.toLowerCase();
  return haystack.includes("gold") || haystack.includes("bullion");
}

function looksLikeOil(symbol: string, name?: string | null, category?: string | null) {
  const haystack = `${symbol} ${name ?? ""} ${category ?? ""}`.toLowerCase();
  return haystack.includes("oil") || haystack.includes("energy") || haystack.includes("crude");
}

function looksLikeBanking(symbol: string, name?: string | null, sector?: string | null, category?: string | null) {
  const haystack = `${symbol} ${name ?? ""} ${sector ?? ""} ${category ?? ""}`.toLowerCase();
  return haystack.includes("bank") || haystack.includes("financial") || haystack.includes("finserv") || haystack.includes("finance");
}

function looksLikeTech(symbol: string, name?: string | null, sector?: string | null, category?: string | null) {
  const haystack = `${symbol} ${name ?? ""} ${sector ?? ""} ${category ?? ""}`.toLowerCase();
  return haystack.includes("tech") || haystack.includes("software") || haystack.includes("internet") || haystack.includes("semiconductor") || haystack.includes("nasdaq");
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
  options?: { name?: string | null; sector?: string | null; category?: string | null },
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
      return pickProxy(paths, ["BTC-USD", "QQQ", "SPY"]);
    }
    if (looksLikeGold(symbol, options?.name, options?.category)) {
      return pickProxy(paths, ["GLD", "TLT", "SPY"]);
    }
    if (looksLikeOil(symbol, options?.name, options?.category)) {
      return pickProxy(paths, ["SPY", "IWM", "QQQ"]);
    }
    if (looksLikeTech(symbol, options?.name, options?.sector, options?.category)) {
      return pickProxy(paths, ["QQQ", "SPY", "IWM"]);
    }
    return pickProxy(paths, ["SPY", "IWM", "QQQ"]);
  }

  if (scenario.region === "IN") {
    if (looksLikeGold(symbol, options?.name, options?.category) || symbol.toUpperCase() === "GOLDBEES.NS") {
      return pickProxy(paths, ["GOLDBEES.NS", "NIFTYBEES.NS", "BANKBEES.NS"]);
    }
    if (looksLikeBanking(symbol, options?.name, options?.sector, options?.category) || symbol.toUpperCase() === "BANKBEES.NS") {
      return pickProxy(paths, ["BANKBEES.NS", "NIFTYBEES.NS", "GOLDBEES.NS"]);
    }
    if (looksLikeTech(symbol, options?.name, options?.sector, options?.category)) {
      return pickProxy(paths, ["NIFTYBEES.NS", "BANKBEES.NS"]);
    }
    return pickProxy(paths, ["NIFTYBEES.NS", "BANKBEES.NS", "GOLDBEES.NS"]);
  }

  return paths[0];
}

// Compute a simple beta estimate from recent daily returns vs the proxy's known annualized vol.
// Beta = asset_annualized_vol / proxy_annualized_vol, clamped to [0.2, 2.5].
// Proxy annualized vols are approximate historical averages for each asset class.
const PROXY_ANNUALIZED_VOLS: Record<string, number> = {
  "SPY":        0.18,
  "QQQ":        0.24,
  "IWM":        0.23,
  "GLD":        0.15,
  "TLT":        0.14,
  "BTC-USD":    0.75,
  "NIFTYBEES.NS": 0.20,
  "BANKBEES.NS":  0.26,
  "GOLDBEES.NS":  0.16,
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
