import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "telemetry" });

const TIMING_ENABLED = process.env.REDIS_TIMING_ENABLED === "true";
const TIMING_SAMPLE = Number(process.env.REDIS_TIMING_SAMPLE || "0.01");

function shouldLog(): boolean {
  return TIMING_ENABLED && Math.random() < TIMING_SAMPLE;
}

/**
 * Wraps an async function with optional sampled timing instrumentation.
 * Uses process.hrtime.bigint() for sub-millisecond precision.
 * Sampling is controlled by REDIS_TIMING_ENABLED + REDIS_TIMING_SAMPLE env vars.
 */
export async function timed<T>(
  op: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>,
): Promise<T> {
  if (!shouldLog()) return fn();
  const start = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info({ op, durationMs, ...meta }, "timing");
  }
}
