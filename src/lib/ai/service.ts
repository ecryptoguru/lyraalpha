import { randomUUID } from "crypto";
import { streamText } from "ai";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG, getSharedAISdkClient, getTierConfig, HISTORY_CAPS, getGpt54Deployment, getTargetOutputTokens, type Gpt54Role, type QueryComplexity } from "./config";
import { resolveGptDeployment } from "./orchestration";
import { getUserPlan, normalizePlanTier } from "@/lib/middleware/plan-gate";
import { BUILD_LYRA_REFERENCE_EXAMPLE, BUILD_LYRA_STATIC_PROMPT, PROMPT_VERSION } from "./prompts/system";
import { validateInput, validateConversationLength, SafetyViolationError, UsageLimitError, checkPromptInjection } from "./guardrails";
import { scrubPII } from "./pii-scrub";
import { LyraContext } from "@/lib/engines/types";
// currentUser removed — user creation now handled by Clerk webhook (src/app/api/webhooks/clerk/route.ts)
import {
  retrieveInstitutionalKnowledge,
  retrieveUserMemory,
  storeConversationLog,
} from "./rag";
import { searchWeb } from "./search";
import { getAllowedTools } from "@/lib/ai/tools";
import { Source } from "@/lib/lyra-utils";
import { LyraMessage } from "@/types/ai";
import { createLogger } from "@/lib/logger";
import { sanitizeError, createTimer } from "@/lib/logger/utils";
import { buildCompressedContext, extractMentionedSymbols, truncateAtSentence } from "./context-builder";
import { analyzeBehavioralPatterns } from "./behavioral-intelligence";
import { findHistoricalAnalogs, formatAnalogContext } from "@/lib/engines/historical-analog";
import { calculateRiskRewardAsymmetry, formatRiskRewardContext, calculateCryptoRiskReward, formatCryptoRiskRewardContext, type CryptoRiskRewardInput } from "@/lib/engines/risk-reward";
import { classifyQuery } from "./query-classifier";
import { AssetEnrichment } from "./types";
import { calculateLLMCost } from "./cost-calculator";
import { redis, getCache, setCache, redisSetNXStrict } from "@/lib/redis";
import { compressKnowledgeContext } from "./compress";
import { distillSessionNotes, getGlobalNotes, getSessionNotes } from "./memory";
import { validateOutput, logValidationResult, validateSemanticConsistency, logSemanticValidationResult } from "./output-validation";
import { applyCostCeiling, recordEstimationAccuracy } from "./cost-ceiling";
import { recordFallbackResult, alertIfDailyCostExceeded, recordLatencyViolation, isFallbackMitigationActive } from "./alerting";
import {
  logModelCacheEvent,
  logModelRouting,
  logRetrievalMetric,
  logContextBudgetMetric,
  logStreamingLatency,
  logRagQuality,
} from "./monitoring";
import { consumeCredits, getCreditCost, addCredits } from "@/lib/services/credit.service";
import { CreditTransactionType } from "@/generated/prisma/enums";
import { logFireAndForgetError } from "@/lib/fire-and-forget";
import { awardXP } from "@/lib/engines/gamification";
import {
  EDU_CACHE_ENABLED,
  EDU_CACHE_TTL,
  ASSET_SYMBOLS_CACHE_KEY,
  ASSET_SYMBOLS_CACHE_TTL,
  eduCacheKey,
  modelCacheKey,
  getModelCacheTtl,
} from "./lyra-cache";

// Modular imports (new structure)
import { refundOnStreamError, singleChunkStream } from "./streaming/utils";
import { executeFallbackChain } from "./streaming/fallback-chain";
import { handleLateCacheHit } from "./streaming/cache-handler";
import {
  DAILY_TOKEN_CAPS_DEFAULTS,
  DAILY_TOKEN_CAPS_REDIS_KEY,
  getEffectiveDailyTokenCaps,
  incrementDailyTokens,
  getDailyTokensUsed,
} from "./guards/token-cap";

// Re-exports for backward compatibility
export {
  DAILY_TOKEN_CAPS_DEFAULTS,
  DAILY_TOKEN_CAPS_REDIS_KEY,
  getEffectiveDailyTokenCaps,
  incrementDailyTokens,
  getDailyTokensUsed,
};

// Re-export types for consumers
export type { FallbackContext } from "./streaming/fallback-chain";
export type { CacheHitContext } from "./streaming/cache-handler";

const logger = createLogger({ service: "lyra-ai" });

// Note: refundOnStreamError now imported from ./streaming/utils

// ─── Precompiled query-classification regexes (hoisted from per-request scope) ──
// Compiling once at module load saves ~10µs per request vs inline RegExp creation.
// Hoisted trivial query regex (compiled once, avoids per-request RegExp overhead)
const TRIVIAL_QUERY_RE =
  /^(?:hi|hello|hey|thanks|thank you|ok|okay|got it|sure|yes|no|bye|goodbye|good morning|good evening)\s*[.!?]*\s*$/i;

const MACRO_DETECTED_RE =
  /\b(?:macro|regime|inflation|fed|rates|yields|economy|recession|cpi|ppi|gdp|market sentiment|overall market|sector rotation)\b/i;
const FUNDAMENTAL_EXCLUSION_RE =
  /(?:fundamental|valuation|earnings|target|insider|dividend|holdings|nav|nav count|peers|coingecko|profile|supply|max supply)/i;
const HISTORICAL_INTENT_RE =
  /\b(?:analog|similar|historical|history|past|precedent|before|last time|when did|pattern|repeat|again)\b/i;
const FRESH_EVIDENCE_RE =
  /\b(?:news|latest|today|current|recent|just|breaking|earnings|guidance|catalyst|headlines?|announced?|updates?|developments?|rally|selloff|sell-off|crash|surge|drop|rise|rising|falling|movers?)\b/i;
const MACRO_RECENCY_RE =
  /\b(?:today|current|recent|latest|now|this week|this month)\b/i;

// ─── Trivial query canned response (greetings/acks — zero LLM cost) ──────────
const TRIVIAL_QUERY_RESPONSE = `Hey! I'm Lyra from LyraAlpha AI. I analyze crypto assets and digital markets with proprietary on-chain scoring engines.

**What would you like to explore?**

1. **Analyze a crypto asset** — any token or coin by ticker (BTC, ETH, SOL...)
2. **Market overview** — current regime, sector rotation, top movers
3. **Compare assets** — how two tokens stack up against each other
4. **Understand a metric** — what does "TVL", "FDV", or "on-chain momentum" mean?
5. **Portfolio view** — how is your crypto portfolio positioned in the current regime?

Just ask!`;

// ─── Estimated input tokens by tier for cache-hit cost tracking ────────────
// Source: p50 of production input token distributions (2026-03 audit).
const ESTIMATED_INPUT_TOKENS_BY_TIER: Record<string, number> = {
  SIMPLE: 1_500,
  MODERATE: 3_500,
  COMPLEX: 5_000,
};

// ─── RAG top-K and timeout by tier/response mode (module-scope, pure) ───────
function resolveRagTopK(
  tier: string,
  responseMode: string,
  resolvedSymbol: string,
  userPlan: string,
): number {
  if (tier === "SIMPLE") return 2;
  if (responseMode === "compare") return 2;
  if (responseMode === "stress-test") return 3;
  if (tier === "MODERATE" && resolvedSymbol !== "GLOBAL") {
    if (userPlan === "ELITE" || userPlan === "ENTERPRISE") return 5;
    if (userPlan === "PRO") return 4;
    return 3;
  }
  return 3;
}

function resolveRagTimeoutMs(responseMode: string, tier: string): number {
  if (responseMode === "compare") return 2_500;
  if (tier === "SIMPLE") return 2_000;
  if (tier === "MODERATE") return 3_500;
  return 5_000;
}

// P0: Runtime safety guard for SKIP_CREDITS env var — bypasses all credit checks and daily token caps.
if (process.env.SKIP_CREDITS === "true") {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL: SKIP_CREDITS=true in PRODUCTION — all credit checks and daily token caps are DISABLED. " +
      "This must NEVER be enabled in production. Remove the env var to start the server.",
    );
  } else {
    logger.warn("SKIP_CREDITS=true — credit checks and daily token caps are bypassed (development only)");
  }
}

// ─── Emergency asset fallback list (used when DB/cache unavailable) ─────────
// This is a conservative fallback to ensure the app remains functional during
// database or cache degradation. Should be kept in sync with major crypto assets.
const EMERGENCY_ASSET_FALLBACK = [
  "BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "USDT-USD", "USDC-USD",
  "XRP-USD", "ADA-USD", "DOGE-USD", "DOT-USD",
] as const;

// Exported for test assertions only — not part of the module's public API.
export { EMERGENCY_ASSET_FALLBACK };

// ─── Conversation history constants ─────────────────────────────────────────
export const RECENT_RAW = 2; // Last 1 user + 1 assistant messages always sent raw (uncompressed)

// Note: Daily token cap functions now imported from ./guards/token-cap

// Re-export for backward compatibility
export type { LyraMessage };

export function getLyraModel() {
  return getSharedAISdkClient().responses(AI_CONFIG.model);
}

/** Returns an AI SDK model instance for a specific GPT-5.4 role.
 *  Falls back to the primary deployment when the role-specific one is not yet configured. */
export function getGpt54Model(role: Gpt54Role) {
  return getSharedAISdkClient().responses(getGpt54Deployment(role));
}

/** Clear the user plan cache — exported for testing only */
export { _clearPlanCacheForTest } from "@/lib/middleware/plan-gate";

async function getAvailableAssetSymbols(): Promise<string[]> {
  // Try fresh cache first
  const cached = await getCache<string[]>(ASSET_SYMBOLS_CACHE_KEY);
  if (cached) return cached;

  const STALE_CACHE_KEY = `${ASSET_SYMBOLS_CACHE_KEY}:stale`;

  try {
    const assets = await prisma.asset.findMany({
      select: { symbol: true },
    });
    const symbols = assets.map((a) => a.symbol.toUpperCase());
    
    // Write to both fresh and stale cache
    const cachePromise = setCache(ASSET_SYMBOLS_CACHE_KEY, symbols, ASSET_SYMBOLS_CACHE_TTL);
    const stalePromise = setCache(STALE_CACHE_KEY, symbols, ASSET_SYMBOLS_CACHE_TTL * 24); // 24x TTL for stale
    Promise.all([cachePromise, stalePromise]).catch((e) => logFireAndForgetError(e, "asset-symbols-cache"));
    
    return symbols;
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch asset symbols from DB");
    
    // Only read stale cache on DB failure — avoids wasted Redis call on happy path
    const staleCached = await getCache<string[]>(STALE_CACHE_KEY).catch(() => null);
    if (staleCached && staleCached.length > 0) {
      logger.warn({ count: staleCached.length }, "Using stale asset symbols cache as fallback");
      return staleCached;
    }
    
    logger.error("Using emergency hardcoded fallback — asset list may be incomplete");
    return [...EMERGENCY_ASSET_FALLBACK];
  }
}

