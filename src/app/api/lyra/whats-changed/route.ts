import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "whats-changed-api" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

interface ChangedAsset {
  symbol: string;
  name: string;
  type: string;
  changeType: "score_inflection" | "regime_shift" | "price_move";
  description: string;
  magnitude: number;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    const plan = await getUserPlan(userId);
    if (plan !== "ELITE" && plan !== "ENTERPRISE") {
      return apiError("Elite plan required", 403);
    }

    const sinceParam = req.nextUrl.searchParams.get("since");
    const sinceRaw = sinceParam ? new Date(sinceParam) : null;
    const since = sinceRaw && !isNaN(sinceRaw.getTime())
      ? sinceRaw
      : new Date(Date.now() - 8 * 60 * 60 * 1000);

    // Single query: watchlist items with their asset data + recent score history.
    // Eliminates the sequential watchlist → assets → scores round-trips.
    const watchlistWithAssets = await prisma.watchlistItem.findMany({
      where: { userId },
      select: {
        symbol: true,
        asset: {
          select: {
            id: true,
            symbol: true,
            name: true,
            type: true,
            changePercent: true,
            avgTrendScore: true,
            avgMomentumScore: true,
            avgVolatilityScore: true,
            lastPriceUpdate: true,
            scores: {
              where: { date: { gte: since } },
              select: { assetId: true, type: true, value: true, date: true },
              orderBy: { date: "desc" },
            },
          },
        },
      },
    });

    if (watchlistWithAssets.length === 0) {
      return NextResponse.json({ changes: [], summary: null });
    }

    // WatchlistItem.asset is a required relation — always non-null
    const assets = watchlistWithAssets.map((w) => w.asset);

    // Group scores by assetId (already co-located on each asset)
    const scoresByAsset = new Map<string, { assetId: string; type: string; value: number; date: Date }[]>();
    for (const asset of assets) {
      if (asset.scores.length > 0) {
        scoresByAsset.set(asset.id, asset.scores);
      }
    }

    const changes: ChangedAsset[] = [];

    for (const asset of assets) {
      // Price move detection
      const cp = asset.changePercent ?? 0;
      if (Math.abs(cp) >= 3) {
        changes.push({
          symbol: asset.symbol,
          name: asset.name,
          type: asset.type,
          changeType: "price_move",
          description: `${cp >= 0 ? "+" : ""}${cp.toFixed(1)}% price move`,
          magnitude: Math.abs(cp),
        });
        continue;
      }

      // Score inflection detection
      const assetScores = scoresByAsset.get(asset.id) || [];
      if (assetScores.length >= 2) {
        const byType = new Map<string, number[]>();
        for (const s of assetScores) {
          if (!byType.has(s.type)) byType.set(s.type, []);
          byType.get(s.type)!.push(s.value);
        }
        for (const [type, vals] of byType) {
          if (vals.length >= 2) {
            const delta = vals[0] - vals[vals.length - 1];
            if (Math.abs(delta) >= 8) {
              changes.push({
                symbol: asset.symbol,
                name: asset.name,
                type: asset.type,
                changeType: "score_inflection",
                description: `${type.toLowerCase()} score ${delta > 0 ? "rose" : "fell"} ${Math.abs(Math.round(delta))} pts`,
                magnitude: Math.abs(delta),
              });
              break;
            }
          }
        }
      }
    }

    // Sort by magnitude, take top 5
    const topChanges = changes.sort((a, b) => b.magnitude - a.magnitude).slice(0, 5);

    // Build summary text using clean display names
    let summary: string | null = null;
    if (topChanges.length > 0) {
      const parts = topChanges.slice(0, 3).map((c) => {
        const cleanName = (c.name && c.name !== c.symbol)
          ? c.name.split(" ").slice(0, 2).join(" ")
          : c.symbol;
        return `${cleanName} (${c.description})`;
      });
      summary = `Since your last visit: ${parts.join(", ")}.`;
      if (topChanges.length > 3) summary += ` +${topChanges.length - 3} more changes.`;
    }

    return NextResponse.json({ changes: topChanges, summary, since: since.toISOString() });
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Whats-changed API failed");
    return apiError("Internal error", 500);
  }
}
