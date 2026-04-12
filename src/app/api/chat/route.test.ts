/**
 * @vitest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Mock dependencies - IMPORTANT: Mock the internal auth utility used by the route
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/ai/service", () => ({
  generateLyraStream: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { generateLyraStream } from "@/lib/ai/service";

vi.mock("@/lib/rate-limit", () => ({
  rateLimitChat: vi.fn().mockResolvedValue({ response: null, success: { headers: {} } }),
}));

vi.mock("@/lib/middleware/plan-gate", () => ({
  getUserPlan: vi.fn().mockResolvedValue("STARTER"),
  normalizePlanTier: vi.fn((p: string) => p ?? "STARTER"),
}));

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as unknown as any);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });

    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns 400 if request body is invalid", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as unknown as any);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ invalid: "data" }),
    });

    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(400);
  });

  it("calls generateLyraStream and returns response on success", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as unknown as any);

    const mockTextStream = (async function* () {
      yield "stream";
    })();

    vi.mocked(generateLyraStream).mockResolvedValue({
      result: {
        textStream: mockTextStream,
      },
      sources: [],
    } as unknown as any);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        symbol: "BTC-USD",
        contextData: { symbol: "BTC-USD" },
      }),
    });

    const res = await POST(req as unknown as NextRequest);

    expect(auth).toHaveBeenCalled();
    expect(generateLyraStream).toHaveBeenCalledWith(
      [{ role: "user", content: "hello" }],
      { scores: {}, symbol: "BTC-USD", regime: undefined, assetName: undefined, assetType: undefined, region: undefined, chatMode: undefined, compareContext: undefined },
      "user_123",
      { sourcesLimit: undefined, skipAssetLinks: false, cacheScope: undefined, preResolvedPlan: "STARTER" },
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 when contextData fails schema validation (invalid region)", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as unknown as any);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
        contextData: { region: "INVALID_REGION" },
      }),
    });

    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 when compareContext contains injection payload (invalid symbol)", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as unknown as any);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "compare" }],
        contextData: {
          compareContext: [{ symbol: "'; DROP TABLE assets; --" }],
        },
      }),
    });

    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(400);
  });

  it("forwards the remaining credits header from generateLyraStream", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as unknown as any);

    const mockTextStream = (async function* () {
      yield "stream";
    })();

    vi.mocked(generateLyraStream).mockResolvedValue({
      result: {
        textStream: mockTextStream,
      },
      sources: [],
      remainingCredits: 42,
    } as unknown as any);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
      }),
    });

    const res = await POST(req as unknown as NextRequest);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Credits-Remaining")).toBe("42");
  });

  it("forwards chatMode from contextData", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as unknown as any);

    const mockTextStream = (async function* () {
      yield "stream";
    })();

    vi.mocked(generateLyraStream).mockResolvedValue({
      result: {
        textStream: mockTextStream,
      },
      sources: [],
    } as unknown as any);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "compare these assets" }],
        symbol: "BTC-USD",
        contextData: {
          symbol: "BTC-USD",
          assetType: "CRYPTO",
          assetName: "Bitcoin",
          chatMode: "compare",
        },
      }),
    });

    await POST(req as unknown as NextRequest);

    expect(generateLyraStream).toHaveBeenCalledWith(
      [{ role: "user", content: "compare these assets" }],
      {
        scores: {},
        symbol: "BTC-USD",
        regime: undefined,
        assetName: "Bitcoin",
        assetType: "CRYPTO",
        region: undefined,
        chatMode: "compare",
        compareContext: undefined,
      },
      "user_123",
      { sourcesLimit: undefined, skipAssetLinks: false, cacheScope: undefined, preResolvedPlan: "STARTER" },
    );
  });

  it("forwards valid compareContext to generateLyraStream", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as unknown as any);

    const mockTextStream = (async function* () { yield "stream"; })();
    vi.mocked(generateLyraStream).mockResolvedValue({
      result: { textStream: mockTextStream },
      sources: [],
    } as unknown as any);

    const compareContext = [
      { symbol: "BTC-USD", name: "Bitcoin", price: 104000, changePercent: 1.2 },
      { symbol: "ETH-USD", name: "Ethereum", price: 3400, changePercent: -0.5 },
    ];

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "compare BTC-USD vs ETH-USD" }],
        contextData: { chatMode: "compare", compareContext },
      }),
    });

    await POST(req as unknown as NextRequest);

    expect(generateLyraStream).toHaveBeenCalledWith(
      [{ role: "user", content: "compare BTC-USD vs ETH-USD" }],
      expect.objectContaining({
        chatMode: "compare",
        compareContext: expect.arrayContaining([
          expect.objectContaining({ symbol: "BTC-USD" }),
          expect.objectContaining({ symbol: "ETH-USD" }),
        ]),
      }),
      "user_123",
      expect.any(Object),
    );
  });

  it("passes region IN from validated contextData through to lyraContext", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as unknown as any);

    const mockTextStream = (async function* () { yield "stream"; })();
    vi.mocked(generateLyraStream).mockResolvedValue({
      result: { textStream: mockTextStream },
      sources: [],
    } as unknown as any);

    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "analyse BTC-USD" }],
        contextData: { symbol: "BTC", region: "US" },
      }),
    });

    await POST(req as unknown as NextRequest);

    expect(generateLyraStream).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ region: "US" }),
      "user_123",
      expect.any(Object),
    );
  });
});