function parseMarketCapValue(marketCap?: number | null): number {
  return marketCap ?? 0;
}

function inferSearchRegion(_symbol: string, contextRegion?: string): "US" | "IN" {
  if ((contextRegion || "").toUpperCase() === "IN") return "IN";
  return "US";
}

function scoreAssetCandidate(
  asset: { symbol: string; name?: string | null; region?: string | null },
  normalizedLower: string,
  normalizedUpper: string,
  wordBoundaryRe: RegExp,
  preferredRegion?: string,
): number {
  const symbolUpper = asset.symbol.toUpperCase();
  const nameLower = (asset.name || "").toLowerCase();
  let score = 0;

  if (symbolUpper === normalizedUpper) score += 1000;
  if (nameLower === normalizedLower) score += 950;
  if (symbolUpper.startsWith(normalizedUpper)) score += 700;
  if (nameLower.startsWith(normalizedLower)) score += 650;
  if (wordBoundaryRe.test(asset.name || "")) {
    score += 550;
  } else if (normalizedLower.length >= 4 && nameLower.includes(normalizedLower)) {
    score += 325;
  }

  if (preferredRegion && (asset.region || "").toUpperCase() === preferredRegion.toUpperCase()) {
    score += 80;
  }

  return score;
}

async function resolveAssetFromShortQuery(
  query: string,
  preferredRegion?: string,
): Promise<{ symbol: string; assetType?: string; region?: string } | null> {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 40) return null;
  if (normalized.split(" ").length > 4) return null;

  const normalizedLower = normalized.toLowerCase();
  const normalizedUpper = normalized.toUpperCase();
  const escapedQuery = normalizedLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Pre-compile word boundary regex once — used for all 25 candidates
  const wordBoundaryRe = new RegExp(`\\b${escapedQuery}\\b`, "i");

  try {
    // Single query covering exact, prefix, and contains matches — avoids a second serial round-trip.
    // `contains` is included so longer names like "Bitcoin" match partial queries.
    const orClauses: object[] = [
      { symbol: { equals: normalizedUpper, mode: "insensitive" } },
      { name: { equals: normalized, mode: "insensitive" } },
      { symbol: { startsWith: normalizedUpper, mode: "insensitive" } },
      { name: { startsWith: normalized, mode: "insensitive" } },
    ];
    if (normalizedLower.length >= 4) {
      orClauses.push({ name: { contains: normalized, mode: "insensitive" } });
    }

    const candidates = await prisma.asset.findMany({
      where: { OR: orClauses },
      take: 25,
      select: { symbol: true, name: true, type: true, region: true, marketCap: true },
    });

    if (candidates.length === 0) return null;

    // Score first (no marketCap parse yet), filter, then compute marketCap only for survivors.
    const ranked = candidates
      .map((asset) => ({
        asset,
        score: scoreAssetCandidate(asset, normalizedLower, normalizedUpper, wordBoundaryRe, preferredRegion),
      }))
      .filter((c) => c.score >= 500)
      .map((c) => ({ ...c, marketCapValue: parseMarketCapValue(c.asset.marketCap) }))
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return b.marketCapValue - a.marketCapValue;
      });

    const best = ranked[0]?.asset;
    if (!best?.symbol) return null;
    return {
      symbol: best.symbol,
      assetType: best.type || undefined,
      region: best.region || undefined,
    };
  } catch (error) {
    logger.warn({ err: sanitizeError(error), query: normalized }, "Short-query asset resolution failed");
    return null;
  }
}

function emitModelCacheEvent(params: {
  modelFamily: "gpt";
  plan: "STARTER" | "PRO" | "ELITE" | "ENTERPRISE";
  tier: "SIMPLE" | "MODERATE" | "COMPLEX";
  operation: "read" | "write";
  outcome: "hit" | "miss" | "success" | "failed";
}) {
  try {
    logModelCacheEvent(params);
  } catch (e) {
    logger.warn({ err: sanitizeError(e) }, "Failed to log model cache event");
  }
}

// Note: singleChunkStream and handleLateCacheHit now imported from ./streaming modules

// Note: FallbackContext and executeFallbackChain now imported from ./streaming/fallback-chain

export interface GenerateLyraStreamOptions {
  sourcesLimit?: number;
  skipAssetLinks?: boolean;
  cacheScope?: string;
  preResolvedPlan?: string;
}

