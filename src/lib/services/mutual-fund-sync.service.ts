import { prisma } from "../prisma";
import { Asset, AssetType, Prisma } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";
import { createTimer, sanitizeError } from "@/lib/logger/utils";
import { AssetService } from "./asset.service";
import { MutualFundAnalyticsEngine } from "../engines/mutual-fund-analytics";
import { OHLCV } from "../engines/types";

const logger = createLogger({ service: "mutual-fund-sync" });

interface MFApiResponse {
  meta: {
    fund_house: string;
    scheme_type: string;
    scheme_category: string;
    scheme_code: number;
    scheme_name: string;
  };
  data: {
    date: string;
    nav: string;
  }[];
  status: string;
}

export class MutualFundSyncService {
  private static API_BASE_URL = "https://api.mfapi.in/mf";
  // UTI Nifty 50 Index Fund (Direct Growth) — proxy for Nifty 50 benchmark
  private static NIFTY_BENCHMARK_SCHEME = "120716";
  private static benchmarkCache: OHLCV[] | null = null;

  /**
   * Fetches and caches Nifty 50 benchmark history (via index fund proxy).
   * Cached for the lifetime of the batch sync to avoid repeated API calls.
   */
  private static async getBenchmarkHistory(): Promise<OHLCV[]> {
    if (this.benchmarkCache) return this.benchmarkCache;
    const data = await this.fetchMFData(this.NIFTY_BENCHMARK_SCHEME);
    if (!data || data.data.length === 0) return [];
    const valid = data.data.filter(h => parseFloat(h.nav) > 0);
    this.benchmarkCache = valid.map((h) => ({
      date: this.parseDate(h.date).toISOString(),
      open: parseFloat(h.nav),
      high: parseFloat(h.nav),
      low: parseFloat(h.nav),
      close: parseFloat(h.nav),
      volume: 0,
    }));
    logger.info({ points: this.benchmarkCache.length }, "Fetched Nifty 50 benchmark history");
    return this.benchmarkCache;
  }

