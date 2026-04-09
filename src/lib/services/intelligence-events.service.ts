/**
 * Intelligence Events Service
 * Extracted from market-sync.service.ts (Phase 4 decomposition)
 *
 * Handles:
 * - Institutional event generation from engine signals
 * - News intelligence sync from Yahoo Finance
 * - Stale data pruning (housekeeping)
 */

import { directPrisma as prisma } from "../prisma";
import { Prisma } from "@/generated/prisma/client";
import { FactorProfile } from "../engines/factor-attribution";
import { fetchAssetNews } from "../market-data";
import { SYNC_CONFIG } from "../engines/constants";
import { createLogger } from "@/lib/logger";
import { createTimer } from "@/lib/logger/utils";
import crypto from "crypto";

const logger = createLogger({ service: "intelligence-events" });

interface EngineSignals {
  trend: { score: number };
  momentum: { score: number };
  volatility: { score: number };
  liquidity: { score: number };
  sentiment: { score: number };
  trust: { score: number };
}

export class IntelligenceEventsService {
  /**
   * Generate institutional events from engine signals and factor profile.
   * Deduplicates by checking existing events for the same asset today.
   */
  static async generateInstitutionalEvents(
    assetId: string,
    symbol: string,
    signals: EngineSignals,
    profile: FactorProfile,
    correlations: Record<string, number>,
  ) {
    const { MOMENTUM_BREAKOUT_THRESHOLD, VALUE_MISPRICING_THRESHOLD } = SYNC_CONFIG;

    // Dedup: only create events if no matching event exists for this asset today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const existingToday = await prisma.institutionalEvent.findMany({
      where: { assetId, date: { gte: today } },
      select: { type: true, title: true },
    });
    const existingKeys = new Set(existingToday.map(e => `${e.type}:${e.title}`));

    if (signals.momentum.score > MOMENTUM_BREAKOUT_THRESHOLD && signals.trend.score > 70
        && !existingKeys.has("TECHNICAL:Momentum Breakout")) {
      await prisma.institutionalEvent.create({
        data: {
          assetId,
          type: "TECHNICAL",
          title: "Momentum Breakout",
          description: "Institutional momentum confirmed with alignment across trend metrics. High conviction breakout signal detected.",
          severity: "HIGH",
          date: new Date(),
          metadata: { sentiment: "bullish", momentum: signals.momentum.score, trend: signals.trend.score } as Prisma.InputJsonValue,
        },
      });
    }

    if (profile.value > VALUE_MISPRICING_THRESHOLD
        && !existingKeys.has("FUNDAMENTAL:Value Mispricing")) {
      await prisma.institutionalEvent.create({
        data: {
          assetId,
          type: "FUNDAMENTAL",
          title: "Value Mispricing",
          description: "Deep value factors identified relative to industry peers. High institutional accumulation potential.",
          severity: "MEDIUM",
          date: new Date(),
          metadata: { sentiment: "bullish", valueScore: profile.value } as Prisma.InputJsonValue,
        },
      });
    }

    // C3 Fix: Check actual correlation breakdown, not volatility score
    const spyCorr = correlations["SPY"] ?? 1;
    const btcCorr = correlations["BTC-USD"] ?? 1;
    const avgBenchmarkCorr = (Math.abs(spyCorr) + Math.abs(btcCorr)) / 2;
    if (avgBenchmarkCorr < 0.3
        && !existingKeys.has("MARKET:Benchmark Shift")) {
      await prisma.institutionalEvent.create({
        data: {
          assetId,
          type: "MARKET",
          title: "Benchmark Shift",
          description: "Significant shift in correlation with core benchmarks detected. Possible regime decoupling.",
          severity: "LOW",
          date: new Date(),
          metadata: { sentiment: "bearish", SPY: spyCorr, BTC: btcCorr, avgCorrelation: avgBenchmarkCorr } as Prisma.InputJsonValue,
        },
      });
    }
  }

  /**
   * Sync news intelligence for an asset from Yahoo Finance.
   * Creates NEWS-type InstitutionalEvent records with deduplication via MD5 hash.
   */
  static async syncNewsIntelligence(assetId: string, symbol: string) {
    try {
      const newsItems = await fetchAssetNews(symbol, 5);
      if (newsItems.length === 0) return;

      for (const item of newsItems) {
        const hash = crypto.createHash("md5").update(item.link || item.uuid || item.title).digest("hex");
        const eventId = `news_${hash}`;

        try {
          await prisma.institutionalEvent.upsert({
            where: { id: eventId },
            update: {},
            create: {
              id: eventId,
              assetId,
              type: "NEWS",
              title: item.title,
              description: item.publisher || "Financial Wire",
              severity: "LOW",
              date: new Date(
                item.providerPublishTime > 1e12
                  ? item.providerPublishTime          // already milliseconds
                  : item.providerPublishTime * 1000   // convert seconds → ms
              ),
              metadata: {
                link: item.link,
              } as Prisma.InputJsonValue,
            },
          });
        } catch {
          logger.debug({ symbol, eventId }, "Skipping news item (insert error)");
        }
      }
    } catch (error) {
      logger.error({ symbol, error }, "Failed to sync news intelligence");
    }
  }

  /**
   * Housekeeping: prune stale data to prevent DB bloat.
   * Runs at the end of every fullSync cycle.
   *
   * - NEWS/MARKET/TECHNICAL events older than 48 hours
   * - INSIDER/ANALYST events older than 7 days
   * - PROTOCOL events older than 30 days
   * - FUNDAMENTAL events kept indefinitely (rare, valuable)
   * - MarketRegime entries older than 7 days
   * - Inactive TrendingQuestions (replaced by active set)
   */
  static async pruneStaleData() {
    const timer = createTimer();
    try {
      const H48 = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const D7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const D30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      // 90 days: calculateMultiHorizonRegime needs 60+ valid JSON rows.
      // With daily sync writing one row/day, we need at least 60 days of history to keep.
      const D90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const [newsResult, marketResult, techResult, insiderResult, analystResult, protocolResult, regimeResult, tqResult] = await Promise.all([
        prisma.institutionalEvent.deleteMany({
          where: { type: "NEWS", date: { lt: H48 } },
        }),
        prisma.institutionalEvent.deleteMany({
          where: { type: "MARKET", date: { lt: H48 } },
        }),
        prisma.institutionalEvent.deleteMany({
          where: { type: "TECHNICAL", date: { lt: H48 } },
        }),
        prisma.institutionalEvent.deleteMany({
          where: { type: "INSIDER", date: { lt: D7 } },
        }),
        prisma.institutionalEvent.deleteMany({
          where: { type: "ANALYST", date: { lt: D7 } },
        }),
        prisma.institutionalEvent.deleteMany({
          where: { type: "PROTOCOL", date: { lt: D30 } },
        }),
        prisma.marketRegime.deleteMany({
          where: { date: { lt: D90 } },
        }),
        prisma.trendingQuestion.deleteMany({
          where: { isActive: false },
        }),
      ]);

      const total = newsResult.count + marketResult.count + techResult.count + insiderResult.count + analystResult.count + protocolResult.count + regimeResult.count + tqResult.count;
      if (total > 0) {
        logger.info({
          news: newsResult.count,
          market: marketResult.count,
          technical: techResult.count,
          insider: insiderResult.count,
          analyst: analystResult.count,
          protocol: protocolResult.count,
          regime: regimeResult.count,
          trendingQ: tqResult.count,
          duration: timer.endFormatted(),
        }, "🧹 Pruned stale data");
      }
    } catch (error) {
      logger.error({ error }, "Failed to prune stale data");
    }
  }
}
