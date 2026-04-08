export interface MarketQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent?: number;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  fiftyTwoWeekChangePercent?: number;
  longName?: string;
  shortName?: string;
  currency?: string;
  exchange?: string;
  timestamp?: number;
  regularMarketVolume?: number;
  averageDailyVolume10Day?: number;
  averageDailyVolume3Month?: number;
  dividendYield?: number;
  beta?: number;
  trailingPegRatio?: number;
  epsTrailingTwelveMonths?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  shortRatio?: number;
  priceToBook?: number;
  returnOnEquity?: number;
  sector?: string;
  industry?: string;
}
