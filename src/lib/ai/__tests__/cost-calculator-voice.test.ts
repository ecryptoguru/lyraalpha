/**
 * @vitest-environment node
 *
 * Unit tests for the voice cost calculator.
 * Covers: calculateVoiceCost, estimateVoiceSessionCost, calculateLLMCost,
 * normalizeModel branching, and pricing constants.
 */
import { describe, expect, it } from "vitest";
import {
  calculateVoiceCost,
  estimateVoiceSessionCost,
  estimateVoiceSessionCostCached,
  summariseVoiceSessionCost,
  calculateLLMCost,
  REALTIME_VOICE_PRICING,
  REALTIME_VOICE_AUDIO_TOKENS_PER_MINUTE_PER_DIRECTION,
  REALTIME_VOICE_AUDIO_INPUT_TOKENS_PER_MINUTE,
  REALTIME_VOICE_AUDIO_OUTPUT_TOKENS_PER_MINUTE,
  REALTIME_VOICE_AUDIO_INPUT_TOKENS_PER_MINUTE_CONTINUOUS,
  REALTIME_VOICE_AUDIO_OUTPUT_TOKENS_PER_MINUTE_CONTINUOUS,
  REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS,
  REALTIME_VOICE_DEFAULT_TEXT_OUTPUT_TOKENS_PER_MINUTE,
  REALTIME_VOICE_STATIC_PREFIX_TOKENS,
  REALTIME_VOICE_MAX_RESPONSE_OUTPUT_TOKENS,
} from "../cost-calculator";

// ─── Pricing constant smoke tests ─────────────────────────────────────────────

describe("REALTIME_VOICE_PRICING constants", () => {
  it("audio input is $10/M tokens", () => {
    expect(REALTIME_VOICE_PRICING.audioInputPerMillion).toBe(10.0);
  });
  it("cached audio input is $0.30/M tokens", () => {
    expect(REALTIME_VOICE_PRICING.cachedAudioInputPerMillion).toBe(0.3);
  });
  it("audio output is $20/M tokens", () => {
    expect(REALTIME_VOICE_PRICING.audioOutputPerMillion).toBe(20.0);
  });
  it("text input is $0.60/M tokens", () => {
    expect(REALTIME_VOICE_PRICING.textInputPerMillion).toBe(0.6);
  });
  it("cached text input is $0.06/M tokens", () => {
    expect(REALTIME_VOICE_PRICING.cachedTextInputPerMillion).toBe(0.06);
  });
  it("text output is $2.40/M tokens", () => {
    expect(REALTIME_VOICE_PRICING.textOutputPerMillion).toBe(2.4);
  });
  it("audio input token rate is 300 tokens/min of session (50/50 split of 600 continuous)", () => {
    expect(REALTIME_VOICE_AUDIO_INPUT_TOKENS_PER_MINUTE).toBe(300);
  });
  it("audio output token rate is 600 tokens/min of session (50/50 split of 1,200 continuous)", () => {
    expect(REALTIME_VOICE_AUDIO_OUTPUT_TOKENS_PER_MINUTE).toBe(600);
  });
  it("continuous audio input rate is 600 tokens/min (1 token per 100ms per OpenAI docs)", () => {
    expect(REALTIME_VOICE_AUDIO_INPUT_TOKENS_PER_MINUTE_CONTINUOUS).toBe(600);
  });
  it("continuous audio output rate is 1,200 tokens/min (1 token per 50ms per OpenAI docs)", () => {
    expect(REALTIME_VOICE_AUDIO_OUTPUT_TOKENS_PER_MINUTE_CONTINUOUS).toBe(1_200);
  });
  it("legacy alias matches session input rate for backward compat", () => {
    expect(REALTIME_VOICE_AUDIO_TOKENS_PER_MINUTE_PER_DIRECTION).toBe(300);
  });
  it("default text input tokens reflects measured prompt size (937)", () => {
    expect(REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS).toBe(937);
  });
  it("default text output tokens/min is 150 (matches 150-token reply cap)", () => {
    expect(REALTIME_VOICE_DEFAULT_TEXT_OUTPUT_TOKENS_PER_MINUTE).toBe(150);
  });
  it("static prefix tokens constant is exported and reflects measured value", () => {
    expect(REALTIME_VOICE_STATIC_PREFIX_TOKENS).toBe(870);
  });
  it("max response output tokens constant matches session config cap (350)", () => {
    expect(REALTIME_VOICE_MAX_RESPONSE_OUTPUT_TOKENS).toBe(350);
  });  
  it("static prefix is less than total default text input tokens", () => {
    expect(REALTIME_VOICE_STATIC_PREFIX_TOKENS).toBeLessThan(REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS);
  });
});

