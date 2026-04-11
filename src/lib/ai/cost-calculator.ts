import { getEncoding } from "js-tiktoken";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "cost-calculator" });

type TiktokenEncoding = ReturnType<typeof getEncoding>;

// Lazy-initialized encodings for exact token counting.
// Deferred to first use to avoid ~50-100ms cold-start penalty on serverless invocations
// that never call estimateTokensFromText.
// o200k_base: GPT-5.4 family
// cl100k_base: legacy fallback
let _o200k: TiktokenEncoding | null = null;
let _cl100k: TiktokenEncoding | null = null;

function getO200k(): TiktokenEncoding {
  if (!_o200k) _o200k = getEncoding("o200k_base");
  return _o200k;
}

function getCl100k(): TiktokenEncoding {
  if (!_cl100k) _cl100k = getEncoding("cl100k_base");
  return _cl100k;
}

type Pricing = {
  inputPerMillion: number;
  cachedInputPerMillion: number;
  outputPerMillion: number;
};

type VoicePricing = {
  audioInputPerMillion: number;
  cachedAudioInputPerMillion: number;
  audioOutputPerMillion: number;
  textInputPerMillion: number;
  cachedTextInputPerMillion: number;
  textOutputPerMillion: number;
};

export type CostUsage = {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
};

export type CostBreakdown = {
  inputCost: number;
  cachedInputCost: number;
  outputCost: number;
  totalCost: number;
};

// gpt-realtime-mini audio pricing (per million tokens)
// Realtime billing is token-based, not minute-based.
// For an illustrative support call, we assume roughly 100 audio tokens per minute
// in each direction, plus a small text footprint for instructions and transcripts.
export const REALTIME_VOICE_PRICING: VoicePricing = {
  audioInputPerMillion: 10.00,
  cachedAudioInputPerMillion: 0.30,
  audioOutputPerMillion: 20.00,
  textInputPerMillion: 0.60,
  cachedTextInputPerMillion: 0.06,
  textOutputPerMillion: 2.40,
};

// Audio token rates for the Realtime API voice channel.
// Per OpenAI's official docs (developers.openai.com/api/docs/guides/realtime-costs):
//   - User audio input:    1 token per 100ms → 600 tokens/min continuous
//   - Assistant audio out: 1 token per 50ms  → 1,200 tokens/min continuous
//
// With semantic VAD and a 50/50 speaking split, each party speaks ~30s per
// minute of session time. Effective rates per minute of SESSION:
//   - Audio input:  300 tokens/min of session (600 × 0.5)
//   - Audio output:  600 tokens/min of session (1,200 × 0.5)
// gpt-realtime-mini bills audio natively at $10/M input and $20/M output.
export const REALTIME_VOICE_AUDIO_INPUT_TOKENS_PER_MINUTE = 300;
export const REALTIME_VOICE_AUDIO_OUTPUT_TOKENS_PER_MINUTE = 600;

// Continuous (100% duty) rates — useful for worst-case estimates.
export const REALTIME_VOICE_AUDIO_INPUT_TOKENS_PER_MINUTE_CONTINUOUS = 600;
export const REALTIME_VOICE_AUDIO_OUTPUT_TOKENS_PER_MINUTE_CONTINUOUS = 1_200;

// Legacy alias kept for backward compat with admin dashboard import.
export const REALTIME_VOICE_AUDIO_TOKENS_PER_MINUTE_PER_DIRECTION = REALTIME_VOICE_AUDIO_INPUT_TOKENS_PER_MINUTE;

// Measured prompt size for the optimised Myra voice prompt.
// Static prefix (870) + typical 3-doc KB block (~50) + user ctx (~17) = ~937.
// Used as the default for cost estimates; pass the actual token count when
// known for precision.
export const REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS = 937;

// Static-prefix token count (personality + rules + guardrails + platform facts).
// Measured from STATIC_PROMPT_PREFIX in voice-prompt.ts using o200k_base.
// This portion is cache-eligible — billed at $0.06/M instead of $0.60/M.
export const REALTIME_VOICE_STATIC_PREFIX_TOKENS = 870;

// Hard cap set in the session config (max_output_tokens = 350).
// Caps each spoken reply at ~5-7 sentences — complete answers without cuts.
// Audio output is $20/M — the most expensive token type.
export const REALTIME_VOICE_MAX_RESPONSE_OUTPUT_TOKENS = 350;

