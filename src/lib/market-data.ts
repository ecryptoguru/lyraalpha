import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();
import type { QuoteSummaryModules } from "yahoo-finance2/modules/quoteSummary";

import { OHLCV } from "./engines/types";
import { prisma } from "./prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { CoinGeckoService } from "./services/coingecko.service";
import { isCryptoSymbol, symbolToCoingeckoId } from "./services/coingecko-mapping";

// Yahoo Finance Type Overrides/Definitions for strict typing
interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  marketCap?: number;
  regularMarketVolume?: number;
  averageDailyVolume10Day?: number;
  longName?: string;
  shortName?: string;
  fullExchangeName?: string;
  exchangeName?: string;
  quoteType?: string;
  currency?: string;
  trailingPE?: number;
  dividendYield?: number;
  beta?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekChangePercent?: number;
  epsTrailingTwelveMonths?: number;
  priceToBook?: number;
  shortRatio?: number;
  returnOnEquity?: number;
  forwardPE?: number;
  averageDailyVolume3Month?: number;
  trailingPegRatio?: number;
  // Crypto specific
  openInterest?: number;
  expireDate?: string;
  circulatingSupply?: number;
  maxSupply?: number;
  volume24Hr?: number;
  startDate?: string;
  coinImageUrl?: string;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  underlyingSymbol?: string;
  pegRatio?: number;
}

interface YahooHistoryQuote {
  date: Date;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
  adjclose?: number | null;
}

interface YahooSummary {
  defaultKeyStatistics?: {
    pegRatio?: number;
    trailingEps?: number;
    "52WeekChange"?: number;
    shortRatio?: number;
    priceToBook?: number;
    annualReportExpenseRatio?: number;
    navPrice?: number;
    yield?: number;
    morningStarOverallRating?: number;
    heldPercentInstitutions?: number;
    heldPercentInsiders?: number;
    profitMargins?: number;
    bookValue?: number;
  };
  financialData?: {
    returnOnEquity?: number;
    currentPrice?: number;
    targetMeanPrice?: number;
    targetHighPrice?: number;
    targetLowPrice?: number;
    numberOfAnalystOpinions?: number;
    freeCashflow?: number;
    operatingMargins?: number;
    profitMargins?: number;
    returnOnAssets?: number;
    debtToEquity?: number;
    currentRatio?: number;
    revenueGrowth?: number;
  };
  summaryDetail?: {
    trailingPE?: number;
    forwardPE?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    dividendYield?: number;
    marketCap?: number;
    volume?: number;
    averageVolume?: number;
    beta?: number;
    openInterest?: number;
    circulatingSupply?: number;
    volume24Hr?: number;
    dayLow?: number;
    dayHigh?: number;
    yield?: number;
    category?: string;
    navPrice?: number;
    priceToSales?: number;
  };
  earningsTrend?: {
    trend?: Array<{
        period: string;
        growth?: number;
    }>;
  };
  fundProfile?: {
    categoryName?: string;
    category?: string;
    feesExpensesInvestment?: {
      annualReportExpenseRatio?: number;
    };
  };
  assetProfile?: {
    longBusinessSummary?: string;
    industry?: string;
    sector?: string;
    website?: string;
    fullTimeEmployees?: number;
    city?: string;
    country?: string;
    companyOfficers?: Array<{
      name?: string;
      title?: string;
    }>;
  };
  topHoldings?: {
    holdings?: Array<{
      symbol?: string;
      holdingName?: string;
      holdingPercent?: { raw?: number };
    }>;
    sectorWeightings?: Array<Record<string, { raw?: number }>>;
    equityHoldings?: {
      priceToEarnings?: { raw?: number };
      priceToBook?: { raw?: number };
      priceToSales?: { raw?: number };
      priceToCashflow?: { raw?: number };
      medianMarketCap?: { raw?: number };
      threeYearEarningsGrowth?: { raw?: number };
    };
    bondHoldings?: {
      maturity?: { raw?: number };
      duration?: { raw?: number };
      creditQuality?: { raw?: number };
    };
  };
  fundPerformance?: {
    performanceOverview?: {
      oneYearTotalReturn?: { raw?: number };
      threeYearTotalReturn?: { raw?: number };
      fiveYearTotalReturn?: { raw?: number };
      tenYearTotalReturn?: { raw?: number };
      ytdReturnPct?: { raw?: number };
      bestThreeYrTotalReturn?: { raw?: number };
      worstThreeYrTotalReturn?: { raw?: number };
    };
    trailingReturns?: Record<string, { raw?: number }>;
  };
}