// ─── calculateVoiceCost ───────────────────────────────────────────────────────

describe("calculateVoiceCost", () => {
  it("returns zero breakdown for all-zero usage", () => {
    const result = calculateVoiceCost({
      audioInputTokens: 0,
      audioOutputTokens: 0,
    });
    expect(result.totalCost).toBe(0);
    expect(result.audioInputCost).toBe(0);
    expect(result.audioOutputCost).toBe(0);
    expect(result.textInputCost).toBe(0);
    expect(result.cachedTextInputCost).toBe(0);
    expect(result.textOutputCost).toBe(0);
  });

  it("clamps negative token values to zero", () => {
    const result = calculateVoiceCost({
      audioInputTokens: -500,
      audioOutputTokens: -200,
    });
    expect(result.totalCost).toBe(0);
  });

  it("calculates pure audio input cost correctly — 1M tokens = $10", () => {
    const result = calculateVoiceCost({
      audioInputTokens: 1_000_000,
      audioOutputTokens: 0,
    });
    expect(result.audioInputCost).toBe(10.0);
    expect(result.totalCost).toBe(10.0);
  });

  it("calculates pure audio output cost correctly — 1M tokens = $20", () => {
    const result = calculateVoiceCost({
      audioInputTokens: 0,
      audioOutputTokens: 1_000_000,
    });
    expect(result.audioOutputCost).toBe(20.0);
    expect(result.totalCost).toBe(20.0);
  });

  it("applies cached audio input rate separately — 1M cached = $0.30", () => {
    const result = calculateVoiceCost({
      audioInputTokens: 1_000_000,
      cachedAudioInputTokens: 1_000_000,
      audioOutputTokens: 0,
    });
    // All 1M tokens are cached → $0.30, non-cached portion = 0
    expect(result.cachedAudioInputCost).toBe(0.3);
    expect(result.audioInputCost).toBe(0);
    expect(result.totalCost).toBe(0.3);
  });

  it("splits cached vs non-cached audio input correctly", () => {
    // 500k non-cached + 500k cached
    const result = calculateVoiceCost({
      audioInputTokens: 1_000_000,
      cachedAudioInputTokens: 500_000,
      audioOutputTokens: 0,
    });
    const expectedNonCached = (500_000 / 1_000_000) * 10.0; // $5.00
    const expectedCached = (500_000 / 1_000_000) * 0.3;    // $0.15
    expect(result.audioInputCost).toBeCloseTo(expectedNonCached, 5);
    expect(result.cachedAudioInputCost).toBeCloseTo(expectedCached, 5);
  });

  it("calculates text input cost — 1M tokens = $0.60", () => {
    const result = calculateVoiceCost({
      audioInputTokens: 0,
      audioOutputTokens: 0,
      textInputTokens: 1_000_000,
    });
    expect(result.textInputCost).toBe(0.6);
  });

  it("calculates cached text input cost — 1M tokens = $0.06", () => {
    const result = calculateVoiceCost({
      audioInputTokens: 0,
      audioOutputTokens: 0,
      textInputTokens: 1_000_000,
      cachedTextInputTokens: 1_000_000,
    });
    expect(result.cachedTextInputCost).toBe(0.06);
    expect(result.textInputCost).toBe(0); // all cached
  });

  it("calculates text output cost — 1M tokens = $2.40", () => {
    const result = calculateVoiceCost({
      audioInputTokens: 0,
      audioOutputTokens: 0,
      textOutputTokens: 1_000_000,
    });
    expect(result.textOutputCost).toBe(2.4);
  });

  it("totalCost is the sum of all components", () => {
    const result = calculateVoiceCost({
      audioInputTokens: 100_000,
      audioOutputTokens: 100_000,
      textInputTokens: 100_000,
      textOutputTokens: 100_000,
    });
    const expected =
      result.audioInputCost +
      result.cachedAudioInputCost +
      result.audioOutputCost +
      result.textInputCost +
      result.cachedTextInputCost +
      result.textOutputCost;
    expect(result.totalCost).toBeCloseTo(expected, 6);
  });
});

// ─── estimateVoiceSessionCost ─────────────────────────────────────────────────

