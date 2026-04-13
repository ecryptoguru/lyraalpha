/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cacheMock } = vi.hoisted(() => ({
  cacheMock: { get: vi.fn(), set: vi.fn() },
}));

vi.stubEnv("COINGECKO_API_KEY", "test-api-key");
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));
vi.mock("@/lib/logger/utils", () => ({ sanitizeError: (e: unknown) => String(e) }));
vi.mock("@/lib/redis", () => ({ getCache: cacheMock.get, setCache: cacheMock.set }));

import { CoinGeckoService } from "../coingecko.service";
import type { CoinGeckoMarket, CoinGeckoMarketChart, CoinGeckoOHLC } from "@/lib/types/coingecko";

const mockMarket: CoinGeckoMarket = {
  id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: 65000, market_cap: 1200000000000, market_cap_rank: 1,
  fully_diluted_valuation: 1400000000000, total_volume: 30000000000, high_24h: 67000, low_24h: 64000,
  price_change_24h: 1500, price_change_percentage_24h: 2.5, market_cap_change_24h: 50000000000,
  market_cap_change_percentage_24h: 4.2, circulating_supply: 19000000, total_supply: 21000000, max_supply: 21000000,
  ath: 69000, ath_change_percentage: -5.8, ath_date: "2021-11-10T00:00:00.000Z", atl: 67.81,
  atl_change_percentage: 95800, atl_date: "2013-07-06T00:00:00.000Z", roi: null, last_updated: "2026-04-14T00:00:00.000Z",
  image: "https://example.com/btc.png", price_change_percentage_7d_in_currency: 5.2,
};

const mockDetail = {
  id: "bitcoin", name: "Bitcoin", symbol: "btc", web_slug: "bitcoin", asset_platform_id: null,
  block_time_in_minutes: 10, hashing_algorithm: "SHA-256", categories: ["Cryptocurrency"], preview_listing: false,
  public_notice: null, country_origin: "", description: { en: "Digital gold" }, genesis_date: "2009-01-03",
  market_cap_rank: 1, market_data: {
    current_price: { usd: 65000 }, market_cap: { usd: 1200000000000 }, fully_diluted_valuation: { usd: 1400000000000 },
    total_volume: { usd: 30000000000 }, high_24h: { usd: 67000 }, low_24h: { usd: 64000 },
    price_change_24h: 1500, price_change_percentage_24h: 2.5, price_change_percentage_7d: 5.2,
    price_change_percentage_14d: 8.0, price_change_percentage_30d: 15.0, price_change_percentage_60d: 25.0,
    price_change_percentage_200d: 60.0, price_change_percentage_1y: 120.0,
    market_cap_change_24h: 50000000000, market_cap_change_percentage_24h: 4.2,
    market_cap_rank: 1, market_cap_fdv_ratio: 0.85,
    circulating_supply: 19000000, total_supply: 21000000, max_supply: 21000000,
    ath: { usd: 69000 }, ath_date: { usd: "2021-11-10" }, atl: { usd: 67.81 }, atl_date: { usd: "2013-07-06" },
    ath_change_percentage: { usd: -5.8 }, atl_change_percentage: { usd: 95800 }, total_value_locked: null,
    mcap_to_tvl_ratio: null, fdv_to_tvl_ratio: null, last_updated: "2026-04-14T00:00:00.000Z",
  },
  developer_data: { forks: 100, stars: 5000, subscribers: 1000, total_issues: 200, closed_issues: 180, pull_requests_merged: 150, pull_request_contributors: 50, code_additions_deletions_4_weeks: { additions: 1000, deletions: 500 }, commit_count_4_weeks: 80, last_4_weeks_commit_activity_series: [] },
  community_data: { facebook_likes: null, twitter_followers: 5000000, reddit_average_posts_48h: 100, reddit_average_comments_48h: 500, reddit_subscribers: 500000, reddit_accounts_active_48h: 5000, telegram_channel_user_count: 100000 },
  links: { homepage: ["https://bitcoin.org"], whitepaper: "https://bitcoin.org/bitcoin.pdf", blockchain_site: ["https://blockchain.info"], twitter_screen_name: "bitcoin", facebook_username: "", telegram_channel_identifier: "bitcoin", subreddit_url: "https://reddit.com/r/bitcoin", repos_url: { github: ["https://github.com/bitcoin"], bitbucket: [] }, official_forum_url: [], chat_url: [], announcement_url: [] },
  image: { thumb: "", small: "", large: "https://example.com/btc.png" },
  sentiment_votes_up_percentage: 75, sentiment_votes_down_percentage: 25,
  watchlist_portfolio_users: 1000000,
  last_updated: "2026-04-14T00:00:00.000Z",
};

