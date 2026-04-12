/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { buildCompressedContext, extractMentionedSymbols } from "../context-builder";

describe("Context Builder — buildCompressedContext", () => {
  describe("asset identity", () => {
    it("includes symbol, name, and type", () => {
      const result = buildCompressedContext({
        symbol: "BTC-USD",
        assetName: "Bitcoin",
        assetType: "CRYPTO",
        scores: {},
      });
      expect(result).toContain("[ASSET] BTC-USD | Bitcoin | Type: CRYPTO");
    });

    it("defaults to GLOBAL when no symbol", () => {
      const result = buildCompressedContext({ scores: {} });
      expect(result).toContain("[ASSET] GLOBAL | GLOBAL | Type: UNKNOWN");
    });
  });

  describe("#5 — real-time price injection", () => {
    it("injects price data when provided", () => {
      const result = buildCompressedContext(
        { symbol: "SOL-USD", assetName: "Solana", assetType: "CRYPTO", scores: {} },
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
        { symbol: "DOGE-USD", scores: {} },
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
        { symbol: "BTC-USD", scores: {} },
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
        { symbol: "BTC-USD", scores: {} },
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
        { symbol: "BTC-USD", scores: {} },
        { priceData: { price: null, changePercent: null, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, lastPriceUpdate: null } },
      );
      expect(result).not.toContain("[PRICE]");
    });

    it("omits [PRICE] when priceData is undefined", () => {
      const result = buildCompressedContext({ symbol: "BTC-USD", scores: {} });
      expect(result).not.toContain("[PRICE]");
    });

    it("handles zero price change correctly", () => {
      const result = buildCompressedContext(
        { symbol: "BTC-USD", scores: {} },
        { priceData: { price: 100.0, changePercent: 0, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, lastPriceUpdate: null } },
      );
      expect(result).toContain("Change:+0.00%");
    });
  });

  describe("engine scores", () => {
    it("includes non-null scores", () => {
      const result = buildCompressedContext({
        symbol: "BTC-USD",
        scores: { trend: 82, momentum: 71, volatility: 65 },
      });
      expect(result).toContain("[ENGINE_SCORES]");
      expect(result).toContain("Trend:82");
      expect(result).toContain("Momentum:71");
      expect(result).toContain("Volatility:65");
    });

    it("omits null scores", () => {
      const result = buildCompressedContext({
        symbol: "BTC-USD",
        scores: { trend: 82, momentum: null, volatility: undefined },
      });
      expect(result).toContain("Trend:82");
      expect(result).not.toContain("Momentum");
      expect(result).not.toContain("Volatility");
    });

    it("omits [ENGINE_SCORES] when all scores are null", () => {
      const result = buildCompressedContext({ symbol: "BTC-USD", scores: {} });
      expect(result).not.toContain("[ENGINE_SCORES]");
    });
  });

  describe("regime data", () => {
    it("includes regime when present", () => {
      const result = buildCompressedContext({
        symbol: "BTC-USD",
        scores: {},
        regime: "RISK_ON",
      });
      expect(result).toContain("[REGIME] Risk-On");
    });

    it("includes enriched regime detail", () => {
      const result = buildCompressedContext({
        symbol: "BTC-USD",
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
        { symbol: "BTC-USD", scores: {} },
        { knowledgeContext: "The DSE engine calculates six independent scores." },
      );
      expect(result).toContain("[INSTITUTIONAL_KNOWLEDGE]");
      expect(result).toContain("The DSE engine calculates six independent scores.");
    });

    it("includes user memory", () => {
      const result = buildCompressedContext(
        { symbol: "BTC-USD", scores: {} },
        { memoryContext: "User previously asked about SOL-USD momentum." },
      );
      expect(result).toContain("[USER_MEMORY]");
      expect(result).toContain("User previously asked about SOL-USD momentum.");
    });

    it("includes cross-chain correlation", () => {
      const result = buildCompressedContext(
        { symbol: "BTC-USD", scores: {} },
        { crossSectorContext: "[CROSS_SECTOR_CORRELATION]: Regime: Convergent" },
      );
      expect(result).toContain("[CROSS_SECTOR_CORRELATION]");
    });
  });

  describe("available assets — smart subset", () => {
    it("includes top crypto symbols that exist in universe", () => {
      const result = buildCompressedContext(
        { symbol: "BTC-USD", scores: {} },
        { availableAssets: ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD"] },
      );
      expect(result).toContain("[AVAILABLE_ASSETS]");
      expect(result).toContain("BTC-USD");
      expect(result).toContain("ETH-USD");
    });

    it("includes mentioned symbols", () => {
      const result = buildCompressedContext(
        { symbol: "BTC-USD", scores: {} },
        {
          availableAssets: ["BTC-USD", "DOGE-USD", "ETH-USD"],
          mentionedSymbols: ["DOGE-USD"],
        },
      );
      expect(result).toContain("DOGE-USD");
    });
  });

  describe("region", () => {
    it("shows India for IN region", () => {
      const result = buildCompressedContext({
        symbol: "BTC-USD",
        scores: {},
        region: "IN",
      });
      expect(result).toContain("[REGION] India");
    });

    it("shows United States for US region", () => {
      const result = buildCompressedContext({
        symbol: "BTC-USD",
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
          symbol: "SOL-USD",
          assetName: "Solana",
          assetType: "CRYPTO",
          scores: { trend: 82 },
          regime: "RISK_ON",
        },
        {
          priceData: { price: 142.3, changePercent: 2.15, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, lastPriceUpdate: null },
          knowledgeContext: "KB content",
          memoryContext: "Memory content",
          availableAssets: ["SOL-USD", "ETH-USD"],
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
        { symbol: "XRP-USD", assetName: "XRP", assetType: "CRYPTO", scores: {} },
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
        { symbol: "BTC-USD", assetName: "Bitcoin", assetType: "CRYPTO", scores: {} },
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
        { symbol: "BTC-USD", scores: {} },
        {
          priceData: { price: 180, changePercent: 0, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, lastPriceUpdate: null },
        },
      );
      expect(result).toContain("Price:$180.00");
    });
  });

  describe("crypto profile — [CRYPTO_ABOUT] and [CRYPTO_MARKET]", () => {
    it("renders [CRYPTO_ABOUT] with truncated description", () => {
      const result = buildCompressedContext(
        { symbol: "ETH-USD", assetType: "CRYPTO", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: {
            type: "CRYPTO",
            description: "Ethereum is a decentralized blockchain for smart contracts and dApps.",
            metadata: { coingecko: {} },
          },
        },
      );
      expect(result).toContain("[CRYPTO_ABOUT]");
      expect(result).toContain("Ethereum is a decentralized blockchain for smart contracts and dApps.");
    });

    it("renders [CRYPTO_MARKET] with supply and market structure", () => {
      const result = buildCompressedContext(
        { symbol: "BTC-USD", assetType: "CRYPTO", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: {
            type: "CRYPTO",
            metadata: {
              circulatingSupply: 19_000_000,
              maxSupply: 21_000_000,
              volume24Hr: 30_000_000_000,
              coingecko: {
                fullyDilutedValuation: 2_100_000_000_000,
                marketCapRank: 1,
              },
            },
          },
        },
      );
      expect(result).toContain("[CRYPTO_MARKET]");
      expect(result).toContain("CircSupply:");
      expect(result).toContain("MaxSupply:");
      expect(result).toContain("Mined:");
      expect(result).toContain("Rank:#1");
    });

    it("truncates long descriptions to 80 chars", () => {
      const longDesc = "A".repeat(300);
      const result = buildCompressedContext(
        { symbol: "BTC-USD", assetType: "CRYPTO", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: { type: "CRYPTO", description: longDesc, metadata: { coingecko: {} } },
        },
      );
      expect(result).toContain("[CRYPTO_ABOUT] " + "A".repeat(80) + "...");
    });

    it("omits [CRYPTO_ABOUT] when no description", () => {
      const result = buildCompressedContext(
        { symbol: "BTC-USD", assetType: "CRYPTO", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: { type: "CRYPTO", metadata: { coingecko: {} } },
        },
      );
      expect(result).not.toContain("[CRYPTO_ABOUT]");
    });
  });

  describe("crypto intelligence — [CRYPTO_TVL] and [CRYPTO_ENHANCED_TRUST]", () => {
    it("renders [CRYPTO_TVL] with TVL, category, and type", () => {
      const result = buildCompressedContext(
        { symbol: "AAVE-USD", assetType: "CRYPTO", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: {
            type: "CRYPTO",
            cryptoIntelligence: {
              tvlData: { tvl: 12_000_000_000, category: "Lending", protocolCount: 3, isChain: false },
            },
          },
        },
      );
      expect(result).toContain("[CRYPTO_TVL]");
      expect(result).toContain("TVL:$12.00B");
      expect(result).toContain("Cat:Lending");
      expect(result).toContain("Type:Protocol");
    });

    it("renders [CRYPTO_TVL] as Type:Chain when isChain is true", () => {
      const result = buildCompressedContext(
        { symbol: "ETH-USD", assetType: "CRYPTO", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: {
            type: "CRYPTO",
            cryptoIntelligence: {
              tvlData: { tvl: 65_000_000_000, protocolCount: 150, isChain: true },
            },
          },
        },
      );
      expect(result).toContain("[CRYPTO_TVL]");
      expect(result).toContain("Type:Chain");
    });

    it("omits [CRYPTO_TVL] when TVL is null", () => {
      const result = buildCompressedContext(
        { symbol: "DOGE-USD", assetType: "CRYPTO", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: {
            type: "CRYPTO",
            cryptoIntelligence: {
              tvlData: { tvl: null },
            },
          },
        },
      );
      expect(result).not.toContain("[CRYPTO_TVL]");
    });
  });

  describe("performance data — [PERFORMANCE] and [52W_POSITION]", () => {
    it("renders [PERFORMANCE] with returns", () => {
      const result = buildCompressedContext(
        { symbol: "BTC-USD", assetType: "CRYPTO", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: {
            type: "CRYPTO",
            performanceData: {
              returns: { "7D": 3.2, "30D": 8.5, "1Y": 15.2 },
            },
          },
        },
      );
      expect(result).toContain("[PERFORMANCE]");
      expect(result).toContain("7D:+3.2%");
      expect(result).toContain("30D:+8.5%");
      expect(result).toContain("1Y:+15.2%");
    });

    it("renders [52W_POSITION] with range data", () => {
      const result = buildCompressedContext(
        { symbol: "ETH-USD", assetType: "CRYPTO", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: {
            type: "CRYPTO",
            performanceData: {
              range52W: { currentPosition: 72, distanceFromHigh: -28, distanceFromLow: 150 },
            },
          },
        },
      );
      expect(result).toContain("[52W_POSITION]");
      expect(result).toContain("Position:72%");
      expect(result).toContain("FromHigh:-28.0%");
    });

    it("handles negative returns", () => {
      const result = buildCompressedContext(
        { symbol: "SOL-USD", assetType: "CRYPTO", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: {
            type: "CRYPTO",
            performanceData: {
              returns: { "7D": -2.5, "30D": -5.1 },
            },
          },
        },
      );
      expect(result).toContain("7D:-2.5%");
      expect(result).toContain("30D:-5.1%");
    });

    it("omits performance when no performanceData", () => {
      const result = buildCompressedContext(
        { symbol: "BTC-USD", assetType: "CRYPTO", scores: {} },
        {
          tier: "COMPLEX",
          assetEnrichment: { type: "CRYPTO" },
        },
      );
      expect(result).not.toContain("[PERFORMANCE]");
      expect(result).not.toContain("[52W_POSITION]");
    });
  });
});

describe("extractMentionedSymbols", () => {
  it("extracts uppercase ticker-like symbols", () => {
    const symbols = extractMentionedSymbols([
      { role: "user", content: "How is BTC-USD doing compared to ETH-USD?" },
    ]);
    expect(symbols).toContain("BTC-USD");
    expect(symbols).toContain("ETH-USD");
  });

  it("extracts -USD suffixed crypto symbols", () => {
    const symbols = extractMentionedSymbols([
      { role: "user", content: "Tell me about BTC-USD, ETH-USD and SOL-USD" },
    ]);
    expect(symbols).toContain("BTC-USD");
    expect(symbols).toContain("ETH-USD");
    expect(symbols).toContain("SOL-USD");
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
      { role: "user", content: "What about BTC-USD?" },
      { role: "assistant", content: "BTC-USD is doing well." },
      { role: "user", content: "Tell me more about BTC-USD" },
    ]);
    const aaplCount = symbols.filter((s) => s === "BTC-USD").length;
    expect(aaplCount).toBe(1);
  });

  it("does not extract lowercase asset names as ticker symbols directly", () => {
    const symbols = extractMentionedSymbols([
      { role: "user", content: "solana" },
    ]);
    expect(symbols).toEqual([]);
  });
});
