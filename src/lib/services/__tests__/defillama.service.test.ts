/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cacheMock } = vi.hoisted(() => ({
  cacheMock: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));
vi.mock("@/lib/redis", () => ({ getCache: cacheMock.get, setCache: cacheMock.set }));

import { DefiLlamaService, DefiLlamaProtocol, DefiLlamaChain } from "../defillama.service";

const mockProtocol: DefiLlamaProtocol = {
  id: "uniswap-v3", name: "Uniswap V3", slug: "uniswap-v3", symbol: "UNI", tvl: 1000000000,
  chainTvls: { ethereum: 900000000, arbitrum: 100000000 }, chains: ["ethereum", "arbitrum"],
  category: "Dexes", change_1h: 0.1, change_1d: 2.5, change_7d: -1.2, mcap: 5000000000, fdv: 6000000000,
};

const mockChain: DefiLlamaChain = {
  gecko_id: "ethereum", tvl: 50000000000, tokenSymbol: "ETH", cmcId: "1027", name: "Ethereum", chainId: 1,
};

describe("DefiLlamaService", () => {
  beforeEach(() => { vi.clearAllMocks(); cacheMock.get.mockResolvedValue(null); global.fetch = vi.fn(); });

  describe("getProtocols", () => {
    it("returns cached protocols when available", async () => {
      const cached = [mockProtocol];
      cacheMock.get.mockResolvedValue(cached);
      const result = await DefiLlamaService.getProtocols();
      expect(result).toBe(cached);
    });

    it("fetches protocols when cache miss", async () => {
      const protocols = [mockProtocol];
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true, json: async () => protocols,
      });
      const result = await DefiLlamaService.getProtocols();
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("uniswap-v3");
      expect(cacheMock.set).toHaveBeenCalled();
    });

    it("returns empty array on API error", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, text: async () => "Error" });
      const result = await DefiLlamaService.getProtocols();
      expect(result).toEqual([]);
    });
  });

  describe("getProtocolDetail", () => {
    it("returns cached detail when available", async () => {
      const cached = { id: "uniswap-v3", name: "Uniswap V3", symbol: "UNI", tvl: [], chainTvls: {}, chains: [], category: "Dexes", mcap: null };
      cacheMock.get.mockResolvedValue(cached);
      const result = await DefiLlamaService.getProtocolDetail("uniswap-v3");
      expect(result).toBe(cached);
    });

    it("returns null on API error", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404, text: async () => "Not found" });
      const result = await DefiLlamaService.getProtocolDetail("unknown");
      expect(result).toBeNull();
    });
  });

  describe("getChains", () => {
    it("returns cached chains when available", async () => {
      const cached = [mockChain];
      cacheMock.get.mockResolvedValue(cached);
      const result = await DefiLlamaService.getChains();
      expect(result).toBe(cached);
    });

    it("fetches chains when cache miss", async () => {
      const chains = [mockChain];
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true, json: async () => chains,
      });
      const result = await DefiLlamaService.getChains();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Ethereum");
    });
  });

  describe("getChainTVL", () => {
    it("returns TVL for existing chain", async () => {
      cacheMock.get.mockResolvedValue([mockChain]);
      const result = await DefiLlamaService.getChainTVL("Ethereum");
      expect(result).toBe(50000000000);
    });

    it("returns null for non-existent chain", async () => {
      cacheMock.get.mockResolvedValue([mockChain]);
      const result = await DefiLlamaService.getChainTVL("NonExistent");
      expect(result).toBeNull();
    });
  });

  describe("getChainName", () => {
    it("returns chain name for known CoinGecko ID", () => {
      expect(DefiLlamaService.getChainName("ethereum")).toBe("Ethereum");
      expect(DefiLlamaService.getChainName("solana")).toBe("Solana");
      expect(DefiLlamaService.getChainName("matic-network")).toBe("Polygon");
    });

    it("returns null for unknown ID", () => {
      expect(DefiLlamaService.getChainName("unknown")).toBeNull();
    });
  });

  describe("getProtocolSlug", () => {
    it("returns protocol slug for known CoinGecko ID", () => {
      expect(DefiLlamaService.getProtocolSlug("uniswap")).toBe("uniswap-v3");
      expect(DefiLlamaService.getProtocolSlug("aave")).toBe("aave-v3");
      expect(DefiLlamaService.getProtocolSlug("maker")).toBe("makerdao");
    });

    it("returns null for unknown ID", () => {
      expect(DefiLlamaService.getProtocolSlug("unknown")).toBeNull();
    });
  });

  describe("getTVLData", () => {
    it("returns chain TVL data for L1 tokens", async () => {
      cacheMock.get.mockResolvedValue([mockChain]);
      const result = await DefiLlamaService.getTVLData("ethereum");
      expect(result).not.toBeNull();
      expect(result?.tvl).toBe(50000000000);
      expect(result?.isChain).toBe(true);
      expect(result?.category).toBe("Layer 1");
    });

    it("returns protocol TVL data for DeFi tokens", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true, json: async () => [mockProtocol],
      });
      const result = await DefiLlamaService.getTVLData("uniswap");
      expect(result).not.toBeNull();
      expect(result?.tvl).toBe(1000000000);
      expect(result?.isChain).toBe(false);
      expect(result?.category).toBe("Dexes");
    });

    it("returns null for unmapped tokens", async () => {
      const result = await DefiLlamaService.getTVLData("unknown-token");
      expect(result).toBeNull();
    });
  });
});
