/**
 * LLM Fallback Chain for Lyra AI service.
 * Implements graceful degradation: lyra-full → lyra-mini → lyra-nano.
 */

import { streamText } from "ai";
import { getSharedAISdkClient, getTierConfig, getTargetOutputTokens, type Gpt54Role, type QueryComplexity } from "../config";
import { resolveGptDeployment } from "../orchestration";
import { calculateLLMCost } from "../cost-calculator";
import { storeConversationLog } from "../rag";
import { validateOutput, logValidationResult } from "../output-validation";
import { recordFallbackResult, recordLatencyViolation } from "../alerting";
import { alertIfDailyCostExceeded } from "../alerting";
import { logModelRouting } from "../monitoring";
import { incrementDailyTokens } from "../guards/token-cap";
import { refundOnStreamError } from "./utils";
import { createLogger } from "@/lib/logger";
import { sanitizeError, createTimer } from "@/lib/logger/utils";
import { logFireAndForgetError } from "@/lib/fire-and-forget";
import type { Source } from "@/lib/lyra-utils";
import type { LyraMessage } from "@/types/ai";

const logger = createLogger({ service: "lyra-fallback" });

export type FallbackContext = {
  userId: string;
  query: string;
  tier: string;
  userPlan: string;
  tierConfig: ReturnType<typeof getTierConfig>;
  effectiveDeployment: string;
  finalMessages: LyraMessage[];
  staticPrompt: string;
  finalSources: Source[];
  remainingCredits: number | null;
  consumedCreditCost: number;
  isEduCacheable: boolean;
  responseMode: string;
  resolvedAssetType: string;
  safeMessages: LyraMessage[];
  timer: ReturnType<typeof createTimer>;
  /** Whether RAG retrieval timed out or failed — passed through to frontend */
  ragDegraded?: boolean;
};

type FallbackStep = {
  role: Gpt54Role;
  deployment: string;
  timeoutMs: number;
  maxOutputTokens: number;
};

/**
 * Execute the fallback chain when primary LLM fails.
 * Returns wrapped fallback stream or throws if all fallbacks fail.
 */
