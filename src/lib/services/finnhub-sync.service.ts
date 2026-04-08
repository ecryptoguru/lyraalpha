import { prisma } from "../prisma";
import { AssetType, Prisma } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";
import { createTimer, sanitizeError } from "@/lib/logger/utils";
import crypto from "crypto";
import {
  FinnhubService,
  type FinnhubCompanyNews,
  type FinnhubNewsSentiment,
  type FinnhubInsiderTransaction,
  type FinnhubRecommendation,
} from "./finnhub.service";
import { CryptoPanicService, type CryptoPanicPost } from "./cryptopanic.service";
import { IndiaNewsService } from "./india-news.service";

const logger = createLogger({ service: "finnhub-sync" });

// ─── Rate Budget ────────────────────────────────────────────────────
// Free tier: 60 req/min. A full sync cycle should finish in ~5 min.
// Hard-cap total Finnhub API calls per cycle to stay well under limits.
const MAX_REQUESTS_PER_CYCLE = 250;
const PHASE_CAPS = {
  NEWS: 15,           // 15 symbols × 2 calls = 30 requests
  CRYPTO_NEWS: 10,    // trending + 10 per-symbol = ~12 requests
  INSIDER: 20,        // 20 symbols × 2 calls = 40 requests
  ANALYST: 15,        // 15 symbols × 3 calls = 45 requests
  FINANCIALS: 20,     // 20 symbols × 1 call = 20 requests
  ETF: 10,            // 10 ETFs × 2 calls = 20 requests
  PEERS: 15,          // 15 symbols × 1 call = 15 requests
  CALENDARS: 4,       // earnings + economic + ipo + market = ~6 requests
} as const;

class RequestBudget {
  private used = 0;
  private phaseUsage: Record<string, number> = {};
  private currentPhase = "";

  get remaining(): number {
    return MAX_REQUESTS_PER_CYCLE - this.used;
  }

  get total(): number {
    return this.used;
  }

  canProceed(needed = 1): boolean {
    if (this.remaining < needed) return false;
    // Enforce per-phase cap if a phase is active and has a defined cap
    if (this.currentPhase) {
      const phaseCap = PHASE_CAPS[this.currentPhase as keyof typeof PHASE_CAPS];
      if (phaseCap != null) {
        const phaseUsed = this.phaseUsage[this.currentPhase] ?? 0;
        if (phaseUsed + needed > phaseCap) return false;
      }
    }
    return true;
  }

  startPhase(name: string) {
    this.currentPhase = name;
    if (!this.phaseUsage[name]) this.phaseUsage[name] = 0;
  }

  consume(n = 1) {
    this.used += n;
    if (this.currentPhase) {
      this.phaseUsage[this.currentPhase] = (this.phaseUsage[this.currentPhase] || 0) + n;
    }
  }

  summary(): Record<string, number> {
    return { ...this.phaseUsage, _total: this.used, _remaining: this.remaining };
  }
}

// ─── Date Helpers ───────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

function today(): string {
  return toDateStr(new Date());
}

// ─── Finnhub Sync Orchestrator ──────────────────────────────────────

export class FinnhubSyncService {
  /**
   * Master sync: runs all Finnhub data enrichment for US stocks.
   * Called from MarketSyncService.fullSync() after harvest.
   */
  static async syncAll(force = false) {
    if (!FinnhubService.isConfigured()) {
      logger.info("⏭️ Finnhub API key not configured — skipping Finnhub sync");
      return;
    }

    const timer = createTimer();
    const budget = new RequestBudget();
    logger.info({ force, maxRequests: MAX_REQUESTS_PER_CYCLE }, "📡 Finnhub Sync: Starting multi-source intelligence sync...");

    try {
      // P0: News + Sentiment (US stocks via Finnhub)
      await this.syncFinnhubNews(budget);

      // P0: Crypto news (CryptoPanic + Finnhub)
      await this.syncCryptoNews(budget);

      // P0: Indian news (Moneycontrol RSS) — no Finnhub calls, doesn't consume budget
      await this.syncIndianNews();

      // P0: Market-wide news (general + crypto categories)
      await this.syncMarketNews(budget);

      // P1: Earnings calendar
      await this.syncEarningsCalendar(budget);

      // P1: Insider transactions + sentiment
      await this.syncInsiderData(budget);

      // P1: Analyst data (recommendations + price targets + upgrades)
      await this.syncAnalystData(budget);

      // P1: Basic financials (60+ ratios)
      await this.syncBasicFinancials(budget, force);

      // P2: Economic calendar
      await this.syncEconomicCalendar(budget);

      // P2: IPO calendar
      await this.syncIPOCalendar(budget);

      // P2: ETF enrichment
      await this.syncETFData(budget);

      // P3: Peer data
      await this.syncPeerData(budget);

      logger.info({ duration: timer.endFormatted(), budget: budget.summary() }, "✅ Finnhub Sync: All intelligence synced");
    } catch (error) {
      logger.error({ error: sanitizeError(error), budget: budget.summary() }, "Finnhub Sync failed");
    }
  }

  static async syncNewsOnly() {
    const timer = createTimer();
    const budget = new RequestBudget();

    try {
      if (FinnhubService.isConfigured()) {
        await this.syncFinnhubNews(budget);
        await this.syncMarketNews(budget);
      } else {
        logger.info("⏭️ Finnhub API key not configured — skipping US/market news sync");
      }

      // India RSS does not depend on Finnhub API key
      await this.syncIndianNews();
      logger.info({ duration: timer.endFormatted(), budget: budget.summary() }, "✅ News-only sync complete");
    } catch (error) {
      logger.error({ error: sanitizeError(error), budget: budget.summary() }, "News-only sync failed");
    }
  }

