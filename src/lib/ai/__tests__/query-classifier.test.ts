/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { classifyQuery } from "../query-classifier";

describe("Query Classifier", () => {
  describe("SIMPLE classification", () => {
    const SIMPLE_QUERIES = [
      "What is TVL?",
      "How does the trend score work?",
      "Explain volatility",
      "Define market regime",
      "Tell me about ARCS",
      "What is FDV?",
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
      "Compare BTC-USD vs ETH-USD vs SOL-USD",
      "SOL-USD versus AVAX-USD performance comparison",
      "What's the portfolio impact of adding Bitcoin?",
      "Analyze the correlation between BTC and ETH",
      "Compare BTC-USD vs ETH-USD cross-chain correlation analysis",
      "What happens during a regime shift to risk-off?",
      "How would a rate hike impact multiple assets in my portfolio?",
      "Token rotation analysis for the current macro environment",
      "What's the risk-adjusted return comparison between BTC-USD and ETH-USD?",
      "Analyze the global macro impact on DeFi and CeFi",
    ];

    for (const query of COMPLEX_QUERIES) {
      it(`classifies as COMPLEX: "${query}"`, () => {
        expect(classifyQuery(query)).toBe("COMPLEX");
      });
    }
  });

  describe("COMPLEX — long queries (>150 chars)", () => {
    it("classifies very long queries as COMPLEX", () => {
      const longQuery = "I want to understand how the current Federal Reserve policy stance is affecting the correlation between L1 crypto and DeFi markets, and whether the recent regime shift signals a broader rotation into stablecoins and yield-bearing protocols";
      expect(longQuery.length).toBeGreaterThan(150);
      expect(classifyQuery(longQuery)).toBe("COMPLEX");
    });
  });

  describe("COMPLEX — deep conversations (12+ messages)", () => {
    it("keeps asset-specific queries at MODERATE before long-conversation escalation", () => {
      expect(classifyQuery("BTC-USD outlook for next quarter", 12)).toBe("MODERATE");
      expect(classifyQuery("BTC-USD outlook for next quarter", 15)).toBe("MODERATE");
    });

    it("escalates long non-asset analytical queries to COMPLEX at 20+ messages", () => {
      expect(classifyQuery("Market breadth is narrowing lately", 20)).toBe("COMPLEX");
    });

    it("SIMPLE patterns still win even in deep conversations", () => {
      // "What is X" matches SIMPLE pattern regardless of conversation length
      expect(classifyQuery("What is TVL?", 10)).toBe("SIMPLE");
    });
  });

  describe("MODERATE classification (default)", () => {
    // MODERATE = analytical queries that are not educational and not asset-specific.
    const MODERATE_QUERIES = [
      "Is the L1 sector overvalued right now?",
      "Market breadth is narrowing lately",
      "Macro liquidity looks tighter now",
      "The DeFi yield cycle seems fragile",
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
      "How long should I hold crypto?",
      "Should I average down on losing crypto?",
      "Should I hold stablecoins during market corrections?",
      "Which exchange is best in India?",
      "How much should I invest in each crypto?",
      "What on-chain metrics should I look at before investing?",
      "Is crypto investing safe?",
      "Should I invest during a market correction?",
      "Should I invest in L1 or DeFi tokens?",
      "How do I know if a crypto is undervalued?",
      "How do I know if a crypto is overvalued?",
      "How do I build a long-term crypto portfolio?",
    ];

    for (const query of BEGINNER_BEHAVIORAL) {
      it(`classifies as SIMPLE: "${query}"`, () => {
        expect(classifyQuery(query, 1)).toBe("SIMPLE");
      });
    }

    it("portfolio analytical intent still classifies as COMPLEX", () => {
      expect(classifyQuery("What is the ideal crypto portfolio allocation?", 1)).toBe("COMPLEX");
      expect(classifyQuery("How would a rate hike impact my crypto portfolio allocation?", 1)).toBe("COMPLEX");
    });
  });

  describe("COMPLEX — crypto-specific deep analytical patterns (QC-1)", () => {
    const COMPLEX_CRYPTO_QUERIES = [
      "How does MEV exposure affect my ETH staking rewards?",
      "Bridge exploit risk analysis for cross-chain wrapped assets",
      "What is the token unlock schedule for this project and how does it affect price?",
      "Impermanent loss risk in my liquidity pool position",
      "Oracle manipulation attack vectors in DeFi lending protocols",
      "Smart contract audit results and reentrancy vulnerability risk",
      "Sandwich attack probability and frontrunning protection strategies",
      "Cross-chain bridge vulnerability assessment for wrapped tokens",
      "Vesting cliff unlock analysis for early investors",
      "TWAP oracle manipulation risk in AMM pools",
    ];

    for (const query of COMPLEX_CRYPTO_QUERIES) {
      it(`classifies as COMPLEX: "${query}"`, () => {
        expect(classifyQuery(query)).toBe("COMPLEX");
      });
    }
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
      expect(classifyQuery("solana")).toBe("MODERATE");
      expect(classifyQuery("solana token")).toBe("MODERATE");
      expect(classifyQuery("bitcoin")).toBe("MODERATE");
      expect(classifyQuery("ethereum")).toBe("MODERATE");
      expect(classifyQuery("bitcoin commodity")).toBe("MODERATE");
      expect(classifyQuery("best DeFi protocol for yield")).toBe("MODERATE");
      expect(classifyQuery("bitcoin price")).toBe("MODERATE");
    });

    it("treats latest developments queries as MODERATE analytical intent", () => {
      expect(classifyQuery("What are the latest developments for Bitcoin?")).toBe("MODERATE");
    });
  });
});
