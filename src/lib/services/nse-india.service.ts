/**
 * NSE India Price Fetcher
 *
 * Fetches real-time stock quotes from NSE India's unofficial API.
 * Handles cookie/session management required by NSE's anti-bot protection.
 *
 * Endpoints used:
 *   - GET https://www.nseindia.com  (to get session cookies)
 *   - GET https://www.nseindia.com/api/quote-equity?symbol=RELIANCE
 *   - GET https://www.nseindia.com/api/marketStatus
 */

import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";

const logger = createLogger({ service: "nse-india" });

const NSE_BASE_URL = "https://www.nseindia.com";
const NSE_API_URL = `${NSE_BASE_URL}/api`;

// Common browser headers to avoid 403
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

export interface NSEQuote {
  // Price
  symbol: string;
  companyName: string;
  lastPrice: number;
  change: number;
  pChange: number;
  open: number;
  close: number;
  previousClose: number;
  vwap: number;
  dayHigh: number;
  dayLow: number;
  yearHigh: number;
  yearLow: number;

  // Shares & Market Cap
  issuedSize: number;          // Total shares outstanding
  faceValue: number;
  marketCapAbs: number;        // lastPrice × issuedSize (absolute INR)
  totalMarketCapCr: number;    // NSE-reported market cap (₹ Cr)
  ffmcCr: number;              // Free-float market cap (₹ Cr)

  // Volume & Trade
  totalTradedVolume: number;   // In Lakhs
  quantityTraded: number;      // Actual shares traded
  totalTradedValueCr: number;  // ₹ Cr
  deliveryQuantity: number;
  deliveryPercent: number;     // Delivery-to-traded %

  // Volatility & Risk
  dailyVolatility: number;     // %
  annualVolatility: number;    // %
  impactCost: number;          // Liquidity quality
  securityVar: number;         // Value at Risk %

  // Fundamentals from NSE
  symbolPe: number;            // Stock P/E from NSE
  sectorPe: number;            // Sector P/E from NSE
  isFnO: boolean;              // F&O eligible
  isin: string;
  listingDate: string;

  // Industry (4-level hierarchy)
  industryMacro: string;       // e.g. "Energy"
  industrySector: string;      // e.g. "Oil Gas & Consumable Fuels"
  industryGroup: string;       // e.g. "Petroleum Products"
  industryBasic: string;       // e.g. "Refineries & Marketing"

  // Index membership
  niftyIndices: string[];      // All NIFTY indices this stock belongs to
}

// Session management
let cachedCookies: string | null = null;
let cookieExpiry: number = 0;
const COOKIE_TTL_MS = 4 * 60 * 1000; // 4 minutes (NSE cookies expire ~5 min)

/**
 * Gets a fresh session cookie from NSE India homepage.
 * NSE requires cookies from the main page before API calls work.
 */
async function getSessionCookies(): Promise<string> {
  const now = Date.now();
  if (cachedCookies && now < cookieExpiry) {
    return cachedCookies;
  }

  logger.debug("Refreshing NSE session cookies...");

  const res = await fetch(NSE_BASE_URL, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`NSE homepage returned ${res.status}`);
  }

  // Extract Set-Cookie headers
  const setCookieHeaders = res.headers.getSetCookie?.() || [];
  
  // Fallback: try raw header
  let cookies: string;
  if (setCookieHeaders.length > 0) {
    cookies = setCookieHeaders
      .map((c: string) => c.split(";")[0])
      .join("; ");
  } else {
    // Some environments don't support getSetCookie
    const rawCookie = res.headers.get("set-cookie") || "";
    cookies = rawCookie
      .split(",")
      .map((c: string) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
  }

  if (!cookies) {
    // Consume body to avoid memory leak
    await res.text();
    throw new Error("No cookies received from NSE");
  }

  // Consume body
  await res.text();

  cachedCookies = cookies;
  cookieExpiry = now + COOKIE_TTL_MS;
  logger.debug({ cookieLength: cookies.length }, "NSE session cookies refreshed");
  return cookies;
}

/**
 * Makes an authenticated API call to NSE India.
 */