  static async syncCryptoOnly() {
    const timer = createTimer();
    const budget = new RequestBudget();

    try {
      await this.syncCryptoNews(budget);
      logger.info({ duration: timer.endFormatted(), budget: budget.summary() }, "✅ Crypto-only sync complete");
    } catch (error) {
      logger.error({ error: sanitizeError(error), budget: budget.summary() }, "Crypto-only sync failed");
    }
  }

  // ── P0: Finnhub Company News + Sentiment (US Stocks) ─────────────

  private static async syncFinnhubNews(budget: RequestBudget) {
    budget.startPhase("news");
    const timer = createTimer();
    const usStocks = await prisma.asset.findMany({
      where: {
        region: "US",
        type: { in: [AssetType.STOCK, AssetType.ETF] },
      },
      select: { id: true, symbol: true },
    });

    // Skip assets with fresh Finnhub news (<6h)
    const SIX_HOURS_AGO = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentNews = await prisma.institutionalEvent.findMany({
      where: {
        assetId: { in: usStocks.map(a => a.id) },
        type: "NEWS",
        date: { gte: SIX_HOURS_AGO },
        description: { contains: "Finnhub" },
      },
      select: { assetId: true },
      distinct: ["assetId"],
    });
    const freshIds = new Set(recentNews.map(n => n.assetId));
    const staleAssets = usStocks.filter(a => !freshIds.has(a.id)).slice(0, PHASE_CAPS.NEWS);

    logger.info({ total: usStocks.length, syncing: staleAssets.length, skipped: freshIds.size, budgetRemaining: budget.remaining }, "Finnhub News: syncing stale US assets");

    let synced = 0;
    // Sequential: each symbol = 2 API calls (news + sentiment)
    for (const asset of staleAssets) {
      if (!budget.canProceed(2)) {
        logger.warn({ synced, budgetRemaining: budget.remaining }, "Finnhub News: budget exhausted — stopping early");
        break;
      }
      try {
        const news = await FinnhubService.getCompanyNews(asset.symbol, daysAgo(3), today());
        budget.consume(1);
        if (news.length > 0) {
          await this.persistFinnhubNews(asset.id, asset.symbol, news);
        }

        const sentiment = await FinnhubService.getNewsSentiment(asset.symbol);
        budget.consume(1);
        if (sentiment) {
          await this.persistNewsSentiment(asset.id, asset.symbol, sentiment);
        }

        synced++;
      } catch (err) {
        logger.debug({ symbol: asset.symbol, err: String(err) }, "Finnhub news sync failed for symbol");
      }
    }

    logger.info({ synced, duration: timer.endFormatted() }, "📰 Finnhub News sync complete");
  }

  private static async persistFinnhubNews(assetId: string, symbol: string, news: FinnhubCompanyNews[]) {
    for (const item of news.slice(0, 5)) {
      const hash = crypto.createHash("md5").update(item.url || item.headline).digest("hex");
      const eventId = `fh_news_${hash}`;

      try {
        await prisma.institutionalEvent.upsert({
          where: { id: eventId },
          update: {},
          create: {
            id: eventId,
            assetId,
            type: "NEWS",
            title: item.headline.slice(0, 500),
            description: `${item.source} via Finnhub`,
            severity: "LOW",
            date: new Date(item.datetime * 1000),
            metadata: {
              link: item.url,
              source: item.source,
              image: item.image,
              summary: item.summary?.slice(0, 1000),
              related: item.related,
              provider: "finnhub",
            } as Prisma.InputJsonValue,
          },
        });
      } catch {
        // Duplicate or constraint error — skip
      }
    }
  }

  private static async persistNewsSentiment(assetId: string, symbol: string, sentiment: FinnhubNewsSentiment) {
    // Store sentiment data on the asset's metadata for use by engines
    try {
      const existing = await prisma.asset.findUnique({
        where: { symbol },
        select: { metadata: true },
      });
      const meta = (existing?.metadata as Record<string, unknown>) || {};

      await prisma.asset.update({
        where: { symbol },
        data: {
          metadata: {
            ...meta,
            finnhubSentiment: {
              companyNewsScore: sentiment.companyNewsScore,
              sectorAvgScore: sentiment.sectorAverageNewsScore,
              sectorAvgBullish: sentiment.sectorAverageBullishPercent,
              bullishPercent: sentiment.sentiment.bullishPercent,
              bearishPercent: sentiment.sentiment.bearishPercent,
              buzz: sentiment.buzz.buzz,
              articlesInLastWeek: sentiment.buzz.articlesInLastWeek,
              weeklyAverage: sentiment.buzz.weeklyAverage,
              lastSync: new Date().toISOString(),
            },
          } as Prisma.JsonObject,
        },
      });
    } catch (err) {
      logger.debug({ symbol, err: String(err) }, "Failed to persist Finnhub sentiment");
    }
  }

  // ── P0: Crypto News (CryptoPanic + Finnhub) ──────────────────────