export async function generateLyraStream(
  messages: LyraMessage[],
  context: LyraContext,
  userId: string,
  options: GenerateLyraStreamOptions = {},
) {
  const {
    sourcesLimit = 3,
    skipAssetLinks = false,
    cacheScope,
    preResolvedPlan,
  } = options;
  const timer = createTimer();
  let remainingCredits: number | null = null;
  let creditsConsumed = false;
  let consumedCreditCost = 0;
  // P2: Defensive copy — prevent in-place mutation of the caller's message array
  // (e.g. history compression, PII scrubbing) from leaking back to the caller.
  // Shallow spread shares content array references for multimodal messages —
  // clone arrays to fully isolate the copy. Preserve discriminated union types.
  const safeMessages: LyraMessage[] = messages.map((m) => {
    if (Array.isArray(m.content)) {
      return { ...m, content: [...m.content] } as typeof m;
    }
    return { ...m };
  });
  logger.info(
    { userId, messageCount: safeMessages.length },
    "Lyra stream started",
  );

  const lastUserMessage = safeMessages[safeMessages.length - 1];

  const query =
    typeof lastUserMessage?.content === "string"
      ? lastUserMessage.content
      : Array.isArray(lastUserMessage?.content)
        ? (lastUserMessage.content as unknown[])
            .filter(
              (p): p is { type: "text"; text: string } =>
                typeof p === "object" &&
                p !== null &&
                "type" in p &&
                (p as { type?: string }).type === "text",
            )
            .map((p) => p.text)
            .join(" ")
        : "Multimodal Input";

  logger.debug({ query }, "Extracted query from message");

  // 1. Guardrail Check + PII Scrubbing
  // Apply guardrails to ALL messages (not just last) to prevent API injection attacks via conversation history
  // B3-FIX: Scrub PII from user messages in-place before they enter the LLM context or logs
  for (let i = 0; i < safeMessages.length; i++) {
    const msg = safeMessages[i];
    if (msg.role === "user" && typeof msg.content === "string" && msg.content) {
      const { scrubbed } = scrubPII(msg.content);
      if (scrubbed !== msg.content) {
        safeMessages[i] = { ...msg, content: scrubbed };
      }
    }
  }
  // Only validate the last user message for the 5000 character limit
  // The conversation history can grow large, but new queries should be reasonable length
  const lastUserMsg = safeMessages[safeMessages.length - 1];
  if (lastUserMsg && lastUserMsg.role === "user" && typeof lastUserMsg.content === "string") {
    const { isValid, reason } = validateInput(lastUserMsg.content);
    if (!isValid) {
      logger.warn({ reason, role: lastUserMsg.role }, "Guardrail violation on new query");
      throw new SafetyViolationError(reason || "Safety Violation");
    }
  }
  // Still check all messages for injection patterns (but not length limit)
  for (const msg of safeMessages) {
    const msgContent = typeof msg.content === "string" ? msg.content : "";
    if (!msgContent) continue;
    const { isValid, reason } = checkPromptInjection(msgContent);
    if (!isValid) {
      logger.warn({ reason, role: msg.role }, "Prompt injection detected in conversation history");
      throw new SafetyViolationError(reason || "Safety Violation");
    }
  }

  // P2: Per-conversation char cap — prevents context-window exhaustion
  const conversationLengthCheck = validateConversationLength(safeMessages);
  if (!conversationLengthCheck.isValid) {
    throw new SafetyViolationError(conversationLengthCheck.reason || "Conversation too long");
  }

  // 1.1 Classify Query Complexity + resolve user plan → select tier config
  // messages.length includes the current message, so subtract 1 for conversation history length
  const tier = classifyQuery(query, Math.max(0, safeMessages.length - 1));
  // Use pre-resolved plan if provided by caller (avoids redundant DB/Redis round-trip).
  const userPlan = preResolvedPlan
    ? normalizePlanTier(preResolvedPlan)
    : await getUserPlan(userId);
  let tierConfig = getTierConfig(userPlan, tier);
  const isCompareMode = context.chatMode === "compare";
  const isStressTestMode = context.chatMode === "stress-test";
  const isMacroResearchMode = context.chatMode === "macro-research";
  const isMultiAssetMode = isCompareMode || isStressTestMode || isMacroResearchMode;
  const hasRichCompareContext = isCompareMode && Array.isArray(context.compareContext) && context.compareContext.length >= 2;
  const hasPortfolioContext = !!(
    context.portfolioHealth ||
    context.portfolioFragility ||
    context.portfolioSimulation
  );
  const responseMode: "default" | "compare" | "stress-test" | "portfolio" | "macro-research" = isCompareMode
    ? "compare"
    : isStressTestMode
      ? "stress-test"
      : isMacroResearchMode
        ? "macro-research"
        : hasPortfolioContext
          ? "portfolio"
          : "default";

  // ── Multi-asset mode quality override ─────────────────────────────────────
  // Compare and Stress Test require cross-asset synthesis depth equivalent to
  // Elite COMPLEX: RAG, web search, cross-sector, and GPT with low reasoning.
  // Override tierConfig (but keep userPlan for prompt identity / governance).
  // Gated to PRO+ to prevent STARTER users from triggering Elite-level spend.
  if (isMultiAssetMode && userPlan !== "STARTER") {
    const userMaxTokens = tierConfig.maxTokens;
    tierConfig = {
      ...getTierConfig("ELITE", "COMPLEX"),
      // Preserve the user's actual token ceiling to avoid over-spending credits.
      // All ELITE COMPLEX feature flags (RAG, web search, cross-sector, reasoning) apply,
      // but the output budget stays within the user's plan ceiling.
      maxTokens: userMaxTokens,
    };
    logger.info({ chatMode: context.chatMode, maxTokens: userMaxTokens }, "Multi-asset mode: tierConfig upgraded to ELITE COMPLEX specs, token ceiling preserved");
  } else if (isMultiAssetMode && userPlan === "STARTER") {
    logger.info({ chatMode: context.chatMode, userPlan }, "Multi-asset mode requested by STARTER user — using standard tier config (upgrade required for Elite features)");
  }

  logger.info({ tier, userPlan, chatMode: context.chatMode ?? "default", maxTokens: tierConfig.maxTokens, reasoningEffort: tierConfig.reasoningEffort }, "Query classified");
  // Multi-asset responses already receive rich structured context and are latency-sensitive.
  // Keep reasoning off there to avoid TTFT spikes from unnecessary hidden deliberation.
  const gptReasoningEffort = responseMode === "default" ? tierConfig.reasoningEffort : "none";

  // Hoist trivial detection before any DB work — greetings/acks skip asset resolution entirely.
  const isTrivial = TRIVIAL_QUERY_RE.test(query.trim());

  // Extract mentioned symbols once from all messages — reuse for symbol resolution, context building, and topic detection.
  const mentionedSymbols = extractMentionedSymbols(safeMessages as Array<{ role: string; content: string | unknown }>);
  // For symbol resolution, only consider the last user message's mentions (same as the old single-message extraction)
  const mentionedFromQuery = !context.chatMode
    ? mentionedSymbols
    : [];
  let resolvedSymbol = context.symbol || "GLOBAL";
  let resolvedAssetType = context.assetType || "GLOBAL";
  let resolvedRegion: string | undefined = context.region;
  if (!isTrivial && resolvedSymbol === "GLOBAL" && mentionedFromQuery.length > 0 && tier !== "SIMPLE") {
    resolvedSymbol = mentionedFromQuery[0];
    logger.info({ resolvedSymbol, from: "auto-detect" }, "Resolved asset from user message");
  }
  if (!isTrivial && resolvedSymbol === "GLOBAL" && !context.chatMode && tier !== "SIMPLE") {
    const preferredRegion = typeof context.region === "string"
      ? context.region
      : undefined;
    const shortQueryAsset = await resolveAssetFromShortQuery(query, preferredRegion);
    if (shortQueryAsset) {
      resolvedSymbol = shortQueryAsset.symbol;
      if (shortQueryAsset.assetType) {
        resolvedAssetType = shortQueryAsset.assetType;
      }
      if (shortQueryAsset.region && !context.region) {
        resolvedRegion = shortQueryAsset.region;
      }
      logger.info({ resolvedSymbol, resolvedAssetType, from: "short-query-db-lookup" }, "Resolved asset from short natural-language query");
    }
  }
  const needsLateAssetTypeResolution =
    resolvedSymbol !== "GLOBAL" &&
    (!resolvedAssetType || resolvedAssetType === "GLOBAL");

  // 1.2b EARLY MODEL CACHE CHECK (Block 2) — before any DB or context work.
  // Key uses tier + query hash only (no priceLastUpdated). Write keys on cache miss match
  // the same shape, so early reads always hit entries written on prior misses.
  // Sources are cached separately under <modelCacheKey>:sources so cache hits return real sources.
  // Use already-computed tierConfig (which includes multi-asset override) — avoids a stale
  // re-fetch that would miss the compare/stress-test GPT upgrade.
  const cacheAssetType = resolvedAssetType;
  const earlyGptKey = modelCacheKey({
    planTier: userPlan,
    tier,
    assetType: cacheAssetType,
    symbol: resolvedSymbol !== "GLOBAL" ? resolvedSymbol : undefined,
    responseMode,
    query,
  });

  // Only attempt early hit when not trivial (trivial handled below) and not an edu-cacheable path
  // (edu cache has its own short-circuit later and may have fresher results).
  const earlyEduCacheable = process.env.ENABLE_EDU_CACHE === "true" && tier === "SIMPLE" && !isMultiAssetMode;
  // Track whether we already checked the GPT cache with the same key that the late
  // check would use — avoids a redundant Redis round-trip on cache misses.
  let earlyCacheAlreadyMissed = false;
  if (!earlyEduCacheable && !needsLateAssetTypeResolution) {
    earlyCacheAlreadyMissed = true; // will be set to false on hit, stays true on miss
    const earlyCacheText = await getCache<string>(earlyGptKey);
    if (earlyCacheText) {
      const cachedSources = await getCache<Source[]>(`${earlyGptKey}:sources`).catch(() => null);
      logger.info({ tier, cacheKey: earlyGptKey }, "Early model cache HIT — skipping context build");
      awardXP(userId, "lyra_question", "Asked Lyra a question").catch((e: unknown) =>
        logger.warn({ err: sanitizeError(e) }, "XP award failed"),
      );

      // Cache-hit cost tracking: estimate tokens so audit/billing doesn't report $0
      // Input tokens estimated by tier (prompt not built yet at early hit point)
      const earlyCacheDeployment = resolveGptDeployment(tierConfig.gpt54Role);
      const estimatedInputTokens = ESTIMATED_INPUT_TOKENS_BY_TIER[tier] ?? ESTIMATED_INPUT_TOKENS_BY_TIER.COMPLEX!;
      const earlyCacheInputTokens = estimatedInputTokens;
      const earlyCacheOutputTokens = Math.round(earlyCacheText.length / 4);
      const earlyCacheCostBreakdown = calculateLLMCost({
        model: earlyCacheDeployment,
        inputTokens: earlyCacheInputTokens,
        outputTokens: earlyCacheOutputTokens,
        cachedInputTokens: earlyCacheInputTokens,
      });
      storeConversationLog(
        userId, query, earlyCacheText, earlyCacheDeployment,
        {
          tokensUsed: earlyCacheInputTokens + earlyCacheOutputTokens,
          inputTokens: earlyCacheInputTokens,
          outputTokens: earlyCacheOutputTokens,
          cachedInputTokens: earlyCacheInputTokens,
          reasoningTokens: 0,
          totalCost: earlyCacheCostBreakdown.totalCost,
        },
        tier, 1, false,
      ).catch((e: unknown) =>
        logger.warn({ err: sanitizeError(e), userId }, "Failed to log early-cache-hit interaction"),
      );

      // Feed cache-hit spend into daily cost alert (same as non-cached path)
      alertIfDailyCostExceeded(earlyCacheCostBreakdown.totalCost).catch((e) => logFireAndForgetError(e, "early-cache-cost-alert"));

      earlyCacheAlreadyMissed = false; // hit — late check must not re-check
      return {
        result: { textStream: singleChunkStream(earlyCacheText) },
        sources: cachedSources ?? [],
        remainingCredits,
        contextTruncated: false,
        ragDegraded: false,
      };
    }
  }

  // 1.2 TRIVIAL QUERY SHORT-CIRCUIT (#4+9)
  // Pure greetings ("hi", "thanks", "ok") return a canned response — zero LLM cost, instant response.
  if (isTrivial) {
    logger.info({ query }, "Trivial query — returning canned response");
    return {
      result: { textStream: singleChunkStream(TRIVIAL_QUERY_RESPONSE) },
      sources: [],
      remainingCredits,
      contextTruncated: false,
      ragDegraded: false,
    };
  }

  // 1.1b EDUCATIONAL CACHE SHORT-CIRCUIT (Starter + PRO, SIMPLE tier only)
  // Returns cached text as a synthetic stream — zero LLM cost for repeated educational queries.
  const isEduCacheable = EDU_CACHE_ENABLED && (userPlan === "STARTER" || userPlan === "PRO") && tier === "SIMPLE" && !isTrivial;
  if (isEduCacheable) {
    const cacheKey = eduCacheKey(query, cacheScope);
    const cachedText = await getCache<string>(cacheKey);
    if (cachedText) {
      logger.info({ cacheKey, queryLen: query.length }, "Educational cache HIT — returning cached response");
      awardXP(userId, "lyra_question", "Asked Lyra a question").catch((e: unknown) =>
        logger.warn({ err: sanitizeError(e) }, "XP award failed"),
      );
      return {
        result: { textStream: singleChunkStream(cachedText) },
        sources: [],
        remainingCredits,
        contextTruncated: false,
        ragDegraded: false,
      };
    }
    logger.debug({ cacheKey }, "Educational cache MISS — proceeding to LLM");
  }

  // B1: Per-user in-flight lock using Redis SET NX (set-if-not-exists) semantics.
  // Plain setCache always overwrites — it cannot detect a pre-existing key.
  // redis.set with nx:true returns "OK" only when the key was absent; null when already set.
  const inFlightKey = `lyra:inflight:chat:${userId}`;
  const lockAcquired = await redisSetNXStrict(inFlightKey, 60);
  if (!lockAcquired) {
    logger.warn({ userId }, "In-flight request already active — rejecting duplicate");
    throw new Error("A request is already in progress. Please wait for it to complete before sending another.");
  }

  // B1: Outer try/finally ensures the in-flight lock is released on ALL exit paths —
  // including early throws from daily-cap, credit-check, or any unexpected error before
  // the inner LLM try/finally (line ~1214) is entered.
  try {

  // 1.1 Daily token spend cap — secondary cost backstop at infrastructure layer.
  // Credits are the primary control; this catches runaway API usage that slips past credits.
  // ENTERPRISE has a finite cap (env-configurable) so the check applies to all plans.
  if (process.env.SKIP_CREDITS !== "true") {
    const effectiveCaps = await getEffectiveDailyTokenCaps();
    const cap = effectiveCaps[userPlan] ?? effectiveCaps.PRO;
    if (isFinite(cap)) {
      const used = await getDailyTokensUsed(userId, userPlan);
      if (used >= cap) {
        logger.warn({ userId, userPlan, used, cap }, "Daily token cap exceeded");
        // Midnight-UTC reset timestamp so the route layer can render a friendly
        // "resets in Xh Ym" countdown + `Retry-After` header instead of a generic 500.
        const now = new Date();
        const resetAt = new Date(Date.UTC(
          now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0,
        )).toISOString();
        throw new UsageLimitError(
          "Daily usage limit reached for your plan. Your quota resets at midnight UTC. Upgrade to increase your limit.",
          "daily_tokens",
          resetAt,
        );
      }
    }
  }

  // 1.2 Credit Check (skip for ENTERPRISE or if SKIP_CREDITS=true in .env)
  if (userPlan !== "ENTERPRISE" && process.env.SKIP_CREDITS !== "true") {
    const isAssetPageQuery = context.symbol && context.symbol !== "GLOBAL";
    const creditCost = isAssetPageQuery ? 5 : getCreditCost(tier);
    const costDescriptor = isAssetPageQuery ? "Lyra Asset Intel Query" : `${tier} query`;

    const { success, remaining } = await consumeCredits(userId, creditCost, costDescriptor);
    if (!success) {
      logger.warn({ userId, creditCost, remaining }, "Insufficient credits");
      throw new UsageLimitError(
        `Insufficient credits. You have ${remaining} credits. Upgrade or purchase more credits to continue.`,
        "credits",
      );
    }
    remainingCredits = remaining;
    creditsConsumed = true;
    consumedCreditCost = creditCost;
    logger.debug({ creditCost, remaining }, "Credits consumed");
  }

  awardXP(userId, "lyra_question", "Asked Lyra a question").catch((e: unknown) =>
    logger.warn({ err: sanitizeError(e) }, "XP award failed"),
  );

  // Parallel retrieval block: RAG + Web Search + Asset List + Price Data + Cross-Sector (all independent)
  let knowledgeContext = "";
  let webSearchContext = "";
  let memoryContext = "";
  let globalNotes = "";
  let sessionNotes = "";
  let knowledgeSources: Source[] = [];
  let webSearchSources: Source[] = [];
  let availableAssets: string[] = [];
  let priceData: {
    price?: number | null; changePercent?: number | null;
    fiftyTwoWeekHigh?: number | null; fiftyTwoWeekLow?: number | null;
    lastPriceUpdate?: Date | null;
  } | undefined;
  let assetEnrichment: AssetEnrichment | undefined;
  let crossSectorContext = "";
  let historicalAnalogContext = "";
  let ragDegraded = false; // UX-1: Track RAG timeout/failure for frontend surfacing

  // 1.5b MACRO SHORT-CIRCUIT detection
  // If the query is purely macro/regime, we skip asset-specific enrichment even if a symbol was detected.
  // This saves ~1,500-2,000 tokens of irrelevant ticker data.
  const isMacroDetected = MACRO_DETECTED_RE.test(query);
  const isPureMacro = isMacroDetected && !FUNDAMENTAL_EXCLUSION_RE.test(query);
  const hasExplicitHistoricalIntent = HISTORICAL_INTENT_RE.test(query);
  const needsFreshExternalEvidence = FRESH_EVIDENCE_RE.test(query);
  // GLOBAL queries are inherently about current market conditions — always fetch web context
  // when webSearchEnabled is true for the plan, regardless of recency keywords in the query.
  const isGlobalQuery = resolvedSymbol === "GLOBAL";
  const isMacroRecencyQuery = isMacroDetected && MACRO_RECENCY_RE.test(query);

  if (!isTrivial) {
    // Determine macro/regime query status early
    const isAnalogQueryFlag = hasExplicitHistoricalIntent;

    // Pre-compute search region once — reused by web search and cross-sector tasks
    const searchRegion = inferSearchRegion(
      resolvedSymbol,
      typeof context.region === "string" ? context.region : assetEnrichment?.region ?? undefined,
    );

    // Build parallel tasks array — but we need to await asset enrichment before analogs
    // because analogs now depend on priceData and assetEnrichment for risk/reward.
    
    // Task: Asset Enrichment (Skipped if Pure Macro)
    let assetEnrichmentPromise: Promise<void> | null = null;
    if (resolvedSymbol !== "GLOBAL" && !isPureMacro) {
      assetEnrichmentPromise = (async () => {
        try {
          const isSimple = tier === "SIMPLE";
          const useLeanAssetEnrichment = responseMode !== "default";
          // P2: Full select shape — Prisma infers the return type from this object.
          // We always declare all fields; at runtime Prisma only fetches what's true.
          // SIMPLE and lean paths set the deep data fields to false to avoid fetching them.
          const deepFields = !isSimple && !useLeanAssetEnrichment;
          const includeScoreDynamics = !isSimple;
          const assetSelect = {
            price: true, changePercent: true,
            fiftyTwoWeekHigh: true, fiftyTwoWeekLow: true, lastPriceUpdate: true,
            performanceData: true, signalStrength: true,
            scoreDynamics: includeScoreDynamics, factorAlignment: includeScoreDynamics,
            marketCap: true, metadata: true, type: true, region: true,
            description: true, industry: true, sector: true,
            cryptoIntelligence: deepFields,
            category: true, currency: true,
            coingeckoId: true,
            // Phase 3: On-chain concentration & leverage data (CI-6, CB-3)
            holderGini: true, top10HolderPercent: true, fundingRate: true, openInterest: true,
            // Phase 3: Exchange flows, staking, emissions, governance (CB-4, CB-5, CB-6)
            exchangeFlows: true, stakingYield: true, emissionSchedule: true, governanceData: true,
          };

          const asset = await prisma.asset.findUnique({
            where: { symbol: resolvedSymbol },
            select: assetSelect,
          });
          if (asset) {
            if (asset.price != null) {
              priceData = asset;
            }
            assetEnrichment = {
              performanceData: asset.performanceData as Record<string, unknown> | null,
              signalStrength: asset.signalStrength as Record<string, unknown> | null,
              scoreDynamics: asset.scoreDynamics as Record<string, unknown> | null,
              factorAlignment: asset.factorAlignment as Record<string, unknown> | null,
              marketCap: asset.marketCap,
              metadata: asset.metadata as Record<string, unknown> | null,
              type: asset.type,
              description: asset.description,
              industry: asset.industry,
              sector: asset.sector,
              cryptoIntelligence: asset.cryptoIntelligence as Record<string, unknown> | null,
              category: asset.category,
              currency: asset.currency,
              coingeckoId: asset.coingeckoId,
              region: asset.region,
              // Phase 3: On-chain concentration & leverage data (CI-6, CB-3)
              holderGini: asset.holderGini,
              top10HolderPercent: asset.top10HolderPercent,
              fundingRate: asset.fundingRate,
              openInterest: asset.openInterest,
              // Phase 3: Exchange flows, staking, emissions, governance (CB-4, CB-5, CB-6)
              exchangeFlows: asset.exchangeFlows as Record<string, unknown> | null,
              stakingYield: asset.stakingYield as Record<string, unknown> | null,
              emissionSchedule: asset.emissionSchedule as Record<string, unknown> | null,
              governanceData: asset.governanceData as Record<string, unknown> | null,
            };
          }
        } catch (e) {
          logger.error({ err: sanitizeError(e) }, "Asset enrichment failed");
        }
      })();
    } else if (isPureMacro && resolvedSymbol !== "GLOBAL") {
      logger.info({ resolvedSymbol, query }, "Macro short-circuit active: skipping enrichment for pure macro query");
    }

    // Await asset enrichment if we need it for analogs or to resolve asset type for auto-detected symbols.
    // needsLateAssetTypeResolution must ALWAYS await enrichment before RAG fires — otherwise RAG
    // uses resolvedAssetType="GLOBAL" and retrieves wrong knowledge chunks.
    const requiresAnalog = (userPlan === "ELITE" || userPlan === "ENTERPRISE") && tier !== "SIMPLE" && isAnalogQueryFlag;
    const requiresResolvedAssetType = needsLateAssetTypeResolution && !!assetEnrichmentPromise;

    if ((requiresAnalog || requiresResolvedAssetType) && assetEnrichmentPromise) {
      await assetEnrichmentPromise;
      resolvedAssetType = (assetEnrichment?.type || context.assetType || "GLOBAL") as string;
    }

    // Build remaining parallel promises array — run concurrently (#8)
    const parallelTasks: Promise<void>[] = [];
    
    const assetEnrichmentAlreadyAwaited = (requiresAnalog || requiresResolvedAssetType) && !!assetEnrichmentPromise;
    if (assetEnrichmentPromise && !assetEnrichmentAlreadyAwaited) {
      parallelTasks.push(assetEnrichmentPromise);
    }

    // Task 1: RAG Retrieval (conditional based on tier)
    // Reduce chunk count for SIMPLE to save ~1500-2000 input tokens
    const ragTopK = resolveRagTopK(tier, responseMode, resolvedSymbol, userPlan);
    const RAG_TIMEOUT_MS = resolveRagTimeoutMs(responseMode, tier);
    const shouldUseRag =
      tierConfig.ragEnabled &&
      (
        responseMode !== "compare" ||
        !hasRichCompareContext ||
        hasExplicitHistoricalIntent ||
        needsFreshExternalEvidence ||
        isMacroRecencyQuery
      );
    if (query.length > 5 && query !== "Multimodal Input" && shouldUseRag) {
      parallelTasks.push(
        (async () => {
          const ragStartTime = Date.now();
          try {
            const useFastPath = tier === "SIMPLE";
            logger.info({ userId, tier, ragTopK, useFastPath, timeoutMs: RAG_TIMEOUT_MS }, "Starting RAG retrieval");
            const ragTimeout = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), RAG_TIMEOUT_MS)
            );
            const ragWork = Promise.all([
              retrieveInstitutionalKnowledge(
                query,
                ragTopK,
                resolvedAssetType !== "GLOBAL" ? resolvedAssetType : context.assetType,
                useFastPath,
                tier,
              ),
              // Block 6: raise threshold from turn 2 to turn 4 — memory retrieval is only
              // useful once enough conversation history exists (turn 2-3 hits are rare given
              // the 0.42 similarity threshold). shouldQueueEmbedding stays at >= 3 so
              // embeddings written on turn 3 are ready for retrieval from turn 4 onward.
              tierConfig.ragMemoryEnabled && safeMessages.length >= 4
                ? retrieveUserMemory(userId, query, {
                    symbol: resolvedSymbol !== "GLOBAL" ? resolvedSymbol : undefined,
                  })
                : Promise.resolve(""),
              // Fetch structured user profile notes (global) and session context notes.
              // Plain-text DB reads — no embedding API call.
              // W5: Skip entirely for new users (< 2 messages) — no notes exist yet, saves 2 DB round-trips.
              tier !== "SIMPLE" && safeMessages.length >= 2 ? getGlobalNotes(userId, "lyra") : Promise.resolve(""),
              tier !== "SIMPLE" && safeMessages.length >= 2 ? getSessionNotes(userId, "lyra") : Promise.resolve(""),
            ]);
            const ragResult = await Promise.race([ragWork, ragTimeout]);
            // Instrument late RAG resolution for capacity planning
            ragWork.then((lateResult) => {
              if (ragResult === null && lateResult !== null) {
                const lateKnowledge = lateResult[0] as { chunkCount?: number } | undefined;
                logger.warn(
                  { tier, timeoutMs: RAG_TIMEOUT_MS, lateChunkCount: lateKnowledge?.chunkCount ?? 0 },
                  "RAG resolved after timeout — underlying work completed late",
                );
              }
            }).catch((e) => logFireAndForgetError(e, "rag-late-resolution"));
            const ragRetrievalMs = Date.now() - ragStartTime;
            if (ragResult === null) {
              logger.warn({ tier, timeoutMs: RAG_TIMEOUT_MS }, "RAG retrieval timed out — proceeding without context");
              ragDegraded = true;
              // Log RAG quality even on timeout (zero chunks, timedOut=true)
              logRagQuality({
                tier,
                chunkCount: 0,
                avgSimilarity: 0,
                p50Similarity: 0,
                p95Similarity: 0,
                timedOut: true,
                retrievalMs: ragRetrievalMs,
              });
            } else {
              const [knowledgeResult, memoryResult, globalNotesResult, sessionNotesResult] = ragResult;
              knowledgeContext = knowledgeResult.content;
              knowledgeSources = knowledgeResult.sources;
              memoryContext = memoryResult;
              if (globalNotesResult) globalNotes = globalNotesResult;
              if (sessionNotesResult) sessionNotes = sessionNotesResult;
              // Calculate similarity statistics for RAG quality logging from knowledgeResult.similarities
              const similarities = knowledgeResult.similarities ?? [];
              const avgSim = similarities.length > 0 ? similarities.reduce((a, b) => a + b, 0) / similarities.length : 0;
              const sortedSims = [...similarities].sort((a, b) => a - b);
              const p50 = sortedSims[Math.floor(sortedSims.length * 0.5)] ?? 0;
              const p95 = sortedSims[Math.floor(sortedSims.length * 0.95)] ?? 0;
              logRagQuality({
                tier,
                chunkCount: knowledgeResult.chunkCount,
                avgSimilarity: avgSim,
                p50Similarity: p50,
                p95Similarity: p95,
                timedOut: false,
                retrievalMs: ragRetrievalMs,
              });
              logger.info(
                { sourceCount: knowledgeSources.length, memorySkipped: !tierConfig.ragMemoryEnabled || safeMessages.length < 4 },
                "RAG retrieval completed",
              );
            }
          } catch (e) {
            const failRetrievalMs = Date.now() - ragStartTime;
            logger.error({ err: sanitizeError(e) }, "RAG retrieval failed");
            ragDegraded = true;
            // Log RAG quality on failure
            logRagQuality({
              tier,
              chunkCount: 0,
              avgSimilarity: 0,
              p50Similarity: 0,
              p95Similarity: 0,
              timedOut: false,
              retrievalMs: failRetrievalMs,
            });
          }
        })()
      );
    }

    // Task 2: Available Assets — for asset-specific queries inject top-20 same-sector peers
    // instead of all 669 symbols (~500-800 token saving). GLOBAL queries still get the full list.
    // Skip for SIMPLE+GLOBAL and Starter SIMPLE (format doesn't use [AVAILABLE_ASSETS]).
    const isSimpleGlobal = tier === "SIMPLE" && resolvedSymbol === "GLOBAL";
    const isAssetSpecific = resolvedSymbol && resolvedSymbol !== "GLOBAL";
    // Guard: assetType "GLOBAL" is not a valid Prisma AssetType enum — skip peer lookup for
    // chatMode (compare / stress-test) and any GLOBAL context to prevent Prisma errors.
    const isPeerLookupSafe = isAssetSpecific && resolvedAssetType !== "GLOBAL" && !context.chatMode;
    if (!isSimpleGlobal && !(userPlan === "STARTER" && tier === "SIMPLE")) {
      parallelTasks.push(
        (async () => {
          if (responseMode === "compare") {
            availableAssets = ((context.compareContext || []) as Array<{ symbol?: string }>)
              .map((item) => item.symbol?.toUpperCase())
              .filter((symbol): symbol is string => !!symbol)
              .slice(0, 3);
          } else if (responseMode === "stress-test") {
            availableAssets = extractMentionedSymbols([{ role: "user", content: query }]).slice(0, 3);
          } else if (isPeerLookupSafe) {
            // Fetch top-20 peers in same sector/type for asset-specific queries.
            // Cached per assetType for 1h — peers change at most daily.
            const peerCacheKey = `lyra:peers:${resolvedAssetType.toLowerCase()}`;
            try {
              const cachedPeers = await getCache<string[]>(peerCacheKey);
              if (cachedPeers) {
                availableAssets = cachedPeers.filter((s) => s !== resolvedSymbol).slice(0, 20);
              } else {
                const peers = await prisma.asset.findMany({
                  where: {
                    type: resolvedAssetType === "CRYPTO" ? "CRYPTO" as const : undefined,
                    symbol: { not: resolvedSymbol },
                  },
                  orderBy: { marketCap: "desc" },
                  take: 20,
                  select: { symbol: true },
                });
                availableAssets = peers.map((p) => p.symbol);
                setCache(peerCacheKey, availableAssets, 3600).catch((e) => logFireAndForgetError(e, "peer-cache"));
              }
            } catch {
              // Fall back to empty list — asset links degrade gracefully without peers.
              // Full 669-symbol fallback would inject ~1200 excess tokens and blow token budget.
              logger.warn({ resolvedSymbol, resolvedAssetType }, "Peer lookup failed — using empty asset list");
              availableAssets = [];
            }
          } else {
            availableAssets = await getAvailableAssetSymbols();
          }
        })()
      );
    }

    // Task 3: Web Search (GPT only)
    // Provider: Tavily (p99 latency ~1.2s). Non-blocking soft deadline: web search fires
    // in parallel but we don't let it hold up the LLM call beyond WEB_SEARCH_SOFT_DEADLINE_MS.
    // If it resolves in time the context is injected; otherwise we proceed without it.
    // 3000ms is 2-3x Tavily's p99 — generous headroom without blocking the LLM response.
    const WEB_SEARCH_SOFT_DEADLINE_MS = 4000;
    const allowModeWebSearch =
      responseMode === "default" ||
      responseMode === "portfolio" ||
      (responseMode === "compare" && (needsFreshExternalEvidence || isMacroRecencyQuery));
    const shouldUseWebSearch =
      tierConfig.webSearchEnabled &&
      tierConfig.modelFamily === "gpt" &&
      allowModeWebSearch &&
      (needsFreshExternalEvidence || isMacroRecencyQuery || isGlobalQuery);
    if (shouldUseWebSearch) {
      parallelTasks.push(
        (async () => {
          try {
            // Tavily handles domain steering natively via includeDomains + topic:"finance"
            // inside searchWeb — no site: query manipulation needed here.
            const searchQuery = resolvedSymbol && resolvedSymbol !== "GLOBAL"
              ? `${resolvedSymbol} ${query}`
              : query;
            const webSearchPromise = searchWeb(
              searchQuery,
              sourcesLimit,
              "basic",
              searchRegion,
              tier === "COMPLEX" ? "complex" : tier === "MODERATE" ? "moderate" : "simple",
            );
            const softDeadline = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), WEB_SEARCH_SOFT_DEADLINE_MS)
            );
            const webResult = await Promise.race([webSearchPromise, softDeadline]);
            if (webResult && webResult.content) {
              webSearchContext = webResult.content;
              webSearchSources = webResult.sources;
            } else if (webResult === null) {
              logger.warn({ timeoutMs: WEB_SEARCH_SOFT_DEADLINE_MS }, "Web search soft deadline exceeded — proceeding without web context");
              // Let the underlying searchWeb promise continue resolving (it will write to cache)
              webSearchPromise.then((r) => {
                if (r?.content) logger.debug({ chars: r.content.length }, "Web search resolved after soft deadline (cached for next request)");
              }).catch((e) => logFireAndForgetError(e, "web-search-soft-deadline"));
            }
          } catch (e) {
            logger.error({ err: sanitizeError(e) }, "Web search failed");
          }
        })()
      );
    }

    // Task 5: Cross-Sector Correlation — only for macro/sector/global queries, not all COMPLEX
    // Avoids DB query + token cost for asset-specific COMPLEX queries like "How is BTC-USD doing?"
    const isCrossSectorQuery = resolvedSymbol === "GLOBAL" || isMacroDetected ||
      /\b(?:sector|regime|macro|cross[- ](?:asset|chain)|market|rotation|inflation|recession|rate|fed|rbi|ecb)\b/i.test(query);
    if (tierConfig.crossSectorEnabled && isCrossSectorQuery) {
      parallelTasks.push(
        (async () => {
          try {
            const latestRegime = await prisma.marketRegime.findFirst({
              where: {
                region: searchRegion,
              },
              orderBy: { date: "desc" },
              select: { correlationMetrics: true },
            });
            const metrics = latestRegime?.correlationMetrics as Record<string, unknown> | null;
            const cs = metrics?.crossSector as Record<string, unknown> | undefined;
            if (cs?.regime) {
              crossSectorContext = `\n[CROSS_SECTOR_CORRELATION]:\nRegime: ${cs.regime} | Avg ρ: ${cs.avgCorrelation} | Trend: ${cs.trend} | Dispersion: ${cs.sectorDispersionIndex}\nGuidance: ${cs.guidance}\nImplications: ${cs.implications}\n`;
              if (responseMode === "compare" || responseMode === "stress-test") {
                crossSectorContext = truncateAtSentence(crossSectorContext, 420);
              }
            }
          } catch (error) {
            logger.debug({ err: sanitizeError(error) }, "Failed to fetch cross-sector context (non-critical)");
          }
        })()
      );
    }

    // Task 6: Historical Analogs — Elite only, macro/regime queries, MODERATE/COMPLEX tier
    if ((userPlan === "ELITE" || userPlan === "ENTERPRISE") && tier !== "SIMPLE" && isAnalogQueryFlag) {
      parallelTasks.push(
        (async () => {
          try {
            const region = context.region || "US";
            const analogResult = await findHistoricalAnalogs(region);
            
            let riskRewardStr = "";
            if (priceData && assetEnrichment) {
              const currentPrice = priceData.price;
              const currentRegime = analogResult?.currentFingerprint.regimeState || "NORMAL";
              const isCryptoAsset = (assetEnrichment?.type || "").toUpperCase() === "CRYPTO";

              if (isCryptoAsset) {
                // Crypto-native risk/reward using ATH/ATL and on-chain metrics
                const metadata = assetEnrichment.metadata as Record<string, unknown> | null;
                const cgMeta = (metadata?.coingecko as Record<string, unknown>) || {};
                const ath = (cgMeta.ath as number | undefined) || priceData.fiftyTwoWeekHigh;
                const atl = (cgMeta.atl as number | undefined) || priceData.fiftyTwoWeekLow;
                const fdvToMcap = (cgMeta.fdv_to_market_cap as number | undefined)
                  || ((metadata?.fdv && metadata?.marketCap)
                    ? (metadata.fdv as number) / (metadata.marketCap as number)
                    : undefined);
                const cycleStage = (metadata?.cycleStage as string | undefined) || "unknown";

                const rrScore = calculateCryptoRiskReward({
                  currentPrice: currentPrice ?? 0,
                  ath,
                  atl,
                  cycleStage: cycleStage as CryptoRiskRewardInput["cycleStage"],
                  fdvToMcapRatio: fdvToMcap,
                  currentRegime,
                });
                if (rrScore) {
                  riskRewardStr = formatCryptoRiskRewardContext(rrScore, cycleStage);
                }
              } else {
                const fiftyTwoWeekHigh = priceData.fiftyTwoWeekHigh;
                const fiftyTwoWeekLow = priceData.fiftyTwoWeekLow;
                const metadata = assetEnrichment.metadata as Record<string, unknown> | null;
                const analystTargetMean = metadata?.analystTargetMean as number | undefined;

                const rrScore = calculateRiskRewardAsymmetry(
                  currentPrice,
                  analystTargetMean,
                  fiftyTwoWeekHigh,
                  fiftyTwoWeekLow,
                  currentRegime
                );
                if (rrScore) {
                  riskRewardStr = formatRiskRewardContext(rrScore);
                }
              }
            }

            if (analogResult) {
              historicalAnalogContext = formatAnalogContext(analogResult, riskRewardStr);
            } else if (riskRewardStr) {
              historicalAnalogContext = riskRewardStr;
            }
            if (responseMode === "compare" || responseMode === "stress-test") {
              historicalAnalogContext = truncateAtSentence(historicalAnalogContext, 450);
            }
          } catch (error) {
            logger.debug({ err: sanitizeError(error) }, "Failed to fetch historical analogs (non-critical)");
          }
        })()
      );
    }

