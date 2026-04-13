import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { AssetService } from "@/lib/services/asset.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { calculateMultiAssetAnalysisCredits, consumeCredits } from "@/lib/services/credit.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "compare-api" });
const MAX_COMPARE_ASSETS = 3;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    const plan = await getUserPlan(userId);
    if (plan !== "ELITE" && plan !== "ENTERPRISE") {
      return apiError("Elite plan required", 403);
    }

    // Validate symbols FIRST — before spending any credits
    const symbolsParam = req.nextUrl.searchParams.get("symbols") || "";
    const symbols = Array.from(new Set(
      symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    ));

    if (symbols.length < 2) {
      return apiError("At least 2 symbols required", 400);
    }

    if (symbols.length > MAX_COMPARE_ASSETS) {
      return apiError(`Compare supports a maximum of ${MAX_COMPARE_ASSETS} assets.`, 400);
    }

    const assets = await Promise.all(
      symbols.map((sym) => AssetService.getAssetBySymbol(sym))
    );

    const accessibleAssets = assets.filter(
      (asset): asset is NonNullable<typeof asset> => Boolean(asset)
    );

    if (accessibleAssets.length === 0) {
      const results = assets.map((asset, i) => {
        if (!asset) return { symbol: symbols[i], error: "Not found" };
        return { symbol: symbols[i], error: "Plan restriction" };
      });
      return NextResponse.json({ symbols, assets: results });
    }

    const requiredCredits = calculateMultiAssetAnalysisCredits(accessibleAssets.length);
    const { success, remaining } = await consumeCredits(userId, requiredCredits, `Asset comparison (${symbols.length} assets)`);
    if (!success) {
      return NextResponse.json({
        error: "Insufficient credits",
        remaining,
        message: `Asset comparison requires ${requiredCredits} credits. You have ${remaining}.`
      }, { status: 402 });
    }

    const results = assets.map((asset, i) => {
      if (!asset) return { symbol: symbols[i], error: "Not found" };

      const meta = (asset.metadata || {}) as Record<string, unknown>;
      const signalStrength = asset.signalStrength as Record<string, unknown> | null;
      const factorAlignment = asset.factorAlignment as Record<string, unknown> | null;
      const performanceData = asset.performanceData as Record<string, unknown> | null;
      const perf = (performanceData?.returns || {}) as Record<string, number | null>;

      return {
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type,
        price: asset.price,
        changePercent: asset.changePercent,
        currency: asset.currency,
        scores: {
          trend: asset.avgTrendScore,
          momentum: asset.avgMomentumScore,
          volatility: asset.avgVolatilityScore,
          liquidity: asset.avgLiquidityScore,
          sentiment: asset.avgSentimentScore,
          trust: asset.avgTrustScore,
          compatibility: asset.compatibilityScore,
        },
        signalStrength: signalStrength ? {
          score: signalStrength.score,
          label: signalStrength.label,
          confidence: signalStrength.confidence,
        } : null,
        factorAlignment: factorAlignment ? {
          score: factorAlignment.score,
          regimeFit: factorAlignment.regimeFit,
          dominantFactor: factorAlignment.dominantFactor,
        } : null,
        performance: {
          "1D": perf["1D"] ?? null,
          "1W": perf["1W"] ?? null,
          "1M": perf["1M"] ?? null,
          "3M": perf["3M"] ?? null,
          "1Y": perf["1Y"] ?? null,
        },
        valuation: {
          peRatio: meta.trailingPE as number | null ?? null,
          priceToBook: meta.priceToBook as number | null ?? null,
          roe: meta.returnOnEquity as number | null ?? null,
          marketCap: meta.marketCap as number | null ?? null,
        },
        sector: asset.sector,
        industry: asset.industry,
      };
    });

    return NextResponse.json({ symbols, assets: results });
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Compare API failed");
    return apiError("Internal error", 500);
  }
}