async function nseApiFetch<T>(path: string): Promise<T> {
  const cookies = await getSessionCookies();

  const res = await fetch(`${NSE_API_URL}${path}`, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: "application/json, text/plain, */*",
      Referer: `${NSE_BASE_URL}/get-quotes/equity?symbol=RELIANCE`,
      Cookie: cookies,
    },
  });

  if (res.status === 401 || res.status === 403) {
    // Cookie expired, clear cache and retry once
    cachedCookies = null;
    cookieExpiry = 0;
    const freshCookies = await getSessionCookies();

    const retryRes = await fetch(`${NSE_API_URL}${path}`, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "application/json, text/plain, */*",
        Referer: `${NSE_BASE_URL}/get-quotes/equity?symbol=RELIANCE`,
        Cookie: freshCookies,
      },
    });

    if (!retryRes.ok) {
      const text = await retryRes.text();
      throw new Error(`NSE API ${path} returned ${retryRes.status}: ${text.slice(0, 200)}`);
    }

    return retryRes.json() as Promise<T>;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NSE API ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Fetches a single equity quote from NSE India.
 * Symbol should be the NSE trading symbol (e.g., "RELIANCE", not "RELIANCE.NS").
 */
export async function fetchNSEQuote(nseSymbol: string): Promise<NSEQuote | null> {
  try {
    // Fetch main quote + trade info in parallel
    const [quoteData, tradeData] = await Promise.all([
      nseApiFetch<{
        info: { symbol: string; companyName: string; isFNOSec: boolean; isin: string; listingDate: string };
        metadata: { pdSectorPe: number; pdSymbolPe: number; pdSectorIndAll: string[] };
        priceInfo: {
          lastPrice: number; change: number; pChange: number;
          open: number; close: number; vwap: number; previousClose: number;
          intraDayHighLow: { min: number; max: number };
          weekHighLow: { min: number; max: number };
        };
        securityInfo?: { faceValue?: number; issuedSize?: number };
        industryInfo?: { macro?: string; sector?: string; industry?: string; basicIndustry?: string };
      }>(`/quote-equity?symbol=${encodeURIComponent(nseSymbol)}`),
      nseApiFetch<{
        marketDeptOrderBook?: {
          tradeInfo?: {
            totalTradedVolume: number; totalTradedValue: number;
            totalMarketCap: number; ffmc: number;
            impactCost: number; cmDailyVolatility: string; cmAnnualVolatility: string;
          };
          valueAtRisk?: { securityVar: number };
        };
        securityWiseDP?: {
          quantityTraded: number; deliveryQuantity: number;
          deliveryToTradedQuantity: number;
        };
      }>(`/quote-equity?symbol=${encodeURIComponent(nseSymbol)}&section=trade_info`).catch(() => null),
    ]);

    if (!quoteData?.priceInfo?.lastPrice) {
      logger.warn({ nseSymbol }, "NSE returned empty quote");
      return null;
    }

    const issuedSize = quoteData.securityInfo?.issuedSize || 0;
    const marketCapAbs = quoteData.priceInfo.lastPrice * issuedSize;
    const ti = tradeData?.marketDeptOrderBook?.tradeInfo;
    const dp = tradeData?.securityWiseDP;
    const var_ = tradeData?.marketDeptOrderBook?.valueAtRisk;

    return {
      symbol: quoteData.info.symbol,
      companyName: quoteData.info.companyName,
      lastPrice: quoteData.priceInfo.lastPrice,
      change: quoteData.priceInfo.change,
      pChange: quoteData.priceInfo.pChange,
      open: quoteData.priceInfo.open,
      close: quoteData.priceInfo.close || 0,
      dayHigh: quoteData.priceInfo.intraDayHighLow?.max || 0,
      dayLow: quoteData.priceInfo.intraDayHighLow?.min || 0,
      previousClose: quoteData.priceInfo.previousClose,
      vwap: quoteData.priceInfo.vwap || 0,
      yearHigh: quoteData.priceInfo.weekHighLow?.max || 0,
      yearLow: quoteData.priceInfo.weekHighLow?.min || 0,
      issuedSize,
      faceValue: quoteData.securityInfo?.faceValue || 0,
      marketCapAbs,
      totalMarketCapCr: ti?.totalMarketCap || 0,
      ffmcCr: ti?.ffmc || 0,
      totalTradedVolume: ti?.totalTradedVolume || 0,
      quantityTraded: dp?.quantityTraded || 0,
      totalTradedValueCr: ti?.totalTradedValue || 0,
      deliveryQuantity: dp?.deliveryQuantity || 0,
      deliveryPercent: dp?.deliveryToTradedQuantity || 0,
      dailyVolatility: parseFloat(ti?.cmDailyVolatility || "0"),
      annualVolatility: parseFloat(ti?.cmAnnualVolatility || "0"),
      impactCost: ti?.impactCost || 0,
      securityVar: var_?.securityVar || 0,
      symbolPe: quoteData.metadata?.pdSymbolPe || 0,
      sectorPe: quoteData.metadata?.pdSectorPe || 0,
      isFnO: quoteData.info.isFNOSec || false,
      isin: quoteData.info.isin || "",
      listingDate: quoteData.info.listingDate || "",
      industryMacro: quoteData.industryInfo?.macro || "",
      industrySector: quoteData.industryInfo?.sector || "",
      industryGroup: quoteData.industryInfo?.industry || "",
      industryBasic: quoteData.industryInfo?.basicIndustry || "",
      niftyIndices: quoteData.metadata?.pdSectorIndAll || [],
    };
  } catch (err) {
    logger.error({ err: sanitizeError(err), nseSymbol }, "Failed to fetch NSE quote");
    return null;
  }
}