export async function executeFallbackChain(
  primaryError: unknown,
  ctx: FallbackContext,
): Promise<{ result: { textStream: AsyncIterable<string> }; sources: Source[]; remainingCredits: number | null; contextTruncated: boolean; ragDegraded: boolean }> {
  const {
    userId, query, tier, userPlan, tierConfig, effectiveDeployment,
    finalMessages, staticPrompt, finalSources, remainingCredits,
    consumedCreditCost, isEduCacheable, responseMode, resolvedAssetType,
    safeMessages, timer, ragDegraded = false,
  } = ctx;

  const nanoDeployment = resolveGptDeployment("lyra-nano");
  const miniDeployment = resolveGptDeployment("lyra-mini");
  if (effectiveDeployment === nanoDeployment) {
    throw primaryError; // nano already failed — nothing left to try
  }

  // Build the fallback chain for this request. Skip `mini` if primary already was `mini`
  // (avoids hitting the same failing deployment twice), and always end at `nano`.
  const fallbackChain: FallbackStep[] = [];
  const isFromFull = effectiveDeployment !== miniDeployment && effectiveDeployment !== nanoDeployment;
  if (isFromFull) {
    // Middle step: mini. Keep a generous output budget since paid-tier users expect
    // institutional-grade responses even on the degraded path.
    fallbackChain.push({
      role: "lyra-mini",
      deployment: miniDeployment,
      timeoutMs: 20_000,
      maxOutputTokens: Math.min(getTargetOutputTokens(tierConfig, tier as QueryComplexity), 1800),
    });
  }
  // Final step: nano. Short timeout, conservative token budget.
  fallbackChain.push({
    role: "lyra-nano",
    deployment: nanoDeployment,
    timeoutMs: 15_000,
    maxOutputTokens: 1200,
  });

  let lastError: unknown = primaryError;
  for (let i = 0; i < fallbackChain.length; i++) {
    const step = fallbackChain[i];
    const isLastStep = i === fallbackChain.length - 1;
    // Separate abort controller per fallback step
    const fallbackAbortController = new AbortController();
    const fallbackAbortTimer = setTimeout(() => {
      logger.warn({ tier, fallbackDeployment: step.deployment }, "Fallback step latency exceeded — aborting");
      fallbackAbortController.abort();
    }, step.timeoutMs);

    try {
      const fallbackModel = getSharedAISdkClient().responses(step.deployment);
      const fallbackResult = streamText({
        model: fallbackModel,
        messages: finalMessages,
        system: staticPrompt,
        maxOutputTokens: step.maxOutputTokens,
        abortSignal: fallbackAbortController.signal,
        providerOptions: {
          openai: {
            textVerbosity: "high" as const,
            promptCacheKey: "lyra-static-v1",
          },
        },
        onFinish: async ({ text, usage }) => {
          // Clear fallback abort timer once stream finishes naturally
          clearTimeout(fallbackAbortTimer);
          const fbDurationMs = timer.end();
          const fbUsageAny = usage as Record<string, unknown>;
          const fbInput = Number.isFinite(usage.inputTokens) ? usage.inputTokens ?? 0 : 0;
          const fbOutput = Number.isFinite(usage.outputTokens) ? usage.outputTokens ?? 0 : 0;
          const fbCachedInput = Number.isFinite(fbUsageAny.cachedInputTokens) ? (fbUsageAny.cachedInputTokens as number) : 0;
          const fbReasoningTokens = Number.isFinite(fbUsageAny.reasoningTokens) ? (fbUsageAny.reasoningTokens as number) : 0;
          logModelRouting({
            model: step.deployment,
            tier,
            tokens: usage.totalTokens ?? ((usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)),
            wasFallback: true,
            duration: `${(fbDurationMs / 1000).toFixed(1)}s`,
            durationMs: fbDurationMs,
          });
          recordFallbackResult(true, step.deployment).catch((e) => logFireAndForgetError(e, "fallback-result"));

          // Track latency budget violations for fallback as well
          const latencyBudgetMs = tierConfig.latencyBudgetMs;
          const exceededBudget = fbDurationMs > latencyBudgetMs;
          recordLatencyViolation(exceededBudget, fbDurationMs, tier).catch((e) => logFireAndForgetError(e, "latency-violation"));

          incrementDailyTokens(userId, usage.totalTokens ?? 0).catch((e) => logFireAndForgetError(e, "daily-tokens"));

          // Fold fallback-path USD spend into the daily cost alert.
          try {
            const fbCost = calculateLLMCost({
              model: step.deployment,
              inputTokens: fbInput,
              outputTokens: fbOutput,
              cachedInputTokens: fbCachedInput,
            });
            alertIfDailyCostExceeded(fbCost.totalCost).catch((e) => logFireAndForgetError(e, "fallback-cost-alert"));
            // Log detailed cost breakdown for fallback (matches primary path logging)
            logger.info({
              tokens: usage.totalTokens ?? 0,
              inputTokens: fbInput,
              outputTokens: fbOutput,
              cachedTokens: fbCachedInput,
              reasoningTokens: fbReasoningTokens,
              totalCost: fbCost.totalCost,
              model: step.deployment,
              tier,
              durationMs: fbDurationMs,
            }, "Fallback LLM generation finished");
          } catch (e) {
            logFireAndForgetError(e, "fallback-cost-calc");
          }

          if (text) {
            storeConversationLog(userId, query, text, step.deployment,
              { tokensUsed: usage.totalTokens ?? 0, inputTokens: fbInput, outputTokens: fbOutput, cachedInputTokens: fbCachedInput, reasoningTokens: fbReasoningTokens }, tier, safeMessages.length, true,
            ).catch((e: unknown) => logger.error({ err: sanitizeError(e) }, "Fallback log failed"));

            // Validate fallback output — previously skipped, creating a blind spot
            // in the validation failure rate alert. Fallback responses are lower quality
            // and more likely to fail section checks, so monitoring them is critical.
            const fallbackValidation = validateOutput(
              text, tier, userPlan,
              tier === "SIMPLE" && isEduCacheable,
              responseMode,
              resolvedAssetType,
            );
            logValidationResult(fallbackValidation);
          }
        },
      });
      logger.warn({ userId, tier, fallbackDeployment: step.deployment, stepIndex: i }, "Fallback stream initiated");
      // Wrap textStream so mid-stream errors trigger credit refund
      const wrappedFallback = { ...fallbackResult, textStream: refundOnStreamError(fallbackResult.textStream, userId, consumedCreditCost, `fallback-${step.deployment}`) };
      return { result: wrappedFallback, sources: finalSources, remainingCredits, contextTruncated: true, ragDegraded };
    } catch (fallbackError: unknown) {
      clearTimeout(fallbackAbortTimer);
      lastError = fallbackError;
      logger.error(
        { err: sanitizeError(fallbackError), userId, fallbackDeployment: step.deployment, stepIndex: i },
        isLastStep ? "Final fallback step failed" : "Fallback step failed — trying next",
      );
      // Continue to the next step unless this was the last one.
      if (isLastStep) {
        throw primaryError; // surface the original error
      }
    }
  }
  // Should be unreachable — the loop either returns or throws — but satisfy control flow.
  throw lastError;
}

/**
 * Build fallback chain configuration for testing purposes.
 * Mirrors the internal logic for unit test verification.
 */
export function buildFallbackChainConfig(
  effectiveDeployment: string,
  miniDeployment: string,
  nanoDeployment: string,
  tierConfig: ReturnType<typeof getTierConfig>,
  tier: QueryComplexity,
): FallbackStep[] | null {
  if (effectiveDeployment === nanoDeployment) {
    return null; // nano already failed — nothing to try
  }

  const fallbackChain: FallbackStep[] = [];
  const isFromFull = effectiveDeployment !== miniDeployment && effectiveDeployment !== nanoDeployment;

  if (isFromFull) {
    fallbackChain.push({
      role: "lyra-mini",
      deployment: miniDeployment,
      timeoutMs: 20_000,
      maxOutputTokens: Math.min(getTargetOutputTokens(tierConfig, tier), 1800),
    });
  }
  fallbackChain.push({
    role: "lyra-nano",
    deployment: nanoDeployment,
    timeoutMs: 15_000,
    maxOutputTokens: 1200,
  });

  return fallbackChain;
}