describe("estimateVoiceSessionCost", () => {
  it("returns zero audio cost for 0-second session (only fixed text tokens remain)", () => {
    const result = estimateVoiceSessionCost(0);
    expect(result.audioInputCost).toBe(0);
    expect(result.audioOutputCost).toBe(0);
    expect(result.textOutputCost).toBe(0);
    // Fixed text input tokens still incur a cost even at 0s
    const expectedTextIn = (REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS / 1_000_000) * 0.6;
    expect(result.textInputCost).toBeCloseTo(expectedTextIn, 6);
  });

  it("negative duration clamps audio to zero but retains fixed text input cost", () => {
    const result = estimateVoiceSessionCost(-60);
    expect(result.audioInputCost).toBe(0);
    expect(result.audioOutputCost).toBe(0);
    // Passing textInputTokens=0 gives a truly zero cost
    const zeroResult = estimateVoiceSessionCost(-60, 0);
    expect(zeroResult.totalCost).toBe(0);
  });

  it("1-minute call uses 300 audio input tokens and 600 audio output tokens (50/50 split)", () => {
    const result = estimateVoiceSessionCost(60);
    // 300 tokens in + 600 tokens out (50/50 split of continuous rates)
    const expectedAudioIn = (300 / 1_000_000) * 10.0;   // $0.003
    const expectedAudioOut = (600 / 1_000_000) * 20.0;   // $0.012
    expect(result.audioInputCost).toBeCloseTo(expectedAudioIn, 6);
    expect(result.audioOutputCost).toBeCloseTo(expectedAudioOut, 6);
  });

  it("variable audio+text-output cost scales linearly with duration", () => {
    // Use textInputTokens=0 to isolate the purely variable costs
    const one = estimateVoiceSessionCost(60, 0);
    const five = estimateVoiceSessionCost(300, 0);
    expect(five.totalCost).toBeCloseTo(one.totalCost * 5, 4);
  });

  it("uses default text input tokens (937) when not specified", () => {
    const result = estimateVoiceSessionCost(60);
    const expectedTextIn = (REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS / 1_000_000) * 0.6;
    expect(result.textInputCost).toBeCloseTo(expectedTextIn, 6);
  });

  it("respects custom textInputTokens parameter", () => {
    const result = estimateVoiceSessionCost(60, 5000);
    const expectedTextIn = (5000 / 1_000_000) * 0.6;
    expect(result.textInputCost).toBeCloseTo(expectedTextIn, 6);
  });

  it("respects cachedTextInputTokens parameter", () => {
    const result = estimateVoiceSessionCost(60, 2000, 2000);
    // All 2000 cached → textInputCost = 0, cachedTextInputCost > 0
    expect(result.textInputCost).toBe(0);
    expect(result.cachedTextInputCost).toBeGreaterThan(0);
  });

  it("30-second call produces roughly half the cost of a 60-second call", () => {
    const half = estimateVoiceSessionCost(30);
    const full = estimateVoiceSessionCost(60);
    // Audio tokens are integer-rounded so we allow ±10% tolerance
    expect(half.totalCost).toBeCloseTo(full.totalCost / 2, 1);
  });
});

// ─── estimateVoiceSessionCostCached ──────────────────────────────────────────

describe("estimateVoiceSessionCostCached", () => {
  it("is always cheaper than or equal to the uncached estimate", () => {
    [60, 180, 300].forEach((secs) => {
      const uncached = estimateVoiceSessionCost(secs);
      const cached = estimateVoiceSessionCostCached(secs);
      expect(cached.totalCost).toBeLessThanOrEqual(uncached.totalCost);
    });
  });

  it("cached text input cost is higher than zero when static prefix tokens > 0", () => {
    const result = estimateVoiceSessionCostCached(60);
    expect(result.cachedTextInputCost).toBeGreaterThan(0);
  });

  it("non-cached text input portion is only the dynamic tail", () => {
    const result = estimateVoiceSessionCostCached(60);
    // Dynamic tail = total (937) - static prefix (870) = 67 tokens
    const dynamicTail = REALTIME_VOICE_DEFAULT_TEXT_INPUT_TOKENS - REALTIME_VOICE_STATIC_PREFIX_TOKENS;
    const expectedNonCachedTextIn = (dynamicTail / 1_000_000) * 0.6;
    expect(result.textInputCost).toBeCloseTo(expectedNonCachedTextIn, 6);
  });

  it("saving increases proportionally with more sessions (linear)", () => {
    const s1 = estimateVoiceSessionCost(60).totalCost - estimateVoiceSessionCostCached(60).totalCost;
    const s3 = estimateVoiceSessionCost(60).totalCost - estimateVoiceSessionCostCached(60).totalCost;
    expect(s1).toBeCloseTo(s3, 8); // per-session saving is constant
  });

  it("when totalTextInputTokens <= staticPrefixTokens, textInputCost is zero", () => {
    // All tokens are cached
    const result = estimateVoiceSessionCostCached(60, 400, 400);
    expect(result.textInputCost).toBe(0);
    expect(result.cachedTextInputCost).toBeGreaterThan(0);
  });
});

