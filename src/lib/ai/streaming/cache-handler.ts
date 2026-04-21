/**
 * Cache hit handlers for Lyra AI service.
 * Provides early and late cache hit processing with cost tracking.
 */

import { resolveGptDeployment } from "../orchestration";
import { calculateLLMCost } from "../cost-calculator";
import { storeConversationLog } from "../rag";
import { alertIfDailyCostExceeded } from "../alerting";
import { logFireAndForgetError } from "@/lib/fire-and-forget";
import { singleChunkStream } from "./utils";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import type { Source } from "@/lib/lyra-utils";
import type { getTierConfig } from "../config";

const logger = createLogger({ service: "lyra-cache-handler" });

export type CacheHitContext = {
  userId: string;
  query: string;
  tier: string;
  tierConfig: ReturnType<typeof getTierConfig>;
  staticPrompt: string;
  finalSources: Source[];
  remainingCredits: number | null;
  costCeiling: { exceeded: boolean };
};

export type EarlyCacheHitContext = CacheHitContext & {
  estimatedInputTokens: number;
};

/**
 * Handle late cache hit (after context building, before LLM call).
 * Handles cost tracking, conversation logging, and daily cost alerting.
 */
export function handleLateCacheHit(
  cachedText: string,
  gptCacheKey: string,
  emitCacheEvent: (params: { modelFamily: "gpt"; operation: "read" | "write"; outcome: "hit" | "miss" | "success" | "failed" }) => void,
  ctx: CacheHitContext,
): { result: { textStream: AsyncIterable<string> }; sources: Source[]; remainingCredits: number | null; contextTruncated: boolean } {
  const { userId, query, tier, tierConfig, staticPrompt, finalSources, remainingCredits, costCeiling } = ctx;

  emitCacheEvent({ modelFamily: "gpt", operation: "read", outcome: "hit" });
  logger.info({ tier, cacheKey: gptCacheKey }, "GPT response cache HIT");

  const cacheHitDeployment = resolveGptDeployment(tierConfig.gpt54Role);
  const cacheHitInputTokens = Math.round(staticPrompt.length / 4);
  const cacheHitOutputTokens = Math.round(cachedText.length / 4);
  const cacheHitCostBreakdown = calculateLLMCost({
    model: cacheHitDeployment,
    inputTokens: cacheHitInputTokens,
    outputTokens: cacheHitOutputTokens,
    cachedInputTokens: cacheHitInputTokens, // entire prompt was cached
  });
  logger.info({
    tier, tokens: cacheHitInputTokens + cacheHitOutputTokens,
    inputTokens: cacheHitInputTokens, outputTokens: cacheHitOutputTokens,
    cachedTokens: cacheHitInputTokens, cost: cacheHitCostBreakdown.totalCost,
    model: cacheHitDeployment,
  }, "LLM generation finished (cache hit)");

  storeConversationLog(
    userId, query, cachedText, cacheHitDeployment,
    {
      tokensUsed: cacheHitInputTokens + cacheHitOutputTokens,
      inputTokens: cacheHitInputTokens,
      outputTokens: cacheHitOutputTokens,
      cachedInputTokens: cacheHitInputTokens,
      reasoningTokens: 0,
      inputCost: cacheHitCostBreakdown.inputCost,
      outputCost: cacheHitCostBreakdown.outputCost,
      cachedInputCost: cacheHitCostBreakdown.cachedInputCost,
      totalCost: cacheHitCostBreakdown.totalCost,
    },
    tier, 1, false,
  ).catch((e: unknown) =>
    logger.warn({ err: sanitizeError(e), userId }, "Failed to log cache-hit interaction"),
  );

  alertIfDailyCostExceeded(cacheHitCostBreakdown.totalCost).catch((e) => logFireAndForgetError(e, "gpt-cache-cost-alert"));

  return { result: { textStream: singleChunkStream(cachedText) }, sources: finalSources, remainingCredits, contextTruncated: costCeiling.exceeded };
}

/**
 * Handle early cache hit (before context building).
 * Uses estimated input tokens since prompt not built yet.
 */
export function handleEarlyCacheHit(
  cachedText: string,
  gptCacheKey: string,
  cachedSources: Source[] | null,
  emitCacheEvent: (params: { modelFamily: "gpt"; operation: "read" | "write"; outcome: "hit" | "miss" | "success" | "failed" }) => void,
  ctx: EarlyCacheHitContext,
): { result: { textStream: AsyncIterable<string> }; sources: Source[]; remainingCredits: number | null; contextTruncated: boolean } {
  const { userId, query, tier, tierConfig, estimatedInputTokens, finalSources, remainingCredits, costCeiling } = ctx;

  emitCacheEvent({ modelFamily: "gpt", operation: "read", outcome: "hit" });
  logger.info({ tier, cacheKey: gptCacheKey }, "Early model cache HIT — skipping context build");

  const cacheHitDeployment = resolveGptDeployment(tierConfig.gpt54Role);
  const cacheHitOutputTokens = Math.round(cachedText.length / 4);
  const cacheHitCostBreakdown = calculateLLMCost({
    model: cacheHitDeployment,
    inputTokens: estimatedInputTokens,
    outputTokens: cacheHitOutputTokens,
    cachedInputTokens: estimatedInputTokens,
  });

  storeConversationLog(
    userId, query, cachedText, cacheHitDeployment,
    {
      tokensUsed: estimatedInputTokens + cacheHitOutputTokens,
      inputTokens: estimatedInputTokens,
      outputTokens: cacheHitOutputTokens,
      cachedInputTokens: estimatedInputTokens,
      reasoningTokens: 0,
      totalCost: cacheHitCostBreakdown.totalCost,
    },
    tier, 1, false,
  ).catch((e: unknown) =>
    logger.warn({ err: sanitizeError(e), userId }, "Failed to log early-cache-hit interaction"),
  );

  alertIfDailyCostExceeded(cacheHitCostBreakdown.totalCost).catch((e) => logFireAndForgetError(e, "early-cache-cost-alert"));

  return { result: { textStream: singleChunkStream(cachedText) }, sources: cachedSources ?? finalSources, remainingCredits, contextTruncated: costCeiling.exceeded };
}

/**
 * Estimate tokens from text using 4 chars/token heuristic.
 * Used for cache hit cost estimation when full prompt not available.
 */
export function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}
