import { getEmbeddingClient, getAzureEmbeddingDeployment } from "./config";
import { prisma } from "@/lib/prisma";
import { getCache, setCache, redisSetNXStrict, redis } from "@/lib/redis";
import fs from "fs";
import path from "path";
import { randomUUID, createHash } from "crypto";
import { Source } from "@/lib/lyra-utils";
// searchWeb is now called directly from service.ts as a separate parallel task
import { chunkMarkdownFile } from "./chunker";
import { createLogger } from "@/lib/logger";
import { INJECTION_PATTERNS } from "./guardrails";
import { scrubPIIString } from "./pii-scrub";
import { recordRagResult, recordRagGrounding } from "./alerting";
import { logFireAndForgetError } from "@/lib/fire-and-forget";

const logger = createLogger({ service: "rag" });

// ─── RAG Configuration ───
const RAG_CONFIG = {
  get embeddingModel() {
    return getAzureEmbeddingDeployment();
  },
  embeddingDimensions: 1536,
  // M1: Tier-aware similarity thresholds
  // SIMPLE needs tighter filtering (fewer, more relevant chunks → lower latency + cost)
  // MODERATE uses the proven default
  // COMPLEX gets slightly looser to surface diverse cross-domain context
  similarityThresholds: {
    SIMPLE: 0.50,
    MODERATE: 0.42,
    COMPLEX: 0.38,
  } as Record<string, number>,
  similarityThresholdDefault: 0.42,                    // Fallback for unknown tiers / cache warming
  knowledgeTopK: 5,                                    // Retrieve top 5 chunks (was 2 whole files)
  memoryTopK: 3,                                       // Top 3 past conversations (was 5 — reduced to save ~1600 tokens/request)
  queryCacheTTL: 21600,                                // 6 hours TTL for query embedding cache (deterministic — same input = same vector)
  queryFastPathCacheTTL: 21600,                        // 6 hours TTL for query-aware fast-path chunks
  assetTypeCacheTTL: 86400,                            // 24 hours TTL for pre-cached asset type chunks (KB changes only on deploy)
  knowledgeEmbeddingBatchSize: 100,
  memoryEmbeddingBatchSize: 50,
  memoryEmbeddingConcurrency: 2,
  embeddingMaxRetries: 3,
  memoryProcessingTimeoutMs: 4 * 60 * 1000,
  memoryBackoffBaseMs: 1000,
};

// Types
export interface Document {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity?: number;
}

export type ConversationLogUsage = {
  tokensUsed: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  inputCost?: number;
  outputCost?: number;
  cachedInputCost?: number;
  totalCost?: number;
};

type EmbeddingStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

type PendingMemoryLog = {
  id: string;
  inputQuery: string;
  outputResponse: string;
  embeddingAttempts: number;
  embeddingTextHash: string | null;
};

type MemorySearchOptions = {
  symbol?: string;
};

/** M1: Get similarity threshold for a given query tier with safe fallback. */
function getSimilarityThreshold(tier?: string): number {
  if (tier && tier in RAG_CONFIG.similarityThresholds) {
    return RAG_CONFIG.similarityThresholds[tier];
  }
  return RAG_CONFIG.similarityThresholdDefault;
}

const MEMORY_STOP_WORDS = new Set([
  "what", "when", "where", "which", "about", "this", "that", "with", "from",
  "your", "their", "have", "will", "would", "could", "should", "into", "than",
  "then", "them", "they", "market", "asset", "stock", "query", "how", "does",
  "doing", "today", "current", "latest", "recent",
]);

function extractMemoryKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !MEMORY_STOP_WORDS.has(token))
    .slice(0, 8);
}

function scoreMemoryCandidate(
  doc: { content: string; similarity?: number; metadata: Record<string, unknown> },
  options: MemorySearchOptions,
  keywords: string[],
): number {
  const lowerContent = doc.content.toLowerCase();
  let score = doc.similarity || 0;

  if (options.symbol) {
    const symbol = options.symbol.toUpperCase();
    if (doc.content.toUpperCase().includes(symbol)) {
      score += 0.18;
    } else {
      score -= 0.08;
    }
  }

  const keywordHits = keywords.filter((keyword) => lowerContent.includes(keyword)).length;
  if (keywordHits > 0) {
    score += Math.min(0.12, keywordHits * 0.03);
  }

  const createdAt = doc.metadata.createdAt instanceof Date
    ? doc.metadata.createdAt
    : new Date(String(doc.metadata.createdAt));
  if (!Number.isNaN(createdAt.getTime())) {
    const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= 14) score += 0.05;
    else if (ageDays <= 45) score += 0.02;
  }

  return score;
}

function toPgVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

function isValidVectorString(v: string, expectedDims = 1536): boolean {
  if (!/^\[[\d.,\-e ]+\]$/.test(v)) return false;
  const commaCount = (v.match(/,/g) || []).length;
  return commaCount === expectedDims - 1;
}

