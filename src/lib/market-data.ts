import { OHLCV } from "./engines/types";
import { prisma } from "./prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { CoinGeckoService } from "./services/coingecko.service";
import { isCryptoSymbol, symbolToCoingeckoId } from "./services/coingecko-mapping";

const logger = createLogger({ service: "market-data" });

export interface MarketDataError {
  error: string;
  details?: unknown;
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
          logger.debug({ symbol }, "History is already up to date, skipping fetch");
          return [];
        }
      }
    }

    // Cryptocurrencies — use CoinGecko
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

    // Non-crypto symbols are not supported on this platform
    logger.warn({ symbol: query }, "Non-crypto symbol — no data source available");
    return [];
  } catch (error) {
    logger.error({ err: sanitizeError(error), symbol: symbol.toUpperCase() }, "Historical fetch failed");
    return [];
  }
}
