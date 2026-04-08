/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useSWR from "swr";
import { useWatchlist } from "./use-watchlist";

vi.mock("swr", () => ({
  default: vi.fn(),
}));

describe("useWatchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("isWatchlisted returns true for existing symbol", () => {
    vi.mocked(useSWR).mockReturnValue({
      data: {
        items: [
          {
            id: "1",
            userId: "u1",
            assetId: "a1",
            symbol: "AAPL",
            region: "US",
            note: null,
            createdAt: new Date().toISOString(),
            asset: {
              symbol: "AAPL",
              name: "Apple",
              type: "STOCK",
              price: 100,
              changePercent: 1,
              currency: "USD",
              region: "US",
              marketCap: null,
              sector: null,
              fundHouse: null,
            },
          },
        ],
      },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    } as never);

    const { result } = renderHook(() => useWatchlist());
    expect(result.current.isWatchlisted("AAPL")).toBe(true);
    expect(result.current.isWatchlisted("MSFT")).toBe(false);
  });

  it("toggleWatchlist removes when symbol already exists", async () => {
    const mutate = vi.fn();

    vi.mocked(useSWR).mockReturnValue({
      data: {
        items: [
          {
            id: "1",
            userId: "u1",
            assetId: "a1",
            symbol: "AAPL",
            region: "US",
            note: null,
            createdAt: new Date().toISOString(),
            asset: {
              symbol: "AAPL",
              name: "Apple",
              type: "STOCK",
              price: 100,
              changePercent: 1,
              currency: "USD",
              region: "US",
              marketCap: null,
              sector: null,
              fundHouse: null,
            },
          },
        ],
      },
      error: undefined,
      isLoading: false,
      mutate,
    } as never);

    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as never);

    const { result } = renderHook(() => useWatchlist());

    await act(async () => {
      const ok = await result.current.toggleWatchlist("AAPL", "US");
      expect(ok).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/user/watchlist",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(mutate).toHaveBeenCalledOnce();
  });
});