  /**
   * Fetches data for a single mutual fund from mfapi.in
   */
  static async fetchMFData(schemeCode: string): Promise<MFApiResponse | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/${schemeCode}`);
      if (!response.ok) {
        throw new Error(`MF API returned status ${response.status}`);
      }
      const data = await response.json();
      if (data.status !== "SUCCESS") {
        throw new Error(`MF API returned unsuccessful status: ${data.status}`);
      }
      return data as MFApiResponse;
    } catch (error) {
      logger.error({ schemeCode, err: sanitizeError(error) }, "Failed to fetch data from mfapi.in");
      return null;
    }
  }

  /**
   * Syncs a single Indian Mutual Fund
   */
  static async syncFund(asset: Asset) {
    const metadata = asset.metadata as Record<string, unknown>;
    const schemeCode = metadata?.schemeCode as string;
    if (!schemeCode) {
      logger.warn({ symbol: asset.symbol }, "Skipping MF sync: No schemeCode found in metadata");
      return;
    }

    const timer = createTimer();
    const data = await this.fetchMFData(schemeCode);
    if (!data || data.data.length === 0) return;

    // Filter out points with zero NAV (bad data from API)
    const validData = data.data.filter(h => parseFloat(h.nav) > 0);
    if (validData.length === 0) {
      logger.warn({ symbol: asset.symbol, schemeCode }, "Skipping MF sync: No valid NAV data found (all zero)");
      return;
    }

    const latestNav = parseFloat(validData[0].nav);
    const lastUpdateDate = this.parseDate(validData[0].date);

    // Prepare history for analytics (Full history needed for long-term CAGR)
    const fullHistory: OHLCV[] = validData.map((h) => ({
      date: this.parseDate(h.date).toISOString(),
      open: parseFloat(h.nav),
      high: parseFloat(h.nav),
      low: parseFloat(h.nav),
      close: parseFloat(h.nav),
      volume: 0,
    }));

    // Calculate Analytics
    const analytics = MutualFundAnalyticsEngine.analyze(fullHistory);

    // Overlay MC-scraped risk metrics from metadata (more accurate than computed)
    if (metadata.beta != null) analytics.risk.beta = Number(metadata.beta);
    if (metadata.sharpeRatio != null) analytics.risk.sharpe = Number(metadata.sharpeRatio);
    if (metadata.standardDeviation != null) analytics.risk.volatility = Number(metadata.standardDeviation);
    if (metadata.alpha != null) analytics.risk.alpha = Number(metadata.alpha);
    if (metadata.rSquared != null) analytics.risk.rSquared = Number(metadata.rSquared);

    // Compute alpha & R² from Nifty 50 benchmark if not available from MC metadata
    if (analytics.risk.alpha == null || analytics.risk.rSquared == null) {
      try {
        const benchmarkHistory = await this.getBenchmarkHistory();
        if (benchmarkHistory.length > 30) {
          const advanced = MutualFundAnalyticsEngine.calculateAdvancedMetrics(fullHistory, benchmarkHistory);
          if (analytics.risk.alpha == null && advanced.alpha != null) analytics.risk.alpha = advanced.alpha;
          if (analytics.risk.beta == null && advanced.beta != null) analytics.risk.beta = advanced.beta;
          if (analytics.risk.rSquared == null && advanced.rSquared != null) analytics.risk.rSquared = advanced.rSquared;
        }
      } catch (err) {
        logger.warn({ symbol: asset.symbol, err: sanitizeError(err) }, "Failed to compute advanced MF metrics");
      }
    }

    try {
      // 1. Update Asset metadata, NAV, and Factor Data
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          nav: latestNav,
          price: latestNav, // For MFs, price is NAV
          lastPriceUpdate: lastUpdateDate,
          category: data.meta.scheme_category,
          fundHouse: data.meta.fund_house,
          schemeType: data.meta.scheme_type,
          updatedAt: new Date(),
          factorData: {
            ...((asset.factorData as object) || {}),
            mfAnalytics: analytics as unknown as Prisma.InputJsonValue
          },
          // P0: Also write to metadata so the analytics API can read it
          metadata: {
            ...((asset.metadata as object) || {}),
            fundHouse: data.meta.fund_house,
            schemeType: data.meta.scheme_type,
            schemeCategory: data.meta.scheme_category,
          } as Prisma.InputJsonValue,
        },
      });

      // 2. Persist Price History (last 365 days)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const historyData = data.data
        .filter((h) => this.parseDate(h.date) >= oneYearAgo)
        .slice(0, 365) // Cap at 1 year of daily data
        .map((h) => ({
          assetId: asset.id,
          date: this.parseDate(h.date),
          open: parseFloat(h.nav),
          high: parseFloat(h.nav),
          low: parseFloat(h.nav),
          close: parseFloat(h.nav),
          volume: 0, // Mutual funds don't have exchange volume in this traditional sense
        }));

      await prisma.priceHistory.createMany({
        data: historyData,
        skipDuplicates: true,
      });

      // 3. Invalidate Cache
      await AssetService.invalidateAsset(asset.symbol);

      logger.info({ 
        symbol: asset.symbol, 
        nav: latestNav, 
        points: historyData.length,
        duration: timer.endFormatted() 
      }, "Synced Indian Mutual Fund");
    } catch (error) {
      logger.error({ symbol: asset.symbol, err: sanitizeError(error) }, "Failed to persist MF data");
    }
  }

  /**
   * Syncs all Indian Mutual Funds
   */
  static async syncAllIndianFunds() {
    const timer = createTimer();
    const funds = await prisma.asset.findMany({
      where: {
        type: AssetType.MUTUAL_FUND,
        region: "IN",
      },
      select: {
        id: true, symbol: true, type: true, nav: true, price: true,
        metadata: true, factorData: true, lastPriceUpdate: true,
        category: true, fundHouse: true, schemeType: true,
        region: true, name: true, currency: true,
        changePercent: true, marketCap: true,
      },
    }) as unknown as Asset[];

    logger.info({ count: funds.length }, "🚀 Starting batch sync for Indian Mutual Funds");

    const CONCURRENCY_LIMIT = 3;
    for (let i = 0; i < funds.length; i += CONCURRENCY_LIMIT) {
      const batch = funds.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(batch.map((fund) => this.syncFund(fund)));
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.benchmarkCache = null; // Free memory
    logger.info({ duration: timer.endFormatted() }, "✅ Indian Mutual Fund sync complete");
  }

  private static parseDate(dateStr: string): Date {
    // mfapi.in returns DD-MM-YYYY
    const [day, month, year] = dateStr.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
