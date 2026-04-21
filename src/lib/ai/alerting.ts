import { createLogger } from "@/lib/logger";
import { redis, getCache, setCache } from "@/lib/redis";

const logger = createLogger({ service: "ai-alerting" });

// ─── Alert thresholds ─────────────────────────────────────────────────────────
// All thresholds are env-overridable at runtime.
// Defaults represent production-safe values based on observed baseline traffic.

const THRESHOLDS = {
  // Daily cost spike: alert when today's total exceeds this USD amount
  dailyCostUsd: Number(process.env.AI_ALERT_DAILY_COST_USD ?? 50),
  // RAG zero-result rate: alert when % of requests returning 0 RAG chunks exceeds threshold (15-min window)
  ragZeroResultRatePct: Number(process.env.AI_ALERT_RAG_ZERO_RESULT_PCT ?? 10),
  // Web search: alert after this many consecutive failures (aligned with circuit breaker at 3)
  webSearchConsecutiveFailures: Number(process.env.AI_ALERT_WEB_SEARCH_FAILURES ?? 3),
  // Output validation: alert when % of responses failing section checks exceeds threshold (15-min window)
  outputValidationFailureRatePct: Number(process.env.AI_ALERT_VALIDATION_FAILURE_PCT ?? 30),
  // Fallback rate: alert when % of requests using nano fallback exceeds threshold
  fallbackRatePct: Number(process.env.AI_ALERT_FALLBACK_RATE_PCT ?? 10),
  // Fallback rate mitigation: automatically switch to backup model when this threshold is exceeded
  fallbackRateMitigationPct: Number(process.env.AI_ALERT_FALLBACK_RATE_MITIGATION_PCT ?? 15),
  // Latency budget violation: alert when % of requests exceeding latency budget exceeds threshold (15-min window)
  latencyViolationRatePct: Number(process.env.AI_ALERT_LATENCY_VIOLATION_PCT ?? 15),
  // Cost-ceiling token estimator drift: avg |est-actual|/est as a percentage, measured
  // over a 1h window. A sustained drift above this threshold means the char→token ratio
  // is out of sync with the real tokenizer (e.g. after an Azure model upgrade) and the
  // cost-ceiling guard is sizing contexts incorrectly. Fires webhook; not just log.
  costEstimationDriftPct: Number(process.env.AI_ALERT_COST_ESTIMATION_DRIFT_PCT ?? 20),
};

// ─── Redis keys ───────────────────────────────────────────────────────────────
const ALERT_COOLDOWN_TTL = 15 * 60; // 15 min — suppress duplicate alerts within window
function cooldownKey(alertId: string): string {
  return `ai:alert:cooldown:${alertId}`;
}

