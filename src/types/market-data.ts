export interface MarketQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent?: number;
  marketCap?: number;
  fiftyTwoWeekChangePercent?: number;
  regularMarketVolume?: number;
  averageDailyVolume10Day?: number;
  averageDailyVolume3Month?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
}
