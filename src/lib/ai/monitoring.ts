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