  private static async syncCryptoNews(budget: RequestBudget) {
    const timer = createTimer();
    const cryptoAssets = await prisma.asset.findMany({
      where: { type: AssetType.CRYPTO },
      select: { id: true, symbol: true },
    });

    // Skip assets with fresh crypto news (<6h)
    const SIX_HOURS_AGO = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentNews = await prisma.institutionalEvent.findMany({
      where: {
        assetId: { in: cryptoAssets.map(a => a.id) },
        type: "NEWS",
        date: { gte: SIX_HOURS_AGO },
      },
      select: { assetId: true },
      distinct: ["assetId"],
    });
    const freshIds = new Set(recentNews.map(n => n.assetId));
    const staleAssets = cryptoAssets.filter(a => !freshIds.has(a.id));

    logger.info({ total: cryptoAssets.length, syncing: staleAssets.length }, "Crypto News: syncing stale crypto assets");

    budget.startPhase("crypto_news");

    // CryptoPanic: batch by top coins (not Finnhub — doesn't consume budget)
    if (CryptoPanicService.isConfigured()) {
      // Get trending news first (covers all coins)
      const trending = await CryptoPanicService.getTrendingNews(20);
      await this.persistCryptoPanicNews(staleAssets, trending);

      // Then per-symbol for top 10 stale assets
      const topStale = staleAssets.slice(0, PHASE_CAPS.CRYPTO_NEWS);
      for (const asset of topStale) {
        try {
          const news = await CryptoPanicService.getNewsForSymbol(asset.symbol, 3);
          if (news.length > 0) {
            await this.persistCryptoPanicNewsForAsset(asset.id, asset.symbol, news);
          }
        } catch {
          logger.debug({ symbol: asset.symbol }, "CryptoPanic per-symbol fetch failed");
        }
      }
    }

    // Finnhub crypto news (general category) — 1 API call
    if (!budget.canProceed(1)) {
      logger.info({ budgetRemaining: budget.remaining }, "Crypto News: skipping Finnhub crypto — budget low");
      logger.info({ duration: timer.endFormatted() }, "🪙 Crypto News sync complete (partial)");
      return;
    }
    try {
      const fhCryptoNews = await FinnhubService.getMarketNews("crypto");
      budget.consume(1);
      if (fhCryptoNews.length > 0) {
        // Match Finnhub crypto news to our assets by checking `related` field
        for (const item of fhCryptoNews.slice(0, 15)) {
          const relatedSymbols = (item.related || "").split(",").map(s => s.trim().toUpperCase());
          for (const asset of staleAssets) {
            const baseSymbol = asset.symbol.replace("-USD", "");
            if (relatedSymbols.includes(baseSymbol) || item.headline.toUpperCase().includes(baseSymbol)) {
              const hash = crypto.createHash("md5").update(item.url || item.headline).digest("hex");
              const eventId = `fh_crypto_${hash}_${asset.symbol}`;
              try {
                await prisma.institutionalEvent.upsert({
                  where: { id: eventId },
                  update: {},
                  create: {
                    id: eventId,
                    assetId: asset.id,
                    type: "NEWS",
                    title: item.headline.slice(0, 500),
                    description: `${item.source} via Finnhub Crypto`,
                    severity: "LOW",
                    date: new Date(item.datetime * 1000),
                    metadata: {
                      link: item.url,
                      source: item.source,
                      image: item.image,
                      summary: item.summary?.slice(0, 1000),
                      provider: "finnhub_crypto",
                    } as Prisma.InputJsonValue,
                  },
                });
              } catch { /* skip duplicates */ }
            }
          }
        }
      }
    } catch (e) {
      logger.debug({ err: String(e) }, "Finnhub crypto news fetch failed");
    }

    logger.info({ duration: timer.endFormatted() }, "🪙 Crypto News sync complete");
  }

  private static async persistCryptoPanicNews(
    assets: { id: string; symbol: string }[],
    posts: CryptoPanicPost[],
  ) {
    const symbolMap = new Map(assets.map(a => [a.symbol.replace("-USD", "").toUpperCase(), a]));

    for (const post of posts) {
      const currencies = post.currencies || [];
      for (const curr of currencies) {
        const asset = symbolMap.get(curr.code.toUpperCase());
        if (!asset) continue;

        await this.persistCryptoPanicNewsForAsset(asset.id, asset.symbol, [post]);
      }
    }
  }

  private static async persistCryptoPanicNewsForAsset(assetId: string, symbol: string, posts: CryptoPanicPost[]) {
    for (const post of posts.slice(0, 5)) {
      const hash = crypto.createHash("md5").update(post.url || post.title).digest("hex");
      const eventId = `cp_${hash}`;
      const { sentiment, score } = CryptoPanicService.deriveSentiment(post);

      try {
        await prisma.institutionalEvent.upsert({
          where: { id: eventId },
          update: {},
          create: {
            id: eventId,
            assetId,
            type: "NEWS",
            title: post.title.slice(0, 500),
            description: `${post.source.title} via CryptoPanic`,
            severity: score > 0.5 || score < -0.5 ? "MEDIUM" : "LOW",
            date: new Date(post.published_at),
            metadata: {
              link: post.url,
              source: post.source.title,
              domain: post.domain,
              sentiment,
              sentimentScore: score,
              votes: post.votes,
              provider: "cryptopanic",
            } as Prisma.InputJsonValue,
          },
        });
      } catch { /* skip duplicates */ }
    }
  }

  // ── P0: Indian News (Moneycontrol/ET RSS) ─────────────────────────

