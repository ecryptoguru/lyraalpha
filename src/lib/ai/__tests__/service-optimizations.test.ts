/**
 * @vitest-environment node
 * 
 * Tests for service.ts optimizations:
 * - #4+9: Trivial query short-circuit (skip all retrieval)
 * - #5: Real-time price injection (price data passed to context builder)
 * - #8: Parallel execution (RAG + assets + price + cross-sector via Promise.all)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───
// Must mock openai BEFORE config.ts is imported (it creates new OpenAI() at module level)
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: { create: vi.fn() },
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asset: {
      findMany: vi.fn().mockResolvedValue([
        { symbol: "BTC-USD" },
        { symbol: "SOL-USD" },
        { symbol: "BNB-USD" },
        { symbol: "BTC-USD" },
      ]),
      findFirst: vi.fn().mockResolvedValue({ symbol: "SOL-USD", type: "CRYPTO" }),
      findUnique: vi.fn().mockResolvedValue({
        price: 142.30,
        changePercent: 2.15,
        fiftyTwoWeekHigh: 156.80,
        fiftyTwoWeekLow: 90.12,
        lastPriceUpdate: new Date("2026-02-12T00:00:00Z"),
      }),
    },
    marketRegime: {
      findFirst: vi.fn().mockResolvedValue({
        correlationMetrics: {
          crossSector: {
            regime: "Convergent",
            avgCorrelation: 0.65,
            trend: "Rising",
            sectorDispersionIndex: 0.12,
            guidance: "Diversification less effective",
            implications: "Broad risk-on",
          },
        },
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: "user_123", plan: "PRO", credits: 50 }),
      upsert: vi.fn().mockResolvedValue({ plan: "PRO" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    creditTransaction: { create: vi.fn() },
    aIRequestLog: { create: vi.fn() },
    $transaction: vi.fn().mockImplementation(async (cb: any) => {
      const mockTx = {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue({ id: "user_123", credits: 49 }),
          findUnique: vi.fn().mockResolvedValue({ id: "user_123", credits: 49 }),
        },
        creditTransaction: { create: vi.fn() },
      };
      return cb(mockTx);
    }),
  },
}));

vi.mock("@/lib/ai/rag", () => ({
  retrieveInstitutionalKnowledge: vi.fn().mockResolvedValue({
    content: "[KB: engines > Trend]\nThe trend engine measures...",
    sources: [{ title: "engines", url: "/docs/engines", type: "knowledge_base" }],
  }),
  retrieveUserMemory: vi.fn().mockResolvedValue(""),
  storeConversationLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ai/search", () => ({
  searchWeb: vi.fn().mockResolvedValue({ content: "", sources: [] }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("ai", () => ({
  streamText: vi.fn().mockReturnValue({
    textStream: (async function* () { yield "test response"; })(),
  }),
}));


vi.mock("../compress", () => ({
  compressKnowledgeContext: vi.fn().mockImplementation(async (raw: string) => raw),
}));

vi.mock("../orchestration", () => ({
  resolveGptDeployment: vi.fn().mockReturnValue("gpt-5.4-chat"),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn().mockReturnValue(
    Object.assign(vi.fn().mockReturnValue("mock-model"), {
      responses: vi.fn().mockReturnValue("mock-responses-model"),
      chat: vi.fn().mockReturnValue("mock-chat-model"),
    }),
  ),
}));

vi.mock("@/lib/ai/tools", () => ({
  aiTools: {},
  getAllowedTools: vi.fn().mockReturnValue({}),
}));

vi.mock("../monitoring", () => ({
  logModelRouting: vi.fn(),
  logModelCacheEvent: vi.fn(),
  logRetrievalMetric: vi.fn(),
  logContextBudgetMetric: vi.fn(),
}));

vi.mock("@/lib/services/credit.service", () => ({
  consumeCredits: vi.fn().mockResolvedValue({ success: true, remaining: 49 }),
  getCreditCost: vi.fn().mockReturnValue(1),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(async (key: string, value: unknown, options?: { nx?: boolean; ex?: number }) => {
      if (options?.nx) {
        // Set-if-not-exists: only set if key doesn't exist
        // For tests, always return "OK" to simulate successful lock acquisition
        return "OK";
      }
      return "OK";
    }),
    del: vi.fn().mockResolvedValue(1),
    setex: vi.fn().mockResolvedValue("OK"),
  },
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: (e: any) => e,
  createTimer: () => ({ endFormatted: () => "100ms" }),
}));

process.env.AZURE_OPENAI_API_KEY = "test-azure-key";
process.env.AZURE_OPENAI_ENDPOINT = "https://test-resource.cognitiveservices.azure.com";
process.env.AZURE_OPENAI_CHAT_DEPLOYMENT = "gpt-5.4-chat";
process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT = "text-embedding-3-small";

import { _clearPlanCacheForTest, generateLyraStream } from "../service";
import { retrieveInstitutionalKnowledge, retrieveUserMemory } from "../rag";
import { prisma } from "@/lib/prisma";
import { streamText } from "ai";
import * as monitoring from "../monitoring";
import { getCache, setCache } from "@/lib/redis";
import { modelCacheKey } from "../lyra-cache";
import { consumeCredits } from "@/lib/services/credit.service";
import { searchWeb } from "@/lib/ai/search";

describe("Service Optimizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearPlanCacheForTest();
  });

  describe("GPT-5.4 model selection", () => {
    it("uses streamText (single mode) for STARTER SIMPLE queries", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "user_s", plan: "STARTER" } as any);
      await generateLyraStream(
        [{ role: "user", content: "What is RSI?" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_s",
      );
      expect(streamText).toHaveBeenCalled();
    });

    it("uses streamText (single mode) for PRO COMPLEX queries", async () => {
      await generateLyraStream(
        [{ role: "user", content: "Compare BTC-USD vs ETH-USD vs ADA-USD in the current macro environment" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_123",
      );
      expect(streamText).toHaveBeenCalled();
    });

    it("uses streamText (single mode) for ELITE MODERATE queries", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "user_elite", plan: "ELITE" } as any);
      await generateLyraStream(
        [{ role: "user", content: "How is SOL-USD performing this quarter?" }],
        { scores: {}, assetType: "CRYPTO", symbol: "SOL-USD" },
        "user_elite",
      );
      expect(streamText).toHaveBeenCalled();
    });

    it("uses streamText (single mode) for ELITE COMPLEX queries", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "user_elite2", plan: "ELITE" } as any);
      await generateLyraStream(
        [{ role: "user", content: "Compare BTC-USD vs ETH-USD vs ADA-USD portfolio impact and cross-chain correlation analysis" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_elite2",
      );
      expect(streamText).toHaveBeenCalled();
    });

    it("uses streamText (single mode) for ENTERPRISE COMPLEX queries", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "user_ent", plan: "ENTERPRISE" } as any);
      await generateLyraStream(
        [{ role: "user", content: "Compare BTC-USD vs ETH-USD vs ADA-USD portfolio impact and cross-chain correlation analysis" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_ent",
      );
      expect(streamText).toHaveBeenCalled();
    });

    it("streamText result is returned as a stream (ELITE MODERATE single mode)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "user_elite3", plan: "ELITE" } as any);
      const { result } = await generateLyraStream(
        [{ role: "user", content: "How is SOL-USD performing this quarter?" }],
        { scores: {}, assetType: "CRYPTO", symbol: "SOL-USD" },
        "user_elite3",
      );
      const chunks: string[] = [];
      for await (const chunk of result.textStream) {
        if (chunk) chunks.push(chunk);
      }
      expect(chunks.join("")).toBe("test response");
    });
  });

  describe("#4+9 — Trivial query short-circuit", () => {
    const TRIVIAL_QUERIES = [
      "hi",
      "hello",
      "hey",
      "thanks",
      "thank you",
      "ok",
      "okay",
      "got it",
      "sure",
      "yes",
      "no",
      "bye",
      "goodbye",
      "good morning",
      "good evening",
      "Hi!",
      "Hello.",
      "Thanks!",
      "OK?",
    ];

    for (const query of TRIVIAL_QUERIES) {
      it(`skips RAG for trivial query: "${query}"`, async () => {
        await generateLyraStream(
          [{ role: "user", content: query }],
          { scores: {} },
          "user_123",
        );

        expect(retrieveInstitutionalKnowledge).not.toHaveBeenCalled();
        expect(retrieveUserMemory).not.toHaveBeenCalled();
        expect(consumeCredits).not.toHaveBeenCalled();
      });
    }

    it("skips price fetch for trivial queries", async () => {
      await generateLyraStream(
        [{ role: "user", content: "hi" }],
        { scores: {}, symbol: "SOL-USD" },
        "user_123",
      );

      expect(prisma.asset.findUnique).not.toHaveBeenCalled();
    });

    it("skips cross-chain for trivial queries", async () => {
      await generateLyraStream(
        [{ role: "user", content: "thanks" }],
        { scores: {} },
        "user_123",
      );

      expect(prisma.marketRegime.findFirst).not.toHaveBeenCalled();
    });

    it("returns canned response for trivial queries", async () => {
      const result = await generateLyraStream(
        [{ role: "user", content: "hi" }],
        { scores: {} },
        "user_123",
      );

      // Trivial queries return canned response without calling LLM
      expect(streamText).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("returns canned response for trivial queries regardless of env flags", async () => {
      const result = await generateLyraStream(
        [{ role: "user", content: "hi" }],
        { scores: {} },
        "user_123",
      );

      // Trivial queries use canned response optimization — no LLM needed for greetings
      expect(result).toBeDefined();
    });
  });

  describe("non-trivial queries DO trigger retrieval", () => {
    const NON_TRIVIAL = [
      "How is SOL-USD doing?",
      "What are the risks for Bitcoin?",
      "hi there, can you analyze BTC-USD?",
      "hello world",
      "thanks for the analysis, now compare BTC-USD vs ETH-USD",
    ];

    for (const query of NON_TRIVIAL) {
      it(`triggers RAG for: "${query}"`, async () => {
        await generateLyraStream(
          [{ role: "user", content: query }],
          { scores: {}, assetType: "CRYPTO" },
          "user_123",
        );

        expect(retrieveInstitutionalKnowledge).toHaveBeenCalled();
      });
    }
  });

  describe("GPT response cache — read hit", () => {
    it("returns cached GPT response without calling streamText", async () => {
      vi.clearAllMocks();
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ plan: "PRO", credits: 50 } as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb({
        user: { update: vi.fn().mockResolvedValue({ credits: 49 }), findUnique: vi.fn().mockResolvedValue({ credits: 49 }) },
        creditTransaction: { create: vi.fn() },
      }));
      vi.mocked(getCache).mockImplementation(async (key: string) => {
        if (key.startsWith("lyra:model:gpt:")) return "cached gpt output";
        return null;
      });

      const response = await generateLyraStream(
        [{ role: "user", content: "How is SOL-USD doing?" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_123",
      );

      const chunks: string[] = [];
      for await (const chunk of response.result.textStream) {
        if (chunk) chunks.push(chunk);
      }

      expect(chunks.join("")).toBe("cached gpt output");
      expect(streamText).not.toHaveBeenCalled();
      expect(consumeCredits).not.toHaveBeenCalled();
    });
  });

  describe("response-mode cache and web search guards", () => {
    it("separates model cache keys by plan tier and response mode", () => {
      const defaultProKey = modelCacheKey({
        modelFamily: "gpt",
        planTier: "PRO",
        tier: "COMPLEX",
        assetType: "CRYPTO",
        responseMode: "default",
        query: "Compare BTC-USD vs ETH-USD",
      });
      const compareProKey = modelCacheKey({
        modelFamily: "gpt",
        planTier: "PRO",
        tier: "COMPLEX",
        assetType: "CRYPTO",
        responseMode: "compare",
        query: "Compare BTC-USD vs ETH-USD",
      });
      const compareEliteKey = modelCacheKey({
        modelFamily: "gpt",
        planTier: "ELITE",
        tier: "COMPLEX",
        assetType: "CRYPTO",
        responseMode: "compare",
        query: "Compare BTC-USD vs ETH-USD",
      });

      expect(defaultProKey).not.toBe(compareProKey);
      expect(compareProKey).not.toBe(compareEliteKey);
    });

    it("blocks web search for compare mode without recency intent", async () => {
      vi.mocked(searchWeb).mockResolvedValue({ content: "", sources: [] } as any);

      await generateLyraStream(
        [{ role: "user", content: "Compare BTC-USD vs ETH-USD on momentum and valuation" }],
        {
          scores: {},
          assetType: "CRYPTO",
          chatMode: "compare",
          compareContext: [{ symbol: "BTC-USD" }, { symbol: "ETH-USD" }],
        },
        "user_123",
      );

      expect(searchWeb).not.toHaveBeenCalled();
    });

    it("allows web search for compare mode with explicit recency intent", async () => {
      // Restore searchWeb mock (beforeEach clearAllMocks resets implementation to undefined)
      vi.mocked(searchWeb).mockResolvedValue({ content: "latest BTC-USD ETH-USD news", sources: [] } as any);
      // Force cache miss so the parallel block (including web search) is not bypassed
      vi.mocked(getCache).mockResolvedValue(null);
      // ELITE user required — PRO MODERATE has webSearchEnabled:false
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ plan: "ELITE", credits: 50 } as any);

      await generateLyraStream(
        [{ role: "user", content: "Compare BTC-USD vs ETH-USD latest news and current developments" }],
        {
          scores: {},
          assetType: "CRYPTO",
          chatMode: "compare",
          compareContext: [{ symbol: "BTC-USD" }, { symbol: "ETH-USD" }],
        },
        "user_123",
      );

      expect(searchWeb).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        "basic",
        "US",
        expect.any(String), // queryComplexity hint (tier-derived)
      );
    });

    it("routes Indian asset grounding through IN regional search", async () => {
      // Restore searchWeb mock (beforeEach clearAllMocks resets implementation to undefined)
      vi.mocked(searchWeb).mockResolvedValue({ content: "Bitcoin latest news", sources: [] } as any);
      // Force cache miss so the parallel block (including web search) is not bypassed
      vi.mocked(getCache).mockResolvedValue(null);
      // ELITE user required for webSearchEnabled on MODERATE/COMPLEX tier
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ plan: "ELITE", credits: 50 } as any);

      await generateLyraStream(
        [{ role: "user", content: "What are the latest developments for Bitcoin?" }],
        ({
          scores: {},
          symbol: "BTC-USD",
          assetType: "CRYPTO",
          region: "IN",
        } as any),
        "user_123",
        { preResolvedPlan: "ELITE" },
      );

      expect(searchWeb).toHaveBeenCalledWith(
        // Domain steering is now Tavily's internal responsibility (includeDomains param).
        // The query passed to searchWeb is clean: "SYMBOL <user query>"
        expect.stringContaining("BTC-USD"),
        expect.any(Number),
        "basic",
        "IN",
        expect.any(String), // queryComplexity hint (tier-derived)
      );
    });

    it("skips generic RAG for compare mode when rich compare context is already present", async () => {
      vi.clearAllMocks();
      // Restore all mocks reset by clearAllMocks
      vi.mocked(streamText).mockReturnValue({ textStream: (async function* () { yield "test response"; })() } as any);
      vi.mocked(getCache).mockResolvedValue(null);
      vi.mocked(consumeCredits).mockResolvedValue({ success: true, remaining: 49 } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ plan: "PRO", credits: 50 } as any);
      vi.mocked(prisma.asset.findMany).mockResolvedValue([{ symbol: "BTC-USD" }, { symbol: "ETH-USD" }] as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb({
        user: { update: vi.fn().mockResolvedValue({ credits: 49 }), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn().mockResolvedValue({ credits: 49 }) },
        creditTransaction: { create: vi.fn() },
      }));

      await generateLyraStream(
        [{ role: "user", content: "Compare BTC-USD vs ETH-USD on momentum and regime fit" }],
        {
          scores: {},
          assetType: "CRYPTO",
          chatMode: "compare",
          compareContext: [
            { symbol: "BTC-USD", scores: { trend: 78, momentum: 72 } },
            { symbol: "ETH-USD", scores: { trend: 81, momentum: 68 } },
          ],
        },
        "user_123",
      );

      expect(retrieveInstitutionalKnowledge).not.toHaveBeenCalled();
      expect(streamText).toHaveBeenCalled();
    });
  });

  describe("GPT response cache policy", () => {
    it("uses GPT read cache for repeat queries", async () => {
      vi.clearAllMocks();
      // Restore user mock — getUserPlan now hits DB directly (no Redis)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ plan: "PRO", credits: 50 } as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb({
        user: { update: vi.fn().mockResolvedValue({ credits: 49 }), findUnique: vi.fn().mockResolvedValue({ credits: 49 }) },
        creditTransaction: { create: vi.fn() },
      }));
      // Use key-based mock to avoid positional fragility (asset symbols may already be cached)
      vi.mocked(getCache).mockImplementation(async (key: string) => {
        if (key.startsWith("lyra:model:gpt:")) return "cached gpt output";
        return null;
      });

      const response = await generateLyraStream(
        [{ role: "user", content: "Compare BTC-USD vs ETH-USD in the current macro environment" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_123",
      );

      const chunks: string[] = [];
      for await (const chunk of response.result.textStream) {
        if (chunk) chunks.push(chunk);
      }

      expect(chunks.join("")).toBe("cached gpt output");
      expect(streamText).not.toHaveBeenCalled();
    });

    it("does not write GPT model cache on completion", async () => {
      vi.clearAllMocks();
      vi.mocked(getCache).mockResolvedValueOnce(null);

      await generateLyraStream(
        [{ role: "user", content: "Compare BTC-USD vs ETH-USD in the current macro environment" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_123",
      );

      expect(setCache).not.toHaveBeenCalledWith(
        expect.stringContaining("lyra:model:gpt:"),
        expect.anything(),
        expect.any(Number),
      );
    });

    it("logs model cache telemetry for GPT cache miss", async () => {
      vi.clearAllMocks();
      // Restore user mock — getUserPlan now hits DB directly (no Redis)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ plan: "PRO", credits: 50 } as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb({
        user: { update: vi.fn().mockResolvedValue({ credits: 49 }), findUnique: vi.fn().mockResolvedValue({ credits: 49 }) },
        creditTransaction: { create: vi.fn() },
      }));
      // Key-based: all cache misses
      vi.mocked(getCache).mockResolvedValue(null);
      const cacheSpy = vi.spyOn(monitoring, "logModelCacheEvent");

      await generateLyraStream(
        [{ role: "user", content: "Compare BTC-USD vs ETH-USD in the current macro environment" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_123",
      );

      expect(cacheSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          modelFamily: "gpt",
          plan: "PRO",
          tier: "COMPLEX",
          operation: "read",
          outcome: "miss",
        }),
      );
    });
  });

  describe("#5 — Real-time price injection", () => {
    it("fetches price data when symbol is provided", async () => {
      await generateLyraStream(
        [{ role: "user", content: "How is SOL-USD doing?" }],
        { scores: {}, symbol: "SOL-USD", assetType: "CRYPTO" },
        "user_123",
      );

      expect(prisma.asset.findUnique).toHaveBeenCalledWith({
        where: { symbol: "SOL-USD" },
        select: {
          price: true, changePercent: true,
          fiftyTwoWeekHigh: true, fiftyTwoWeekLow: true, lastPriceUpdate: true,
          performanceData: true, signalStrength: true,
          scoreDynamics: true, factorAlignment: true,
          marketCap: true, metadata: true, type: true, region: true,
          description: true, industry: true, sector: true,
          cryptoIntelligence: true,
          category: true, currency: true,
          coingeckoId: true,
        },
      });
    });

    it("does NOT fetch price when symbol is GLOBAL", async () => {
      await generateLyraStream(
        [{ role: "user", content: "How is the market?" }],
        { scores: {}, symbol: "GLOBAL" },
        "user_123",
      );

      expect(prisma.asset.findUnique).not.toHaveBeenCalled();
    });

    it("does NOT fetch price when no symbol", async () => {
      await generateLyraStream(
        [{ role: "user", content: "What is a PE ratio?" }],
        { scores: {} },
        "user_123",
      );

      expect(prisma.asset.findUnique).not.toHaveBeenCalled();
    });

    it("price data is passed to context builder (appears in context message)", async () => {
      await generateLyraStream(
        [{ role: "user", content: "How is SOL-USD doing?" }],
        { scores: {}, symbol: "SOL-USD", assetType: "CRYPTO" },
        "user_123",
      );

      // The streamText call should have a context message containing price data
      const streamCall = vi.mocked(streamText).mock.calls[0][0] as any;
      const contextMsg = streamCall.messages[streamCall.messages.length - 1];
      expect(contextMsg.role).toBe("system");
      expect(contextMsg.content).toContain("[PRICE]");
      expect(contextMsg.content).toContain("142.30");
    });
  });

  describe("#8 — Parallel execution", () => {
    it("fetches assets in parallel with RAG (not sequential)", async () => {
      const callOrder: string[] = [];

      vi.mocked(prisma.asset.findMany).mockReturnValue((async () => {
        callOrder.push("assets-start");
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push("assets-end");
        return [{ symbol: "BTC-USD" }];
      })() as any);

      vi.mocked(retrieveInstitutionalKnowledge).mockImplementation(async () => {
        callOrder.push("rag-start");
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push("rag-end");
        return { content: "test", sources: [] };
      });

      await generateLyraStream(
        [{ role: "user", content: "BTC-USD outlook for next quarter" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_123",
      );

      // Both should start before either ends (parallel execution)
      const assetsStartIdx = callOrder.indexOf("assets-start");
      const ragStartIdx = callOrder.indexOf("rag-start");
      const assetsEndIdx = callOrder.indexOf("assets-end");
      const ragEndIdx = callOrder.indexOf("rag-end");

      // Both start calls should happen before both end calls
      expect(Math.max(assetsStartIdx, ragStartIdx)).toBeLessThan(
        Math.min(assetsEndIdx, ragEndIdx),
      );
    });

    it("cross-chain runs in parallel for COMPLEX queries", async () => {
      await generateLyraStream(
        [{ role: "user", content: "Compare BTC-USD vs ETH-USD vs ADA-USD in the current macro environment" }],
        { scores: {}, symbol: "BTC-USD", assetType: "CRYPTO" },
        "user_123",
        { preResolvedPlan: "ELITE" },
      );

      // Cross-chain should have been called (COMPLEX tier + ELITE plan enables crossSectorEnabled)
      // Note: asset.findMany may be skipped due to in-memory cache from prior tests
      expect(prisma.marketRegime.findFirst).toHaveBeenCalled();
    });
  });

  describe("guardrail integration", () => {
    it("rejects prediction-intent phrases before any retrieval", async () => {
      await expect(
        generateLyraStream(
          [{ role: "user", content: "Predict the target price for BTC-USD" }],
          { scores: {} },
          "user_123",
        ),
      ).rejects.toThrow("price prediction");

      expect(retrieveInstitutionalKnowledge).not.toHaveBeenCalled();
    });

    it("allows analyst target price lookups (data request)", async () => {
      await expect(
        generateLyraStream(
          [{ role: "user", content: "What is the analyst target price for BTC-USD?" }],
          { scores: {}, symbol: "BTC-USD", assetType: "CRYPTO" },
          "user_123",
        ),
      ).resolves.toBeDefined();
    });

    it("allows 'price' alone (not a banned phrase)", async () => {
      await expect(
        generateLyraStream(
          [{ role: "user", content: "What is the current price of BTC-USD?" }],
          { scores: {}, symbol: "BTC-USD", assetType: "CRYPTO" },
          "user_123",
        ),
      ).resolves.toBeDefined();
    });
  });

  describe("tier routing integration", () => {
    it("SIMPLE tier skips memory retrieval", async () => {
      await generateLyraStream(
        [{ role: "user", content: "What is a PE ratio?" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_123",
      );

      // retrieveUserMemory should be called with empty promise for SIMPLE
      // (ragMemoryEnabled = false for SIMPLE tier)
      const ragCall = vi.mocked(retrieveInstitutionalKnowledge);
      expect(ragCall).toHaveBeenCalled();
      // Memory should not be called because SIMPLE tier has ragMemoryEnabled: false
      expect(retrieveUserMemory).not.toHaveBeenCalled();
    });

    it("COMPLEX tier enables cross-chain correlation", async () => {
      await generateLyraStream(
        [{ role: "user", content: "Compare BTC-USD vs ETH-USD portfolio impact and cross-chain correlation" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_123",
        { preResolvedPlan: "ELITE" },
      );

      expect(prisma.marketRegime.findFirst).toHaveBeenCalled();
    });

    it("MODERATE tier does NOT enable cross-chain", async () => {
      await generateLyraStream(
        [{ role: "user", content: "How is SOL-USD doing today?" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_123",
      );
      expect(prisma.marketRegime.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("auto-detected asset hardening", () => {
    it("uses resolved asset type for auto-detected asset RAG, skips early global cache, and returns fallback asset sources", async () => {
      vi.clearAllMocks();
      vi.mocked(getCache).mockResolvedValue(null);
      vi.mocked(retrieveInstitutionalKnowledge).mockResolvedValueOnce({ content: "", sources: [] });
      vi.mocked(prisma.asset.findUnique).mockResolvedValueOnce({
        price: null,
        changePercent: null,
        fiftyTwoWeekHigh: null,
        fiftyTwoWeekLow: null,
        lastPriceUpdate: null,
        performanceData: null,
        signalStrength: null,
        scoreDynamics: null,
        factorAlignment: null,
        marketCap: "3.5T",
        metadata: null,
        type: "CRYPTO",
        description: "Solana",
        industry: "Layer 1",
        sector: "Layer 1",
        cryptoIntelligence: null,
        category: null,
        currency: "USD",
        coingeckoId: null,
      } as any);

      const response = await generateLyraStream(
        [{ role: "user", content: "SOL-USD price" }],
        { scores: {} },
        "user_123",
      );

      expect(retrieveInstitutionalKnowledge).toHaveBeenCalledWith(
        "SOL-USD price",
        expect.any(Number),
        "CRYPTO",
        expect.any(Boolean),
        expect.any(String),
      );

      const earlyGlobalKey = modelCacheKey({
        modelFamily: "gpt",
        tier: "COMPLEX",
        assetType: "GLOBAL",
        query: "SOL-USD price",
      });
      expect(getCache).not.toHaveBeenCalledWith(earlyGlobalKey);

      expect(response.sources).toEqual([
        expect.objectContaining({
          title: "SOL-USD asset intelligence context",
          url: "/dashboard/assets/SOL-USD",
          type: "knowledge_base",
        }),
      ]);

      const streamCall = vi.mocked(streamText).mock.calls[0][0] as any;
      expect(streamCall.system).toContain("## Protocol & Growth");
      expect(streamCall.system).toContain("## Tokenomics Valuation");
      expect(streamCall.system).not.toContain("## Market Pulse");
    });
  });

  describe("context message structure", () => {
    it("appends context as the last system message for optimal prompt caching", async () => {
      await generateLyraStream(
        [{ role: "user", content: "Analyze BTC-USD" }],
        { scores: {}, symbol: "BTC-USD", assetType: "CRYPTO" },
        "user_123",
      );

      const streamCall = vi.mocked(streamText).mock.calls[0][0] as any;
      const lastMsg = streamCall.messages[streamCall.messages.length - 1];
      expect(lastMsg.role).toBe("system");
      expect(lastMsg.content).toContain("### LIVE MARKET CONTEXT");
      expect(lastMsg.content).toContain("[ASSET] BTC-USD");
    });

    it("propagates auto-detected symbol and resolved asset type into final context", async () => {
      vi.mocked(prisma.asset.findUnique).mockResolvedValueOnce({
        price: 142.30,
        changePercent: 2.15,
        fiftyTwoWeekHigh: 156.80,
        fiftyTwoWeekLow: 90.12,
        lastPriceUpdate: new Date("2026-02-12T00:00:00Z"),
        performanceData: null,
        signalStrength: null,
        scoreDynamics: null,
        factorAlignment: null,
        marketCap: null,
        metadata: null,
        type: "CRYPTO",
        description: null,
        industry: null,
        sector: null,
        cryptoIntelligence: null,
        category: null,
        currency: "USD",
        coingeckoId: null,
      } as any);

      await generateLyraStream(
        [{ role: "user", content: "How is SOL-USD doing today?" }],
        { scores: {} },
        "user_123",
      );

      const streamCall = vi.mocked(streamText).mock.calls[0][0] as any;
      const lastMsg = streamCall.messages[streamCall.messages.length - 1];
      expect(lastMsg.content).toContain("[ASSET] SOL-USD");
      expect(lastMsg.content).toContain("Type: CRYPTO");
    });

    it("system prompt includes core identity and rules", async () => {
      await generateLyraStream(
        [{ role: "user", content: "How is BTC-USD?" }],
        { scores: {}, assetType: "CRYPTO" },
        "user_123",
      );

      const streamCall = vi.mocked(streamText).mock.calls[0][0] as any;
      expect(streamCall.system).toContain("Lyra");
      expect(streamCall.system).toContain("### CORE RULES");
    });
  });
});
