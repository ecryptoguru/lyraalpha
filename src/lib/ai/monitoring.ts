/**
 * AI Model Routing & Usage Monitoring
 * Lightweight monitoring via structured logging for GPT-5.4 routing.
 * Uses existing logger infrastructure instead of separate DB tables.
 */

import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "ai-monitoring" });

export interface ModelRoutingEvent {
  model: string;
  tier: string;
  tokens: number;
  wasFallback?: boolean;
  duration?: string;
  durationMs?: number;
}

export interface ModelCacheEvent {
  modelFamily: "gpt";
  plan?: "STARTER" | "PRO" | "ELITE" | "ENTERPRISE";
  tier?: "SIMPLE" | "MODERATE" | "COMPLEX";
  operation: "read" | "write";
  outcome: "hit" | "miss" | "success" | "failed";
}

export interface RetrievalMetric {
  tier: string;
  responseMode: string;
  knowledgeChars: number;
  memoryChars: number;
  webChars: number;
  sourceCount: number;
}

export interface ContextBudgetMetric {
  tier: string;
  responseMode: string;
  staticPromptLength: number;
  contextLength: number;
  historyLength: number;
}

/**
 * Log model routing decision for monitoring.
 * Emits structured log that can be aggregated by log management tools (e.g., Vercel logs, Datadog).
 */
export function logModelRouting(params: ModelRoutingEvent) {
  logger.info(
    {
      event: "model_routing",
      model: params.model,
      tier: params.tier,
      tokens: params.tokens,
      wasFallback: params.wasFallback || false,
      duration: params.duration,
    },
    "AI model routing decision",
  );
}

export function logModelCacheEvent(params: ModelCacheEvent) {
  logger.info(
    {
      event: "model_cache",
      modelFamily: params.modelFamily,
      plan: params.plan,
      tier: params.tier,
      operation: params.operation,
      outcome: params.outcome,
    },
    "Model cache telemetry",
  );
}

export function logRetrievalMetric(params: RetrievalMetric) {
  logger.info(
    {
      event: "ai_retrieval",
      tier: params.tier,
      responseMode: params.responseMode,
      knowledgeChars: params.knowledgeChars,
      memoryChars: params.memoryChars,
      webChars: params.webChars,
      sourceCount: params.sourceCount,
    },
    "AI retrieval telemetry",
  );
}

export function logContextBudgetMetric(params: ContextBudgetMetric) {
  logger.info(
    {
      event: "ai_context_budget",
      tier: params.tier,
      responseMode: params.responseMode,
      staticPromptLength: params.staticPromptLength,
      contextLength: params.contextLength,
      historyLength: params.historyLength,
    },
    "AI context budget telemetry",
  );
}

export interface MemoryEvent {
  userId: string;
  source: "lyra" | "myra";
  outcome: "updated" | "skipped_empty" | "retained_existing" | "failed" | "locked";
  noteCount?: number;
  latencyMs?: number;
}

export function logMemoryEvent(params: MemoryEvent) {
  logger.info(
    {
      event: "ai_memory",
      userId: params.userId,
      source: params.source,
      outcome: params.outcome,
      noteCount: params.noteCount ?? 0,
      latencyMs: params.latencyMs ?? 0,
    },
    "Memory distillation telemetry",
  );
}

/**
 * Streaming latency metrics for per-chunk performance monitoring.
 * Tracks time-to-first-token (TTFT) and tokens-per-second (TPS) for quality detection.
 */
export interface StreamingLatencyEvent {
  model: string;
  tier: string;
  plan: string;
  /** Time from request start to first token received (milliseconds) */
  ttftMs: number;
  /** Tokens per second after first token */
  tps: number;
  /** Total tokens streamed */
  totalTokens: number;
  /** Total stream duration (milliseconds) */
  durationMs: number;
  /** Whether this was a fallback model */
  wasFallback?: boolean;
}

/**
 * Log streaming latency metrics for model performance monitoring.
 * Use this to detect model degradation, cold starts, or routing issues.
 */
export function logStreamingLatency(params: StreamingLatencyEvent) {
  logger.info(
    {
      event: "ai_streaming_latency",
      model: params.model,
      tier: params.tier,
      plan: params.plan,
      ttftMs: params.ttftMs,
      tps: Number(params.tps.toFixed(2)),
      totalTokens: params.totalTokens,
      durationMs: params.durationMs,
      wasFallback: params.wasFallback ?? false,
    },
    `Streaming latency: ${params.ttftMs}ms TTFT, ${params.tps.toFixed(2)} TPS`,
  );
}

/**
 * RAG retrieval quality metrics including similarity scores.
 */
export interface RagQualityEvent {
  tier: string;
  /** Number of chunks retrieved */
  chunkCount: number;
  /** Average similarity score of retrieved chunks (0-1) */
  avgSimilarity: number;
  /** p50 similarity score */
  p50Similarity: number;
  /** p95 similarity score */
  p95Similarity: number;
  /** Whether retrieval timed out */
  timedOut: boolean;
  /** Time spent on retrieval (milliseconds) */
  retrievalMs: number;
}

/**
 * Log RAG retrieval quality metrics for monitoring relevance and performance.
 */
export function logRagQuality(params: RagQualityEvent) {
  logger.info(
    {
      event: "ai_rag_quality",
      tier: params.tier,
      chunkCount: params.chunkCount,
      avgSimilarity: Number(params.avgSimilarity.toFixed(4)),
      p50Similarity: Number(params.p50Similarity.toFixed(4)),
      p95Similarity: Number(params.p95Similarity.toFixed(4)),
      timedOut: params.timedOut,
      retrievalMs: params.retrievalMs,
    },
    `RAG quality: ${params.chunkCount} chunks, avg_sim=${params.avgSimilarity.toFixed(4)}`,
  );
}