// ─── Vector Store (Prisma + pgvector) — Chunked Architecture ───
class PrismaVectorStore {
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  async initialize() {
    if (this.isInitialized) return;
    // Prevent concurrent initialization
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize() {
    if (this.isInitialized) return;

    // Boot-level Redis lock: prevent multiple server instances from hydrating
    // the knowledge base simultaneously (e.g., during a rolling deploy).
    // Uses fail-closed lock (redisSetNXStrict) — if Redis is down, skip hydration
    // rather than risking N instances all embedding the same files in parallel.
    const KB_LOCK_KEY = "rag:kb:hydration_lock";
    const KB_LOCK_TTL = 300; // 5 min — generous for full hydration
    const lockAcquired = await redisSetNXStrict(KB_LOCK_KEY, KB_LOCK_TTL);
    if (!lockAcquired) {
      logger.info("KB hydration lock held by another instance — skipping hydration");
      this.isInitialized = true;
      return;
    }

    try {
    const knowledgeDir = path.join(process.cwd(), "src/lib/ai/knowledge");
    if (!fs.existsSync(knowledgeDir)) {
      logger.warn("Knowledge directory not found");
      return;
    }

    const files = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));

    // Batch check: single query to find which files already have chunks and their stored content hash
    const existingMeta = await prisma.$queryRaw<Array<{ prefix: string; cnt: bigint; contentHash: string | null }>>`
      SELECT
        SPLIT_PART(id, '-chunk-', 1) AS prefix,
        COUNT(*) AS cnt,
        MAX(metadata->>'contentHash') AS "contentHash"
      FROM "KnowledgeDoc"
      WHERE id LIKE '%-chunk-%'
      GROUP BY prefix;
    `;
    const chunkedFiles = new Map(existingMeta.map((r) => [r.prefix, { cnt: Number(r.cnt), contentHash: r.contentHash ?? null }]));

    // Hydrate if: (a) no chunks exist, or (b) file content changed since last embed
    const filesToHydrate = files.filter((file) => {
      const filePrefix = file.replace(".md", "");
      const existing = chunkedFiles.get(filePrefix);
      if (!existing || existing.cnt === 0) return true;
      const content = fs.readFileSync(path.join(knowledgeDir, file), "utf-8");
      const currentHash = createHash("sha256").update(content).digest("hex").slice(0, 16);
      return existing.contentHash !== currentHash;
    });

    if (filesToHydrate.length > 0) {
      logger.warn(
        { filesToHydrate: filesToHydrate.length },
        "Knowledge files missing or stale. Scheduling background hydration (non-blocking).",
      );

      this.hydrateMissingFiles(filesToHydrate, knowledgeDir).catch((e) => {
        logger.error({ err: e }, "Background knowledge hydration failed");
      });
    }

    this.isInitialized = true;

    // Pre-warm asset type caches in background (non-blocking)
    // Ensures first SIMPLE query for any asset type gets a fast-path cache hit
    this.warmAllAssetTypeCaches().catch((e) =>
      logger.warn({ err: e }, "Background asset type cache warming failed"),
    );
    } finally {
      // Release boot-level lock so other instances can hydrate if needed
      redis.del(KB_LOCK_KEY).catch((e) =>
        logger.debug({ err: e }, "Failed to release KB hydration lock (non-critical)"),
      );
    }
  }

  private async hydrateMissingFiles(files: string[], knowledgeDir: string): Promise<void> {
    for (const file of files) {
      const content = fs.readFileSync(path.join(knowledgeDir, file), "utf-8");
      const contentHash = createHash("sha256").update(content).digest("hex").slice(0, 16);
      const chunks = chunkMarkdownFile(content, file);
      // Inject contentHash into every chunk's metadata so stale-check works on next boot
      for (const chunk of chunks) {
        (chunk.metadata as Record<string, unknown>).contentHash = contentHash;
      }
      logger.info({ file, chunkCount: chunks.length, contentHash }, "Chunking knowledge file");

      const filePrefix = file.replace(".md", "");
      await prisma.$executeRaw`DELETE FROM "KnowledgeDoc" WHERE id LIKE ${filePrefix + "-%"};`;

      let successCount = 0;
      let failedCount = 0;
      const batches = chunkArray(chunks, RAG_CONFIG.knowledgeEmbeddingBatchSize);

      for (const [index, batch] of batches.entries()) {
        const batchStart = Date.now();
        try {
          const embeddings = await this.getEmbeddingsBatch(
            batch.map((chunk) => chunk.content),
            RAG_CONFIG.embeddingMaxRetries,
          );

          for (const [chunkIndex, chunk] of batch.entries()) {
            try {
              const embedding = embeddings[chunkIndex];
              const embeddingVector = toPgVectorLiteral(embedding);
              const metadataJson = JSON.stringify(chunk.metadata);

              await prisma.$executeRaw`
                INSERT INTO "KnowledgeDoc" (id, content, metadata, embedding, "createdAt")
                VALUES (${chunk.id}, ${chunk.content}, ${metadataJson}::jsonb, ${embeddingVector}::vector, NOW())
                ON CONFLICT (id) DO UPDATE
                SET content = ${chunk.content}, metadata = ${metadataJson}::jsonb, embedding = ${embeddingVector}::vector;
              `;
              successCount += 1;
            } catch (e) {
              failedCount += 1;
              logger.error({ err: e, chunkId: chunk.id }, "Failed to persist embedded chunk");
            }
          }

          logger.info(
            {
              batchType: "knowledge",
              file,
              batchNumber: index + 1,
              totalBatches: batches.length,
              size: batch.length,
              durationMs: Date.now() - batchStart,
              successCount,
              failedCount,
            },
            "Knowledge embedding batch completed",
          );
        } catch (e) {
          failedCount += batch.length;
          logger.error(
            {
              err: e,
              batchType: "knowledge",
              file,
              batchNumber: index + 1,
              totalBatches: batches.length,
              size: batch.length,
              durationMs: Date.now() - batchStart,
              successCount,
              failedCount,
            },
            "Knowledge embedding batch failed",
          );
        }
      }

      logger.info(
        { file, stored: successCount, failed: failedCount },
        "Knowledge file chunked and embedded",
      );
    }
  }

  /** Pre-warm Redis caches for all 6 asset types (background, non-blocking) */
  private async warmAllAssetTypeCaches(): Promise<void> {
    const types = ["CRYPTO", "GLOBAL"];
    await Promise.all(
      types.map(async (assetType) => {
        const existing = await this.getPreCachedChunks(assetType);
        if (existing) {
          logger.debug({ assetType }, "Asset type cache already warm");
          return;
        }
        await this.warmAssetTypeCache(assetType);
      }),
    );
    logger.info("All asset type caches warmed");
  }

  // ─── Embedding Generation (with Redis cache for queries) ───
  async getEmbedding(text: string, useCache = false, retries = 3): Promise<number[]> {
    // Check Redis cache for query embeddings (avoids redundant API calls)
    if (useCache) {
      const cacheKey = `emb:${hashText(text)}`;
      const cached = await getCache<number[]>(cacheKey);
      if (cached) return cached;

      const embedding = await this._callEmbeddingAPI(text, retries);
      await setCache(cacheKey, embedding, RAG_CONFIG.queryCacheTTL);
      return embedding;
    }

    return this._callEmbeddingAPI(text, retries);
  }

  private async _callEmbeddingAPI(text: string, retries: number): Promise<number[]> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await getEmbeddingClient().embeddings.create({
          model: RAG_CONFIG.embeddingModel,
          input: text,
          dimensions: RAG_CONFIG.embeddingDimensions,
          encoding_format: "float",
        });
        return response.data[0].embedding;
      } catch (error) {
        if (attempt === retries) {
          logger.error({ err: error, attempt }, "Embedding generation failed - returning empty array for graceful degradation");
          // Return empty array instead of throwing to allow system to continue without RAG context
          return [];
        }
        const jitter = Math.floor(Math.random() * 250);
        const delayMs = RAG_CONFIG.memoryBackoffBaseMs * Math.pow(2, attempt - 1) + jitter;
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs),
        );
      }
    }
    logger.error("Embedding generation failed after all retries - returning empty array");
    return [];
  }

  private async getEmbeddingsBatch(texts: string[], retries: number): Promise<number[][]> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await getEmbeddingClient().embeddings.create({
          model: RAG_CONFIG.embeddingModel,
          input: texts,
          dimensions: RAG_CONFIG.embeddingDimensions,
          encoding_format: "float",
        });
        return response.data.map((item) => item.embedding);
      } catch (error) {
        if (attempt === retries) {
          logger.error({ err: error, attempt, batchSize: texts.length }, "Batch embedding generation failed - returning empty arrays for graceful degradation");
          // Return empty arrays instead of throwing to allow system to continue without RAG context
          return texts.map(() => []);
        }

        const jitter = Math.floor(Math.random() * 250);
        const delayMs = RAG_CONFIG.memoryBackoffBaseMs * Math.pow(2, attempt - 1) + jitter;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    logger.error("Batch embedding generation failed after all retries - returning empty arrays");
    return texts.map(() => []);
  }

  async processPendingMemoryEmbeddings(): Promise<{
    claimed: number;
    done: number;
    failed: number;
    skipped: number;
  }> {
    const runStart = Date.now();
    const staleCutoff = new Date(Date.now() - RAG_CONFIG.memoryProcessingTimeoutMs);

    await prisma.$executeRaw`
      UPDATE "AIRequestLog"
      SET "embeddingStatus" = 'PENDING',
          "embeddingProcessingAt" = NULL
      WHERE "embeddingStatus" = 'PROCESSING'
        AND "embeddingProcessingAt" < ${staleCutoff};
    `;

    const pending = await prisma.$queryRaw<PendingMemoryLog[]>`
      WITH claimed AS (
        UPDATE "AIRequestLog"
        SET "embeddingStatus" = 'PROCESSING',
            "embeddingProcessingAt" = NOW()
        WHERE id IN (
          SELECT id
          FROM "AIRequestLog"
          WHERE "embeddingStatus" = 'PENDING'
            AND "embeddingAttempts" < ${RAG_CONFIG.embeddingMaxRetries}
            AND "inputQuery" IS NOT NULL
            AND "outputResponse" IS NOT NULL
          ORDER BY "createdAt" ASC
          LIMIT ${RAG_CONFIG.memoryEmbeddingBatchSize}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, "inputQuery", "outputResponse", "embeddingAttempts", "embeddingTextHash"
      )
      SELECT * FROM claimed;
    `;

    if (pending.length === 0) {
      return { claimed: 0, done: 0, failed: 0, skipped: 0 };
    }

    let done = 0;
    let failed = 0;
    let skipped = 0;
    const workers = Math.max(1, Math.min(RAG_CONFIG.memoryEmbeddingConcurrency, pending.length));
    const workBatches = chunkArray(pending, Math.ceil(pending.length / workers));

    await Promise.all(
      workBatches.map(async (batch) => {
        if (batch.length === 0) return;

        const batchStart = Date.now();
        const texts = batch.map((item) => `User: ${item.inputQuery}\nLyra: ${item.outputResponse}`);
        const hashes = texts.map((text) => hashText(text));

        const toEmbedIndices = hashes
          .map((hash, idx) => ({ hash, idx }))
          .filter(({ hash, idx }) => batch[idx].embeddingTextHash !== hash);

        if (toEmbedIndices.length === 0) {
          skipped += batch.length;
          for (const item of batch) {
            await prisma.$executeRaw`
              UPDATE "AIRequestLog"
              SET "embeddingStatus" = 'DONE',
                  "embeddedAt" = NOW(),
                  "embeddingProcessingAt" = NULL,
                  "lastEmbeddingError" = NULL
              WHERE id = ${item.id};
            `;
          }
          return;
        }

        try {
          const embeddings = await this.getEmbeddingsBatch(
            toEmbedIndices.map(({ idx }) => texts[idx]),
            RAG_CONFIG.embeddingMaxRetries,
          );

          for (const [embedIdx, target] of toEmbedIndices.entries()) {
            const item = batch[target.idx];
            const embeddingVector = toPgVectorLiteral(embeddings[embedIdx]);
            await prisma.$executeRaw`
              UPDATE "AIRequestLog"
              SET embedding = ${embeddingVector}::vector,
                  "embeddingStatus" = 'DONE',
                  "embeddingTextHash" = ${target.hash},
                  "embeddedAt" = NOW(),
                  "embeddingProcessingAt" = NULL,
                  "lastEmbeddingError" = NULL
              WHERE id = ${item.id};
            `;
            done += 1;
          }

          for (const [idx, item] of batch.entries()) {
            if (!toEmbedIndices.some((target) => target.idx === idx)) {
              await prisma.$executeRaw`
                UPDATE "AIRequestLog"
                SET "embeddingStatus" = 'DONE',
                    "embeddedAt" = NOW(),
                    "embeddingProcessingAt" = NULL,
                    "lastEmbeddingError" = NULL
                WHERE id = ${item.id};
              `;
              skipped += 1;
            }
          }

          logger.info(
            {
              batchType: "memory",
              size: batch.length,
              embedded: toEmbedIndices.length,
              skipped: batch.length - toEmbedIndices.length,
              durationMs: Date.now() - batchStart,
              retryCount: 0,
            },
            "Memory embedding batch completed",
          );
        } catch (error) {
          failed += batch.length;
          for (const item of batch) {
            const nextAttempts = item.embeddingAttempts + 1;
            const nextStatus: EmbeddingStatus =
              nextAttempts >= RAG_CONFIG.embeddingMaxRetries ? "FAILED" : "PENDING";
            await prisma.$executeRaw`
              UPDATE "AIRequestLog"
              SET "embeddingAttempts" = "embeddingAttempts" + 1,
                  "embeddingStatus" = ${nextStatus},
                  "embeddingProcessingAt" = NULL,
                  "lastEmbeddingError" = ${String(error)}
              WHERE id = ${item.id};
            `;
          }

          logger.error(
            {
              err: error,
              batchType: "memory",
              size: batch.length,
              durationMs: Date.now() - batchStart,
            },
            "Memory embedding batch failed",
          );
        }
      }),
    );

    logger.info(
      {
        event: "memory_embedding_cron",
        claimed: pending.length,
        done,
        failed,
        skipped,
        durationMs: Date.now() - runStart,
      },
      "Memory embedding cron run completed",
    );

    return { claimed: pending.length, done, failed, skipped };
  }

  // ─── Pre-cached Asset Type Context (#10) ───
  // For asset-specific chats, we can skip the embedding+pgvector round-trip
  // by pre-caching the top chunks per asset type in Redis.
  async getPreCachedChunks(assetType: string): Promise<Document[] | null> {
    const cacheKey = `rag:assettype:${assetType.toLowerCase()}`;
    const cached = await getCache<Document[]>(cacheKey);
    return cached;
  }

  private buildQueryFastPathCacheKey(query: string, assetType: string): string {
    const normalizedQuery = normalizeCacheQuery(query);
    return `rag:q:${assetType.toLowerCase()}:${hashText(normalizedQuery)}`;
  }

  async getQueryFastPathChunks(query: string, assetType: string): Promise<Document[] | null> {
    const cacheKey = this.buildQueryFastPathCacheKey(query, assetType);
    return getCache<Document[]>(cacheKey);
  }

  async setQueryFastPathChunks(query: string, assetType: string, docs: Document[]): Promise<void> {
    if (!docs.length) return;
    const cacheKey = this.buildQueryFastPathCacheKey(query, assetType);
    await setCache(cacheKey, docs, RAG_CONFIG.queryFastPathCacheTTL);
  }

  async warmAssetTypeCache(assetType: string): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    const cacheKey = `rag:assettype:${assetType.toLowerCase()}`;

    // Use a representative query per asset type to find the most relevant chunks
    const typeQueries: Record<string, string> = {
      CRYPTO: "crypto bitcoin network health volatility risk on-chain",
      GLOBAL: "market regime risk macro cross-asset correlation",
    };

    const query = typeQueries[assetType] || typeQueries.GLOBAL;
    const queryEmbedding = await this.getEmbedding(query);
    const vectorString = toPgVectorLiteral(queryEmbedding);

    if (!isValidVectorString(vectorString)) {
      logger.error({ assetType }, "Invalid vector string from embedding API — skipping cache warm");
      return;
    }

    type KnowledgeResult = { id: string; content: string; metadata: Record<string, unknown>; similarity: number };

    try {
      // R6-FIX: Use $queryRaw with Prisma.sql for type-safe parameterized queries.
      // $queryRawUnsafe bypasses Prisma's SQL injection protection entirely.
      // Prisma.sql ensures all values are properly parameterized at the driver level.
      const results = await prisma.$queryRaw<KnowledgeResult[]>`
        SELECT id, content, metadata, 1 - (embedding <=> ${vectorString}::vector) as similarity
        FROM "KnowledgeDoc"
        WHERE 1 - (embedding <=> ${vectorString}::vector) >= ${RAG_CONFIG.similarityThresholdDefault}
        ORDER BY embedding <=> ${vectorString}::vector ASC
        LIMIT ${RAG_CONFIG.knowledgeTopK};
      `;

      const docs: Document[] = results.map((r) => ({
        id: r.id, content: r.content, metadata: r.metadata, similarity: r.similarity,
      }));

      await setCache(cacheKey, docs, RAG_CONFIG.assetTypeCacheTTL);
      logger.info({ assetType, chunks: docs.length }, "Asset type cache warmed");
    } catch (e) {
      logger.error({ err: e, assetType }, "Failed to warm asset type cache");
    }
  }

  // ─── Knowledge Search (chunked, with similarity threshold) ───
  async searchKnowledge(
    query: string,
    k: number = RAG_CONFIG.knowledgeTopK,
    assetType?: string,
    useFastPath: boolean = false,
    tier?: string,
  ): Promise<Document[]> {
    if (!this.isInitialized) await this.initialize();

    // FAST PATH L2: query-aware cache first (assetType + normalized query)
    // Prevents low-relevance reuse from generic asset-only cache keys.
    if (useFastPath && assetType && assetType !== "GLOBAL") {
      const queryCached = await this.getQueryFastPathChunks(query, assetType);
      if (queryCached && queryCached.length > 0) {
        logger.info(
          { assetType, chunks: queryCached.length },
          "RAG fast path: using query-aware cached chunks",
        );
        return queryCached.slice(0, k);
      }

      // FAST PATH L1: baseline prewarmed asset type chunks
      const cached = await this.getPreCachedChunks(assetType);
      if (cached && cached.length > 0) {
        logger.info({ assetType, chunks: cached.length }, "RAG fast path: using pre-cached chunks");
        return cached.slice(0, k);
      }
      // Cache miss — fall through to full embedding search and warm cache
      logger.debug({ assetType }, "RAG fast path miss — falling through to embedding search");
      void Promise.resolve().then(() => this.warmAssetTypeCache(assetType)).catch((e) => logFireAndForgetError(e, "warm-asset-cache"));
    }

    // FULL PATH: Embed query → pgvector similarity search
    // Cache the query embedding (same query = same vector)
    const queryEmbedding = await this.getEmbedding(query, true);
    const vectorString = toPgVectorLiteral(queryEmbedding);

    if (!isValidVectorString(vectorString)) {
      logger.error({ query: query.slice(0, 80) }, "Invalid vector string from embedding API — skipping knowledge search");
      return [];
    }

    type KnowledgeResult = {
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      similarity: number;
    };

    try {
      // R6-FIX: Use $queryRaw with Prisma.sql for type-safe parameterized queries.
      const similarityThreshold = getSimilarityThreshold(tier);
      const results = await prisma.$queryRaw<KnowledgeResult[]>`
        SELECT id, content, metadata, 1 - (embedding <=> ${vectorString}::vector) as similarity
        FROM "KnowledgeDoc"
        WHERE 1 - (embedding <=> ${vectorString}::vector) >= ${similarityThreshold}
        ORDER BY embedding <=> ${vectorString}::vector ASC
        LIMIT ${k};
      `;

      // If assetType provided, boost relevant chunks to the top
      if (assetType && assetType !== "GLOBAL") {
        results.sort((a, b) => {
          const aRelevant = (a.metadata as { assetTypes?: string[] })?.assetTypes?.includes(assetType) ? 1 : 0;
          const bRelevant = (b.metadata as { assetTypes?: string[] })?.assetTypes?.includes(assetType) ? 1 : 0;
          if (aRelevant !== bRelevant) return bRelevant - aRelevant;
          return b.similarity - a.similarity;
        });

        // Merge with pre-cached chunks if query search returned fewer than requested
        if (results.length < k) {
          const cached = await this.getPreCachedChunks(assetType);
          if (cached) {
            const seenIds = new Set(results.map((r) => r.id));
            for (const doc of cached) {
              if (!seenIds.has(doc.id) && results.length < k) {
                results.push({ id: doc.id, content: doc.content, metadata: doc.metadata as Record<string, unknown>, similarity: doc.similarity || 0 });
              }
            }
          }
        }
      }

      logger.debug({ found: results.length, threshold: getSimilarityThreshold(tier), tier: tier ?? "unknown" }, "Knowledge search completed");

      // Warm asset type cache in background if not already cached
      if (assetType && assetType !== "GLOBAL") {
        this.getPreCachedChunks(assetType).then((cached) => {
          if (!cached) void Promise.resolve().then(() => this.warmAssetTypeCache(assetType!)).catch((e) => logFireAndForgetError(e, "warm-asset-cache"));
        }).catch((e) => logFireAndForgetError(e, "precache-check"));

        this.setQueryFastPathChunks(
          query,
          assetType,
          results.map((r) => ({
            id: r.id,
            content: r.content,
            metadata: r.metadata,
            similarity: r.similarity,
          })),
        ).catch((e) => logFireAndForgetError(e, "query-fast-path-cache"));
      }

      const mappedResults = results.map((r) => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        similarity: r.similarity,
      }));

      // SEC-1: Post-retrieval injection scan — drop chunks that contain injection patterns.
      // Defends against poisoned knowledge base entries attempting to hijack LLM behaviour.
      // R2-FIX: Normalize to NFKC before pattern matching to defeat Unicode homoglyph evasion.
      const cleanResults = mappedResults.filter((doc) => {
        const normalizedContent = doc.content.normalize("NFKC");
        for (const pattern of INJECTION_PATTERNS) {
          if (pattern.test(normalizedContent)) {
            logger.warn(
              { event: "rag_injection_filtered", docId: doc.id, similarity: doc.similarity },
              "RAG chunk dropped — matched injection pattern",
            );
            return false;
          }
        }
        return true;
      });

      // RAG-1: Low-grounding confidence log + sliding-window alert.
      // Per-request log warns when avg similarity is low; recordRagGrounding tracks the
      // rate over a 15-min window and fires a webhook when sustained low grounding is detected.
      if (tier && tier !== "SIMPLE" && cleanResults.length > 0) {
        const avgSimilarity = cleanResults.reduce((sum, r) => sum + r.similarity, 0) / cleanResults.length;
        if (avgSimilarity < 0.45) {
          logger.warn(
            { event: "rag_low_grounding", avgSimilarity: avgSimilarity.toFixed(3), tier, chunks: cleanResults.length },
            "RAG low-grounding warning — avg similarity below 0.45, responses may be weakly grounded",
          );
        }
        recordRagGrounding(avgSimilarity, tier).catch((e) => logFireAndForgetError(e, "rag-grounding-alert"));
      }

      return cleanResults;
    } catch (e) {
      logger.error({ err: e }, "Knowledge search failed");
      return [];
    }
  }

  // ─── User Memory Search ───
  async searchUserMemory(
    userId: string,
    query: string,
    k: number = RAG_CONFIG.memoryTopK,
    options: MemorySearchOptions = {},
  ): Promise<Document[]> {
    const queryEmbedding = await this.getEmbedding(query, true);
    const vectorString = toPgVectorLiteral(queryEmbedding);

    // R6-FIX: Guard against empty embedding — when the embedding API fails after all retries,
    // _callEmbeddingAPI returns [] which produces an invalid vector string. Running a pgvector
    // query with an empty vector produces undefined similarity distances and random results.
    if (!isValidVectorString(vectorString)) {
      logger.error({ query: query.slice(0, 80) }, "Invalid vector string from embedding API — skipping user memory search");
      return [];
    }

    try {
      type RawLog = {
        id: string;
        inputQuery: string;
        outputResponse: string;
        createdAt: Date;
        similarity: number;
      };

      const results = await prisma.$queryRaw<RawLog[]>`
        SELECT id, "inputQuery", "outputResponse", "createdAt",
               1 - (embedding <=> ${vectorString}::vector) as similarity
        FROM "AIRequestLog"
        WHERE "userId" = ${userId}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${vectorString}::vector) >= ${RAG_CONFIG.similarityThresholdDefault}
        ORDER BY embedding <=> ${vectorString}::vector ASC
        LIMIT ${Math.max(k * 4, 8)};
      `;

      const docs = results.map((r) => ({
        id: r.id,
        content: `User: ${r.inputQuery}\nLyra: ${truncateForContext(r.outputResponse, 150)}`,
        metadata: { createdAt: r.createdAt },
        similarity: r.similarity,
      }));

      const keywords = extractMemoryKeywords(query);
      return docs
        .map((doc) => ({
          doc,
          score: scoreMemoryCandidate(doc, options, keywords),
        }))
        .filter((candidate) => candidate.score >= Math.max(RAG_CONFIG.similarityThresholdDefault + 0.04, 0.46))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map((candidate) => candidate.doc);
    } catch (e) {
      logger.error({ err: e }, "Memory retrieval failed");
      return [];
    }
  }

  // ─── Conversation Log Storage (non-blocking embedding) ───
  // Inserts the log row immediately, then embeds asynchronously in background.
  // This removes ~200-400ms from the response completion path.
  async storeLog(
    userId: string,
    input: string,
    output: string,
    model: string,
    usage: ConversationLogUsage,
    complexity: string | null = null,
    conversationLength: number = 1,
    wasFallback: boolean = false,
  ) {
    // Security: Enforce length limits to prevent storage abuse
    
    if (input.length > MAX_INPUT_LENGTH) {
      logger.warn(
        { userId, inputLength: input.length, maxLength: MAX_INPUT_LENGTH },
        "Input exceeds maximum length, truncating",
      );
      input = input.slice(0, MAX_INPUT_LENGTH);
    }
    
    if (output.length > MAX_OUTPUT_LENGTH) {
      logger.warn(
        { userId, outputLength: output.length, maxLength: MAX_OUTPUT_LENGTH },
        "Output exceeds maximum length, truncating",
      );
      output = output.slice(0, MAX_OUTPUT_LENGTH);
    }

    // B3-FIX: Scrub PII before storing in DB — prevents email/phone/user-id leaks in logs
    input = scrubPIIString(input);
    output = scrubPIIString(output);

    const id = randomUUID();
    const shouldQueueEmbedding = conversationLength >= 3;
    const combinedText = `User: ${input}\nLyra: ${output}`;
    const embeddingTextHash = shouldQueueEmbedding ? hashText(combinedText) : null;
    const embeddingStatus: EmbeddingStatus = shouldQueueEmbedding ? "PENDING" : "DONE";

    // 1. Insert row immediately WITHOUT embedding (fast path)
    await prisma.$executeRaw`
      INSERT INTO "AIRequestLog" (
        id,
        "userId",
        "inputQuery",
        "outputResponse",
        model,
        "tokensUsed",
        complexity,
        "inputTokens",
        "outputTokens",
        "cachedInputTokens",
        "reasoningTokens",
        "wasFallback",
        "inputCost",
        "outputCost",
        "cachedInputCost",
        "totalCost",
        "embeddingStatus",
        "embeddingAttempts",
        "embeddingProcessingAt",
        "embeddingTextHash",
        "embeddedAt",
        "createdAt"
      )
      VALUES (
        ${id},
        ${userId},
        ${input},
        ${output},
        ${model},
        ${usage.tokensUsed},
        ${complexity ?? null},
        ${usage.inputTokens ?? null},
        ${usage.outputTokens ?? null},
        ${usage.cachedInputTokens ?? null},
        ${usage.reasoningTokens ?? null},
        ${wasFallback},
        ${usage.inputCost ?? null},
        ${usage.outputCost ?? null},
        ${usage.cachedInputCost ?? null},
        ${usage.totalCost ?? null},
        ${embeddingStatus},
        0,
        NULL,
        ${embeddingTextHash},
        ${shouldQueueEmbedding ? null : new Date()},
        NOW()
      );
    `;

    logger.debug(
      { logId: id, shouldQueueEmbedding, embeddingStatus },
      "Conversation log stored for async embedding pipeline",
    );
  }

  // Legacy compatibility
  async similaritySearch(query: string, k = 1): Promise<Document[]> {
    return this.searchKnowledge(query, k);
  }
}

