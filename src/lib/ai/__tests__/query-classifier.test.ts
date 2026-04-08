/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { classifyQuery } from "../query-classifier";

describe("Query Classifier", () => {
  describe("SIMPLE classification", () => {
    const SIMPLE_QUERIES = [
      "What is a PE ratio?",
      "How does the trend score work?",
      "Explain volatility",
      "Define market regime",
      "Tell me about ARCS",
      "What's the difference between alpha and beta?",
      "Can you explain the momentum engine?",
      "What is the volatility score?",
      "How is the trust score calculated?",
      "What does DSE stand for?",
    ];

    for (const query of SIMPLE_QUERIES) {
      it(`classifies as SIMPLE: "${query}"`, () => {
        expect(classifyQuery(query)).toBe("SIMPLE");
      });
    }
  });

  describe("SIMPLE — greetings (short queries)", () => {
    const GREETINGS = [
      "hi",
      "hello",
      "hey",
      "thanks",
      "thank you",
      "ok",
      "okay",
      "got it",
      "sure",
      "Hi!",
      "Hello.",
      "Thanks!",
    ];

    for (const query of GREETINGS) {
      it(`classifies greeting as SIMPLE: "${query}"`, () => {
        expect(classifyQuery(query)).toBe("SIMPLE");
      });
    }
  });

  describe("COMPLEX classification", () => {
    const COMPLEX_QUERIES = [
      "Compare AAPL vs MSFT vs GOOGL",
      "NVDA versus AMD performance comparison",
      "What's the portfolio impact of adding Bitcoin?",
      "Analyze the correlation between gold and equities",
      "Cross-sector analysis of tech and healthcare",
      "What happens during a regime shift to risk-off?",
      "How would a rate hike impact multiple assets in my portfolio?",
      "Factor rotation analysis for the current macro environment",
      "What's the risk-adjusted return comparison between SPY and QQQ?",
      "Analyze the global macro impact on emerging markets and crypto",
    ];

    for (const query of COMPLEX_QUERIES) {
      it(`classifies as COMPLEX: "${query}"`, () => {
        expect(classifyQuery(query)).toBe("COMPLEX");
      });
    }
  });

  describe("COMPLEX — long queries (>150 chars)", () => {
    it("classifies very long queries as COMPLEX", () => {
      const longQuery = "I want to understand how the current Federal Reserve policy stance is affecting the correlation between technology stocks and cryptocurrency markets, and whether the recent regime shift signals a broader rotation into defensive assets like gold and treasury ETFs";
      expect(longQuery.length).toBeGreaterThan(150);
      expect(classifyQuery(longQuery)).toBe("COMPLEX");
    });
  });

  describe("COMPLEX — deep conversations (12+ messages)", () => {
    it("keeps asset-specific queries at MODERATE before long-conversation escalation", () => {
      expect(classifyQuery("AAPL outlook for next quarter", 12)).toBe("MODERATE");
      expect(classifyQuery("AAPL outlook for next quarter", 15)).toBe("MODERATE");
    });

    it("escalates long non-asset analytical queries to COMPLEX at 20+ messages", () => {
      expect(classifyQuery("Market breadth is narrowing lately", 20)).toBe("COMPLEX");
    });

    it("SIMPLE patterns still win even in deep conversations", () => {
      // "What is X" matches SIMPLE pattern regardless of conversation length
      expect(classifyQuery("What is a PE ratio?", 10)).toBe("SIMPLE");
    });
  });

  describe("MODERATE classification (default)", () => {
    // MODERATE = analytical queries that are not educational and not asset-specific.
    const MODERATE_QUERIES = [
      "Is the tech sector overvalued right now?",
      "Market breadth is narrowing lately",
      "Macro liquidity looks tighter now",
      "The semiconductor cycle seems fragile",
      "Breadth participation looks uneven lately",
    ];

    for (const query of MODERATE_QUERIES) {
      it(`classifies as MODERATE: "${query}"`, () => {
        expect(classifyQuery(query)).toBe("MODERATE");
      });
    }
  });

  describe("SIMPLE — beginner behavioral (rules 11-15, benchmark regressions)", () => {
    const BEGINNER_BEHAVIORAL = [
      "Can I lose more than I invest?",
      "How long should I hold stocks?",
      "Should I average down on losing stocks?",
      "Should I hold cash during market corrections?",
      "Which broker is best in India?",
      "How much should I invest in each stock?",
      "What financial ratios should I look at before investing?",
      "Is stock market investing safe?",
      "Should I invest during a market correction?",
      "Should I invest in growth or value stocks?",
      "How do I know if a stock is undervalued?",
      "How do I know if a stock is overvalued?",
      "How do I build a long-term portfolio?",
      "Is SIP better than lump-sum investing?",
    ];

    for (const query of BEGINNER_BEHAVIORAL) {
      it(`classifies as SIMPLE: "${query}"`, () => {
        expect(classifyQuery(query, 1)).toBe("SIMPLE");
      });
    }

    it("portfolio analytical intent still classifies as COMPLEX", () => {
      expect(classifyQuery("What is the ideal portfolio allocation?", 1)).toBe("COMPLEX");
      expect(classifyQuery("How would a rate hike impact my portfolio allocation?", 1)).toBe("COMPLEX");
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(classifyQuery("")).toBe("MODERATE");
    });

    it("handles whitespace-only", () => {
      expect(classifyQuery("   ")).toBe("MODERATE");
    });

    it("defaults conversationLength to 1", () => {
      expect(classifyQuery("Market breadth is narrowing lately")).toBe("MODERATE");
    });

    it("SIMPLE patterns only match short queries for short-query path", () => {
      // "What is X" pattern should still work for longer educational queries
      const longEducational = "What is the difference between a momentum score and a trend score in the DSE engine?";
      expect(longEducational.length).toBeGreaterThan(40);
      expect(classifyQuery(longEducational)).toBe("MODERATE");
    });

    it("routes asset-name queries to MODERATE by default", () => {
      expect(classifyQuery("nvidia")).toBe("MODERATE");
      expect(classifyQuery("nvidia stock")).toBe("MODERATE");
      expect(classifyQuery("bitcoin")).toBe("MODERATE");
      expect(classifyQuery("reliance")).toBe("MODERATE");
      expect(classifyQuery("gold commodity")).toBe("MODERATE");
      expect(classifyQuery("best mutual fund for large cap")).toBe("MODERATE");
      expect(classifyQuery("apple stock")).toBe("MODERATE");
    });

    it("treats latest developments queries as MODERATE analytical intent", () => {
      expect(classifyQuery("What are the latest developments for Reliance?")).toBe("MODERATE");
    });
  });
});
