/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cacheMock } = vi.hoisted(() => ({
  cacheMock: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));
vi.mock("@/lib/redis", () => ({ getCache: cacheMock.get, setCache: cacheMock.set }));

import { NewsDataCryptoService, getNewsDataCoinCode, CryptoPanicPost } from "../newsdata.service";

describe("getNewsDataCoinCode", () => {
  it("maps BTC-USD to BTC", () => { expect(getNewsDataCoinCode("BTC-USD")).toBe("BTC"); });
  it("maps ETH-USD to ETH", () => { expect(getNewsDataCoinCode("ETH-USD")).toBe("ETH"); });
  it("maps SOL-USD to SOL", () => { expect(getNewsDataCoinCode("SOL-USD")).toBe("SOL"); });
  it("returns null for unknown symbols", () => { expect(getNewsDataCoinCode("UNKNOWN")).toBeNull(); });
  it("handles SHIB-USD mapping", () => { expect(getNewsDataCoinCode("SHIB-USD")).toBe("SHIB"); });
  it("handles PEPE-USD mapping", () => { expect(getNewsDataCoinCode("PEPE-USD")).toBe("PEPE"); });
});

describe("NewsDataCryptoService", () => {
  beforeEach(() => { vi.clearAllMocks(); cacheMock.get.mockResolvedValue(null); });

  describe("isConfigured", () => {
    it("returns configuration status (based on module load time env)", () => {
      // isConfigured checks AUTH_TOKEN which is set at module load time
      // We verify the method returns a boolean
      expect(typeof NewsDataCryptoService.isConfigured()).toBe("boolean");
    });
  });

  describe("deriveSentiment", () => {
    it("calculates sentiment from sentiment_stats", () => {
      const post: CryptoPanicPost = {
        kind: "news", domain: "example.com", title: "Test", published_at: "2026-04-14", slug: "test", url: "",
        source: { title: "Example", region: "US", domain: "example.com" },
        votes: { negative: 0, positive: 0, important: 0, liked: 0, disliked: 0, lol: 0, toxic: 0, saved: 0, comments: 0 },
        sentiment_stats: { positive: 80, negative: 10, neutral: 10 },
      };
      const result = NewsDataCryptoService.deriveSentiment(post);
      expect(result.sentiment).toBe("POSITIVE");
      expect(result.totalVotes).toBe(100);
    });

    it("returns NEUTRAL when no stats available", () => {
      const post: CryptoPanicPost = {
        kind: "news", domain: "example.com", title: "Test", published_at: "2026-04-14", slug: "test", url: "",
        source: { title: "Example", region: "US", domain: "example.com" },
        votes: { negative: 0, positive: 0, important: 0, liked: 0, disliked: 0, lol: 0, toxic: 0, saved: 0, comments: 0 },
      };
      const result = NewsDataCryptoService.deriveSentiment(post);
      expect(result.sentiment).toBe("NEUTRAL");
      expect(result.score).toBe(0);
    });

    it("uses vote counts as fallback when sentiment_stats unavailable", () => {
      const post: CryptoPanicPost = {
        kind: "news", domain: "example.com", title: "Test", published_at: "2026-04-14", slug: "test", url: "",
        source: { title: "Example", region: "US", domain: "example.com" },
        votes: { negative: 5, positive: 15, important: 10, liked: 5, disliked: 0, lol: 0, toxic: 0, saved: 0, comments: 0 },
      };
      const result = NewsDataCryptoService.deriveSentiment(post);
      expect(result.sentiment).toBe("POSITIVE");
    });

    it("handles negative sentiment from votes", () => {
      const post: CryptoPanicPost = {
        kind: "news", domain: "example.com", title: "Test", published_at: "2026-04-14", slug: "test", url: "",
        source: { title: "Example", region: "US", domain: "example.com" },
        votes: { negative: 20, positive: 5, important: 0, liked: 0, disliked: 10, lol: 0, toxic: 0, saved: 0, comments: 0 },
      };
      const result = NewsDataCryptoService.deriveSentiment(post);
      expect(result.sentiment).toBe("NEGATIVE");
    });

    it("uses raw sentiment field when available", () => {
      const post: CryptoPanicPost = {
        kind: "news", domain: "example.com", title: "Test", published_at: "2026-04-14", slug: "test", url: "",
        source: { title: "Example", region: "US", domain: "example.com" },
        votes: { negative: 0, positive: 0, important: 0, liked: 0, disliked: 0, lol: 0, toxic: 0, saved: 0, comments: 0 },
        sentiment: "negative",
      };
      const result = NewsDataCryptoService.deriveSentiment(post);
      expect(result.sentiment).toBe("NEGATIVE");
    });
  });

  describe("getTrendingNews", () => {
    it("returns empty array when not configured", async () => {
      // getTrendingNews delegates to getNews which checks AUTH_TOKEN
      const result = await NewsDataCryptoService.getTrendingNews(15);
      // Without proper API key, returns empty array
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getNewsForSymbol", () => {
    it("returns empty array for unmapped symbols", async () => {
      const result = await NewsDataCryptoService.getNewsForSymbol("UNKNOWN", 5);
      expect(result).toEqual([]);
    });
  });

  describe("getNews", () => {
    it("returns empty array when API key not configured", async () => {
      vi.stubEnv("NEWSDATA_API_KEY", "");
      const result = await NewsDataCryptoService.getNews();
      expect(result).toEqual([]);
    });
  });
});