export async function processPendingConversationEmbeddings() {
  return vectorStore.processPendingMemoryEmbeddings();
}

// ─── Truncate response for context injection (keeps full text in DB for embedding quality) ───
function truncateForContext(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
}

// ─── Collision-resistant hash for cache keys (SHA-256, truncated to 24 hex chars) ───
// 24 hex chars = 96 bits, significantly reducing collision probability vs 16 chars (64 bits)
export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

function normalizeCacheQuery(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// ─── Exports ───
export const vectorStore = new PrismaVectorStore();

// ─── Security constants ───────────────────────────────────────────────────────
export const MAX_INPUT_LENGTH = 50000; // ~10k words - prevents storage abuse
export const MAX_OUTPUT_LENGTH = 100000; // ~20k words - prevents storage abuse

export async function retrieveContext(query: string): Promise<string> {
  const { content } = await retrieveInstitutionalKnowledge(query);
  return content;
}

export interface KnowledgeRetrievalResult {
  content: string;
  sources: Source[];
  /** Similarity scores of retrieved chunks for quality metrics (0-1) */
  similarities: number[];
  /** Number of chunks retrieved */
  chunkCount: number;
}

export async function retrieveInstitutionalKnowledge(
  query: string,
  topK: number = RAG_CONFIG.knowledgeTopK,
  assetType?: string,
  useFastPath: boolean = false,
  tier?: string,
): Promise<KnowledgeRetrievalResult> {
  let content = "";
  const sources: Source[] = [];
  const similarities: number[] = [];

  try {
    // 1. Chunked Knowledge Retrieval (topK relevant chunks, threshold-filtered)
    try {
      const localDocs = await vectorStore.searchKnowledge(query, topK, assetType, useFastPath, tier);
      if (localDocs.length > 0) {
        // Deduplicate sources by file
        const seenSources = new Set<string>();

        content += localDocs
          .map((d) => {
            const section = (d.metadata as { section?: string }).section || "General";
            const source = (d.metadata as { source?: string }).source || "knowledge";
            return `[KB: ${source} > ${section}]\n${d.content}`;
          })
          .join("\n\n");

        for (const d of localDocs) {
          const source = (d.metadata as { source?: string }).source || "";
          if (!seenSources.has(source)) {
            seenSources.add(source);
            sources.push({
              title: source.replace(".md", ""),
              url: `/docs/${source.replace(".md", "")}`,
              type: "knowledge_base" as const,
            });
          }
          // Capture similarity for quality metrics
          if (d.similarity != null) {
            similarities.push(d.similarity);
          }
        }

        const docSimilarities = localDocs.map((d) => d.similarity || 0);
        logger.info(
          {
            chunks: localDocs.length,
            avgSimilarity: +(docSimilarities.reduce((s, v) => s + v, 0) / docSimilarities.length).toFixed(3),
            minSimilarity: +Math.min(...docSimilarities).toFixed(3),
          },
          "Knowledge retrieval completed",
        );
      }
      // OBS-1: Record RAG result for zero-result rate alert window.
      recordRagResult(localDocs.length > 0).catch((e) => logFireAndForgetError(e, "rag-result"));
    } catch (e) {
      logger.error({ err: e }, "Local knowledge retrieval failed");
      recordRagResult(false).catch((e) => logFireAndForgetError(e, "rag-result-failed"));
    }

    return { content, sources, similarities, chunkCount: similarities.length };
  } catch (e) {
    logger.error({ err: e }, "Retrieval logic failed");
    return { content, sources, similarities, chunkCount: 0 };
  }
}

export async function retrieveUserMemory(
  userId: string,
  query: string,
  options: MemorySearchOptions = {},
): Promise<string> {
  try {
    const docs = await vectorStore.searchUserMemory(userId, query, RAG_CONFIG.memoryTopK, options);
    if (docs.length === 0) return "";

    // Scan memory chunks for injection patterns before injecting into prompt
    const safeDocs = docs.filter((d) => {
      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(d.content)) {
          logger.warn({ userId, docId: d.id }, "Memory chunk blocked due to injection pattern");
          return false;
        }
      }
      return true;
    });

    return safeDocs
      .map(
        (d) =>
          `[MEMORY: ${new Date(d.metadata.createdAt as Date).toLocaleDateString()}]\n${d.content}`,
      )
      .join("\n\n");
  } catch (e) {
    logger.error({ err: e }, "Memory retrieval failed");
    return "";
  }
}