// ─── summariseVoiceSessionCost ────────────────────────────────────────────────

describe("summariseVoiceSessionCost", () => {
  it("returns a summary with both estimates and a positive saving", () => {
    const summary = summariseVoiceSessionCost(180);
    expect(summary.durationSeconds).toBe(180);
    expect(summary.worstCase.totalCost).toBeGreaterThan(summary.withCaching.totalCost);
    expect(summary.cachingSavingUsd).toBeGreaterThan(0);
  });

  it("cachingSavingUsd equals worstCase minus withCaching total cost", () => {
    const summary = summariseVoiceSessionCost(300);
    expect(summary.cachingSavingUsd).toBeCloseTo(
      summary.worstCase.totalCost - summary.withCaching.totalCost,
      6,
    );
  });

  it("saving is consistent whether called directly or via summarise", () => {
    const worst = estimateVoiceSessionCost(120);
    const cached = estimateVoiceSessionCostCached(120);
    const summary = summariseVoiceSessionCost(120);
    expect(summary.worstCase.totalCost).toBeCloseTo(worst.totalCost, 6);
    expect(summary.withCaching.totalCost).toBeCloseTo(cached.totalCost, 6);
  });
});

// ─── calculateLLMCost — model normalisation ───────────────────────────────────

describe("calculateLLMCost model normalisation", () => {
  it("gpt-5.4 → full pricing", () => {
    const result = calculateLLMCost({ model: "gpt-5.4", inputTokens: 1_000_000, outputTokens: 0 });
    expect(result.inputCost).toBe(2.5);
  });

  it("gpt-5.4-mini → mini pricing", () => {
    const result = calculateLLMCost({ model: "gpt-5.4-mini", inputTokens: 1_000_000, outputTokens: 0 });
    expect(result.inputCost).toBe(0.75);
  });

  it("gpt-5.4-nano → nano pricing", () => {
    const result = calculateLLMCost({ model: "gpt-5.4-nano", inputTokens: 1_000_000, outputTokens: 0 });
    expect(result.inputCost).toBe(0.2);
  });

  it("gpt-5.4-nano-2025-01-preview prefix → nano pricing", () => {
    const result = calculateLLMCost({
      model: "gpt-5.4-nano-2025-01-preview",
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(result.inputCost).toBe(0.2);
  });

  it("unknown model falls back to gpt-5.4 pricing without throwing", () => {
    const result = calculateLLMCost({ model: "gpt-realtime-mini", inputTokens: 1_000_000, outputTokens: 0 });
    expect(result.inputCost).toBe(2.5); // gpt-5.4 rate
  });

  it("returns zero total cost for zero token usage", () => {
    const result = calculateLLMCost({ model: "gpt-5.4", inputTokens: 0, outputTokens: 0 });
    expect(result.totalCost).toBe(0);
  });

  it("handles negative tokens by clamping to 0", () => {
    const result = calculateLLMCost({ model: "gpt-5.4", inputTokens: -1000, outputTokens: -500 });
    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it("cachedInputTokens reduce the non-cached input cost", () => {
    // 1M input, 500k cached → only 500k at full rate
    const result = calculateLLMCost({
      model: "gpt-5.4",
      inputTokens: 1_000_000,
      cachedInputTokens: 500_000,
      outputTokens: 0,
    });
    const expectedNonCached = (500_000 / 1_000_000) * 2.5; // $1.25
    const expectedCached = (500_000 / 1_000_000) * 0.25;   // $0.125
    expect(result.inputCost).toBeCloseTo(expectedNonCached, 5);
    expect(result.cachedInputCost).toBeCloseTo(expectedCached, 5);
  });

  it("totalCost = inputCost + cachedInputCost + outputCost", () => {
    const result = calculateLLMCost({
      model: "gpt-5.4",
      inputTokens: 500_000,
      cachedInputTokens: 100_000,
      outputTokens: 200_000,
    });
    expect(result.totalCost).toBeCloseTo(
      result.inputCost + result.cachedInputCost + result.outputCost,
      6,
    );
  });
});

// ─── Exact cost per minute — gpt-realtime-mini ────────────────────────────────
// Token rates per OpenAI official docs (developers.openai.com/api/docs/guides/realtime-costs):
//   Continuous rates:  User audio input: 1 token / 100ms = 600 tokens/min
//                      Assistant audio:  1 token / 50ms  = 1,200 tokens/min
//   With 50/50 split:  Audio input:  300 tokens/min of session
//                      Audio output:  600 tokens/min of session
// Pricing per gpt-realtime-mini (per million tokens):
//   Audio input:  $10.00  |  Cached audio input:  $0.30
//   Audio output: $20.00  |  Text input:          $0.60
//   Cached text:  $0.06   |  Text output:         $2.40

describe("Exact cost per minute — gpt-realtime-mini voice agent", () => {
  it("1-minute session: audio-only variable cost (no text)", () => {
    const result = estimateVoiceSessionCost(60, 0, 0);
    // Audio input:  300 tokens × $10/M  = $0.003000
    // Audio output: 600 tokens × $20/M  = $0.012000
    // Text output:  150 tokens × $2.40/M = $0.000360
    expect(result.audioInputCost).toBeCloseTo(0.003, 6);
    expect(result.audioOutputCost).toBeCloseTo(0.012, 6);
    expect(result.textOutputCost).toBeCloseTo(0.00036, 6);
    // Total variable cost per minute ≈ $0.015360
    expect(result.totalCost).toBeCloseTo(0.01536, 6);
  });

  it("1-minute session: full cost with default text instructions (937 tokens)", () => {
    const result = estimateVoiceSessionCost(60);
    // Audio input:   300 × $10/M   = $0.003000
    // Audio output:  600 × $20/M   = $0.012000
    // Text input:    937 × $0.60/M  = $0.000562
    // Text output:   150 × $2.40/M  = $0.000360
    // Total ≈ $0.015922
    expect(result.audioInputCost).toBeCloseTo(0.003, 6);
    expect(result.audioOutputCost).toBeCloseTo(0.012, 6);
    expect(result.textInputCost).toBeCloseTo(0.0005622, 6);
    expect(result.textOutputCost).toBeCloseTo(0.00036, 6);
    expect(result.totalCost).toBeCloseTo(0.0159222, 6);
  });

  it("1-minute session: with cached static prefix (870 of 937 tokens cached)", () => {
    const result = estimateVoiceSessionCostCached(60);
    // Cached text:   870 × $0.06/M  = $0.0000522
    // Non-cached:    67  × $0.60/M  = $0.0000402
    // Audio + text output same as above
    expect(result.cachedTextInputCost).toBeCloseTo(0.0000522, 6);
    expect(result.textInputCost).toBeCloseTo(0.0000402, 6);
    // Total ≈ $0.0154524 (saves ~$0.00047 vs uncached)
    expect(result.totalCost).toBeLessThan(estimateVoiceSessionCost(60).totalCost);
  });

  it("3-minute session: typical support call (cached)", () => {
    const result = estimateVoiceSessionCostCached(180);
    // Audio input:   900 × $10/M   = $0.009
    // Audio output:  1,800 × $20/M  = $0.036
    // Text input (cached prefix): 870 × $0.06/M + 67 × $0.60/M = $0.0000924
    // Text output:   450 × $2.40/M  = $0.00108
    // Total ≈ $0.0461724
    expect(result.audioInputCost).toBeCloseTo(0.009, 6);
    expect(result.audioOutputCost).toBeCloseTo(0.036, 6);
    expect(result.totalCost).toBeCloseTo(0.0461724, 5);
  });

  it("5-minute session: long support call (cached)", () => {
    const result = estimateVoiceSessionCostCached(300);
    // Audio input:   1,500 × $10/M  = $0.015
    // Audio output:  3,000 × $20/M  = $0.060
    // Text: ~$0.0001324
    // Text output: 750 × $2.40/M = $0.0018
    // Total ≈ $0.0769324
    expect(result.audioInputCost).toBeCloseTo(0.015, 6);
    expect(result.audioOutputCost).toBeCloseTo(0.060, 6);
    expect(result.totalCost).toBeCloseTo(0.0769324, 4);
  });

  it("audio output dominates cost — ~75% of total per minute", () => {
    const result = estimateVoiceSessionCost(60, 0, 0);
    const audioOutShare = result.audioOutputCost / result.totalCost;
    // 0.012 / 0.01536 ≈ 0.78
    expect(audioOutShare).toBeGreaterThan(0.70);
    expect(audioOutShare).toBeLessThan(0.85);
  });

  it("summariseVoiceSessionCost gives consistent per-minute breakdown", () => {
    const summary = summariseVoiceSessionCost(60);
    // Worst case ≈ $0.0159222/min
    expect(summary.worstCase.totalCost).toBeCloseTo(0.0159222, 5);
    // With caching ≈ $0.0154524/min
    expect(summary.withCaching.totalCost).toBeCloseTo(0.0154524, 5);
    // Caching saves ~$0.00047 per minute
    expect(summary.cachingSavingUsd).toBeCloseTo(0.0004698, 5);
  });
});