// Execute all tasks in parallel
await Promise.all(parallelTasks);

// Merge web search results into knowledge context (after parallel tasks complete — no race condition).
// R2: Cap web search content at 2000 chars before merging — prevents large web results from crowding
// out [USER_PROFILE], [USER_MEMORY], and [KB] blocks when the cost ceiling truncates combined context.
if (webSearchContext) {
  const cappedWebSearch = webSearchContext.length > 2000
    ? truncateAtSentence(webSearchContext, 2000)
    : webSearchContext;
  knowledgeContext = knowledgeContext
    ? `${knowledgeContext}\n\n${cappedWebSearch}`
    : cappedWebSearch;
  knowledgeSources.push(...webSearchSources);
}

logRetrievalMetric({
  tier,
  responseMode,
  knowledgeChars: knowledgeContext.length,
  memoryChars: memoryContext.length,
  webChars: webSearchContext.length,
  sourceCount: knowledgeSources.length,
});

// C2: Only overwrite resolvedAssetType when enrichment actually returned a type.
  // On the macro path assetEnrichment is undefined — blindly reading ?.type resets
  // a correctly DB-resolved type (e.g. CRYPTO from resolveAssetFromShortQuery) back to "GLOBAL".
  if (assetEnrichment?.type) {
    resolvedAssetType = assetEnrichment.type as string;
  } else if (!resolvedAssetType || resolvedAssetType === "GLOBAL") {
    resolvedAssetType = (context.assetType || "GLOBAL") as string;
  }
    // 2) Multi-asset chatMode (compare/stress-test) where context > 8000 chars regardless of plan
    //    — prevents 43K+ raw context blowing up input token cost (audit: compare-pro-3asset was $0.04)
    if (responseMode === "compare" && knowledgeContext.length > 2400) {
      knowledgeContext = truncateAtSentence(knowledgeContext, 2400);
    } else if (responseMode === "stress-test" && knowledgeContext.length > 2800) {
      knowledgeContext = truncateAtSentence(knowledgeContext, 2800);
    } else if (responseMode === "portfolio" && knowledgeContext.length > 2600) {
      knowledgeContext = truncateAtSentence(knowledgeContext, 2600);
    }

    const isChatModeOversize = !!context.chatMode && knowledgeContext.length > 8000;
    const isMacroHeavyModerate =
      tier === "MODERATE" &&
      tierConfig.modelFamily === "gpt" &&
      (
        (resolvedAssetType === "GLOBAL") ||
        /\b(?:fed|rates?|inflation|macro|regime|sector rotation|yield|oil|gold|copper|dollar|usd|treasury|bond)\b/i.test(query)
      );
    // Raised thresholds: GPT-5.4 has 1M token context window; compressing 12K chars (~3K tokens) wasted a nano call.
    // Standard Elite: 12000→18000 chars. Macro-heavy MODERATE: 9000→12000 chars (broader context = more noise).
    const isEliteGptOversize = knowledgeContext.length > (isMacroHeavyModerate ? 12000 : 18000) &&
      tierConfig.modelFamily === "gpt" &&
      (userPlan === "ELITE" || userPlan === "ENTERPRISE");

    if (isChatModeOversize || isEliteGptOversize) {
      logger.info({ rawLength: knowledgeContext.length, trigger: isChatModeOversize ? "chatMode-cap" : "elite-gpt" }, "Triggering Pre-flight Context Compression");
      knowledgeContext = await compressKnowledgeContext(knowledgeContext);
    }
  } else {
    // Trivial query — only fetch asset list (cheap, in-memory cached)
    availableAssets = await getAvailableAssetSymbols();
  }

  // 1.8 Build Final Context (Compressed — saves ~2000 tokens vs raw JSON)
  // Override symbol/assetType in context when auto-detected from user message
  const enrichedContext: Record<string, unknown> = { ...context };
  if (resolvedSymbol !== (context.symbol || "GLOBAL")) {
    enrichedContext.symbol = resolvedSymbol;
    if (resolvedAssetType !== "GLOBAL") {
      enrichedContext.assetType = resolvedAssetType;
    }
  }
  if (resolvedRegion && !enrichedContext.region) {
    enrichedContext.region = resolvedRegion;
  }
  // mentionedSymbols already computed at top of function (L821) — reused here.

  // Analyze behavioral patterns from conversation history (MODERATE/COMPLEX only).
  // Builds a lightweight user intent profile from the last N user messages.
  const recentUserMessages = safeMessages
    .filter((m) => m.role === "user")
    .slice(-12);
  const behavioralInsights = tier !== "SIMPLE" && safeMessages.length >= 5
    ? analyzeBehavioralPatterns(
        recentUserMessages
          .map((m, idx) => ({
            // CB-2: Don't backfill every historical message with the current query's symbol.
            // Behavioral pattern detection relies on per-message asset symbols; falsifying them
            // breaks concentration, recency, and FOMO detection across the conversation.
            assetSymbol: undefined,
            assetType: resolvedAssetType !== "GLOBAL" ? resolvedAssetType : undefined,
            query: typeof m.content === "string" ? m.content : undefined,
            // Stagger timestamps by message index (1s apart, oldest first) so hasDistinctTimestamps=true
            // and recency/FOMO pattern detection works correctly on in-session conversation history.
            timestamp: new Date(Date.now() - (recentUserMessages.length - 1 - idx) * 1000),
          }))
      )
    : [];

  let finalContext = buildCompressedContext(enrichedContext, {
    knowledgeContext,
    memoryContext,
    globalNotes: globalNotes || undefined,
    sessionNotes: sessionNotes || undefined,
    crossSectorContext,
    availableAssets,
    mentionedSymbols,
    priceData,
    assetEnrichment,
    userPlan,
    tier,
    historicalAnalogContext,
    behavioralInsights,
    responseMode,
    query,
  });

  // ─── CACHE-OPTIMIZED TWO-MESSAGE ARCHITECTURE ───
  // Static system prompt (CACHED by OpenAI) — identity, governance, safety, format, guidance, modules
  // Variable context (injected as system message in messages array) — never cached, always fresh

  // 2a. Build Static System Prompt → goes into `system` param (CACHED)
  // Word budget = content tokens only (exclude ~450 structural overhead: headers, tables, follow-ups).
  // Content tokens × 0.72 ≈ words. This ensures the MINIMUM word instruction is achievable
  // within the actual maxOutputTokens cap.
  // Structural overhead: headers, tables, follow-up questions, disclaimer ≈ 450 tokens.
  // All real configs have maxTokens ≥ 1400, so (maxTokens - 450) always exceeds (maxTokens * 0.6).
  const contentTokens = tierConfig.maxTokens - 450;
  let wordBudget = (tierConfig.wordBudgetMultiplier != null && tierConfig.wordBudgetMultiplier > 0)
    ? Math.round(contentTokens * tierConfig.wordBudgetMultiplier * 0.72)
    : 0;
  // Elite/Enterprise: wordBudgetMultiplier=null → wordBudget=0 means NO word instruction in prompt.
  // Without a floor, verbosity:high API hint alone can still produce short responses on some prompts.
  // Floor = 60% of content tokens × 0.72 = a comfortable minimum that leaves headroom.
  if (wordBudget === 0) {
    wordBudget = Math.round(contentTokens * 0.60 * 0.72);
  }
  // Multi-asset mode (compare/stress-test) inherits ELITE COMPLEX's low multiplier (0.374) but
  // runs on the user's original (lower) token ceiling. For a STARTER user this yields ~256w —
  // far too tight for a multi-asset synthesis. Enforce a 900w floor for chatMode queries.
  if (isMultiAssetMode && wordBudget < 900) {
    wordBudget = 900;
  }
  // No-context floor: when both RAG and web search returned nothing (e.g. web search 5xx outage +
  // no knowledge-base embeddings for the queried symbol), the model has only its parametric knowledge.
  // Without grounding, models tend to hedge and produce short responses well below the word target.
  // Raise to the same 60%-of-content-tokens floor used for unconstrained tiers so the model
  // produces a substantive knowledge-based response instead of a hollow short one.
  // This does NOT inject context — it only adjusts the minimum word instruction in the prompt.
  const hasNoRetrievedContext = knowledgeContext.length === 0 && webSearchContext.length === 0;
  if (hasNoRetrievedContext && wordBudget < Math.round(contentTokens * 0.60 * 0.72)) {
    wordBudget = Math.round(contentTokens * 0.60 * 0.72);
    logger.debug({ wordBudget, tier, plan: userPlan }, "No-context floor applied to word budget");
  }
  const staticPrompt = BUILD_LYRA_STATIC_PROMPT(
    resolvedAssetType,
    query,
    userPlan,
    wordBudget,
    tier,
    tierConfig.modelFamily,
    hasPortfolioContext,
    responseMode,
  );

  const referenceExample = BUILD_LYRA_REFERENCE_EXAMPLE({
    assetType: resolvedAssetType,
    planTier: userPlan,
    queryTier: tier,
  });

  // Reference example always prepended when present so the messages-array prefix
  // is structurally identical across all conversation turns.
  // OpenAI caches the longest *matching prefix* — a turn-conditional insertion
  // would break the cache on turn 2 by shifting every subsequent message position.
  // BUILD_LYRA_REFERENCE_EXAMPLE returns "" for MODERATE/COMPLEX so this is a no-op there.
  const messagesWithExample: LyraMessage[] =
    referenceExample
      ? [{ role: "assistant", content: referenceExample }, ...safeMessages]
      : [...safeMessages];

  // 2b. Build Context Message → goes as system message in messages array (NOT cached, always fresh)
  // skipAssetLinks override lives HERE (not in static prompt) to preserve prompt cache across main chat + sidebar
  const assetLinkOverride = skipAssetLinks
    ? "\n[OVERRIDE] User is on this asset's page — do NOT include [View ... Intelligence] links."
    : "";
  // Conversation-aware context: on follow-ups, tell the model the turn number and to go deeper
  // Only inject the "build on prior" directive when the current query is still on the same asset
  // as the previous turn. For pivot questions (user switched assets/topics), inject [NEW_TOPIC]
  // so the model doesn't suppress context the new question actually requires.
  const prevSymbol = (() => {
    const prevMessages = safeMessages.slice(0, -1);
    if (prevMessages.length === 0) return null;
    const prevMentioned = extractMentionedSymbols(prevMessages as Array<{ role: string; content: string | unknown }>);
    return prevMentioned[0] ?? null;
  })();
  const isSameAssetTopic = prevSymbol === null || prevSymbol === resolvedSymbol;
  const conversationMeta = safeMessages.length > 1
    ? isSameAssetTopic
      ? `\n[CONVERSATION_META] Turn:${safeMessages.length} | Topic:${resolvedSymbol} | Build on prior analysis. Do NOT restate the Bottom Line, Risk Assessment, or conclusions from prior turns. Jump directly to the new angle, go deeper on a specific signal, or address the exact follow-up asked.`
      : `\n[CONVERSATION_META] Turn:${safeMessages.length} | NEW_TOPIC:${resolvedSymbol} | This is a new topic — treat it as a fresh analysis. Do not reference prior conversation conclusions unless directly relevant.`
    : "";
  const contextContent = `### LIVE MARKET CONTEXT\n${finalContext}${assetLinkOverride}${conversationMeta}`;

  // GPT supports role:"system" inside the messages array — used for the variable context block
  // so the static system prompt stays cacheable (OpenAI caches the longest matching prefix).
  const contextMessage: LyraMessage = {
    role: "system",
    content: contextContent,
  };

  // ── Plan-based conversation history caps (defined in config.ts) ────────────────
  const planHistoryCap = HISTORY_CAPS[userPlan] ?? 4;

  // Split into: recent (always sent raw) vs older (compress if present)
  const cappedMessages = messagesWithExample.length > planHistoryCap
    ? messagesWithExample.slice(-planHistoryCap)
    : [...messagesWithExample];

  // Compress older turns into a single lightweight summary message.
  // Only fires when there are messages beyond the last 2 raw turns.
  // Fired as a promise here so it overlaps with finalSources/cacheKey/metrics below.
  const olderTurns = cappedMessages.slice(0, -RECENT_RAW);
  const recentTurns = cappedMessages.slice(-RECENT_RAW);

  let historyCompressionPromise: Promise<LyraMessage[] | null> | null = null;
  if (olderTurns.length > 0) {
    const historyText = olderTurns
      .map((m) => `${m.role === "user" ? "User" : "Lyra"}: ${typeof m.content === "string" ? m.content : ""}`)
      .join("\n\n");
    // Skip compression for SIMPLE/MODERATE tiers (history context adds little to shallow queries)
    // and for short histories that wouldn't meaningfully compress (< 3000 chars).
    if (tier === "COMPLEX" && historyText.length >= 3000) {
      historyCompressionPromise = compressKnowledgeContext(historyText, 800)
        .then((compressed) => {
          const summaryMessage: LyraMessage = {
            role: "user",
            content: `[PRIOR CONVERSATION SUMMARY — compressed for efficiency]\n${compressed}`,
          };
          const ackMessage: LyraMessage = {
            role: "assistant",
            content: "Understood. I have context from our prior conversation.",
          };
          logger.debug(
            { originalTurns: olderTurns.length, compressedLen: compressed.length },
            "Conversation history compressed",
          );
          return [summaryMessage, ackMessage, ...recentTurns];
        })
        .catch(() => {
          logger.warn("Conversation compression failed — using raw capped history");
          return null; // signal to use cappedMessages
        });
    }
  }

  // 2c. Synchronous work runs while historyCompressionPromise (if any) resolves in background.
  // Key shape matches earlyGptKey (no priceLastUpdated) so reads hit writes.
  // When the early check already probed the same key shape, reuse it to avoid recomputation.
  const isMarketLevel = resolvedAssetType === "GLOBAL" || resolvedSymbol === "GLOBAL";
  const gptCacheKey = earlyCacheAlreadyMissed
    ? earlyGptKey
    : modelCacheKey({
        planTier: userPlan,
        tier,
        assetType: resolvedAssetType,
        symbol: resolvedSymbol !== "GLOBAL" ? resolvedSymbol : undefined,
        responseMode,
        query,
      });

  const emitCacheEvent = (params: {
    modelFamily: "gpt";
    operation: "read" | "write";
    outcome: "hit" | "miss" | "success" | "failed";
  }) => emitModelCacheEvent({
    ...params,
    plan: userPlan as "STARTER" | "PRO" | "ELITE" | "ENTERPRISE",
    tier: tier as "SIMPLE" | "MODERATE" | "COMPLEX",
  });

  // Static system prompt kept pure → enables OpenAI's server-side prompt cache.
  // Live context is injected as a system message in the messages array (always fresh).
  const finalSources: Source[] = knowledgeSources.length > 0
    ? knowledgeSources
    : resolvedSymbol !== "GLOBAL" && resolvedAssetType !== "GLOBAL" && (assetEnrichment || priceData)
      ? [{
          title: `${resolvedSymbol} asset intelligence context`,
          url: `/dashboard/assets/${encodeURIComponent(resolvedSymbol)}`,
          description: `Internal ${resolvedAssetType.toLowerCase()} context with live asset data and fundamental intelligence.`,
          type: "knowledge_base",
        }]
      : [];

  // Now await compression (should be done or nearly done — overlapped with sync work above)
  const historyMessages: LyraMessage[] = historyCompressionPromise
    ? (await historyCompressionPromise) ?? cappedMessages
    : cappedMessages;
  const finalMessages: LyraMessage[] = [...historyMessages, contextMessage];

  logger.debug(
    { staticPromptLength: staticPrompt.length, contextLength: finalContext.length, tier },
    "Cache-optimized prompts prepared",
  );
  const historyChars = historyMessages
    .reduce((sum, message) => sum + (typeof message.content === "string" ? message.content.length : 0), 0);
  logContextBudgetMetric({
    tier,
    responseMode,
    staticPromptLength: staticPrompt.length,
    contextLength: finalContext.length,
    historyLength: historyChars,
  });

  // H1: Pre-call cost ceiling — truncate context if estimated input tokens exceed plan ceiling.
  // Runs before LLM call. Never blocks — only truncates the context block to fit.
  const costCeiling = applyCostCeiling({
    systemPrompt: staticPrompt,
    context: finalContext,
    historyChars,
    userQuery: query,
    plan: userPlan,
    tier,
  });
  if (costCeiling.exceeded) {
    finalContext = costCeiling.truncatedContext;
    // C1: Rebuild as role:"system" to match the original contextMessage role.
    // Using role:"user" here broke the two-message cache architecture and leaked
    // system metadata into user-role content.
    const truncatedContextMessage: LyraMessage = { role: "system", content: `### LIVE MARKET CONTEXT\n${finalContext}${assetLinkOverride}${conversationMeta}` };
    finalMessages[finalMessages.length - 1] = truncatedContextMessage;
  }

  // 3. Call LLM (GPT-5.4 family — shared prompt cache)
  // Skip late cache check when the early check already probed the same key and missed.
  // The late check is only needed when needsLateAssetTypeResolution was true (early check
  // was skipped because resolvedAssetType wasn't final yet) or when edu-cache logic
  // bypassed the early check.
  const cachedGptText = earlyCacheAlreadyMissed ? null : await getCache<string>(gptCacheKey);
  if (cachedGptText) {
    return handleLateCacheHit(cachedGptText, gptCacheKey, emitCacheEvent, {
      userId, query, tier, tierConfig, staticPrompt, finalSources, remainingCredits, costCeiling,
    });
  }
  emitCacheEvent({ modelFamily: "gpt", operation: "read", outcome: "miss" });

  const tierTools = getAllowedTools();
  const hasTools = Object.keys(tierTools).length > 0;
  // Use the tier-appropriate GPT-5.4 deployment (nano/mini/full) from tierConfig.
  // This is the primary cost lever: Starter SIMPLE → nano ($0.20/M) vs full ($2.50/M).
  // Declared before the try so the catch block can reference it for the nano fallback check.
  // MIT-1: When fallback mitigation is active (fallback rate > 15%), override to nano
  // to avoid cascading failures against a degraded primary model.
  const mitigationActive = await isFallbackMitigationActive().catch(() => false);
  let effectiveDeployment: string;
  if (mitigationActive && tierConfig.gpt54Role !== "lyra-nano") {
    effectiveDeployment = resolveGptDeployment("lyra-nano");
    logger.warn({ tier, originalRole: tierConfig.gpt54Role }, "Fallback mitigation active — overriding to nano deployment");
  } else {
    effectiveDeployment = resolveGptDeployment(tierConfig.gpt54Role);
  }
  const effectiveModel = getSharedAISdkClient().responses(effectiveDeployment);

  // B1-FIX: Enforce latency budget with AbortController — prevents indefinite hangs.
  // Budget × 1.5 gives the model grace to finish a nearly-complete stream without
  // cutting off responses that are just barely over budget.
  // Multi-asset modes (compare/stress-test/macro-research) need RAG + web search +
  // cross-sector before LLM, so the effective floor is higher — use 2.0× for those.
  const latencyAbortController = new AbortController();
  const latencyAbortMultiplier = isMultiAssetMode ? 2.0 : 1.5;
  const latencyAbortTimeoutMs = tierConfig.latencyBudgetMs * latencyAbortMultiplier;
  const latencyAbortTimer = setTimeout(() => {
    logger.warn({ tier, budgetMs: tierConfig.latencyBudgetMs, abortMs: latencyAbortTimeoutMs }, "Latency budget exceeded — aborting stream");
    latencyAbortController.abort();
  }, latencyAbortTimeoutMs);

  try {
    const result = streamText({
      model: effectiveModel,
      messages: finalMessages,
      system: staticPrompt,
      ...(hasTools ? { tools: tierTools } : {}),
      maxOutputTokens: getTargetOutputTokens(tierConfig, tier as QueryComplexity),
      abortSignal: latencyAbortController.signal,
      providerOptions: {
        openai: {
          textVerbosity: "high",
          promptCacheKey: "lyra-static-v1",
          ...(gptReasoningEffort !== "none" ? { reasoningEffort: gptReasoningEffort } : {}),
        },
      },
      onFinish: async ({ text, usage }) => {
        // B1-FIX: Clear the abort timer once the stream finishes naturally
        clearTimeout(latencyAbortTimer);

        // AI SDK exposes cachedInputTokens and reasoningTokens at top level
        // Use runtime validation with safe number extraction
        const usageAny = usage as Record<string, unknown>;
        const cachedTokens = Number.isFinite(usageAny.cachedInputTokens) ? (usageAny.cachedInputTokens as number) : 0;
        const reasoningTokens = Number.isFinite(usageAny.reasoningTokens) ? (usageAny.reasoningTokens as number) : 0;
        const inputTokens = Number.isFinite(usage.inputTokens) ? usage.inputTokens ?? 0 : 0;
        const outputTokens = Number.isFinite(usage.outputTokens) ? usage.outputTokens ?? 0 : 0;
        const totalTokens = Number.isFinite(usage.totalTokens) ? usage.totalTokens! : (inputTokens + outputTokens);
        const tokensUsed = Number.isFinite(totalTokens) ? totalTokens : (inputTokens + outputTokens);
        const durationMs = timer.end();
        const tokenReport = {
          tokens: tokensUsed,
          inputTokens: inputTokens ?? 0,
          outputTokens: outputTokens ?? 0,
          cachedTokens,
          noCacheTokens: (inputTokens ?? 0) - cachedTokens,
          reasoningTokens,
          tier,
          reasoningEffort: gptReasoningEffort,
          promptVersion: PROMPT_VERSION,
          duration: `${(durationMs / 1000).toFixed(1)}s`,
          durationMs,
        };
        logger.info(tokenReport, "LLM generation finished");

        // Track latency budget violations
        const latencyBudgetMs = tierConfig.latencyBudgetMs;
        const exceededBudget = durationMs > latencyBudgetMs;
        recordLatencyViolation(exceededBudget, durationMs, tier).catch((e) => logFireAndForgetError(e, "latency-violation"));

        // Increment daily token counter (fire-and-forget — never blocks response path)
        incrementDailyTokens(userId, usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)).catch((e) => logFireAndForgetError(e, "daily-tokens"));

        // W3-FIX: Record cost ceiling estimation accuracy — compare estimated vs actual input tokens.
        // This was defined but never called, leaving estimation accuracy unmonitored.
        recordEstimationAccuracy(costCeiling.estimatedInputTokens, inputTokens, tier).catch((e) => logFireAndForgetError(e, "cost-estimation"));

        try {
          logModelRouting({
            model: effectiveDeployment,
            tier,
            tokens: usage.totalTokens ?? ((usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)),
            wasFallback: false,
            duration: tokenReport.duration,
            durationMs,
          });

          // Streaming latency metrics (OBS-2): TTFT requires stream instrumentation for true measurement.
          // Using estimated TTFT based on tier-specific heuristics until per-chunk tracking is added.
          // COMPLEX queries have longer input processing (~30% of duration), SIMPLE is faster (~15%).
          const estimatedTtftRatio = tier === "COMPLEX" ? 0.30 : tier === "MODERATE" ? 0.20 : 0.15;
          const estimatedTtftMs = Math.round(durationMs * estimatedTtftRatio);
          const streamingDurationMs = Math.max(1, durationMs - estimatedTtftMs);
          const tps = outputTokens > 0 ? (outputTokens / (streamingDurationMs / 1000)) : 0;

          logStreamingLatency({
            model: effectiveDeployment,
            tier,
            plan: userPlan,
            // TTFT is estimated until per-chunk instrumentation is added
            ttftMs: estimatedTtftMs,
            tps,
            totalTokens: outputTokens,
            durationMs,
            wasFallback: false,
          });
        } catch (e) {
          logger.warn({ err: sanitizeError(e) }, "Failed to log GPT routing or streaming latency");
        }

        // Write educational cache for Starter + PRO + SIMPLE (cache miss path)
        if (isEduCacheable && text) {
          const cacheKey = eduCacheKey(query, cacheScope);
          setCache(cacheKey, text, EDU_CACHE_TTL).catch((e) =>
            logger.warn({ err: sanitizeError(e), cacheKey }, "Educational cache write failed"),
          );
          logger.debug({ cacheKey }, "Educational cache WRITE");
        }

        // Write model response cache + sources (Block 2)
        if (text) {
          const modelTtl = getModelCacheTtl(tier, isMarketLevel);
          setCache(gptCacheKey, text, modelTtl).catch((e) =>
            logger.warn({ err: sanitizeError(e), cacheKey: gptCacheKey }, "GPT response cache write failed"),
          );
          if (finalSources.length > 0) {
            setCache(`${gptCacheKey}:sources`, finalSources, modelTtl).catch((e) => logFireAndForgetError(e, "gpt-sources-cache"));
          }
          emitCacheEvent({ modelFamily: "gpt", operation: "write", outcome: "success" });
        }

        const costBreakdown = calculateLLMCost({
          model: effectiveDeployment,
          inputTokens,
          outputTokens,
          cachedInputTokens: cachedTokens,
        });

        // OBS-1: Record non-fallback completion and check daily cost ceiling alert
        recordFallbackResult(false, effectiveDeployment).catch((e) => logFireAndForgetError(e, "fallback-result"));
        alertIfDailyCostExceeded(costBreakdown.totalCost).catch((e) => logFireAndForgetError(e, "daily-cost-alert"));

        storeConversationLog(
          userId,
          query,
          text || "",
          effectiveDeployment,
          {
            tokensUsed: tokensUsed,
            inputTokens,
            outputTokens,
            cachedInputTokens: cachedTokens,
            reasoningTokens,
            inputCost: costBreakdown.inputCost,
            outputCost: costBreakdown.outputCost,
            cachedInputCost: costBreakdown.cachedInputCost,
            totalCost: costBreakdown.totalCost,
          },
          tier,
          safeMessages.length,
          false,
        ).catch((e: unknown) =>
          logger.error({ err: sanitizeError(e), userId }, "Failed to log interaction"),
        );

        // H6: Post-stream output validation — soft logging only, never blocks
        if (text) {
          const validation = validateOutput(
            text, tier, userPlan,
            tier === "SIMPLE" && isEduCacheable,
            responseMode,
            resolvedAssetType,
          );
          logValidationResult(validation);

          // H7: Semantic validation (sample-based) for ELITE/COMPLEX — hallucination detection
          // Checks if factual claims in output are supported by retrieved context
          const semanticValidation = validateSemanticConsistency(
            text,
            knowledgeContext,
            tier,
            userPlan,
          );
          logSemanticValidationResult(semanticValidation);
        }

        // Memory distillation — extract durable notes from session, async non-blocking.
        // R5: Debounce — fire on turn counts that are exact multiples of 2 (turns 2, 4, 6…).
        // Lowered from 4 to capture preferences from shorter sessions (2–3 turns).
        const userTurnCount = safeMessages.filter((m) => m.role === "user").length;
        if (userTurnCount >= 2 && userTurnCount % 2 === 0) {
          distillSessionNotes(userId, safeMessages as Array<{ role: string; content: unknown }>, "lyra").catch((e: unknown) =>
            logger.warn({ err: sanitizeError(e) }, "Memory distillation failed"),
          );
        }
      },
    });

    logger.info({ tier }, "Stream initiated successfully");
    // Wrap textStream so mid-stream errors trigger credit refund.
    // AI SDK's textStream is readonly — spread into a new object with the wrapped stream.
    const wrappedResult = { ...result, textStream: refundOnStreamError(result.textStream, userId, consumedCreditCost, "primary") };
    return { result: wrappedResult, sources: finalSources, remainingCredits, contextTruncated: costCeiling.exceeded, ragDegraded };
  } catch (primaryError: unknown) {
    // B1-FIX: Clear latency abort timer — primary path failed, no need to keep the timer running
    clearTimeout(latencyAbortTimer);

    logger.error(
      { err: sanitizeError(primaryError), userId, tier, primaryDeployment: effectiveDeployment },
      "Primary model generation failed — attempting graceful fallback",
    );

    return executeFallbackChain(primaryError, {
      userId, query, tier, userPlan, tierConfig, effectiveDeployment,
      finalMessages, staticPrompt, finalSources, remainingCredits,
      consumedCreditCost, isEduCacheable, responseMode, resolvedAssetType,
      safeMessages, timer, ragDegraded,
    });
  }

  } catch (outerError: unknown) {
    // P0: Refund credits if consumed but the request failed (LLM failure, fallback exhaustion,
    // or unexpected error after credit consumption). Pre-credit-check errors (guardrail
    // violations, daily cap exceeded, insufficient credits) set creditsConsumed=false.
    if (creditsConsumed && consumedCreditCost > 0) {
      try {
        await addCredits(userId, consumedCreditCost, CreditTransactionType.ADJUSTMENT, "LLM failure refund", `lyra-refund:${randomUUID().slice(0, 8)}-${userId.slice(-6)}`);
        logger.warn({ userId, creditCost: consumedCreditCost }, "Credits refunded after LLM failure");
      } catch (refundError) {
        logger.error({ err: sanitizeError(refundError), userId, creditCost: consumedCreditCost }, "Credit refund failed on LLM failure");
      }
    }
    throw outerError;
  } finally {
    // B1: Release in-flight lock — fires on ALL exit paths including pre-LLM throws
    redis.del(inFlightKey).catch((e) => logFireAndForgetError(e, "in-flight-lock-release"));
  }
}