const logger = createLogger({ service: "market-data" });

export interface MarketDataError {
  error: string;
  details?: unknown;
}

export interface YahooSearchNewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  type: string;
}

export interface YahooSearchResponse {
  news: YahooSearchNewsItem[];
}



export function getRawValue(val: unknown): number | string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "object" && val !== null && "raw" in val) {
    return (val as { raw: number | string }).raw;
  }
  return val as number | string;
}

export async function fetchAssetData(
  symbol: string,
  _range: string = "1y",
  fetchNew: boolean = false
): Promise<OHLCV[] | MarketDataError> {
  try {
    void _range;
    const query = symbol.toUpperCase();
    const asset = await prisma.asset.findUnique({
        where: { symbol: query },
        select: { id: true, type: true, metadata: true, region: true, coingeckoId: true }
    });

    if (asset && !fetchNew) {
        const historyData = await prisma.priceHistory.findMany({
            where: { assetId: asset.id },
            orderBy: { date: 'asc' }
        });

        if (historyData.length > 0) {
            return historyData.map(h => ({
                date: h.date.toISOString(),
                open: h.open,
                high: h.high,
                low: h.low,
                close: h.close,
                volume: h.volume
            }));
        }
    }

    const now = Math.floor(Date.now() / 1000);
    let period1 = now - (365 * 24 * 60 * 60); // Default to 1y

    if (asset && fetchNew) {
      const lastHistory = await prisma.priceHistory.findFirst({
        where: { assetId: asset.id },
        orderBy: { date: 'desc' },
        select: { date: true }
      });
      if (lastHistory) {
        // Fetch from last recorded date + 1 day to avoid overlap
        period1 = Math.floor(lastHistory.date.getTime() / 1000) + 86400;
        
        // If the gap is less than a day, we might already have the data
        if (period1 >= now - 3600) {
          logger.debug({ symbol }, "History is already up to date, skipping Yahoo fetch");
          return [];
        }
      }
    }

    // INTERCEPT: Cryptocurrencies — use CoinGecko instead of Yahoo Finance
    if (isCryptoSymbol(query)) {
      const cgId = asset?.coingeckoId || symbolToCoingeckoId(query);
      if (cgId) {
        const chart = await CoinGeckoService.getMarketChart(cgId, 365);
        if (chart && chart.prices.length > 0) {
          return CoinGeckoService.marketChartToOHLCV(chart);
        }
      }
      // Fallback: return DB history if CoinGecko fails
      if (asset) {
        const historyData = await prisma.priceHistory.findMany({
          where: { assetId: asset.id },
          orderBy: { date: "asc" },
        });
        if (historyData.length > 0) {
          return historyData.map((h) => ({
            date: h.date.toISOString(),
            open: h.open,
            high: h.high,
            low: h.low,
            close: h.close,
            volume: h.volume,
          }));
        }
      }
      logger.warn({ symbol: query }, "CoinGecko history unavailable for crypto asset");
      return [];
    }

    const result = await yahooFinance.chart(query, {
      period1,
      period2: now,
      interval: "1d",
    }) as unknown as { quotes?: YahooHistoryQuote[] };

    const quotes = (result.quotes || []).map((quote: YahooHistoryQuote) => {
      // Normalize date to start of day UTC
      const d = new Date(quote.date);
      d.setUTCHours(0, 0, 0, 0);
      
      return {
        date: d.toISOString(),
        open: quote.open || 0,
        high: quote.high || 0,
        low: quote.low || 0,
        close: quote.close || 0,
        volume: quote.volume || 0,
      };
    });

    // Remove any overlapping records that might have been fetched if they exist in the result set
    return Array.from(new Map(quotes.map(q => [q.date, q])).values());
  } catch (error) {
    logger.error({ err: sanitizeError(error), symbol: symbol.toUpperCase() }, "Historical fetch failed");
    // Never return synthetic data to users — it could be mistaken for real prices.
    // Return an empty array for user-facing requests so the UI handles it gracefully.
    return [];
  }
}

