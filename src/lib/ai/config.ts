import OpenAI from "openai";
import { createOpenAI } from "@ai-sdk/openai";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "lyra-config" });

// Lazy-initialized raw OpenAI client for embeddings (rag.ts).
// Separate from the AI SDK client which handles streaming/chat.
let _embeddingClient: OpenAI | null = null;

// ─── Shared AI SDK Client (singleton) ────────────────────────────────────────
// Used by service.ts, orchestration.ts, and compress.ts.
// Single connection pool instead of 3 independent ones.
let _aiSdkClient: ReturnType<typeof createOpenAI> | null = null;

export function getSharedAISdkClient(): ReturnType<typeof createOpenAI> {
  if (!_aiSdkClient) {
    _aiSdkClient = createOpenAI({
      apiKey: getAzureOpenAIApiKey(),
      baseURL: getAzureOpenAIBaseURL(),
    });
  }
  return _aiSdkClient;
}

// ─── GPT-5.4 Deployment Map ───────────────────────────────────────────────────
// Each role maps to an Azure deployment name env var.
// AZURE_OPENAI_CHAT_DEPLOYMENT remains the primary deployment (used by AI_CONFIG.model).
// These additional deployments enable multi-model orchestration in Phase 3+.
// Falls back gracefully to the primary deployment if not configured.
export type Gpt54Role = "lyra-full" | "lyra-mini" | "lyra-nano" | "myra";

export const GPT54_DEPLOYMENT_ENV_KEYS: Record<Gpt54Role, string> = {
  "lyra-full": "AZURE_OPENAI_DEPLOYMENT_LYRA_FULL",
  "lyra-mini": "AZURE_OPENAI_DEPLOYMENT_LYRA_MINI",
  "lyra-nano": "AZURE_OPENAI_DEPLOYMENT_LYRA_NANO",
  "myra":      "AZURE_OPENAI_DEPLOYMENT_MYRA",
};

/** Returns the Azure deployment name for a given GPT-5.4 role.
 *  Falls back to the primary AZURE_OPENAI_CHAT_DEPLOYMENT when the role-specific
 *  env var is not yet configured — ensures Phase 1 is safe to deploy. */
export function getGpt54Deployment(role: Gpt54Role): string {
  const envKey = GPT54_DEPLOYMENT_ENV_KEYS[role];
  const deployment = process.env[envKey]?.trim();
  if (deployment) return deployment;
  // Graceful fallback — keeps existing behaviour until Azure deployments are wired
  return getAzureChatDeployment();
}

/** Feature flag: Responses API is available for the given deployment.
 *  Controlled per-environment via AZURE_RESPONSES_API_ENABLED=true.
 *  When false, the service falls back to Chat Completions (current behaviour). */
export function isResponsesApiEnabled(): boolean {
  return process.env.AZURE_RESPONSES_API_ENABLED === "true";
}

/** Feature flag: native web search tool is available on Azure.
 *  Must be explicitly confirmed per deployment before enabling. */
export function isNativeWebSearchEnabled(): boolean {
  return process.env.AZURE_NATIVE_WEB_SEARCH_ENABLED === "true";
}

export function getAzureOpenAIApiKey(): string | undefined {
  return process.env.AZURE_OPENAI_API_KEY;
}

export function hasAzureOpenAIConfig(): boolean {
  return Boolean(getAzureOpenAIApiKey() && process.env.AZURE_OPENAI_ENDPOINT);
}

function getAzureEndpointRoot(): string {
  const raw = process.env.AZURE_OPENAI_ENDPOINT || "";
  const normalized = raw.trim();
  if (!normalized) {
    throw new Error("Azure OpenAI endpoint is not configured");
  }
  if (normalized.includes("/openai/deployments/")) {
    return normalized.split("/openai/deployments/")[0];
  }
  if (normalized.includes("/openai/v1/")) {
    return normalized.split("/openai/v1/")[0];
  }
  if (normalized.includes("/openai/v1")) {
    return normalized.split("/openai/v1")[0];
  }
  return normalized.replace(/\/+$/, "");
}

export function getAzureOpenAIBaseURL(): string {
  const endpointRoot = getAzureEndpointRoot();
  const v1Root = endpointRoot.includes(".cognitiveservices.azure.com")
    ? endpointRoot.replace(".cognitiveservices.azure.com", ".openai.azure.com")
    : endpointRoot;
  return `${v1Root.replace(/\/+$/, "")}/openai/v1/`;
}

export function getAzureChatDeployment(): string {
  const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT?.trim();
  if (!deployment) {
    throw new Error("AZURE_OPENAI_CHAT_DEPLOYMENT is not configured");
  }
  return deployment;
}

