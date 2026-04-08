import { EngineResult } from "./types";
import { Asset, AssetType } from "@/generated/prisma/client";
import { MarketQuote } from "@/types/market-data";

export function calculateTrustScore(
  asset: Asset,
  quote: MarketQuote,
): EngineResult {
  const marketCap = quote.marketCap || 0;
  const reasons: string[] = [];

  // 1. Base Score by Asset Class (40% weight)
  let baseScore = 50;
  switch (asset.type) {
    case AssetType.STOCK:
    case AssetType.ETF:
    case AssetType.MUTUAL_FUND:
      baseScore = 78;
      reasons.push("Regulated public security");
      break;
    case AssetType.CRYPTO:
      baseScore = 38;
      reasons.push("Speculative asset class");
      break;
    case AssetType.COMMODITY:
      baseScore = 72;
      reasons.push("Established commodity markets");
      break;
    default:
      baseScore = 50;
  }

  // 2. Market Cap Score — logarithmic gradient instead of discrete tiers (30% weight)
  // Maps market cap to 0-100 using log scale for smooth differentiation
  let capScore = 30;
  if (marketCap > 0) {
    const logCap = Math.log10(marketCap);
    // log10(100M) = 8, log10(1T) = 12 → map [7, 12.5] → [10, 95]
    capScore = Math.min(95, Math.max(10, ((logCap - 7) / 5.5) * 85 + 10));
    if (marketCap > 500_000_000_000) reasons.push("Category leader");
    else if (marketCap > 100_000_000_000) reasons.push("Mega-cap institutional grade");
    else if (marketCap > 10_000_000_000) reasons.push("Large-cap stability");
    else if (marketCap > 1_000_000_000) reasons.push("Mid-cap");
    else if (marketCap < 100_000_000) reasons.push("Micro-cap volatility risk");
  }

  // 3. Volume/Liquidity Proxy (15% weight)
  // Higher average volume = more market trust / easier exit
  const avgVol = quote.averageDailyVolume10Day || quote.regularMarketVolume || 0;
  let volumeScore = 50;
  if (avgVol > 0) {
    const dollarVol = avgVol * (quote.regularMarketPrice || 0);
    const logDolVol = Math.log10(Math.max(1, dollarVol));
    // log10(1M) = 6, log10(1B) = 9 → map [5, 10] → [15, 90]
    volumeScore = Math.min(90, Math.max(15, ((logDolVol - 5) / 5) * 75 + 15));
  }

  // 4. Price Stability Proxy (15% weight)
  // Assets near 52W high are more trusted by market consensus
  const high52 = quote.fiftyTwoWeekHigh;
  const price = quote.regularMarketPrice || 0;
  let stabilityScore = 50;
  if (high52 && high52 > 0 && price > 0) {
    const distFromHigh = ((high52 - price) / high52) * 100;
    // 0% from high → 85, 50%+ from high → 20
    stabilityScore = Math.min(85, Math.max(20, 85 - distFromHigh * 1.3));
  }

  // Composite: 40% base + 30% cap + 15% volume + 15% stability
  const score = Math.round(
    baseScore * 0.40 + capScore * 0.30 + volumeScore * 0.15 + stabilityScore * 0.15
  );
  const clampedScore = Math.min(99, Math.max(1, score));

  const direction = clampedScore >= 65 ? "UP" : clampedScore <= 40 ? "DOWN" : "FLAT";

  return {
    score: clampedScore,
    direction,
    context: reasons.join(". ") + ".",
    metadata: {
      marketCap,
      type: asset.type,
      breakdown: {
        base: Math.round(baseScore),
        cap: Math.round(capScore),
        volume: Math.round(volumeScore),
        stability: Math.round(stabilityScore),
      },
    },
  };
}