/**
 * Fetches batch quotes for the universe.
 * Automatically chunks requests to avoid URL length limits.
 */
export async function getQuotes(symbols: string[]): Promise<YahooQuote[]> {
  try {
    const BATCH_SIZE = 100; // Safe batch size for Yahoo Finance URL length
    const chunks = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      chunks.push(symbols.slice(i, i + BATCH_SIZE));
    }


    const results = await Promise.all(
      chunks.map((chunk) => yahooFinance.quote(chunk))
    );
    const allQuotes: YahooQuote[] = results.flatMap((result) =>
      Array.isArray(result)
        ? (result as unknown as YahooQuote[])
        : result
        ? [(result as unknown as YahooQuote)]
        : []
    );

    return allQuotes;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Batch quote fetch failed");
    return [];
  }
}

/**
 * Fetches deep institutional summary
 */
export async function fetchInstitutionalSummary(symbol: string, includeExtended: boolean = false): Promise<YahooSummary | null> {
  try {
    const baseModules = ["defaultKeyStatistics", "financialData", "summaryDetail", "earningsTrend", "fundProfile"] as const;
    const extendedModules = [...baseModules, "assetProfile", "topHoldings", "fundPerformance"] as const;
    const modules = includeExtended ? [...extendedModules] : [...baseModules];
    const result = await yahooFinance.quoteSummary(symbol, {
      modules: modules as unknown as QuoteSummaryModules[],
    }, { validateResult: false });
    return result as unknown as YahooSummary;
  } catch (error) {
    logger.error({ err: sanitizeError(error), symbol }, "Institutional summary fetch failed");
    return null;
  }
}

/**
 * Fetches financial statement data using the fundamentalsTimeSeries API.
 * Returns latest annual data for income statement, balance sheet, and cash flow.
 * Much cleaner than quoteSummary — values are plain numbers, no .raw unwrapping.
 */
export interface FundamentalsData {
  incomeStatement?: {
    period?: string;
    totalRevenue?: number | null;
    grossProfit?: number | null;
    operatingIncome?: number | null;
    netIncome?: number | null;
    ebitda?: number | null;
    operatingExpense?: number | null;
    researchAndDevelopment?: number | null;
    basicEPS?: number | null;
    dilutedEPS?: number | null;
  };
  balanceSheet?: {
    period?: string;
    totalAssets?: number | null;
    totalLiabilities?: number | null;
    totalEquity?: number | null;
    cash?: number | null;
    currentAssets?: number | null;
    currentLiabilities?: number | null;
    longTermDebt?: number | null;
    totalDebt?: number | null;
    workingCapital?: number | null;
    retainedEarnings?: number | null;
  };
  cashflow?: {
    period?: string;
    operatingCashflow?: number | null;
    capitalExpenditures?: number | null;
    freeCashFlow?: number | null;
    financingCashFlow?: number | null;
    investingCashFlow?: number | null;
    dividendsPaid?: number | null;
    repurchaseOfCapitalStock?: number | null;
  };
  debtToEquity?: number | null;
  currentRatio?: number | null;
}

