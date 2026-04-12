/**
 * @vitest-environment node
 *
 * Tests for ChatContextDataSchema (I3) — structural validation of contextData
 * passed to /api/chat, preventing prompt injection via unvalidated compareContext.
 */
import { describe, expect, it } from "vitest";
import { ChatContextDataSchema, ChatMessageSchema } from "@/lib/schemas";

describe("ChatContextDataSchema (I3)", () => {
  describe("valid inputs", () => {
    it("accepts an empty object", () => {
      expect(ChatContextDataSchema.safeParse({}).success).toBe(true);
    });

    it("accepts all known fields with valid values", () => {
      const result = ChatContextDataSchema.safeParse({
        symbol: "BTC-USD",
        assetName: "Bitcoin",
        assetType: "CRYPTO",
        region: "US",
        regime: "RISK_ON",
        chatMode: "compare",
        scores: { momentum: 0.75, value: -0.3 },
        compareContext: [
          { symbol: "BTC-USD", name: "Bitcoin", assetType: "CRYPTO", region: "US", price: 104000, changePercent: 1.2 },
          { symbol: "ETH-USD", name: "Ethereum", assetType: "CRYPTO" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("accepts region IN", () => {
      const result = ChatContextDataSchema.safeParse({ region: "IN" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.region).toBe("IN");
    });

    it("accepts region US", () => {
      const result = ChatContextDataSchema.safeParse({ region: "US" });
      expect(result.success).toBe(true);
    });

    it("accepts compareContext with up to 10 items", () => {
      const items = Array.from({ length: 10 }, (_, i) => ({ symbol: `SYM${i}` }));
      expect(ChatContextDataSchema.safeParse({ compareContext: items }).success).toBe(true);
    });

    it("accepts compareContext item with null price/changePercent", () => {
      const result = ChatContextDataSchema.safeParse({
        compareContext: [{ symbol: "BTC-USD", price: null, changePercent: null }],
      });
      expect(result.success).toBe(true);
    });

    it("passes through unknown extra keys (catchall)", () => {
      const result = ChatContextDataSchema.safeParse({ unknownField: "extra", symbol: "BTC-USD" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).unknownField).toBe("extra");
      }
    });

    it("accepts undefined contextData in ChatMessageSchema", () => {
      const result = ChatMessageSchema.safeParse({
        messages: [{ role: "user", content: "hello" }],
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.contextData).toBeUndefined();
    });
  });

  describe("invalid inputs — region", () => {
    it("rejects invalid region value", () => {
      const result = ChatContextDataSchema.safeParse({ region: "EU" });
      expect(result.success).toBe(false);
    });

    it("rejects numeric region", () => {
      const result = ChatContextDataSchema.safeParse({ region: 42 });
      expect(result.success).toBe(false);
    });
  });

  describe("invalid inputs — symbol", () => {
    it("rejects symbol longer than 20 chars", () => {
      const result = ChatContextDataSchema.safeParse({ symbol: "A".repeat(21) });
      expect(result.success).toBe(false);
    });

    it("rejects symbol with injection characters", () => {
      const result = ChatContextDataSchema.safeParse({ symbol: "BTC-USD; DROP TABLE" });
      expect(result.success).toBe(false);
    });
  });

  describe("invalid inputs — compareContext", () => {
    it("rejects compareContext with more than 10 items", () => {
      const items = Array.from({ length: 11 }, (_, i) => ({ symbol: `SYM${i}` }));
      const result = ChatContextDataSchema.safeParse({ compareContext: items });
      expect(result.success).toBe(false);
    });

    it("rejects compareContext item with invalid symbol", () => {
      const result = ChatContextDataSchema.safeParse({
        compareContext: [{ symbol: "A".repeat(25) }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects compareContext item with non-finite price", () => {
      const result = ChatContextDataSchema.safeParse({
        compareContext: [{ symbol: "BTC-USD", price: Infinity }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects compareContext item with non-finite changePercent", () => {
      const result = ChatContextDataSchema.safeParse({
        compareContext: [{ symbol: "BTC-USD", changePercent: NaN }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects summary longer than 2000 chars", () => {
      const result = ChatContextDataSchema.safeParse({
        compareContext: [{ symbol: "BTC-USD", summary: "x".repeat(2001) }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("invalid inputs — scores", () => {
    it("rejects scores with non-finite values", () => {
      const result = ChatContextDataSchema.safeParse({ scores: { momentum: NaN } });
      expect(result.success).toBe(false);
    });

    it("rejects scores with key longer than 50 chars", () => {
      const result = ChatContextDataSchema.safeParse({ scores: { ["k".repeat(51)]: 0.5 } });
      expect(result.success).toBe(false);
    });
  });

  describe("assetName / assetType / regime / chatMode length limits", () => {
    it("rejects assetName longer than 200 chars", () => {
      expect(ChatContextDataSchema.safeParse({ assetName: "x".repeat(201) }).success).toBe(false);
    });

    it("rejects assetType longer than 30 chars", () => {
      expect(ChatContextDataSchema.safeParse({ assetType: "x".repeat(31) }).success).toBe(false);
    });

    it("rejects regime longer than 100 chars", () => {
      expect(ChatContextDataSchema.safeParse({ regime: "x".repeat(101) }).success).toBe(false);
    });

    it("rejects chatMode longer than 50 chars", () => {
      expect(ChatContextDataSchema.safeParse({ chatMode: "x".repeat(51) }).success).toBe(false);
    });
  });
});

describe("ChatMessageSchema — contextData integration (I3)", () => {
  it("accepts valid contextData with compareContext in full ChatMessageSchema", () => {
    const result = ChatMessageSchema.safeParse({
      messages: [{ role: "user", content: "compare BTC-USD vs ETH-USD" }],
      contextData: {
        chatMode: "compare",
        region: "US",
        compareContext: [
          { symbol: "BTC-USD", name: "Bitcoin", price: 104000, changePercent: 1.5 },
          { symbol: "ETH-USD", name: "Ethereum", price: 3400, changePercent: -0.3 },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid contextData shape — prevents injection via compareContext", () => {
    const result = ChatMessageSchema.safeParse({
      messages: [{ role: "user", content: "compare" }],
      contextData: {
        compareContext: [{ symbol: "'; DROP TABLE assets; --" }],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid region inside contextData", () => {
    const result = ChatMessageSchema.safeParse({
      messages: [{ role: "user", content: "hello" }],
      contextData: { region: "INVALID" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts contextData without compareContext (optional)", () => {
    const result = ChatMessageSchema.safeParse({
      messages: [{ role: "user", content: "What is BTC-USD?" }],
      symbol: "BTC-USD",
      contextData: { symbol: "BTC-USD", assetType: "CRYPTO", region: "US" },
    });
    expect(result.success).toBe(true);
  });
});