export async function storeConversationLog(
  userId: string,
  input: string,
  output: string,
  model: string,
  usage: ConversationLogUsage,
  complexity: string | null = null,
  conversationLength: number = 1,
  wasFallback: boolean = false,
) {
  // Skip logging for synthetic/test userIds that are not real Clerk user IDs.
  // Clerk user IDs always start with "user_". Plan names ("ELITE", "PRO", etc.)
  // or other test strings would violate the AIRequestLog_userId_fkey FK constraint.
  if (!userId.startsWith("user_")) {
    logger.warn({ userId }, "storeConversationLog: skipping non-Clerk userId — update guard if ID format changes");
    return;
  }

  // Generate idempotency key to prevent duplicate storage on retries
  // Hash of userId + input + output + timestamp rounded to 10-second window
  const timestampWindow = Math.floor(Date.now() / 10000) * 10000;
  const idempotencyKey = createHash("sha256")
    .update(`${userId}:${timestampWindow}:${input}:${output}`)
    .digest("hex");

  // Check if this exact exchange was already logged within the time window
  try {
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "AIRequestLog"
      WHERE "userId" = ${userId}
        AND "inputQuery" = ${input}
        AND "outputResponse" = ${output}
        AND "createdAt" >= NOW() - INTERVAL '10 seconds'
      LIMIT 1
    `;
    if (existing && existing.length > 0) {
      logger.debug({ userId, idempotencyKey }, "storeConversationLog: duplicate detected, skipping");
      return;
    }
  } catch (e) {
    // Idempotency check failed — proceed with storage to avoid data loss
    logger.warn({ err: e, userId }, "storeConversationLog: idempotency check failed, proceeding with storage");
  }

  try {
    await vectorStore.storeLog(
      userId,
      input,
      output,
      model,
      usage,
      complexity,
      conversationLength,
      wasFallback,
    );
  } catch (e) {
    logger.error({ err: e, userId }, "Failed to store vector log — attempting raw fallback");
    // Fallback: Store without embedding if vector operation fails
    try {
      await prisma.$executeRaw`
        INSERT INTO "AIRequestLog" (
          id,
          "userId",
          "inputQuery",
          "outputResponse",
          model,
          "tokensUsed",
          complexity,
          "inputTokens",
          "outputTokens",
          "cachedInputTokens",
          "reasoningTokens",
          "wasFallback",
          "inputCost",
          "outputCost",
          "cachedInputCost",
          "totalCost",
          "createdAt"
        )
        VALUES (
          ${randomUUID()},
          ${userId},
          ${input},
          ${output},
          ${model},
          ${usage.tokensUsed},
          ${complexity ?? null},
          ${usage.inputTokens ?? null},
          ${usage.outputTokens ?? null},
          ${usage.cachedInputTokens ?? null},
          ${usage.reasoningTokens ?? null},
          ${wasFallback},
          ${usage.inputCost ?? null},
          ${usage.outputCost ?? null},
          ${usage.cachedInputCost ?? null},
          ${usage.totalCost ?? null},
          NOW()
        );
      `;
    } catch (fallbackError) {
      logger.error({ err: fallbackError }, "Fallback logging also failed");
    }
  }
}