// ─── Webhook delivery ─────────────────────────────────────────────────────────
async function sendWebhookAlert(payload: {
  alert: string;
  severity: "warn" | "critical";
  value: number;
  threshold: number;
  detail?: string;
}): Promise<void> {
  const webhookUrl = process.env.AI_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return; // no webhook configured — log-only mode

  // R8-FIX: Validate webhook URL — must be HTTPS and a well-formed URL.
  // Prevents data leakage to arbitrary endpoints from misconfigured or compromised env vars.
  try {
    const parsed = new URL(webhookUrl);
    if (parsed.protocol !== "https:") {
      logger.warn({ protocol: parsed.protocol }, "AI alert webhook URL must use HTTPS — skipping delivery");
      return;
    }
  } catch {
    logger.warn({ webhookUrl: webhookUrl.slice(0, 50) }, "AI alert webhook URL is invalid — skipping delivery");
    return;
  }

  // Cooldown: suppress duplicate alerts within 15 min
  const ck = cooldownKey(payload.alert);
  const cooling = await getCache<boolean>(ck).catch(() => null);
  if (cooling) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 *AI Alert — ${payload.alert}*\nSeverity: ${payload.severity}\nValue: ${payload.value} (threshold: ${payload.threshold})\n${payload.detail ?? ""}`,
        ...payload,
        ts: new Date().toISOString(),
      }),
    });
    await setCache(ck, true, ALERT_COOLDOWN_TTL);
  } catch (err) {
    logger.warn({ err, alert: payload.alert }, "AI alert webhook delivery failed");
  }
}

// ─── Public alert emitters ────────────────────────────────────────────────────

/** OBS-1a: Daily cost spike alert.
 *  Accumulates per-request cost into a Redis daily counter and checks the cumulative total
 *  against the threshold. Previously accepted a single-request cost which could never
 *  exceed the $50 threshold — the alert was effectively dead code.
 *
 *  @param requestCostUsd  Cost of the current request (added to daily cumulative total)
 */
export async function alertIfDailyCostExceeded(requestCostUsd: number): Promise<void> {
  if (requestCostUsd <= 0) return;

  // Accumulate into a Redis daily counter — same pattern as daily token tracking.
  // Key resets at midnight UTC via the date suffix.
  const todayKey = `ai:daily_cost:${new Date().toISOString().slice(0, 10)}`;
  let cumulativeCost = 0;
  try {
    const pipeline = redis.pipeline();
    pipeline.incrbyfloat(todayKey, requestCostUsd);
    pipeline.expire(todayKey, 90_000); // 25h TTL — covers UTC day + buffer
    const results = await pipeline.exec();
    const rawTotal = Array.isArray(results?.[0]) ? (results[0][1] as string | number) ?? 0 : (results?.[0] as string | number) ?? 0;
    cumulativeCost = Number(rawTotal) || 0;
  } catch {
    // Redis failure — alerting is non-critical, never block
    return;
  }

  if (cumulativeCost < THRESHOLDS.dailyCostUsd) return;
  logger.warn(
    { event: "ai_alert_cost", cumulativeCostUsd: cumulativeCost, requestCostUsd, threshold: THRESHOLDS.dailyCostUsd },
    "AI daily cost threshold exceeded",
  );
  await sendWebhookAlert({
    alert: "daily_cost_exceeded",
    severity: "critical",
    value: Number(cumulativeCost.toFixed(2)),
    threshold: THRESHOLDS.dailyCostUsd,
    detail: `Daily AI spend has reached $${cumulativeCost.toFixed(2)} (threshold: $${THRESHOLDS.dailyCostUsd}).`,
  });
}

/** OBS-1b: Web search consecutive failure alert.
 *  Call from search.ts circuit breaker after incrementing failure count. */
export async function alertIfWebSearchOutage(consecutiveFailures: number): Promise<void> {
  if (consecutiveFailures < THRESHOLDS.webSearchConsecutiveFailures) return;
  logger.warn(
    { event: "ai_alert_web_search", consecutiveFailures, threshold: THRESHOLDS.webSearchConsecutiveFailures },
    "AI alert: web search outage detected",
  );
  await sendWebhookAlert({
    alert: "web_search_outage",
    severity: "warn",
    value: consecutiveFailures,
    threshold: THRESHOLDS.webSearchConsecutiveFailures,
    detail: `Tavily web search has failed ${consecutiveFailures} times consecutively.`,
  });
}

/** OBS-1c: RAG zero-result rate alert.
 *  Uses a 15-min sliding window counter in Redis. Call from rag.ts after each search. */
export async function recordRagResult(hadResults: boolean): Promise<void> {
  const windowKey = `ai:rag:window:${Math.floor(Date.now() / (15 * 60 * 1000))}`;
  try {
    const pipeline = redis.pipeline();
    pipeline.hincrby(windowKey, "total", 1);
    if (!hadResults) pipeline.hincrby(windowKey, "zero", 1);
    pipeline.expire(windowKey, 20 * 60); // 20 min TTL — 1 window + buffer
    const results = await pipeline.exec();

    const total = Array.isArray(results?.[0]) ? (results[0][1] as number) ?? 0 : (results?.[0] as number) ?? 0;
    const zero = Array.isArray(results?.[1]) ? (results[1][1] as number) ?? 0 : (results?.[1] as number) ?? 0;
    if (total < 10) return; // need sufficient sample before alerting

    const zeroRatePct = (zero / total) * 100;
    if (zeroRatePct >= THRESHOLDS.ragZeroResultRatePct) {
      logger.warn(
        { event: "ai_alert_rag", zeroRatePct: zeroRatePct.toFixed(1), total, threshold: THRESHOLDS.ragZeroResultRatePct },
        "AI alert: RAG zero-result rate elevated",
      );
      await sendWebhookAlert({
        alert: "rag_zero_result_rate",
        severity: "warn",
        value: Math.round(zeroRatePct),
        threshold: THRESHOLDS.ragZeroResultRatePct,
        detail: `${zero}/${total} requests (${zeroRatePct.toFixed(1)}%) returned 0 RAG chunks in last 15 min.`,
      });
    }
  } catch {
    // Redis failure — alerting is non-critical, never block
  }
}

/** OBS-1d: Output validation failure rate alert.
 *  Uses a 15-min sliding window counter in Redis. Call from output-validation.ts after each check. */
export async function recordValidationResult(passed: boolean): Promise<void> {
  const windowKey = `ai:validation:window:${Math.floor(Date.now() / (15 * 60 * 1000))}`;
  try {
    const pipeline = redis.pipeline();
    pipeline.hincrby(windowKey, "total", 1);
    if (!passed) pipeline.hincrby(windowKey, "failed", 1);
    pipeline.expire(windowKey, 20 * 60);
    const results = await pipeline.exec();

    const total = Array.isArray(results?.[0]) ? (results[0][1] as number) ?? 0 : (results?.[0] as number) ?? 0;
    const failed = Array.isArray(results?.[1]) ? (results[1][1] as number) ?? 0 : (results?.[1] as number) ?? 0;
    if (total < 10) return;

    const failRatePct = (failed / total) * 100;
    if (failRatePct >= THRESHOLDS.outputValidationFailureRatePct) {
      logger.warn(
        { event: "ai_alert_validation", failRatePct: failRatePct.toFixed(1), total, threshold: THRESHOLDS.outputValidationFailureRatePct },
        "AI alert: output validation failure rate elevated",
      );
      await sendWebhookAlert({
        alert: "output_validation_failure_rate",
        severity: "warn",
        value: Math.round(failRatePct),
        threshold: THRESHOLDS.outputValidationFailureRatePct,
        detail: `${failed}/${total} responses (${failRatePct.toFixed(1)}%) failed section validation in last 15 min.`,
      });
    }
  } catch {
    // Redis failure — never block
  }
}

/** OBS-1e: Fallback rate alert with automatic mitigation.
 *  Uses a 15-min sliding window. Call from service.ts whenever wasFallback=true.
 *  When fallback rate exceeds mitigation threshold, sets a Redis flag to trigger
 *  automatic model switching in the service layer. */
export async function recordFallbackResult(wasFallback: boolean, deployment?: string): Promise<void> {
  const windowKey = `ai:fallback:window:${Math.floor(Date.now() / (15 * 60 * 1000))}`;
  const mitigationFlagKey = "ai:fallback:mitigation_active";

  // AUDIT-7: Per-deployment breakdown. Aggregate rate triggers alerts/mitigation,
  // but this side counter lets operators see which Azure deployment is degrading.
  // Fire-and-forget — any failure here is irrelevant to the main counter.
  if (deployment) {
    try {
      const perDeploymentKey = `ai:fallback:deployment:${Math.floor(Date.now() / (15 * 60 * 1000))}`;
      const pipeline = redis.pipeline();
      pipeline.hincrby(perDeploymentKey, `${deployment}:total`, 1);
      if (wasFallback) pipeline.hincrby(perDeploymentKey, `${deployment}:fallback`, 1);
      pipeline.expire(perDeploymentKey, 20 * 60);
      await pipeline.exec();
    } catch {
      // Non-critical — never block
    }
  }

  try {
    const pipeline = redis.pipeline();
    pipeline.hincrby(windowKey, "total", 1);
    if (wasFallback) pipeline.hincrby(windowKey, "fallback", 1);
    pipeline.expire(windowKey, 20 * 60);
    const results = await pipeline.exec();

    const total = Array.isArray(results?.[0]) ? (results[0][1] as number) ?? 0 : (results?.[0] as number) ?? 0;
    const fallbacks = Array.isArray(results?.[1]) ? (results[1][1] as number) ?? 0 : (results?.[1] as number) ?? 0;
    if (total < 10) return;

    const fallbackRatePct = (fallbacks / total) * 100;

    // Alert threshold (10%)
    if (fallbackRatePct >= THRESHOLDS.fallbackRatePct) {
      logger.warn(
        { event: "ai_alert_fallback", fallbackRatePct: fallbackRatePct.toFixed(1), total, threshold: THRESHOLDS.fallbackRatePct },
        "AI alert: nano fallback rate elevated — primary model may be degraded",
      );
      await sendWebhookAlert({
        alert: "fallback_rate_elevated",
        severity: "critical",
        value: Math.round(fallbackRatePct),
        threshold: THRESHOLDS.fallbackRatePct,
        detail: `${fallbacks}/${total} requests (${fallbackRatePct.toFixed(1)}%) fell back to nano in last 15 min. Primary model may be degraded.`,
      });
    }

    // Mitigation threshold (15%) - set flag for automatic model switching
    if (fallbackRatePct >= THRESHOLDS.fallbackRateMitigationPct) {
      logger.warn(
        { event: "ai_fallback_mitigation", fallbackRatePct: fallbackRatePct.toFixed(1), total, threshold: THRESHOLDS.fallbackRateMitigationPct },
        "AI fallback mitigation triggered — setting backup model flag",
      );
      // Set mitigation flag with 30-minute TTL to avoid permanent switching
      await setCache(mitigationFlagKey, true, 30 * 60);
      await sendWebhookAlert({
        alert: "fallback_mitigation_triggered",
        severity: "critical",
        value: Math.round(fallbackRatePct),
        threshold: THRESHOLDS.fallbackRateMitigationPct,
        detail: `${fallbacks}/${total} requests (${fallbackRatePct.toFixed(1)}%) fell back to nano in last 15 min. Automatic mitigation triggered.`,
      });
    }
  } catch {
    // Redis failure — never block
  }
}

/**
 * Check if fallback mitigation is currently active.
 * Service layer should call this before selecting the primary model.
 */
export async function isFallbackMitigationActive(): Promise<boolean> {
  try {
    const mitigationFlagKey = "ai:fallback:mitigation_active";
    const isActive = await getCache<boolean>(mitigationFlagKey);
    return isActive === true;
  } catch {
    return false;
  }
}

/** OBS-1f: Latency budget violation alert.
 *  Uses a 15-min sliding window. Call from service.ts when request exceeds latency budget.
 */
export async function recordLatencyViolation(exceededBudget: boolean, latencyMs: number, tier: string): Promise<void> {
  const windowKey = `ai:latency:window:${Math.floor(Date.now() / (15 * 60 * 1000))}`;
  try {
    const pipeline = redis.pipeline();
    pipeline.hincrby(windowKey, "total", 1);
    if (exceededBudget) pipeline.hincrby(windowKey, "violations", 1);
    pipeline.expire(windowKey, 20 * 60);
    const results = await pipeline.exec();

    const total = Array.isArray(results?.[0]) ? (results[0][1] as number) ?? 0 : (results?.[0] as number) ?? 0;
    const violations = Array.isArray(results?.[1]) ? (results[1][1] as number) ?? 0 : (results?.[1] as number) ?? 0;
    if (total < 10) return;

    const violationRatePct = (violations / total) * 100;
    if (violationRatePct >= THRESHOLDS.latencyViolationRatePct) {
      logger.warn(
        { event: "ai_alert_latency", violationRatePct: violationRatePct.toFixed(1), total, threshold: THRESHOLDS.latencyViolationRatePct, tier },
        "AI alert: latency budget violation rate elevated",
      );
      await sendWebhookAlert({
        alert: "latency_violation_rate_elevated",
        severity: "warn",
        value: Math.round(violationRatePct),
        threshold: THRESHOLDS.latencyViolationRatePct,
        detail: `${violations}/${total} requests (${violationRatePct.toFixed(1)}%) exceeded latency budget in last 15 min. Tier: ${tier}`,
      });
    }
  } catch {
    // Redis failure — never block
  }
}

/** OBS-1g: Cost-ceiling token-estimator drift alert.
 *  Call from cost-ceiling.ts after each per-request accuracy sample. Fires when the
 *  15-min-windowed average error exceeds the configured drift threshold. Unlike the
 *  previous log-only behaviour, this now delivers to the webhook so SRE sees the drift
 *  in near-real-time — critical because a silent tokenizer update would otherwise
 *  under-size context budgets for hours before anyone notices.
 */
export async function alertIfCostEstimationDrift(
  avgErrorPct: number,
  sampleCount: number,
  tier: string,
): Promise<void> {
  if (sampleCount < 50) return;
  if (avgErrorPct < THRESHOLDS.costEstimationDriftPct) return;
  logger.warn(
    { event: "ai_alert_cost_estimation_drift", avgErrorPct, sampleCount, tier, threshold: THRESHOLDS.costEstimationDriftPct },
    "AI cost estimation drift exceeded threshold",
  );
  await sendWebhookAlert({
    alert: "cost_estimation_drift",
    severity: "warn",
    value: Number(avgErrorPct.toFixed(1)),
    threshold: THRESHOLDS.costEstimationDriftPct,
    detail: `Token-estimator average error is ${avgErrorPct.toFixed(1)}% over ${sampleCount} samples (tier: ${tier}). The char→token ratio is likely out of sync with the tokenizer — cost ceilings may be mis-sizing contexts.`,
  });
}

/** OBS-1i: RAG low-grounding sliding-window alert.
 *  Tracks the rate of low-grounding RAG results (avg similarity < 0.45) over a 15-min window.
 *  When the rate exceeds the threshold, fires a webhook alert — sustained low grounding
 *  means the knowledge base is stale, embeddings are drifting, or queries are out-of-domain.
 */
const RAG_LOW_GROUNDING_THRESHOLD_PCT = Number(process.env.AI_ALERT_RAG_LOW_GROUNDING_PCT ?? 30);

export async function recordRagGrounding(avgSimilarity: number, tier: string): Promise<void> {
  const windowKey = `ai:rag_grounding:window:${Math.floor(Date.now() / (15 * 60 * 1000))}`;
  try {
    const pipeline = redis.pipeline();
    pipeline.hincrby(windowKey, "total", 1);
    if (avgSimilarity < 0.45) pipeline.hincrby(windowKey, "low", 1);
    pipeline.expire(windowKey, 20 * 60);
    const results = await pipeline.exec();

    // Upstash pipeline.exec() returns [error, value][] tuples.
    // Safely extract the numeric values regardless of client implementation.
    const total = Array.isArray(results?.[0]) ? (results[0][1] as number) ?? 0 : (results?.[0] as number) ?? 0;
    const low = Array.isArray(results?.[1]) ? (results[1][1] as number) ?? 0 : (results?.[1] as number) ?? 0;
    if (total < 10) return;

    const lowRatePct = (low / total) * 100;
    if (lowRatePct >= RAG_LOW_GROUNDING_THRESHOLD_PCT) {
      logger.warn(
        { event: "ai_alert_rag_low_grounding", lowRatePct: lowRatePct.toFixed(1), total, threshold: RAG_LOW_GROUNDING_THRESHOLD_PCT, tier },
        "AI alert: RAG low-grounding rate elevated — knowledge base may be stale or out-of-domain",
      );
      await sendWebhookAlert({
        alert: "rag_low_grounding_rate",
        severity: "warn",
        value: Math.round(lowRatePct),
        threshold: RAG_LOW_GROUNDING_THRESHOLD_PCT,
        detail: `${low}/${total} RAG results (${lowRatePct.toFixed(1)}%) had avg similarity < 0.45 in last 15 min (tier: ${tier}). Knowledge base may be stale or queries out-of-domain.`,
      });
    }
  } catch {
    // Redis failure — never block
  }
}

/** OBS-1h: Cron LLM call observability.
 *  Records cost, latency, and failure for cron-driven LLM calls (daily briefing,
 *  trending questions, personal briefing, etc.) that previously had no alerting coverage.
 *  Uses a 1-hour sliding window to detect sustained issues in cron pipelines.
 */
export async function recordCronLlmCall(args: {
  job: string;
  costUsd: number;
  latencyMs: number;
  success: boolean;
}): Promise<void> {
  const { job, costUsd, latencyMs, success } = args;
  const windowBucket = Math.floor(Date.now() / (60 * 60 * 1000)); // 1h window
  const windowKey = `ai:cron:window:${windowBucket}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.hincrby(windowKey, `${job}:calls`, 1);
    pipeline.hincrbyfloat(windowKey, `${job}:cost`, costUsd);
    pipeline.hincrby(windowKey, `${job}:latency_ms`, latencyMs);
    if (!success) pipeline.hincrby(windowKey, `${job}:failures`, 1);
    pipeline.expire(windowKey, 2 * 60 * 60); // 2h TTL
    await pipeline.exec();
  } catch {
    // Redis failure — never block
  }

  // Per-call alerts: individual cron failure or extreme latency.
  // Dedup per job with a 1h Redis key so transient Azure hiccups don't spam.
  const CRON_ALERT_DEDUP_TTL = 3600; // 1h
  const CRON_LATENCY_THRESHOLD_MS = 60_000;

  if (!success) {
    logger.warn(
      { event: "ai_alert_cron_failure", job, latencyMs },
      `AI alert: cron LLM call failed for ${job}`,
    );
    // Dedup: only send webhook alert if we haven't alerted for this job in the last hour
    const dedupKey = `ai:cron:alerted:failure:${job}`;
    const alreadyAlerted = await redis.set(dedupKey, "1", { ex: CRON_ALERT_DEDUP_TTL, nx: true }).catch(() => null);
    if (alreadyAlerted === "OK") {
      sendWebhookAlert({
        alert: `cron_llm_failure_${job}`,
        severity: "warn",
        value: latencyMs,
        threshold: 0,
        detail: `Cron job \"${job}\" LLM call failed after ${latencyMs}ms.`,
      }).catch(() => {});
    }
  }

  // Alert on extreme latency (> 60s for cron jobs)
  if (success && latencyMs > CRON_LATENCY_THRESHOLD_MS) {
    logger.warn(
      { event: "ai_alert_cron_latency", job, latencyMs, threshold: CRON_LATENCY_THRESHOLD_MS },
      `AI alert: cron LLM call slow for ${job}`,
    );
    // Dedup: only send webhook alert if we haven't alerted for this job in the last hour
    const dedupKey = `ai:cron:alerted:latency:${job}`;
    const alreadyAlerted = await redis.set(dedupKey, "1", { ex: CRON_ALERT_DEDUP_TTL, nx: true }).catch(() => null);
    if (alreadyAlerted === "OK") {
      sendWebhookAlert({
        alert: `cron_llm_latency_${job}`,
        severity: "warn",
        value: latencyMs,
        threshold: CRON_LATENCY_THRESHOLD_MS,
        detail: `Cron job \"${job}\" took ${latencyMs}ms (threshold: ${CRON_LATENCY_THRESHOLD_MS}ms).`,
      }).catch(() => {});
    }
  }

  // Accumulate cost into the daily cost counter (same as interactive requests)
  if (costUsd > 0) {
    await alertIfDailyCostExceeded(costUsd).catch(() => {});
  }
}

export { THRESHOLDS };
