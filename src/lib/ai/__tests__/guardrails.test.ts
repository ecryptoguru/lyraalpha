/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { validateInput } from "../guardrails";

describe("Guardrails — validateInput", () => {
  describe("allowed queries", () => {
    const ALLOWED = [
      "What is the price of NVDA?",
      "How is the price doing today?",
      "Show me price action for Bitcoin",
      "What price did AAPL close at?",
      "price",
      "current price",
      "price movement",
      "What are the risks for TSLA?",
      "Compare AAPL vs MSFT",
      "How does the volatility score work?",
      "What is a short squeeze?",
      "Explain the momentum engine",
      "Is Bitcoin correlated with gold?",
      "What's driving NVDA's rally?",
      "How is the tech sector doing?",
      "buyback program for AAPL",
      "short-term outlook",
      "long-term investment thesis",
      // H2: These are now allowed — LLM reframes as analysis via governance rules
      "Should I buy NVDA?",
      "Should I sell my Bitcoin?",
      "Buy or sell AAPL?",
    ];

    for (const query of ALLOWED) {
      it(`allows: "${query}"`, () => {
        const result = validateInput(query);
        expect(result.isValid).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    }
  });

  describe("blocked queries — banned phrases", () => {
    const BLOCKED_PHRASES = [
      { query: "Give me a price prediction for BTC", phrase: "price prediction" },
      { query: "Is TSLA a guaranteed return?", phrase: "guaranteed return" },
      { query: "Is this a safe bet?", phrase: "safe bet" },
    ];

    for (const { query, phrase } of BLOCKED_PHRASES) {
      it(`blocks: "${query}" (phrase: "${phrase}")`, () => {
        const result = validateInput(query);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain(phrase);
      });
    }
  });

  // Block 10: intent-aware "target price" — only blocks prediction intent, not data lookups
  describe("target price — intent-aware (Block 10)", () => {
    describe("allows legitimate analyst target price lookups", () => {
      const ALLOWED_TARGET = [
        "What is the analyst target price for AAPL?",
        "What's the consensus target price on NVDA?",
        "Show me the 12-month price target for TSLA",
        "What do analysts have as a target price for MSFT?",
      ];
      for (const query of ALLOWED_TARGET) {
        it(`allows: "${query}"`, () => {
          const result = validateInput(query);
          expect(result.isValid).toBe(true);
        });
      }
    });

    describe("blocks prediction-intent target price claims", () => {
      const BLOCKED_TARGET = [
        { query: "My target price for AAPL is $250", desc: "own target price claim" },
        { query: "Predict the target price for BTC", desc: "explicit predict" },
        { query: "Forecasting target price for NVDA next year", desc: "forecasting intent" },
        { query: "TSLA will reach its target price of $400", desc: "will reach" },
        { query: "Going to hit price target of $300 soon", desc: "going to hit" },
      ];
      for (const { query, desc } of BLOCKED_TARGET) {
        it(`blocks: "${desc}"`, () => {
          const result = validateInput(query);
          expect(result.isValid).toBe(false);
        });
      }
    });
  });

  describe("blocked queries — banned words (whole-word only, no analytical context)", () => {
    const BLOCKED_WORDS = [
      { query: "BTC to the moon!", word: "moon" },
      { query: "Is this a pump?", word: "pump" },
      { query: "Is DOGE going to dump?", word: "dump" },
    ];

    for (const { query, word } of BLOCKED_WORDS) {
      it(`blocks: "${query}" (word: "${word}")`, () => {
        const result = validateInput(query);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain(word);
      });
    }
  });

  // Block 10: pump/dump/moon allowed in analytical/research context
  describe("banned words — allowed in analytical context (Block 10)", () => {
    const ANALYTICAL_ALLOWED = [
      "Explain the pump-and-dump scheme risk for low-cap crypto",
      "What are the signals to detect a pump pattern in memecoin volume?",
      "Supply dump risk in BTC after halving",
      "Going-to-the-moon sentiment as a contrarian signal",
      "How to avoid a rug pull or dump trap in DeFi",
      "Analyse the pump pattern in PEPE's on-chain data",
    ];

    for (const query of ANALYTICAL_ALLOWED) {
      it(`allows analytical context: "${query}"`, () => {
        const result = validateInput(query);
        expect(result.isValid).toBe(true);
      });
    }
  });

  describe("banned words do NOT match substrings", () => {
    const SAFE_SUBSTRINGS = [
      "moonlight sonata",
      "pumping iron at the gym",
      "dumpling recipe from grandma",
    ];

    for (const query of SAFE_SUBSTRINGS) {
      it(`allows substring: "${query}"`, () => {
        const result = validateInput(query);
        expect(result.isValid).toBe(true);
      });
    }
  });
});