export async function fetchFundamentals(symbol: string): Promise<FundamentalsData | null> {
  try {
    // Fetch latest 2 years of annual data (module='all' gets financials + balance sheet + cash flow)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const results = await yahooFinance.fundamentalsTimeSeries(symbol, {
      period1: twoYearsAgo.toISOString().split("T")[0],
      type: "annual",
      module: "all",
    }, { validateResult: false }) as unknown as Record<string, unknown>[];

    if (!results || results.length === 0) {
      return null;
    }

    // Get the latest period (last element, sorted by date)
    const sorted = [...results].sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());
    const latest = sorted[sorted.length - 1];
    const period = latest.date ? new Date(latest.date as string).toISOString().split("T")[0] : undefined;

    const asNum = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;

    const data: FundamentalsData = {};

    // Income Statement
    if (latest.totalRevenue != null || latest.netIncome != null) {
      data.incomeStatement = {
        period,
        totalRevenue: asNum(latest.totalRevenue),
        grossProfit: asNum(latest.grossProfit),
        operatingIncome: asNum(latest.operatingIncome),
        netIncome: asNum(latest.netIncome),
        ebitda: asNum(latest.EBITDA) ?? asNum(latest.normalizedEBITDA),
        operatingExpense: asNum(latest.operatingExpense),
        researchAndDevelopment: asNum(latest.researchAndDevelopment),
        basicEPS: asNum(latest.basicEPS),
        dilutedEPS: asNum(latest.dilutedEPS),
      };
    }

    // Balance Sheet
    if (latest.totalAssets != null || latest.stockholdersEquity != null) {
      const totalEquity = asNum(latest.stockholdersEquity) ?? asNum(latest.commonStockEquity);
      const totalDebt = asNum(latest.totalDebt);
      const currentAssets = asNum(latest.currentAssets);
      const currentLiabilities = asNum(latest.currentLiabilities);

      data.balanceSheet = {
        period,
        totalAssets: asNum(latest.totalAssets),
        totalLiabilities: asNum(latest.totalLiabilitiesNetMinorityInterest),
        totalEquity,
        cash: asNum(latest.cashAndCashEquivalents) ?? asNum(latest.cashCashEquivalentsAndShortTermInvestments),
        currentAssets,
        currentLiabilities,
        longTermDebt: asNum(latest.longTermDebt),
        totalDebt,
        workingCapital: asNum(latest.workingCapital),
        retainedEarnings: asNum(latest.retainedEarnings),
      };

      // Derived ratios
      if (totalEquity && totalEquity !== 0 && totalDebt != null) {
        data.debtToEquity = (totalDebt / totalEquity) * 100;
      }
      if (currentAssets && currentLiabilities && currentLiabilities !== 0) {
        data.currentRatio = currentAssets / currentLiabilities;
      }
    }

    // Cash Flow
    if (latest.operatingCashFlow != null || latest.freeCashFlow != null) {
      data.cashflow = {
        period,
        operatingCashflow: asNum(latest.operatingCashFlow),
        capitalExpenditures: asNum(latest.capitalExpenditure),
        freeCashFlow: asNum(latest.freeCashFlow),
        financingCashFlow: asNum(latest.financingCashFlow),
        investingCashFlow: asNum(latest.investingCashFlow),
        dividendsPaid: asNum(latest.cashDividendsPaid) ?? asNum(latest.commonStockDividendPaid),
        repurchaseOfCapitalStock: asNum(latest.repurchaseOfCapitalStock),
      };
    }

    return Object.keys(data).length > 0 ? data : null;
  } catch (error) {
    logger.error({ err: sanitizeError(error), symbol }, "Fundamentals time series fetch failed");
    return null;
  }
}

/**
 * Fetches latest news for an asset
 */
export async function fetchAssetNews(symbol: string, newsCount: number = 5) {
  try {
    const result = (await yahooFinance.search(symbol, { newsCount })) as unknown as YahooSearchResponse;
    return result.news || [];
  } catch (error) {
    logger.error({ err: sanitizeError(error), symbol }, "News fetch failed");
    return [];
  }
}