/**
 * Fetches quotes for multiple Indian stocks from NSE India.
 * Handles rate limiting with delays between requests.
 *
 * @param symbols - Array of Yahoo-style symbols (e.g., "RELIANCE.NS")
 * @returns Map of symbol → NSEQuote
 */
export async function fetchNSEQuotes(
  symbols: string[],
  options: { delayMs?: number; batchSize?: number } = {},
): Promise<Map<string, NSEQuote>> {
  const { delayMs = 350, batchSize = 5 } = options;
  const results = new Map<string, NSEQuote>();

  // Convert Yahoo symbols to NSE symbols: "RELIANCE.NS" → "RELIANCE"
  const symbolPairs = symbols.map((s) => ({
    yahoo: s,
    nse: s.replace(/\.NS$/, "").replace(/\.BO$/, ""),
  }));

  logger.info({ count: symbolPairs.length }, "Fetching Indian stock quotes from NSE India...");

  // Process in small batches with delays to respect rate limits
  for (let i = 0; i < symbolPairs.length; i += batchSize) {
    const batch = symbolPairs.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(async ({ yahoo, nse }) => {
        const quote = await fetchNSEQuote(nse);
        if (quote) {
          results.set(yahoo, quote);
        }
      }),
    );

    // Log any failures
    batchResults.forEach((r, idx) => {
      if (r.status === "rejected") {
        logger.warn({ symbol: batch[idx].yahoo, error: r.reason }, "NSE quote fetch failed");
      }
    });

    // Rate limit delay between batches
    if (i + batchSize < symbolPairs.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  logger.info({ fetched: results.size, total: symbols.length }, "NSE India quotes fetched");
  return results;
}

/**
 * Checks if NSE market is currently open.
 * NSE trading hours: 9:15 AM - 3:30 PM IST (Mon-Fri)
 */
export function isNSEMarketOpen(): boolean {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);

  const day = ist.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // 9:15 AM = 555 min, 3:30 PM = 930 min
  return timeInMinutes >= 555 && timeInMinutes <= 930;
}

/**
 * Checks if we should sync Indian stocks based on time.
 * Allows sync on weekdays to fetch latest available NSE data (end-of-day or intraday).
 * Skips weekends when NSE is closed.
 */
export function shouldSyncIndianStocks(): boolean {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);

  const day = ist.getDay();
  // Skip weekends (NSE closed)
  if (day === 0 || day === 6) return false;

  // Allow sync on weekdays regardless of time
  // NSE API returns latest available data (end-of-day or live during market hours)
  return true;
}