// Text output tokens per minute: transcribed Myra replies billed as text.
// At the 150-token reply cap, 10 turns/3-min session ≈ 500 tokens/session
// or ~167 tokens/min. Rounded down to 150 to stay conservative.
export const REALTIME_VOICE_DEFAULT_TEXT_OUTPUT_TOKENS_PER_MINUTE = 150;

const PRICING_BY_MODEL: Record<string, Pricing> = {
  "gpt-5.4": {
    inputPerMillion: 2.50,
    cachedInputPerMillion: 0.25,
    outputPerMillion: 15.0,
  },
  "gpt-5.4-mini": {
    inputPerMillion: 0.75,
    cachedInputPerMillion: 0.075,
    outputPerMillion: 4.50,
  },
  "gpt-5.4-nano": {
    inputPerMillion: 0.20,
    cachedInputPerMillion: 0.02,
    outputPerMillion: 1.25,
  },
};

const DEFAULT_MODEL = "gpt-5.4";
const WARNED_UNKNOWN_MODELS = new Set<string>();

function normalizeModel(model: string): string {
  const normalized = model.trim().toLowerCase();
  if (normalized === "gpt-5.4-nano" || normalized.startsWith("gpt-5.4-nano")) {
    return "gpt-5.4-nano";
  }
  if (normalized === "gpt-5.4-mini" || normalized.startsWith("gpt-5.4-mini")) {
    return "gpt-5.4-mini";
  }
  if (normalized.startsWith("gpt-5.4")) {
    return "gpt-5.4";
  }
  if (process.env.NODE_ENV !== "test" && !WARNED_UNKNOWN_MODELS.has(normalized)) {
    WARNED_UNKNOWN_MODELS.add(normalized);
    logger.warn({ model, normalized, defaultModel: DEFAULT_MODEL }, "Falling back to default pricing for unknown model");
  }
  return DEFAULT_MODEL;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Exact token counting using js-tiktoken.
 * Uses o200k_base for GPT-5.4 family and cl100k_base as fallback.
 */
export function estimateTokensFromText(text: string, model?: string): number {
  if (!text) return 0;
  
  try {
    const normalized = normalizeModel(model || DEFAULT_MODEL);
    const encoding = normalized.startsWith("gpt-5.4")
      ? getO200k()
      : getCl100k();
    
    return encoding.encode(text).length;
  } catch {
    // Fallback if encoding fails
    return Math.max(1, Math.ceil(text.length / 4));
  }
}

export type VoiceCostUsage = {
  audioInputTokens: number;
  cachedAudioInputTokens?: number;
  audioOutputTokens: number;
  textInputTokens?: number;
  cachedTextInputTokens?: number;
  textOutputTokens?: number;
};

export type VoiceCostBreakdown = {
  audioInputCost: number;
  cachedAudioInputCost: number;
  audioOutputCost: number;
  textInputCost: number;
  cachedTextInputCost: number;
  textOutputCost: number;
  totalCost: number;
};

/**
 * Calculates the dollar cost for a gpt-realtime-mini voice session.
 * Audio token assumption: ~100 tokens/min per direction for a typical support call.
 */
export function calculateVoiceCost(usage: VoiceCostUsage): VoiceCostBreakdown {
  const p = REALTIME_VOICE_PRICING;
  const audioIn = Math.max(0, usage.audioInputTokens);
  const cachedAudioIn = Math.max(0, usage.cachedAudioInputTokens ?? 0);
  const audioOut = Math.max(0, usage.audioOutputTokens);
  const textIn = Math.max(0, usage.textInputTokens ?? 0);
  const cachedTextIn = Math.max(0, usage.cachedTextInputTokens ?? 0);
  const textOut = Math.max(0, usage.textOutputTokens ?? 0);

  const nonCachedAudioIn = Math.max(0, audioIn - cachedAudioIn);
  const nonCachedTextIn = Math.max(0, textIn - cachedTextIn);

  const audioInputCost   = (nonCachedAudioIn / 1_000_000) * p.audioInputPerMillion;
  const cachedAudioInputCost = (cachedAudioIn  / 1_000_000) * p.cachedAudioInputPerMillion;
  const audioOutputCost  = (audioOut         / 1_000_000) * p.audioOutputPerMillion;
  const textInputCost    = (nonCachedTextIn  / 1_000_000) * p.textInputPerMillion;
  const cachedTextInputCost = (cachedTextIn  / 1_000_000) * p.cachedTextInputPerMillion;
  const textOutputCost   = (textOut          / 1_000_000) * p.textOutputPerMillion;

  return {
    audioInputCost:      roundUsd(audioInputCost),
    cachedAudioInputCost: roundUsd(cachedAudioInputCost),
    audioOutputCost:     roundUsd(audioOutputCost),
    textInputCost:       roundUsd(textInputCost),
    cachedTextInputCost: roundUsd(cachedTextInputCost),
    textOutputCost:      roundUsd(textOutputCost),
    totalCost: roundUsd(
      audioInputCost + cachedAudioInputCost + audioOutputCost +
      textInputCost  + cachedTextInputCost  + textOutputCost
    ),
  };
}

/**
 * Estimates the cost for a voice session of a given duration.
 * Assumes a 50/50 user-speaking / Myra-responding split.
 * @param durationSeconds - Total session length in seconds
 * @param textInputTokens - System instructions + history token count
 * @param cachedTextInputTokens - How many text input tokens are cache hits
 */
export function estimateVoiceSessionCost(
  durationSeconds: number,
  textInputTokens = REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS,
  cachedTextInputTokens = 0,
): VoiceCostBreakdown {
  const minutes = Math.max(0, durationSeconds) / 60;
  const audioInputTokens = Math.round(minutes * REALTIME_VOICE_AUDIO_INPUT_TOKENS_PER_MINUTE);
  const audioOutputTokens = Math.round(minutes * REALTIME_VOICE_AUDIO_OUTPUT_TOKENS_PER_MINUTE);
  const textOutputTokens = Math.round(minutes * REALTIME_VOICE_DEFAULT_TEXT_OUTPUT_TOKENS_PER_MINUTE);
  return calculateVoiceCost({
    audioInputTokens,
    audioOutputTokens,
    textInputTokens,
    cachedTextInputTokens,
    textOutputTokens,
  });
}

/**
 * Estimates the cost for a voice session assuming the static prompt prefix is
 * a cache hit (the realistic steady-state for repeat users).
 * The static prefix (~480 tokens) is billed at $0.06/M; only the small dynamic
 * tail (~140 tokens KB + ~30 tokens user ctx) is billed at the full $0.60/M rate.
 * @param durationSeconds - Total session length in seconds
 * @param totalTextInputTokens - Full prompt token count (default: measured optimised size)
 * @param staticPrefixTokens - Tokens in the stable cache-eligible prefix
 */
export function estimateVoiceSessionCostCached(
  durationSeconds: number,
  totalTextInputTokens = REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS,
  staticPrefixTokens = REALTIME_VOICE_STATIC_PREFIX_TOKENS,
): VoiceCostBreakdown {
  return estimateVoiceSessionCost(
    durationSeconds,
    totalTextInputTokens,
    Math.min(staticPrefixTokens, totalTextInputTokens),
  );
}

export type VoiceSessionCostSummary = {
  worstCase: VoiceCostBreakdown;
  withCaching: VoiceCostBreakdown;
  cachingSavingUsd: number;
  durationSeconds: number;
};

/**
 * Returns both the worst-case (no cache) and cache-optimised cost estimates
 * for a voice session of the given duration. Use this for admin cost dashboards.
 */
export function summariseVoiceSessionCost(durationSeconds: number): VoiceSessionCostSummary {
  const worstCase = estimateVoiceSessionCost(durationSeconds);
  const withCaching = estimateVoiceSessionCostCached(durationSeconds);
  return {
    worstCase,
    withCaching,
    cachingSavingUsd: roundUsd(worstCase.totalCost - withCaching.totalCost),
    durationSeconds,
  };
}

export function calculateLLMCost(usage: CostUsage): CostBreakdown {
  const modelKey = normalizeModel(usage.model);
  const pricing = PRICING_BY_MODEL[modelKey] ?? PRICING_BY_MODEL[DEFAULT_MODEL];

  const inputTokens = Math.max(0, usage.inputTokens ?? 0);
  const cachedInputTokens = Math.max(0, usage.cachedInputTokens ?? 0);
  const outputTokens = Math.max(0, usage.outputTokens ?? 0);
  const nonCachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);

  const inputCost = (nonCachedInputTokens / 1_000_000) * pricing.inputPerMillion;
  const cachedInputCost = (cachedInputTokens / 1_000_000) * pricing.cachedInputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return {
    inputCost: roundUsd(inputCost),
    cachedInputCost: roundUsd(cachedInputCost),
    outputCost: roundUsd(outputCost),
    totalCost: roundUsd(inputCost + cachedInputCost + outputCost),
  };
}
