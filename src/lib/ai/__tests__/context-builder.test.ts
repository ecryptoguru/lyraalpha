/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { buildCompressedContext, extractMentionedSymbols } from "../context-builder";

describe("Context Builder — buildCompressedContext", () => {
  describe("asset identity", () => {
    it("includes symbol, name, and type", () => {
      const result = buildCompressedContext({
        symbol: "AAPL",
        assetName: "Apple Inc.",
        assetType: "STOCK",
        scores: {},
      });
      expect(result).toContain("[ASSET] AAPL | Apple Inc. | Type: STOCK");
    });

    it("defaults to GLOBAL when no symbol", () => {
      const result = buildCompressedContext({ scores: {} });
      expect(result).toContain("[ASSET] GLOBAL | GLOBAL | Type: UNKNOWN");
    });
  });

  describe("#5 — real-time price injection", () => {
    it("injects price data when provided", () => {
      const result = buildCompressedContext(
        { symbol: "NVDA", assetName: "NVIDIA", assetType: "STOCK", scores: {} },
        {
          priceData: {
            price: 142.3,
            changePercent: 2.15,
            fiftyTwoWeekHigh: 156.8,
            fiftyTwoWeekLow: 90.12,
            lastPriceUpdate: null,
          },
        },
      );
      expect(result).toContain("[PRICE]");
      expect(result).toContain("Price:$142.30");
      expect(result).toContain("Change:+2.15%");
      expect(result).toContain("52W:$90.12-$156.80");
    });

    it("shows negative change with minus sign", () => {
      const result = buildCompressedContext(
        { symbol: "TSLA", scores: {} },
        {
          priceData: {
            price: 250.0,
            changePercent: -3.45,
            fiftyTwoWeekHigh: null,
            fiftyTwoWeekLow: null,
            lastPriceUpdate: null,
          },
        },
      );
      expect(result).toContain("Change:-3.45%");
      expect(result).not.toContain("52W:");
    });

    it("shows update age in minutes when recent", () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const result = buildCompressedContext(
        { symbol: "AAPL", scores: {} },
        {
          priceData: {
            price: 180.5,
            changePercent: 0.5,
            fiftyTwoWeekHigh: null,
            fiftyTwoWeekLow: null,
            lastPriceUpdate: tenMinutesAgo,
          },
        },
      );
      expect(result).toMatch(/Updated:\d+m ago/);
    });

    it("shows update age in hours when old", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const result = buildCompressedContext(
        { symbol: "AAPL", scores: {} },
        {
          priceData: {
            price: 180.5,
            changePercent: 0.5,
            fiftyTwoWeekHigh: null,
            fiftyTwoWeekLow: null,
            lastPriceUpdate: threeHoursAgo,
          },
        },
      );
      expect(result).toMatch(/Updated:\d+h ago/);
    });

    it("omits [PRICE] when price is null", () => {
      const result = buildCompressedContext(
        { symbol: "AAPL", scores: {} },
        { priceData: { price: null, changePercent: null, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, lastPriceUpdate: null } },
      );
      expect(result).not.toContain("[PRICE]");
    });

    it("omits [PRICE] when priceData is undefined", () => {
      const result = buildCompressedContext({ symbol: "AAPL", scores: {} });
      expect(result).not.toContain("[PRICE]");
    });

    it("handles zero price change correctly", () => {
      const result = buildCompressedContext(
        { symbol: "AAPL", scores: {} },
        { priceData: { price: 100.0, changePercent: 0, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, lastPriceUpdate: null } },
      );
      expect(result).toContain("Change:+0.00%");
    });
  });

  describe("engine scores", () => {
    it("includes non-null scores", () => {
      const result = buildCompressedContext({
        symbol: "AAPL",
        scores: { trend: 82, momentum: 71, volatility: 65 },
      });
      expect(result).toContain("[ENGINE_SCORES]");
      expect(result).toContain("Trend:82");
      expect(result).toContain("Momentum:71");
      expect(result).toContain("Volatility:65");
    });

    it("omits null scores", () => {
      const result = buildCompressedContext({
        symbol: "AAPL",
        scores: { trend: 82, momentum: null, volatility: undefined },
      });
      expect(result).toContain("Trend:82");
      expect(result).not.toContain("Momentum");
      expect(result).not.toContain("Volatility");
    });

    it("omits [ENGINE_SCORES] when all scores are null", () => {
      const result = buildCompressedContext({ symbol: "AAPL", scores: {} });
      expect(result).not.toContain("[ENGINE_SCORES]");
    });
  });

  describe("regime data", () => {
    it("includes regime when present", () => {
      const result = buildCompressedContext({
        symbol: "AAPL",
        scores: {},
        regime: "RISK_ON",
      });
      expect(result).toContain("[REGIME] Risk-On");
    });

    it("includes enriched regime detail", () => {
      const result = buildCompressedContext({
        symbol: "AAPL",
        scores: {},
        regimeDetail: {
          regime: "STRONG_RISK_ON",
          risk: "Low",
          volatility: "Compressed",
          breadth: "Broad",
        },
      });
      expect(result).toContain("[MARKET_REGIME]");
      expect(result).toContain("State:Strong Risk-On");
      expect(result).toContain("Risk:Low");
    });
  });

  describe("knowledge and memory context", () => {
    it("includes institutional knowledge", () => {
      const result = buildCompressedContext(
        { symbol: "AAPL", scores: {} },
        { knowledgeContext: "The DSE engine calculates six independent scores." },
      );
      expect(result).toContain("[INSTITUTIONAL_KNOWLEDGE]");
      expect(result).toContain("The DSE engine calculates six independent scores.");
    });

    it("includes user memory", () => {
      const result = buildCompressedContext(
        { symbol: "AAPL", scores: {} },
        { memoryContext: "User previously asked about NVDA earnings." },
      );
      expect(result).toContain("[USER_MEMORY]");
      expect(result).toContain("User previously asked about NVDA earnings.");
    });

    it("includes cross-sector correlation", () => {
      const result = buildCompressedContext(
        { symbol: "AAPL", scores: {} },
        { crossSectorContext: "[CROSS_SECTOR_CORRELATION]: Regime: Convergent" },
      );
      expect(result).toContain("[CROSS_SECTOR_CORRELATION]");
    });
  });

  describe("available assets — smart subset", () => {
    it("includes benchmark symbols that exist in universe", () => {
      const result = buildCompressedContext(
        { symbol: "AAPL", scores: {} },
        { availableAssets: ["AAPL", "MSFT", "GOOGL", "SPY", "BTC-USD"] },
      );
      expect(result).toContain("[AVAILABLE_ASSETS]");
      expect(result).toContain("AAPL");
      expect(result).toContain("SPY");
    });

    it("includes mentioned symbols", () => {
      const result = buildCompressedContext(
        { symbol: "AAPL", scores: {} },
        {
          availableAssets: ["AAPL", "TSLA", "SPY"],
          mentionedSymbols: ["TSLA"],
        },
      );
      expect(result).toContain("TSLA");
    });
  });

  describe("region", () => {
    it("shows India for IN region", () => {
      const result = buildCompressedContext({
        symbol: "RELIANCE.NS",
        scores: {},
        region: "IN",
      });
      expect(result).toContain("[REGION] India");
    });

    it("shows United States for US region", () => {
      const result = buildCompressedContext({
        symbol: "AAPL",
        scores: {},
        region: "US",
      });
      expect(result).toContain("[REGION] United States");
    });
  });

  describe("full context assembly order", () => {
    it("produces sections in correct order: ASSET > PRICE > SCORES > REGIME > KNOWLEDGE > MEMORY > ASSETS", () => {
      const result = buildCompressedContext(
        {
          symbol: "NVDA",
          assetName: "NVIDIA",
          assetType: "STOCK",
          scores: { trend: 82 },
          regime: "RISK_ON",
        },
        {
          priceData: { price: 142.3, changePercent: 2.15, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, lastPriceUpdate: null },
          knowledgeContext: "KB content",
          memoryContext: "Memory content",
          availableAssets: ["NVDA", "SPY"],
        },
      );

      const assetIdx = result.indexOf("[ASSET]");
      const priceIdx = result.indexOf("[PRICE]");
      const scoresIdx = result.indexOf("[ENGINE_SCORES]");
      const regimeIdx = result.indexOf("[REGIME]");
      const kbIdx = result.indexOf("[INSTITUTIONAL_KNOWLEDGE]");
      const memIdx = result.indexOf("[USER_MEMORY]");
      const assetsIdx = result.indexOf("[AVAILABLE_ASSETS]");

      expect(assetIdx).toBeLessThan(priceIdx);
      expect(priceIdx).toBeLessThan(scoresIdx);
      expect(scoresIdx).toBeLessThan(regimeIdx);
      expect(regimeIdx).toBeLessThan(kbIdx);
      expect(kbIdx).toBeLessThan(memIdx);
      expect(memIdx).toBeLessThan(assetsIdx);
    });
  });

  describe("currency symbol — INR vs USD", () => {
    it("uses ₹ for INR assets", () => {
      const result = buildCompressedContext(
        { symbol: "RELIANCE.NS", assetName: "Reliance", assetType: "STOCK", scores: {} },
        {
          priceData: { price: 2450.50, changePercent: 1.2, fiftyTwoWeekHigh: 2800, fiftyTwoWeekLow: 2100, lastPriceUpdate: null },
          assetEnrichment: { currency: "INR" },
        },
      );
      expect(result).toContain("Price:₹2450.50");
      expect(result).toContain("52W:₹2100.00-₹2800.00");
      expect(result).not.toContain("Price:$");
    });

    it("uses $ for USD assets", () => {
      const result = buildCompressedContext(
        { symbol: "AAPL", assetName: "Apple", assetType: "STOCK", scores: {} },
        {
          priceData: { price: 180.50, changePercent: -0.5, fiftyTwoWeekHigh: 200, fiftyTwoWeekLow: 140, lastPriceUpdate: null },
          assetEnrichment: { currency: "USD" },
        },
      );
      expect(result).toContain("Price:$180.50");
      expect(result).toContain("52W:$140.00-$200.00");
    });

    it("defaults to $ when currency is null", () => {
      const result = buildCompressedContext(
        { symbol: "BTC-USD", scores: {} },
        {
          priceData: { price: 50000, changePercent: 3.0, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, lastPriceUpdate: null },
          assetEnrichment: { currency: null },
        },
      );
      expect(result).toContain("Price:$50000.00");
    });

    it("defaults to $ when assetEnrichment is undefined", () => {
      const result = buildCompressedContext(
        { symbol: "AAPL", scores: {} },
        {
          priceData: { price: 180, changePercent: 0, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, lastPriceUpdate: null },
        },
      );
      expect(result).toContain("Price:$180.00");
    });
  });

  describe("company profile — stocks and ETFs", () => {
    it("renders [COMPANY_PROFILE] with industry and sector", () => {
      const result = buildCompressedContext(
        { symbol: "AAPL", assetType: "STOCK", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: {
            type: "STOCK",
            industry: "Consumer Electronics",
            sector: "Technology",
            description: "Apple Inc. designs smartphones.",
          },
        },
      );
      expect(result).toContain("[COMPANY_PROFILE]");
      expect(result).toContain("Industry:Consumer Electronics");
      expect(result).toContain("Sector:Technology");
      expect(result).toContain("About:Apple Inc. designs smartphones.");
    });

    it("omits sector when same as industry", () => {
      const result = buildCompressedContext(
        { symbol: "XLE", assetType: "ETF", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: {
            type: "ETF",
            industry: "Energy",
            sector: "Energy",
          },
        },
      );
      expect(result).toContain("Industry:Energy");
      expect(result).not.toContain("Sector:Energy");
    });

    it("truncates long descriptions to 80 chars", () => {
      const longDesc = "A".repeat(300);
      const result = buildCompressedContext(
        { symbol: "AAPL", assetType: "STOCK", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: { type: "STOCK", description: longDesc, industry: "Tech" },
        },
      );
      expect(result).toContain("About:" + "A".repeat(80) + "...");
    });

    it("does NOT render [COMPANY_PROFILE] for MUTUAL_FUND", () => {
      const result = buildCompressedContext(
        { symbol: "MF-119551", assetType: "MUTUAL_FUND", scores: {} },
        {
          assetEnrichment: { type: "MUTUAL_FUND", industry: "Equity", description: "A fund" },
        },
      );
      expect(result).not.toContain("[COMPANY_PROFILE]");
    });
  });

  describe("mutual fund profile", () => {
    it("renders [MF_PROFILE] with fundHouse, category, NAV", () => {
      const result = buildCompressedContext(
        { symbol: "MF-119551", assetType: "MUTUAL_FUND", scores: {} },
        {
          assetEnrichment: {
            type: "MUTUAL_FUND",
            fundHouse: "Axis Mutual Fund",
            category: "Equity - Large Cap",
            nav: 110.43,
          },
        },
      );
      expect(result).toContain("[MF_PROFILE]");
      expect(result).toContain("FundHouse:Axis Mutual Fund");
      expect(result).toContain("Category:Equity - Large Cap");
      expect(result).toContain("NAV:₹110.43");
    });

    it("does NOT render [MF_PROFILE] for STOCK", () => {
      const result = buildCompressedContext(
        { symbol: "AAPL", assetType: "STOCK", scores: {} },
        {
          assetEnrichment: { type: "STOCK", fundHouse: "N/A", category: "N/A", nav: 100 },
        },
      );
      expect(result).not.toContain("[MF_PROFILE]");
    });

    it("omits [MF_PROFILE] when all MF fields are null", () => {
      const result = buildCompressedContext(
        { symbol: "MF-000", assetType: "MUTUAL_FUND", scores: {} },
        {
          assetEnrichment: { type: "MUTUAL_FUND", fundHouse: null, category: null, nav: null },
        },
      );
      expect(result).not.toContain("[MF_PROFILE]");
    });
  });

  describe("fund performance returns — ETF and MF", () => {
    it("renders [ETF_FUND_RETURNS] for ETF", () => {
      const result = buildCompressedContext(
        { symbol: "SPY", assetType: "ETF", scores: {} },
        {
          assetEnrichment: {
            type: "ETF",
            fundPerformanceHistory: { ytd: 8.5, oneYear: 15.2, threeYear: 10.1, fiveYear: 12.3 },
          },
        },
      );
      expect(result).toContain("[ETF_FUND_RETURNS]");
      expect(result).toContain("YTD:+8.5%");
      expect(result).toContain("1Y:+15.2%");
      expect(result).toContain("3Y:+10.1%");
      expect(result).toContain("5Y:+12.3%");
    });

    it("renders [MF_RETURNS] for MUTUAL_FUND", () => {
      const result = buildCompressedContext(
        { symbol: "MF-119551", assetType: "MUTUAL_FUND", scores: {} },
        {
          assetEnrichment: {
            type: "MUTUAL_FUND",
            fundPerformanceHistory: { ytd: 0.19, oneYear: 6.77 },
          },
        },
      );
      expect(result).toContain("[MF_RETURNS]");
      expect(result).toContain("YTD:+0.2%");
      expect(result).toContain("1Y:+6.8%");
      expect(result).not.toContain("[ETF_FUND_RETURNS]");
    });

    it("handles negative returns", () => {
      const result = buildCompressedContext(
        { symbol: "MF-000", assetType: "MUTUAL_FUND", scores: {} },
        {
          assetEnrichment: {
            type: "MUTUAL_FUND",
            fundPerformanceHistory: { ytd: -2.5, oneYear: -5.1 },
          },
        },
      );
      expect(result).toContain("YTD:-2.5%");
      expect(result).toContain("1Y:-5.1%");
    });

    it("does NOT render fund returns for STOCK", () => {
      const result = buildCompressedContext(
        { symbol: "AAPL", assetType: "STOCK", scores: {} },
        {
          assetEnrichment: {
            type: "STOCK",
            fundPerformanceHistory: { ytd: 10 },
          },
        },
      );
      expect(result).not.toContain("[ETF_FUND_RETURNS]");
      expect(result).not.toContain("[MF_RETURNS]");
    });
  });
});