  private static async syncIndianNews() {
    const timer = createTimer();
    const indianStocks = await prisma.asset.findMany({
      where: { region: "IN", type: AssetType.STOCK },
      select: { id: true, symbol: true },
    });

    // Skip assets with fresh news (<6h)
    const SIX_HOURS_AGO = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentNews = await prisma.institutionalEvent.findMany({
      where: {
        assetId: { in: indianStocks.map(a => a.id) },
        type: "NEWS",
        date: { gte: SIX_HOURS_AGO },
      },
      select: { assetId: true },
      distinct: ["assetId"],
    });
    const freshIds = new Set(recentNews.map(n => n.assetId));
    const staleAssets = indianStocks.filter(a => !freshIds.has(a.id));

    logger.info({ total: indianStocks.length, syncing: staleAssets.length }, "Indian News: syncing stale IN assets");

    // Fetch all Indian market news once
    const allNews = await IndiaNewsService.getIndianMarketNews(60);

    // Match news to specific stocks
    for (const asset of staleAssets) {
      const keyword = asset.symbol.replace(/\.(NS|BO)$/, "").toUpperCase();
      const matched = allNews.filter(item => {
        const text = `${item.title} ${item.description}`.toUpperCase();
        return text.includes(keyword);
      }).slice(0, 3);

      for (const item of matched) {
        const hash = crypto.createHash("md5").update(item.link || item.title).digest("hex");
        const eventId = `in_news_${hash}`;
        const sentiment = IndiaNewsService.deriveSentiment(item.title);

        try {
          await prisma.institutionalEvent.upsert({
            where: { id: eventId },
            update: {},
            create: {
              id: eventId,
              assetId: asset.id,
              type: "NEWS",
              title: item.title.slice(0, 500),
              description: `${item.source} (India)`,
              severity: "LOW",
              date: new Date(item.pubDate),
              metadata: {
                link: item.link,
                source: item.source,
                sentiment,
                category: item.category,
                provider: "india_rss",
              } as Prisma.InputJsonValue,
            },
          });
        } catch { /* skip duplicates */ }
      }
    }

    // Also persist general Indian market news (not asset-specific)
    // These go as "market-wide" events without a specific assetId — skip for now
    // since InstitutionalEvent requires assetId

    logger.info({ matched: staleAssets.length, totalNews: allNews.length, duration: timer.endFormatted() }, "🇮🇳 Indian News sync complete");
  }

  // ── P1: Insider Transactions + Sentiment ──────────────────────────

  private static async syncInsiderData(budget: RequestBudget) {
    budget.startPhase("insider");
    const timer = createTimer();
    // Only US stocks (insider data is SEC-based)
    const usStocks = await prisma.asset.findMany({
      where: { region: "US", type: AssetType.STOCK },
      select: { id: true, symbol: true, metadata: true },
    });

    // Only sync weekly (check last sync in metadata)
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const needsSync = usStocks.filter(a => {
      const meta = (a.metadata as Record<string, unknown>) || {};
      const lastSync = (meta.finnhubInsiderSync as string) ? new Date(meta.finnhubInsiderSync as string).getTime() : 0;
      return Date.now() - lastSync > WEEK_MS;
    });

    if (needsSync.length === 0) {
      logger.info("Insider data: all assets fresh — skipping");
      return;
    }

    logger.info({ syncing: Math.min(needsSync.length, PHASE_CAPS.INSIDER), budgetRemaining: budget.remaining }, "Insider Data: syncing US stocks");

    let synced = 0;
    for (const asset of needsSync.slice(0, PHASE_CAPS.INSIDER)) {
      if (!budget.canProceed(2)) {
        logger.warn({ synced, budgetRemaining: budget.remaining }, "Insider Data: budget exhausted — stopping early");
        break;
      }
      try {
        const txns = await FinnhubService.getInsiderTransactions(asset.symbol);
        budget.consume(1);
        if (txns.length > 0) {
          await this.persistInsiderTransactions(asset.id, asset.symbol, txns);
        }

        // Also fetch insider sentiment (MSPR)
        const sentiment = await FinnhubService.getInsiderSentiment(asset.symbol, daysAgo(365), today());
        budget.consume(1);
        if (sentiment?.data?.length) {
          await this.persistInsiderSentiment(asset.id, asset.symbol, sentiment.data);
        }

        // Mark as synced
        const meta = (asset.metadata as Record<string, unknown>) || {};
        await prisma.asset.update({
          where: { symbol: asset.symbol },
          data: {
            metadata: { ...meta, finnhubInsiderSync: new Date().toISOString() } as Prisma.JsonObject,
          },
        });
        synced++;
      } catch {
        logger.debug({ symbol: asset.symbol }, "Insider data sync failed");
      }
    }

    logger.info({ synced, duration: timer.endFormatted() }, "🕵️ Insider Data sync complete");
  }

  private static async persistInsiderTransactions(assetId: string, symbol: string, txns: FinnhubInsiderTransaction[]) {
    // Only persist significant transactions (buys/sells, not options exercises)
    const significant = txns.filter(t =>
      ["P", "S"].includes(t.transactionCode) && Math.abs(t.change) > 0
    ).slice(0, 5);

    for (const txn of significant) {
      const isBuy = txn.transactionCode === "P";
      const hash = crypto.createHash("md5").update(`${txn.name}_${txn.filingDate}_${txn.change}`).digest("hex");
      const eventId = `insider_${hash}`;

      try {
        await prisma.institutionalEvent.upsert({
          where: { id: eventId },
          update: {},
          create: {
            id: eventId,
            assetId,
            type: "INSIDER",
            title: `${isBuy ? "Insider Buy" : "Insider Sell"}: ${txn.name}`,
            description: `${Math.abs(txn.change).toLocaleString()} shares @ $${txn.transactionPrice?.toFixed(2) || "N/A"}`,
            severity: Math.abs(txn.change * (txn.transactionPrice || 0)) > 1_000_000 ? "HIGH" : "MEDIUM",
            date: new Date(txn.filingDate),
            metadata: {
              insiderName: txn.name,
              shares: txn.change,
              price: txn.transactionPrice,
              action: isBuy ? "BUY" : "SELL",
              filingDate: txn.filingDate,
              transactionDate: txn.transactionDate,
              provider: "finnhub",
            } as Prisma.InputJsonValue,
          },
        });
      } catch { /* skip duplicates */ }
    }
  }

