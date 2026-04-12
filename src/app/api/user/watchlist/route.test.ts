/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, POST } from "./route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asset: {
      findUnique: vi.fn(),
    },
    watchlistItem: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  })),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

describe("/api/user/watchlist normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as never);
  });

  it("POST normalizes symbol before lookup and persistence", async () => {
    vi.mocked(prisma.asset.findUnique).mockResolvedValue({ id: "asset_1", region: "US" } as never);
    vi.mocked(prisma.watchlistItem.upsert).mockResolvedValue({ id: "w_1" } as never);

    const req = new Request("http://localhost/api/user/watchlist", {
      method: "POST",
      body: JSON.stringify({ symbol: " btc-usd ", region: "US" }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(201);

    expect(prisma.asset.findUnique).toHaveBeenCalledWith({
      where: { symbol: "BTC-USD" },
      select: { id: true, region: true },
    });

    expect(prisma.watchlistItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ symbol: "BTC-USD" }),
      }),
    );
  });

  it("DELETE normalizes symbol before lookup", async () => {
    vi.mocked(prisma.watchlistItem.deleteMany).mockResolvedValue({ count: 1 } as never);

    const req = new Request("http://localhost/api/user/watchlist", {
      method: "DELETE",
      body: JSON.stringify({ symbol: " btc-usd " }),
    });

    const res = await DELETE(req as NextRequest);
    expect(res.status).toBe(200);

    // Code uses deleteMany with nested asset filter (no findUnique call)
    expect(prisma.watchlistItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_123", asset: { symbol: "BTC-USD" } },
    });
  });
});
