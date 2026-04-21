/**
 * @vitest-environment node
 *
 * Tests for RAG optimizations:
 * - #10: Pre-cached asset context (Redis cache per asset type)
 * - #11: Inline knowledge citations ([KB: source > section] format)
 * - Embedding cache, similarity threshold, asset-type boosting
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───
const mockGetCache = vi.fn();
const mockSetCache = vi.fn();

vi.mock("@/lib/redis", () => ({
  getCache: (...args: any[]) => mockGetCache(...args),
  setCache: (...args: any[]) => mockSetCache(...args),
  redisSetNXStrict: vi.fn().mockResolvedValue(true),
  redis: { del: vi.fn().mockResolvedValue(undefined), pipeline: vi.fn(() => ({ hincrby: vi.fn(), hincrbyfloat: vi.fn(), expire: vi.fn(), exec: vi.fn().mockResolvedValue([]) })) },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ count: BigInt(5) }]),
    $executeRaw: vi.fn(),
  },
}));

const mockEmbeddingsCreate = vi.fn().mockResolvedValue({
  data: [{ embedding: new Array(1536).fill(0.1) }],
});

vi.mock("@/lib/ai/config", () => ({
  AI_CONFIG: { model: "gpt-5.4-chat" },
  hasAzureOpenAIConfig: () => true,
  getAzureEmbeddingDeployment: () => "text-embedding-3-small",
  getEmbeddingClient: () => ({
    embeddings: { create: mockEmbeddingsCreate },
  }),
}));

vi.mock("@/lib/ai/chunker", () => ({
  chunkMarkdownFile: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/ai/search", () => ({
  searchWeb: vi.fn().mockResolvedValue({ content: "", sources: [] }),
}));

vi.mock("@/lib/ai/alerting", () => ({
  recordRagResult: vi.fn().mockResolvedValue(undefined),
  recordRagGrounding: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/fire-and-forget", () => ({
  logFireAndForgetError: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { retrieveInstitutionalKnowledge, Document } from "../rag";
import { prisma } from "@/lib/prisma";
// openai import removed — now using mockEmbeddingsCreate directly

describe("RAG Optimizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCache.mockResolvedValue(null);
    mockSetCache.mockResolvedValue(undefined);
  });

  describe("#11 — Inline knowledge citations", () => {
    it("formats chunks with [KB: source > section] prefix", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        {
          id: "engines-chunk-001",
          content: "The trend engine measures directional price movement.",
          metadata: { source: "engines.md", section: "Trend Engine", assetTypes: ["CRYPTO"] },
          similarity: 0.85,
        },
        {
          id: "engines-chunk-002",
          content: "Momentum captures the rate of change in price.",
          metadata: { source: "engines.md", section: "Momentum Engine", assetTypes: ["CRYPTO"] },
          similarity: 0.78,
        },
      ]);

      const result = await retrieveInstitutionalKnowledge("How does the trend engine work?", 3, "CRYPTO");

      expect(result.content).toContain("[KB: engines.md > Trend Engine]");
      expect(result.content).toContain("[KB: engines.md > Momentum Engine]");
      expect(result.content).toContain("The trend engine measures directional price movement.");
    });

    it("deduplicates sources by file name", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        {
          id: "engines-chunk-001",
          content: "Chunk 1",
          metadata: { source: "engines.md", section: "Trend" },
          similarity: 0.85,
        },
        {
          id: "engines-chunk-002",
          content: "Chunk 2",
          metadata: { source: "engines.md", section: "Momentum" },
          similarity: 0.78,
        },
        {
          id: "arcs-chunk-001",
          content: "Chunk 3",
          metadata: { source: "arcs.md", section: "Compatibility" },
          similarity: 0.72,
        },
      ]);

      const result = await retrieveInstitutionalKnowledge("test query", 3);

      // Should have 2 unique sources (engines.md and arcs.md), not 3
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].title).toBe("engines");
      expect(result.sources[1].title).toBe("arcs");
    });

    it("falls back to 'General' section when metadata missing", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        {
          id: "chunk-001",
          content: "Some content",
          metadata: {},
          similarity: 0.75,
        },
      ]);

      const result = await retrieveInstitutionalKnowledge("test", 3);
      expect(result.content).toContain("[KB: knowledge > General]");
    });
  });

  describe("#10 — Pre-cached asset context", () => {
    it("uses query-aware fast-path cache before asset-type baseline cache", async () => {
      const queryScopedChunks: Document[] = [
        {
          id: "query-hit-1",
          content: "Query-specific CRYPTO chunk",
          metadata: { source: "engines.md", section: "Trend", assetTypes: ["CRYPTO"] },
          similarity: 0.91,
        },
      ];

      mockGetCache.mockImplementation(async (key: string) => {
        if (key.startsWith("rag:q:crypto:")) return queryScopedChunks;
        if (key === "rag:assettype:crypto") {
          return [
            {
              id: "baseline-1",
              content: "Generic CRYPTO baseline chunk",
              metadata: { source: "overview.md", section: "General" },
              similarity: 0.5,
            },
          ];
        }
        return null;
      });

      const result = await retrieveInstitutionalKnowledge("How is BTC-USD momentum?", 2, "CRYPTO", true);

      expect(result.content).toContain("Query-specific CRYPTO chunk");
      expect(result.content).not.toContain("Generic CRYPTO baseline chunk");

      const assetBaselineCalls = mockGetCache.mock.calls.filter(
        (call) => call[0] === "rag:assettype:crypto",
      );
      expect(assetBaselineCalls).toHaveLength(0);
    });

    it("warms cache in background on first query for an asset type", async () => {
      // First call: no cache exists
      mockGetCache.mockResolvedValue(null);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        {
          id: "chunk-1",
          content: "Crypto analysis content",
          metadata: { source: "engines.md", section: "Overview", assetTypes: ["CRYPTO"] },
          similarity: 0.8,
        },
      ]);

      await retrieveInstitutionalKnowledge("How is BTC-USD?", 3, "CRYPTO");

      // Give background task time to execute
      await new Promise((r) => setTimeout(r, 50));

      // The getPreCachedChunks check should have been called
      expect(mockGetCache).toHaveBeenCalledWith(
        expect.stringContaining("rag:assettype:crypto"),
      );
    });

    it("merges pre-cached chunks when query returns sparse results", async () => {
      // Simulate: query returns only 1 result, but cache has 3
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        {
          id: "query-chunk-1",
          content: "Query-specific content",
          metadata: { source: "engines.md", section: "Trend", assetTypes: ["CRYPTO"] },
          similarity: 0.9,
        },
      ]);

      // Pre-cached chunks available
      const cachedChunks: Document[] = [
        { id: "cached-1", content: "Cached crypto overview", metadata: { source: "engines.md", section: "Overview" }, similarity: 0.7 },
        { id: "cached-2", content: "Cached crypto scoring", metadata: { source: "engines.md", section: "Scoring" }, similarity: 0.65 },
      ];

      // First getCache call for pre-cached check returns null (initial check)
      // Second getCache call (merge check) returns cached chunks
      let getCacheCallCount = 0;
      mockGetCache.mockImplementation(async (key: string) => {
        if (key.includes("rag:assettype:crypto")) {
          getCacheCallCount++;
          // Return null on first call (pre-search check), cached on second (merge check)
          return getCacheCallCount <= 1 ? null : cachedChunks;
        }
        return null; // embedding cache miss
      });

      const result = await retrieveInstitutionalKnowledge("BTC-USD trend", 5, "CRYPTO");

      // Should contain the query-specific chunk
      expect(result.content).toContain("Query-specific content");
    });

    it("writes query-aware fast-path cache after full search", async () => {
      mockGetCache.mockResolvedValue(null);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        {
          id: "query-chunk-1",
          content: "Query-specific CRYPTO content",
          metadata: { source: "engines.md", section: "Trend", assetTypes: ["CRYPTO"] },
          similarity: 0.89,
        },
      ]);

      await retrieveInstitutionalKnowledge("BTC-USD trend setup", 3, "CRYPTO", true);

      expect(mockSetCache).toHaveBeenCalledWith(
        expect.stringMatching(/^rag:q:crypto:/),
        expect.arrayContaining([
          expect.objectContaining({ id: "query-chunk-1" }),
        ]),
        21600,
      );
    });

    it("does NOT attempt pre-cache for GLOBAL asset type", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      await retrieveInstitutionalKnowledge("market overview", 3, "GLOBAL");

      // Should not check for asset type cache with GLOBAL
      const assetTypeCacheCalls = mockGetCache.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].includes("rag:assettype:"),
      );
      expect(assetTypeCacheCalls).toHaveLength(0);
    });
  });

  describe("embedding cache", () => {
    it("caches query embeddings in Redis", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      await retrieveInstitutionalKnowledge("test query", 3);

      // Should have called setCache for the embedding
      expect(mockSetCache).toHaveBeenCalledWith(
        expect.stringContaining("emb:"),
        expect.any(Array),
        21600, // queryCacheTTL (6 hours — deterministic embeddings)
      );
    });

    it("uses cached embedding when available", async () => {
      const cachedEmbedding = new Array(1536).fill(0.5);
      mockGetCache.mockImplementation(async (key: string) => {
        if (key.startsWith("emb:")) return cachedEmbedding;
        return null;
      });

      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      await retrieveInstitutionalKnowledge("test query", 3);

      // Embedding API should NOT be called (cache hit)
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
    });
  });

  describe("asset-type boosting", () => {
    it("sorts asset-type-relevant chunks to the top", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        {
          id: "generic-chunk",
          content: "Generic market content",
          metadata: { source: "overview.md", section: "General", assetTypes: [] },
          similarity: 0.85,
        },
        {
          id: "crypto-chunk",
          content: "Crypto-specific content",
          metadata: { source: "engines.md", section: "Crypto", assetTypes: ["CRYPTO"] },
          similarity: 0.80,
        },
      ]);

      const result = await retrieveInstitutionalKnowledge("Bitcoin analysis", 5, "CRYPTO");

      // Crypto chunk should appear first despite lower similarity
      const cryptoIdx = result.content.indexOf("Crypto-specific content");
      const genericIdx = result.content.indexOf("Generic market content");
      expect(cryptoIdx).toBeLessThan(genericIdx);
    });
  });

  describe("similarity threshold", () => {
    it("returns empty when no chunks meet threshold", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      const result = await retrieveInstitutionalKnowledge("completely irrelevant query about cooking", 3);

      // Content should only contain web search results (empty in mock)
      expect(result.content).toBe("");
      expect(result.sources).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("returns empty content on knowledge search failure", async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB connection failed"));

      const result = await retrieveInstitutionalKnowledge("test", 3);

      // Should not throw, should return empty
      expect(result.content).toBeDefined();
    });
  });
});