export function getAzureEmbeddingDeployment(): string {
  const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT?.trim();
  if (!deployment) {
    throw new Error("AZURE_OPENAI_EMBEDDING_DEPLOYMENT is not configured");
  }
  return deployment;
}

export function getEmbeddingClient(): OpenAI {
  if (!_embeddingClient) {
    _embeddingClient = new OpenAI({
      apiKey: getAzureOpenAIApiKey(),
      baseURL: getAzureOpenAIBaseURL(),
    });
  }
  return _embeddingClient;
}

export const AI_CONFIG = {
  get model() {
    return getAzureChatDeployment();
  },
};

// ─── Tiered Routing Configuration ───
// GPT tiers use a shared GPT model family for prompt cache efficiency.
// Overall cost/latency is controlled through maxTokens, RAG, web search, and family routing.
export type QueryComplexity = "SIMPLE" | "MODERATE" | "COMPLEX";
export type PlanTier = "STARTER" | "PRO" | "ELITE" | "ENTERPRISE";

export interface TierConfig {
  maxTokens: number;
  modelFamily: "gpt";  // GPT-only since Phase 2 — kept for config shape compatibility
  reasoningEffort: "none" | "low" | "medium" | "high";  // GPT reasoning effort
  ragEnabled: boolean;
  ragMemoryEnabled: boolean;
  webSearchEnabled: boolean;
  crossSectorEnabled: boolean;
  wordBudgetMultiplier: number | null; // null = unconstrained (Elite)
  gpt54Role: Gpt54Role | null; // null = fall back to primary AZURE_OPENAI_CHAT_DEPLOYMENT
  latencyBudgetMs: number; // Maximum allowed latency in milliseconds
}

// ─── Word budget formula (for reference) ───
// wordBudgetMultiplier = targetWords / ((maxTokens - 450) * 0.72)
// where 450 = structural overhead (headers, tables, follow-up questions, disclaimer)
// and 0.72 = tokens-to-words conversion factor
// targetWords is the desired response length in words at this tier

// ─── Starter Tier — educational, concise, GPT-5.4-nano ───
// SIMPLE raised to 1400: educational 4-section format needs ~280+ output tokens.
const STARTER_TIER_CONFIG: Record<QueryComplexity, TierConfig> = {
  SIMPLE: {
    maxTokens: 1400,      // targetWords:300 → 300/((1400-450)*0.72)=0.439
    modelFamily: "gpt",
    reasoningEffort: "none",
    ragEnabled: false,
    ragMemoryEnabled: false,
    webSearchEnabled: false,
    crossSectorEnabled: false,
    wordBudgetMultiplier: 0.439,  // targetWords: ~300
    gpt54Role: "lyra-nano",
    latencyBudgetMs: 8000,  // 8s for SIMPLE queries
  },
  MODERATE: {
    maxTokens: 1850,      // targetWords:600 → 600/((1850-450)*0.72)=0.595
    modelFamily: "gpt",
    reasoningEffort: "none",
    ragEnabled: true,
    ragMemoryEnabled: true,    // enabled: past-context anchoring improves nano MODERATE quality; ~$0.001/query delta
    webSearchEnabled: false,
    crossSectorEnabled: false,
    wordBudgetMultiplier: 0.595,  // targetWords: ~600 (audit: nano writes 580-606w vs old 450w instruction)
    gpt54Role: "lyra-nano",
    latencyBudgetMs: 15000,  // 15s for MODERATE queries
  },
  COMPLEX: {
    maxTokens: 2600,      // targetWords:650 → 650/((2600-450)*0.72)=0.420
    modelFamily: "gpt",
    reasoningEffort: "none",
    ragEnabled: true,
    ragMemoryEnabled: true,
    webSearchEnabled: false,
    crossSectorEnabled: false,
    wordBudgetMultiplier: 0.420,  // targetWords: ~650
    gpt54Role: "lyra-mini",
    latencyBudgetMs: 30000,  // 30s for COMPLEX queries
  },
};

