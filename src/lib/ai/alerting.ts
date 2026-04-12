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
  // Web search: alert after this many consecutive failures (set to 2, circuit breaker at 3)
  webSearchConsecutiveFailures: Number(process.env.AI_ALERT_WEB_SEARCH_FAILURES ?? 2),
  // Output validation: alert when % of responses failing section checks exceeds threshold (15-min window)
  outputValidationFailureRatePct: Number(process.env.AI_ALERT_VALIDATION_FAILURE_PCT ?? 30),
  // Fallback rate: alert when % of requests using nano fallback exceeds threshold
  fallbackRatePct: Number(process.env.AI_ALERT_FALLBACK_RATE_PCT ?? 10),
  // Fallback rate mitigation: automatically switch to backup model when this threshold is exceeded
  fallbackRateMitigationPct: Number(process.env.AI_ALERT_FALLBACK_RATE_MITIGATION_PCT ?? 15),
  // Latency budget violation: alert when % of requests exceeding latency budget exceeds threshold (15-min window)
  latencyViolationRatePct: Number(process.env.AI_ALERT_LATENCY_VIOLATION_PCT ?? 15),
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
    cumulativeCost = Number((results?.[0] as number) ?? 0);
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

    const total = (results?.[0] as number) ?? 0;
    const zero = (results?.[1] as number) ?? 0;
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

    const total = (results?.[0] as number) ?? 0;
    const failed = (results?.[1] as number) ?? 0;
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
export async function recordFallbackResult(wasFallback: boolean): Promise<void> {
  const windowKey = `ai:fallback:window:${Math.floor(Date.now() / (15 * 60 * 1000))}`;
  const mitigationFlagKey = "ai:fallback:mitigation_active";
  try {
    const pipeline = redis.pipeline();
    pipeline.hincrby(windowKey, "total", 1);
    if (wasFallback) pipeline.hincrby(windowKey, "fallback", 1);
    pipeline.expire(windowKey, 20 * 60);
    const results = await pipeline.exec();

    const total = (results?.[0] as number) ?? 0;
    const fallbacks = (results?.[1] as number) ?? 0;
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

    const total = (results?.[0] as number) ?? 0;
    const violations = (results?.[1] as number) ?? 0;
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

export { THRESHOLDS };