describe("extractMentionedSymbols", () => {
  it("extracts uppercase ticker-like symbols", () => {
    const symbols = extractMentionedSymbols([
      { role: "user", content: "How is AAPL doing compared to MSFT?" },
    ]);
    expect(symbols).toContain("AAPL");
    expect(symbols).toContain("MSFT");
  });

  it("extracts .NS suffixed symbols including long Indian tickers", () => {
    const symbols = extractMentionedSymbols([
      { role: "user", content: "Tell me about TCS.NS, INFY.NS and RELIANCE.NS" },
    ]);
    expect(symbols).toContain("TCS.NS");
    expect(symbols).toContain("INFY.NS");
    expect(symbols).toContain("RELIANCE.NS");
  });

  it("extracts crypto symbols with -USD suffix", () => {
    const symbols = extractMentionedSymbols([
      { role: "user", content: "Compare BTC-USD and ETH-USD" },
    ]);
    expect(symbols).toContain("BTC-USD");
    expect(symbols).toContain("ETH-USD");
  });

  it("filters out common English words", () => {
    const symbols = extractMentionedSymbols([
      { role: "user", content: "THE RISK FOR ALL NEW HIGH LOW" },
    ]);
    expect(symbols).not.toContain("THE");
    expect(symbols).not.toContain("RISK");
    expect(symbols).not.toContain("ALL");
    expect(symbols).not.toContain("NEW");
    expect(symbols).not.toContain("HIGH");
    expect(symbols).not.toContain("LOW");
  });

  it("handles non-string content gracefully", () => {
    const symbols = extractMentionedSymbols([
      { role: "user", content: 12345 as unknown as string },
    ]);
    expect(symbols).toEqual([]);
  });

  it("deduplicates symbols across messages", () => {
    const symbols = extractMentionedSymbols([
      { role: "user", content: "What about AAPL?" },
      { role: "assistant", content: "AAPL is doing well." },
      { role: "user", content: "Tell me more about AAPL" },
    ]);
    const aaplCount = symbols.filter((s) => s === "AAPL").length;
    expect(aaplCount).toBe(1);
  });

  it("does not extract lowercase asset names as ticker symbols directly", () => {
    const symbols = extractMentionedSymbols([
      { role: "user", content: "nvidia" },
    ]);
    expect(symbols).toEqual([]);
  });
});