// ─── Pro Tier — full diagnostics, GPT-5.4-mini SIMPLE/MODERATE, GPT-5.4-full COMPLEX ───
// PRO SIMPLE: upgraded from nano to mini — nano undershoots 300w edu target (outputs ~174w).
// PRO MODERATE: crossSectorEnabled=false — most PRO MODERATE queries are single-asset.
const PRO_TIER_CONFIG: Record<QueryComplexity, TierConfig> = {
  SIMPLE: {
    maxTokens: 1700,      // targetWords:300 → 300/((1700-450)*0.72)=0.333
    modelFamily: "gpt",
    reasoningEffort: "none",
    ragEnabled: true,
    ragMemoryEnabled: true,
    webSearchEnabled: false,
    crossSectorEnabled: false,
    wordBudgetMultiplier: 0.333,  // targetWords: ~300
    gpt54Role: "lyra-mini",       // upgraded from nano: nano undershoots edu target consistently
    latencyBudgetMs: 8000,  // 8s for SIMPLE queries
  },
  MODERATE: {
    maxTokens: 2200,      // targetWords:750 → 750/((2200-450)*0.72)=0.595
    modelFamily: "gpt",
    reasoningEffort: "none",      // reasoning:low on single streamText adds 3–5s TTFT with no quality gain
    ragEnabled: true,
    ragMemoryEnabled: true,
    webSearchEnabled: false,
    crossSectorEnabled: false,
    wordBudgetMultiplier: 0.595,  // targetWords: ~750
    gpt54Role: "lyra-mini",       // upgraded from nano: richer signal analysis, $0.00039/query delta
    latencyBudgetMs: 15000,  // 15s for MODERATE queries
  },
  COMPLEX: {
    maxTokens: 2900,      // targetWords:950 → 950/((2900-450)*0.72)=0.539
    modelFamily: "gpt",
    reasoningEffort: "none",
    ragEnabled: true,
    ragMemoryEnabled: true,
    webSearchEnabled: true,
    crossSectorEnabled: true,
    wordBudgetMultiplier: 0.539,  // targetWords: ~950
    gpt54Role: "lyra-full",
    latencyBudgetMs: 30000,  // 30s for COMPLEX queries
  },
};

// ─── Elite Tier — GPT-5.4 across all tiers ───
// ELITE SIMPLE:   mini single
// ELITE MODERATE: mini single
// ELITE COMPLEX:  full single · reasoning:none
const ELITE_TIER_CONFIG: Record<QueryComplexity, TierConfig> = {
  SIMPLE: {
    maxTokens: 2000,      // targetWords:500 → 500/((2000-450)*0.72)=0.448
    modelFamily: "gpt",
    reasoningEffort: "none",      // SIMPLE = capacity-limited, not reasoning-limited
    ragEnabled: true,
    ragMemoryEnabled: true,
    webSearchEnabled: false,
    crossSectorEnabled: false,
    wordBudgetMultiplier: 0.448,  // targetWords: ~500
    gpt54Role: "lyra-mini",       // upgraded from nano: nano undershoots edu word target (capacity gap)
    latencyBudgetMs: 8000,  // 8s for SIMPLE queries
  },
  MODERATE: {
    maxTokens: 2600,      // targetWords:800 → 800/((2600-450)*0.72)=0.517
    modelFamily: "gpt",
    reasoningEffort: "none",
    ragEnabled: true,
    ragMemoryEnabled: true,
    webSearchEnabled: true,
    crossSectorEnabled: true,
    wordBudgetMultiplier: 0.517,  // targetWords: ~800
    gpt54Role: "lyra-mini",
    latencyBudgetMs: 15000,  // 15s for MODERATE queries
  },
  COMPLEX: {
    maxTokens: 3200,      // targetWords:1000 → 1000/((3200-450)*0.72)=0.505
    modelFamily: "gpt",
    reasoningEffort: "none",
    ragEnabled: true,
    ragMemoryEnabled: true,
    webSearchEnabled: true,
    crossSectorEnabled: true,
    wordBudgetMultiplier: 0.505,  // targetWords: ~1000
    gpt54Role: "lyra-full",
    latencyBudgetMs: 30000,  // 30s for COMPLEX queries
  },
};