describe("CoinGeckoService", () => {
  beforeEach(() => { vi.clearAllMocks(); cacheMock.get.mockResolvedValue(null); global.fetch = vi.fn(); });

  describe("getMarkets", () => {
    it("returns cached markets when available", async () => {
      const cached = [mockMarket];
      cacheMock.get.mockResolvedValue(cached);
      const result = await CoinGeckoService.getMarkets(["bitcoin"]);
      expect(result).toBe(cached);
    });

    it("returns empty array for empty ids", async () => {
      const result = await CoinGeckoService.getMarkets([]);
      expect(result).toEqual([]);
    });

    it("fetches and caches markets on miss", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true, json: async () => [mockMarket],
      });
      const result = await CoinGeckoService.getMarkets(["bitcoin", "ethereum"]);
      expect(result).toHaveLength(1);
      expect(cacheMock.set).toHaveBeenCalled();
    });
  });

  describe("getCoinDetail", () => {
    it("returns cached detail when available", async () => {
      cacheMock.get.mockResolvedValue(mockDetail);
      const result = await CoinGeckoService.getCoinDetail("bitcoin");
      expect(result).toBe(mockDetail);
    });

    it("returns null on API error", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404, text: async () => "Not found" });
      const result = await CoinGeckoService.getCoinDetail("unknown");
      expect(result).toBeNull();
    });
  });

  describe("getOHLC", () => {
    it("returns cached OHLC when available", async () => {
      const cached: CoinGeckoOHLC = [[1713004800000, 65000, 67000, 64000, 66000]];
      cacheMock.get.mockResolvedValue(cached);
      const result = await CoinGeckoService.getOHLC("bitcoin", 7);
      expect(result).toBe(cached);
    });

    it("returns empty array on error", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 429, text: async () => "Rate limited" });
      const result = await CoinGeckoService.getOHLC("bitcoin");
      expect(result).toEqual([]);
    });
  });

  describe("getMarketChart", () => {
    it("returns cached chart when available", async () => {
      const cached: CoinGeckoMarketChart = {
        prices: [[1713004800000, 65000]], market_caps: [[1713004800000, 1200000000000]], total_volumes: [[1713004800000, 30000000000]],
      };
      cacheMock.get.mockResolvedValue(cached);
      const result = await CoinGeckoService.getMarketChart("bitcoin");
      expect(result).toBe(cached);
    });
  });

  describe("getSimplePrice", () => {
    it("returns cached prices when available", async () => {
      const cached = { bitcoin: { usd: 65000, usd_market_cap: 1200000000000, usd_24h_vol: 30000000000, usd_24h_change: 2.5, last_updated_at: 1713004800 } };
      cacheMock.get.mockResolvedValue(cached);
      const result = await CoinGeckoService.getSimplePrice(["bitcoin"]);
      expect(result).toBe(cached);
    });

    it("returns empty object for empty ids", async () => {
      const result = await CoinGeckoService.getSimplePrice([]);
      expect(result).toEqual({});
    });
  });

  describe("getTopCoins", () => {
    it("returns cached top coins when available", async () => {
      cacheMock.get.mockResolvedValue([mockMarket]);
      const result = await CoinGeckoService.getTopCoins(10);
      expect(result).toHaveLength(1);
    });

    it("defaults to 50 coins", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => [mockMarket] });
      await CoinGeckoService.getTopCoins();
      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(call).toContain("per_page=50");
    });
  });

  describe("transformDetailToMetadata", () => {
    it("transforms detail to metadata format", () => {
      const result = CoinGeckoService.transformDetailToMetadata(mockDetail);
      expect(result.marketCapRank).toBe(1);
      expect(result.circulatingSupply).toBe(19000000);
      expect(result.developer).toEqual(expect.objectContaining({ forks: 100, stars: 5000 }));
      expect(result.community).toEqual(expect.objectContaining({ redditSubscribers: 500000 }));
      expect(result.links.twitter).toBe("https://x.com/bitcoin");
    });
  });

  describe("ohlcToOHLCV", () => {
    it("converts OHLC to OHLCV format", () => {
      const ohlc: CoinGeckoOHLC = [[1713004800000, 65000, 67000, 64000, 66000], [1713091200000, 66000, 68000, 65000, 67000]];
      const volumes: [number, number][] = [[1713004800000, 1000000], [1713091200000, 2000000]];
      const result = CoinGeckoService.ohlcToOHLCV(ohlc, volumes);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({ open: 65000, high: 67000, low: 64000, close: 66000, volume: 1000000 }));
    });

    it("deduplicates same-day entries", () => {
      const ohlc: CoinGeckoOHLC = [[1713004800000, 65000, 67000, 64000, 66000], [1713008400000, 66000, 68000, 65000, 67000]];
      const result = CoinGeckoService.ohlcToOHLCV(ohlc);
      expect(result).toHaveLength(1);
    });
  });

  describe("marketChartToOHLCV", () => {
    it("converts market chart to OHLCV using price as all OHLC values", () => {
      const chart: CoinGeckoMarketChart = {
        prices: [[1713004800000, 65000], [1713091200000, 66000]],
        market_caps: [[1713004800000, 1200000000000], [1713091200000, 1250000000000]],
        total_volumes: [[1713004800000, 1000000], [1713091200000, 2000000]],
      };
      const result = CoinGeckoService.marketChartToOHLCV(chart);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({ open: 65000, high: 65000, low: 65000, close: 65000, volume: 1000000 }));
    });
  });

  describe("getGlobalData", () => {
    it("returns cached global data when available", async () => {
      const cached = { totalMarketCap: { usd: 2000000000000 }, totalVolume: { usd: 100000000000 }, btcDominance: 52, ethDominance: 18, activeCryptocurrencies: 10000, markets: 800 };
      cacheMock.get.mockResolvedValue(cached);
      const result = await CoinGeckoService.getGlobalData();
      expect(result).toBe(cached);
    });
  });

  describe("getTrendingCoins", () => {
    it("returns cached trending when available", async () => {
      const cached = [{ id: "pepe", name: "Pepe", symbol: "PEPE", marketCapRank: 45, score: 95 }];
      cacheMock.get.mockResolvedValue(cached);
      const result = await CoinGeckoService.getTrendingCoins();
      expect(result).toBe(cached);
    });

    it("fetches and maps trending coins", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true, json: async () => ({ coins: [{ item: { id: "pepe", name: "Pepe", symbol: "PEPE", market_cap_rank: 45, score: 95 } }] }),
      });
      const result = await CoinGeckoService.getTrendingCoins();
      expect(result[0]).toEqual(expect.objectContaining({ id: "pepe", symbol: "PEPE", score: 95 }));
    });
  });

  describe("getCoinCategories", () => {
    it("returns cached categories when available", async () => {
      const cached = [{ id: "defi", name: "DeFi", marketCap: 50000000000, marketCapChange24h: 2.5, volume: 5000000000 }];
      cacheMock.get.mockResolvedValue(cached);
      const result = await CoinGeckoService.getCoinCategories();
      expect(result).toBe(cached);
    });
  });
});