  private static async persistInsiderSentiment(
    assetId: string,
    symbol: string,
    data: { year: number; month: number; change: number; mspr: number }[],
  ) {
    // Store aggregated insider sentiment on asset metadata
    const latest = data.slice(0, 6); // Last 6 months
    const avgMSPR = latest.reduce((s, d) => s + d.mspr, 0) / (latest.length || 1);
    const totalChange = latest.reduce((s, d) => s + d.change, 0);

    try {
      const existing = await prisma.asset.findUnique({
        where: { symbol },
        select: { metadata: true },
      });
      const meta = (existing?.metadata as Record<string, unknown>) || {};

      await prisma.asset.update({
        where: { symbol },
        data: {
          metadata: {
            ...meta,
            insiderSentiment: {
              avgMSPR: Math.round(avgMSPR * 1000) / 1000,
              totalShareChange6m: totalChange,
              monthlyData: latest,
              signal: avgMSPR > 0 ? "BULLISH" : avgMSPR < -0.5 ? "BEARISH" : "NEUTRAL",
            },
          } as Prisma.JsonObject,
        },
      });
    } catch {
      logger.debug({ symbol }, "Failed to persist insider sentiment");
    }
  }

  // ── P1: Earnings Calendar ─────────────────────────────────────────

  private static async syncEarningsCalendar(budget: RequestBudget) {
    budget.startPhase("earnings");
    if (!budget.canProceed(1)) {
      logger.info({ budgetRemaining: budget.remaining }, "Earnings Calendar: skipping — budget low");
      return;
    }
    const timer = createTimer();
    try {
      // Get earnings for next 2 weeks + last week
      const events = await FinnhubService.getEarningsCalendar(daysAgo(7), daysAgo(-14));
      budget.consume(1);

      // Match to our universe
      const ourSymbols = await prisma.asset.findMany({
        where: { type: { in: [AssetType.STOCK, AssetType.ETF] } },
        select: { id: true, symbol: true },
      });
      const symbolMap = new Map(ourSymbols.map(a => [a.symbol, a.id]));

      let persisted = 0;
      for (const event of events) {
        const assetId = symbolMap.get(event.symbol);
        if (!assetId) continue;

        const hash = crypto.createHash("md5").update(`${event.symbol}_${event.date}_Q${event.quarter}`).digest("hex");
        const eventId = `earnings_${hash}`;

        const isUpcoming = new Date(event.date) > new Date();
        const hasSurprise = event.epsActual !== null && event.epsEstimate !== null;
        const surprise = hasSurprise ? ((event.epsActual! - event.epsEstimate!) / Math.abs(event.epsEstimate! || 1)) * 100 : null;

        try {
          await prisma.institutionalEvent.upsert({
            where: { id: eventId },
            update: hasSurprise ? {
              metadata: {
                epsActual: event.epsActual,
                epsEstimate: event.epsEstimate,
                revenueActual: event.revenueActual,
                revenueEstimate: event.revenueEstimate,
                surprise: surprise ? Math.round(surprise * 100) / 100 : null,
                provider: "finnhub",
              } as Prisma.InputJsonValue,
            } : {},
            create: {
              id: eventId,
              assetId,
              type: "EARNINGS",
              title: isUpcoming
                ? `Earnings Due: Q${event.quarter} ${event.year}`
                : `Earnings Report: Q${event.quarter} ${event.year}`,
              description: hasSurprise
                ? `EPS: $${event.epsActual?.toFixed(2)} vs $${event.epsEstimate?.toFixed(2)} est. (${surprise! > 0 ? "+" : ""}${surprise?.toFixed(1)}%)`
                : `EPS Est: $${event.epsEstimate?.toFixed(2) || "N/A"} | Rev Est: $${event.revenueEstimate ? (event.revenueEstimate / 1e9).toFixed(2) + "B" : "N/A"}`,
              severity: hasSurprise && Math.abs(surprise!) > 10 ? "HIGH" : isUpcoming ? "MEDIUM" : "LOW",
              date: new Date(event.date),
              metadata: {
                epsActual: event.epsActual,
                epsEstimate: event.epsEstimate,
                revenueActual: event.revenueActual,
                revenueEstimate: event.revenueEstimate,
                quarter: event.quarter,
                year: event.year,
                hour: event.hour,
                surprise: surprise ? Math.round(surprise * 100) / 100 : null,
                isUpcoming,
                provider: "finnhub",
              } as Prisma.InputJsonValue,
            },
          });
          persisted++;
        } catch { /* skip */ }
      }

      logger.info({ total: events.length, matched: persisted, duration: timer.endFormatted() }, "📊 Earnings Calendar sync complete");
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "Earnings calendar sync failed");
    }
  }

  // ── P1: Analyst Data (Recommendations + Price Targets + Upgrades) ─

  private static async syncAnalystData(budget: RequestBudget) {
    budget.startPhase("analyst");
    const timer = createTimer();
    const usStocks = await prisma.asset.findMany({
      where: { region: "US", type: AssetType.STOCK },
      select: { id: true, symbol: true, metadata: true },
    });

    // Weekly sync check
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const needsSync = usStocks.filter(a => {
      const meta = (a.metadata as Record<string, unknown>) || {};
      const lastSync = (meta.finnhubAnalystSync as string) ? new Date(meta.finnhubAnalystSync as string).getTime() : 0;
      return Date.now() - lastSync > WEEK_MS;
    }).slice(0, PHASE_CAPS.ANALYST);

    if (needsSync.length === 0) {
      logger.info("Analyst data: all assets fresh — skipping");
      return;
    }

    let synced = 0;
    for (const asset of needsSync) {
      // 3 sequential API calls per symbol
      if (!budget.canProceed(3)) {
        logger.warn({ synced, budgetRemaining: budget.remaining }, "Analyst Data: budget exhausted — stopping early");
        break;
      }
      try {
        // Sequential to avoid bursting rate limit
        const recs = await FinnhubService.getRecommendationTrends(asset.symbol);
        budget.consume(1);
        const pt = await FinnhubService.getPriceTarget(asset.symbol);
        budget.consume(1);
        const upgrades = await FinnhubService.getUpgradeDowngrade(asset.symbol);
        budget.consume(1);

        const meta = (asset.metadata as Record<string, unknown>) || {};
        const analystData: Record<string, unknown> = {};

        if (recs.length > 0) {
          const latest = recs[0];
          analystData.recommendations = {
            strongBuy: latest.strongBuy,
            buy: latest.buy,
            hold: latest.hold,
            sell: latest.sell,
            strongSell: latest.strongSell,
            period: latest.period,
            consensus: this.deriveConsensus(latest),
          };
        }

        if (pt) {
          analystData.priceTarget = {
            high: pt.targetHigh,
            low: pt.targetLow,
            mean: pt.targetMean,
            median: pt.targetMedian,
            lastUpdated: pt.lastUpdated,
          };
        }

        if (upgrades.length > 0) {
          analystData.recentUpgrades = upgrades.slice(0, 5).map(u => ({
            company: u.company,
            from: u.fromGrade,
            to: u.toGrade,
            action: u.action,
            date: new Date(u.gradeTime * 1000).toISOString(),
          }));

          // Persist upgrade/downgrade events
          for (const u of upgrades.slice(0, 3)) {
            const hash = crypto.createHash("md5").update(`${u.company}_${u.gradeTime}_${u.action}`).digest("hex");
            const eventId = `ud_${hash}`;
            try {
              await prisma.institutionalEvent.upsert({
                where: { id: eventId },
                update: {},
                create: {
                  id: eventId,
                  assetId: asset.id,
                  type: "ANALYST",
                  title: `${u.action}: ${u.company} (${u.fromGrade} → ${u.toGrade})`,
                  description: `Analyst rating change by ${u.company}`,
                  severity: u.action === "upgrade" ? "MEDIUM" : u.action === "downgrade" ? "HIGH" : "LOW",
                  date: new Date(u.gradeTime * 1000),
                  metadata: {
                    company: u.company,
                    fromGrade: u.fromGrade,
                    toGrade: u.toGrade,
                    action: u.action,
                    provider: "finnhub",
                  } as Prisma.InputJsonValue,
                },
              });
            } catch { /* skip */ }
          }
        }

        // Persist to metadata
        await prisma.asset.update({
          where: { symbol: asset.symbol },
          data: {
            metadata: {
              ...meta,
              finnhubAnalyst: analystData,
              finnhubAnalystSync: new Date().toISOString(),
            } as Prisma.JsonObject,
          },
        });
        synced++;
      } catch {
        logger.debug({ symbol: asset.symbol }, "Analyst data sync failed");
      }
    }

    logger.info({ synced, duration: timer.endFormatted() }, "📈 Analyst Data sync complete");
  }

  private static deriveConsensus(rec: FinnhubRecommendation): string {
    const total = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell;
    if (total === 0) return "N/A";
    const score = (rec.strongBuy * 5 + rec.buy * 4 + rec.hold * 3 + rec.sell * 2 + rec.strongSell * 1) / total;
    if (score >= 4.2) return "Strong Buy";
    if (score >= 3.5) return "Buy";
    if (score >= 2.5) return "Hold";
    if (score >= 1.8) return "Sell";
    return "Strong Sell";
  }

  // ── P1: Basic Financials (60+ ratios) ─────────────────────────────

  private static async syncBasicFinancials(budget: RequestBudget, force = false) {
    budget.startPhase("financials");
    const timer = createTimer();
    const usStocks = await prisma.asset.findMany({
      where: { region: "US", type: AssetType.STOCK },
      select: { id: true, symbol: true, metadata: true },
    });

    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const cap = force ? Math.min(usStocks.length, PHASE_CAPS.FINANCIALS * 2) : PHASE_CAPS.FINANCIALS;
    const needsSync = usStocks.filter(a => {
      const meta = (a.metadata as Record<string, unknown>) || {};
      const lastSync = (meta.finnhubFinancialsSync as string) ? new Date(meta.finnhubFinancialsSync as string).getTime() : 0;
      return force || Date.now() - lastSync > WEEK_MS;
    }).slice(0, cap);

    if (needsSync.length === 0) {
      logger.info("Basic financials: all assets fresh — skipping");
      return;
    }

    let synced = 0;
    for (const asset of needsSync) {
      if (!budget.canProceed(1)) {
        logger.warn({ synced, budgetRemaining: budget.remaining }, "Basic Financials: budget exhausted — stopping early");
        break;
      }
      try {
        const fin = await FinnhubService.getBasicFinancials(asset.symbol);
        budget.consume(1);
        if (!fin?.metric) continue;

        const meta = (asset.metadata as Record<string, unknown>) || {};
        const m = fin.metric;

        // Extract key metrics and store on asset fields + metadata
        await prisma.asset.update({
          where: { symbol: asset.symbol },
          data: {
            // Update first-class fields where available
            ...(m["peBasicExclExtraTTM"] ? { peRatio: m["peBasicExclExtraTTM"] } : {}),
            ...(m["psTTM"] ? { priceToSales: m["psTTM"] } : {}),
            ...(m["pbQuarterly"] ? { priceToBook: m["pbQuarterly"] } : {}),
            ...(m["roeTTM"] ? { roe: m["roeTTM"] } : {}),
            ...(m["currentDividendYieldTTM"] ? { dividendYield: m["currentDividendYieldTTM"] } : {}),
            ...(m["epsGrowthTTMYoy"] ? { eps: m["epsBasicExclExtraItemsTTM"] } : {}),
            ...(m["revenueGrowthQuarterlyYoy"] ? { revenueGrowth: m["revenueGrowthQuarterlyYoy"] } : {}),
            ...(m["operatingMarginTTM"] ? { operatingMargins: m["operatingMarginTTM"] } : {}),
            ...(m["netProfitMarginTTM"] ? { profitMargins: m["netProfitMarginTTM"] } : {}),
            metadata: {
              ...meta,
              finnhubFinancials: {
                // Valuation
                peRatio: m["peBasicExclExtraTTM"],
                forwardPE: m["peExclExtraTTM"],
                priceToSales: m["psTTM"],
                priceToBook: m["pbQuarterly"],
                evToEbitda: m["totalDebt/totalEquityQuarterly"],
                pegRatio: m["pegRatio"],
                // Profitability
                roe: m["roeTTM"],
                roa: m["roaTTM"],
                roic: m["roicTTM"],
                grossMargin: m["grossMarginTTM"],
                operatingMargin: m["operatingMarginTTM"],
                netMargin: m["netProfitMarginTTM"],
                // Growth
                epsGrowth: m["epsGrowthTTMYoy"],
                revenueGrowth: m["revenueGrowthQuarterlyYoy"],
                revenueGrowth3Y: m["revenueGrowth3Y"],
                revenueGrowth5Y: m["revenueGrowth5Y"],
                epsGrowth3Y: m["epsGrowth3Y"],
                epsGrowth5Y: m["epsGrowth5Y"],
                // Risk
                beta: m["beta"],
                debtToEquity: m["totalDebt/totalEquityQuarterly"],
                currentRatio: m["currentRatioQuarterly"],
                quickRatio: m["quickRatioQuarterly"],
                // Dividend
                dividendYield: m["currentDividendYieldTTM"],
                dividendGrowth5Y: m["dividendGrowthRate5Y"],
                payoutRatio: m["payoutRatioTTM"],
                // Price
                "52WeekHigh": m["52WeekHigh"],
                "52WeekLow": m["52WeekLow"],
                "52WeekHighDate": m["52WeekHighDate"],
                "52WeekLowDate": m["52WeekLowDate"],
                "10DayAvgVolume": m["10DayAverageTradingVolume"],
                "3MonthAvgVolume": m["3MonthAverageTradingVolume"],
                marketCap: m["marketCapitalization"],
              },
              finnhubFinancialsSync: new Date().toISOString(),
            } as Prisma.JsonObject,
          },
        });
        synced++;
      } catch {
        logger.debug({ symbol: asset.symbol }, "Basic financials sync failed");
      }
    }

    logger.info({ synced, duration: timer.endFormatted() }, "💰 Basic Financials sync complete");
  }

  // ── P2: Economic Calendar ─────────────────────────────────────────

  private static async syncEconomicCalendar(budget: RequestBudget) {
    budget.startPhase("economic");
    if (!budget.canProceed(1)) {
      logger.info({ budgetRemaining: budget.remaining }, "Economic Calendar: skipping — budget low");
      return;
    }
    const timer = createTimer();
    try {
      const events = await FinnhubService.getEconomicCalendar(daysAgo(1), daysAgo(-7));
      budget.consume(1);

      // Store in Redis as a global feed (not per-asset)
      const { setCache } = await import("@/lib/redis");
      await setCache("finnhub:economic_calendar", events, 3600);

      logger.info({ count: events.length, duration: timer.endFormatted() }, "🌍 Economic Calendar sync complete");
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "Economic calendar sync failed");
    }
  }

  // ── P2: IPO Calendar ──────────────────────────────────────────────

  private static async syncIPOCalendar(budget: RequestBudget) {
    budget.startPhase("ipo");
    if (!budget.canProceed(1)) {
      logger.info({ budgetRemaining: budget.remaining }, "IPO Calendar: skipping — budget low");
      return;
    }
    const timer = createTimer();
    try {
      const events = await FinnhubService.getIPOCalendar(daysAgo(7), daysAgo(-30));
      budget.consume(1);

      const { setCache } = await import("@/lib/redis");
      await setCache("finnhub:ipo_calendar", events, 86400);

      logger.info({ count: events.length, duration: timer.endFormatted() }, "🚀 IPO Calendar sync complete");
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "IPO calendar sync failed");
    }
  }

  // ── P2: ETF Enrichment ────────────────────────────────────────────

  private static async syncETFData(budget: RequestBudget) {
    budget.startPhase("etf");
    const timer = createTimer();
    const etfs = await prisma.asset.findMany({
      where: { type: AssetType.ETF },
      select: { id: true, symbol: true, metadata: true },
    });

    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const needsSync = etfs.filter(a => {
      const meta = (a.metadata as Record<string, unknown>) || {};
      const lastSync = (meta.finnhubETFSync as string) ? new Date(meta.finnhubETFSync as string).getTime() : 0;
      return Date.now() - lastSync > WEEK_MS;
    }).slice(0, PHASE_CAPS.ETF);

    if (needsSync.length === 0) {
      logger.info("ETF data: all fresh — skipping");
      return;
    }

    let synced = 0;
    for (const etf of needsSync) {
      // 2 sequential API calls per ETF
      if (!budget.canProceed(2)) {
        logger.warn({ synced, budgetRemaining: budget.remaining }, "ETF Data: budget exhausted — stopping early");
        break;
      }
      try {
        // Sequential to avoid bursting rate limit
        const profile = await FinnhubService.getETFProfile(etf.symbol);
        budget.consume(1);
        const holdings = await FinnhubService.getETFHoldings(etf.symbol);
        budget.consume(1);

        const meta = (etf.metadata as Record<string, unknown>) || {};
        const etfData: Record<string, unknown> = {};

        if (profile?.profile) {
          const p = profile.profile;
          etfData.profile = {
            name: p.name,
            assetClass: p.assetClass,
            aum: p.aum,
            expenseRatio: p.expenseRatio,
            dividendYield: p.dividendYield,
            trackingIndex: p.trackingIndex,
            inceptionDate: p.inceptionDate,
            isInverse: p.isInverse,
            isLeveraged: p.isLeveraged,
            investmentSegment: p.investmentSegment,
            etfCompany: p.etfCompany,
          };
        }

        if (holdings.length > 0) {
          etfData.topHoldings = holdings.slice(0, 15).map(h => ({
            symbol: h.symbol,
            name: h.name,
            percent: h.percent,
            value: h.value,
          }));
          etfData.holdingsCount = holdings.length;
        }

        await prisma.asset.update({
          where: { symbol: etf.symbol },
          data: {
            ...(profile?.profile?.expenseRatio ? { expenseRatio: profile.profile.expenseRatio } : {}),
            metadata: {
              ...meta,
              finnhubETF: etfData,
              finnhubETFSync: new Date().toISOString(),
            } as Prisma.JsonObject,
          },
        });
        synced++;
      } catch {
        logger.debug({ symbol: etf.symbol }, "ETF data sync failed");
      }
    }

    logger.info({ synced, duration: timer.endFormatted() }, "📦 ETF Data sync complete");
  }

  // ── P3: Peer Data ─────────────────────────────────────────────────

  private static async syncPeerData(budget: RequestBudget) {
    budget.startPhase("peers");
    const timer = createTimer();
    const usStocks = await prisma.asset.findMany({
      where: { region: "US", type: AssetType.STOCK },
      select: { id: true, symbol: true, metadata: true },
    });

    const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    const needsSync = usStocks.filter(a => {
      const meta = (a.metadata as Record<string, unknown>) || {};
      const lastSync = (meta.finnhubPeerSync as string) ? new Date(meta.finnhubPeerSync as string).getTime() : 0;
      return Date.now() - lastSync > MONTH_MS;
    }).slice(0, PHASE_CAPS.PEERS);

    if (needsSync.length === 0) {
      logger.info("Peer data: all fresh — skipping");
      return;
    }

    let synced = 0;
    for (const asset of needsSync) {
      if (!budget.canProceed(1)) {
        logger.warn({ synced, budgetRemaining: budget.remaining }, "Peer Data: budget exhausted — stopping early");
        break;
      }
      try {
        const peers = await FinnhubService.getPeers(asset.symbol);
        budget.consume(1);
        if (peers.length > 0) {
          const meta = (asset.metadata as Record<string, unknown>) || {};
          await prisma.asset.update({
            where: { symbol: asset.symbol },
            data: {
              metadata: {
                ...meta,
                finnhubPeers: peers,
                finnhubPeerSync: new Date().toISOString(),
              } as Prisma.JsonObject,
            },
          });
          synced++;
        }
      } catch {
        logger.debug({ symbol: asset.symbol }, "Peer data sync failed");
      }
    }

    logger.info({ synced, duration: timer.endFormatted() }, "🤝 Peer Data sync complete");
  }

  // ── P0: Market-wide News ──────────────────────────────────────────

  private static async syncMarketNews(budget: RequestBudget) {
    budget.startPhase("market_news");
    if (!budget.canProceed(2)) {
      logger.info({ budgetRemaining: budget.remaining }, "Market News: skipping — budget low");
      return;
    }
    const timer = createTimer();
    try {
      // Sequential to avoid bursting rate limit
      const generalNews = await FinnhubService.getMarketNews("general");
      budget.consume(1);
      const mergerNews = await FinnhubService.getMarketNews("merger");
      budget.consume(1);

      // Store in Redis for the timeline feed
      const { setCache } = await import("@/lib/redis");
      await setCache("finnhub:market_news", [...generalNews, ...mergerNews], 1800);

      logger.info({
        general: generalNews.length,
        merger: mergerNews.length,
        duration: timer.endFormatted(),
      }, "📡 Market News sync complete");
    } catch (err) {
      logger.error({ err: sanitizeError(err) }, "Market news sync failed");
    }
  }
}
