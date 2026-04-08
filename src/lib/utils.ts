import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Async sleep helper. Prefer this over inline `new Promise(setTimeout)`.
 * @example await wait(500) // pauses for 500ms
 */
export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));


/**
 * Region-aware number formatting.
 * US: M (Million), B (Billion), T (Trillion) with $
 * IN: L (Lakh), Cr (Crore), L Cr (Lakh Crore) with ₹
 */
export type RegionFormat = "US" | "IN";

/**
 * Formats a market cap string/number into human-readable scale.
 * US: $1.5B, $2.8T, $500M
 * IN: ₹1.5L Cr, ₹2,800Cr, ₹500Cr
 */
export function formatMarketCap(
  value: string | number | null | undefined,
  symbol: string = "$",
  region: RegionFormat = "US",
): string {
  return formatCompactNumber(value, { isCurrency: true, symbol, region });
}

/**
 * Formats a number using Indian notation (Lakhs / Crores).
 * 1 Lakh = 1,00,000 (1e5)
 * 1 Crore = 1,00,00,000 (1e7)
 * 1 Lakh Crore = 1,00,00,00,00,000 (1e12)
 */
function formatIndianCompact(num: number, symbol: string = "₹"): string {
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1e12) return `${sign}${symbol}${(abs / 1e12).toFixed(2)} Lac Cr`;
  if (abs >= 1e7) return `${sign}${symbol}${Math.round(abs / 1e7).toLocaleString("en-IN")} Cr`;
  if (abs >= 1e5) return `${sign}${symbol}${(abs / 1e5).toFixed(2)} Lac`;
  if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(2)} K`;
  return `${sign}${symbol}${abs.toLocaleString("en-IN")}`;
}

/**
 * Global compact number formatter — region-aware.
 * Use for market cap, volume, or any large number display.
 * Replaces local `formatShortValue` helpers.
 */
export function formatCompactNumber(
  val: string | number | null | undefined,
  options: {
    isCurrency?: boolean;
    symbol?: string;
    region?: RegionFormat;
  } = {},
): string {
  if (val === null || val === undefined || val === "—") return "—";

  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";

  const { isCurrency = true, symbol = "$", region = "US" } = options;
  const prefix = isCurrency ? symbol : "";

  if (region === "IN") {
    if (!isCurrency) {
      const abs = Math.abs(num);
      if (abs >= 1e12) return `${(abs / 1e12).toFixed(2)} Lac Cr`;
      if (abs >= 1e7) return `${Math.round(abs / 1e7).toLocaleString("en-IN")} Cr`;
      if (abs >= 1e5) return `${(abs / 1e5).toFixed(2)} Lac`;
      if (abs >= 1e3) return `${(abs / 1e3).toFixed(2)} K`;
      return abs.toLocaleString("en-IN");
    }
    return formatIndianCompact(num, symbol);
  }

  if (num >= 1e12) return `${prefix}${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${prefix}${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${prefix}${(num / 1e6).toFixed(2)}M`;
  return isCurrency ? `${symbol}${num.toLocaleString()}` : num.toLocaleString();
}

/**
 * Formats a price value with the correct currency symbol.
 * IN region uses Indian locale grouping (1,23,456.78).
 */
export function formatPrice(
  value: number | null | undefined,
  options: {
    symbol?: string;
    region?: RegionFormat;
    decimals?: number;
  } = {},
): string {
  if (value === null || value === undefined) return "—";

  const { symbol = "$", region = "US", decimals = 2 } = options;
  const locale = region === "IN" ? "en-IN" : "en-US";

  return `${symbol}${value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Returns the correct currency symbol and region format based on asset currency.
 * Utility for components that receive currency from the API.
 */
export function getCurrencyConfig(currency: string): {
  symbol: string;
  region: RegionFormat;
} {
  if (currency === "INR") return { symbol: "₹", region: "IN" };
  return { symbol: "$", region: "US" };
}

/**
 * Computes a safe 0-100 position for an in-range marker.
 * Returns 50 (neutral center) when dayHigh equals dayLow.
 */
export function computeRangePositionPercent(
  value: number,
  low: number,
  high: number,
): number {
  const span = high - low;
  if (span === 0) return 50;

  const raw = ((value - low) / span) * 100;
  return Math.min(100, Math.max(0, raw));
}

/**
 * Converts raw market regime labels into plain-English descriptions.
 * Used across dashboard, regime cards, and metric displays.
 */
export function humanizeRegimeLabel(label: string): string {
  const map: Record<string, string> = {
    STRONG_RISK_ON: "Market Rising Strongly",
    RISK_ON: "Market Trending Up",
    MILD_RISK_ON: "Market Leaning Up",
    NEUTRAL: "Market Mixed",
    MILD_RISK_OFF: "Market Leaning Down",
    DEFENSIVE: "Cautious Market",
    RISK_OFF: "Market Declining",
    STRONG_RISK_OFF: "Market Falling Sharply",
    CRISIS: "Market Under Stress",
    RECOVERY: "Market Recovering",
    TRENDING_UP: "Trending Up",
    TRENDING_DOWN: "Trending Down",
    SIDEWAYS: "Moving Sideways",
    HIGH_VOLATILITY: "High Volatility",
    LOW_VOLATILITY: "Low Volatility",
  };
  const key = label.toUpperCase().replace(/ /g, "_");
  return map[key] ?? label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolves error state for analytics sync flows.
 * Keeps existing error when cached analytics is already available.
 */
export function resolveAnalyticsSyncError(
  previousError: string | null,
  hasAnalytics: boolean,
  error: unknown,
): string | null {
  if (hasAnalytics) return previousError;
  return error instanceof Error ? error.message : "Synchronization cycle interrupted";
}