// ─── Enterprise Tier — GPT-5.4 across all tiers ───
// ENTERPRISE SIMPLE:   mini single
// ENTERPRISE MODERATE: mini single
// ENTERPRISE COMPLEX:  full single · reasoning:none
const ENTERPRISE_TIER_CONFIG: Record<QueryComplexity, TierConfig> = {
  SIMPLE: {
    maxTokens: 2200,      // targetWords:450 → 450/((2200-450)*0.72)=0.357
    modelFamily: "gpt",
    reasoningEffort: "none",
    ragEnabled: true,
    ragMemoryEnabled: true,
    webSearchEnabled: false,
    crossSectorEnabled: false,
    wordBudgetMultiplier: 0.357,  // targetWords: ~450
    gpt54Role: "lyra-mini",       // upgraded from nano: nano undershoots edu target consistently
    latencyBudgetMs: 8000,  // 8s for SIMPLE queries
  },
  MODERATE: {
    maxTokens: 2600,      // targetWords:800 → 800/((2600-450)*0.72)=0.517
    modelFamily: "gpt",
    reasoningEffort: "none",
    ragEnabled: true,
    ragMemoryEnabled: true,
    webSearchEnabled: true,
    crossSectorEnabled: true,
    wordBudgetMultiplier: 0.517,  // targetWords: ~800
    gpt54Role: "lyra-mini",
    latencyBudgetMs: 15000,  // 15s for MODERATE queries
  },
  COMPLEX: {
    maxTokens: 3500,      // targetWords:950 → 950/((3500-450)*0.72)=0.430
    modelFamily: "gpt",
    reasoningEffort: "none",
    ragEnabled: true,
    ragMemoryEnabled: true,
    webSearchEnabled: true,
    crossSectorEnabled: true,
    wordBudgetMultiplier: 0.430,  // targetWords: ~950 (audit Mar-24: was overshooting 1350w at 0.455)
    gpt54Role: "lyra-full",
    latencyBudgetMs: 30000,  // 30s for COMPLEX queries
  },
};

// ─── Plan → Config resolver ───
const PLAN_CONFIGS: Record<PlanTier, Record<QueryComplexity, TierConfig>> = {
  STARTER: STARTER_TIER_CONFIG,
  PRO: PRO_TIER_CONFIG,
  ELITE: ELITE_TIER_CONFIG,
  ENTERPRISE: ENTERPRISE_TIER_CONFIG,
};

// ─── Plan-based conversation history caps ────────────────────────────────────
// ELITE/ENTERPRISE: 10 msgs (5 turns) | PRO: 6 msgs (3 turns) | STARTER: 4 msgs (2 turns)
//
// B2 — Memory gate interaction: distillSessionNotes fires only when userTurnCount >= 4.
// STARTER users have a history cap of 4 messages (2 user + 2 assistant turns), so they
// will never reach the 4-user-turn gate. This is intentional — STARTER is nano-only
// and per-session memory extraction is a cost-tier feature (PRO+).
// To enable STARTER memory in future, lower the gate to >= 2 in service.ts and guard
// with: source === "lyra" && userPlan === "STARTER".
export const HISTORY_CAPS: Record<PlanTier, number> = {
  ELITE: 10,
  ENTERPRISE: 10,
  PRO: 6,
  STARTER: 4,
};

/**
 * Derive a tight maxOutputTokens cap from the tier's word budget target.
 * Formula: (targetWords / 0.68) + buffer
 *
 * 0.68 is the empirically measured word-to-token ratio for Lyra responses
 * (audit avg: 0.689; COMPLEX markdown-heavy responses reach 0.70-0.74).
 * Using 0.68 as divisor gives conservative token headroom above the word target
 * so the model is never truncated mid-response on overshoot.
 *
 * Buffer is tier-sensitive (audit Mar-24):
 *   - SIMPLE/MODERATE: +400 tokens — responses stay within target band consistently
 *   - COMPLEX: +600 tokens — macro-to-micro queries can run 30-40% over wbm target;
 *     +400 caused token_cap truncation on ent-complex-macro-micro (1788 tok ceiling hit)
 *
 * Falls back to maxTokens - 100 when wordBudgetMultiplier is null (unconstrained).
 * Prevents Azure from reserving 35-50% more output capacity than needed.
 */
export function getTargetOutputTokens(config: TierConfig, complexity?: QueryComplexity): number {
  if (config.wordBudgetMultiplier == null || config.wordBudgetMultiplier <= 0) {
    return config.maxTokens - 100;
  }
  const contentTokens = config.maxTokens - 450;
  const targetWords = Math.round(contentTokens * config.wordBudgetMultiplier * 0.72);
  // COMPLEX paths get +600 buffer (macro queries overshoot by 30-40%); others +400
  const isComplex = complexity === "COMPLEX";
  const buffer = isComplex ? 600 : 400;
  const targetOutputTokens = Math.round(targetWords / 0.68) + buffer;
  // Never exceed maxTokens - 100 (hard ceiling) and never go below 400 (floor for short responses)
  return Math.min(config.maxTokens - 100, Math.max(400, targetOutputTokens));
}

/** Resolve tier config based on user plan + query complexity */
export function getTierConfig(plan: PlanTier, complexity: QueryComplexity): TierConfig {
  const config = PLAN_CONFIGS[plan]?.[complexity];
  if (!config) {
    logger.warn({ plan, complexity }, "getTierConfig: unknown plan or complexity — falling back to PRO config");
    return PRO_TIER_CONFIG[complexity];
  }
  return config;
}

