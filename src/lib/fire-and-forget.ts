import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "fire-and-forget" });

/**
 * Fire-and-forget a promise with error logging.
 * Replaces `.catch(() => {})` with `.catch(logFireAndForgetError)` so
 * failures are observable in production without blocking the caller.
 *
 * Usage:
 *   someAsyncOp().catch(logFireAndForgetError);          // auto-context
 *   someAsyncOp().catch((e) => logFireAndForgetError(e, "cache write"));  // explicit context
 */
export function logFireAndForgetError(err: unknown, context?: string): void {
  const ctx = context ?? inferContextFromError(err);
  logger.warn({ err, context: ctx }, `Fire-and-forget failed${ctx ? ` (${ctx})` : ""}`);
}

function inferContextFromError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message?.toLowerCase() ?? "";
    if (msg.includes("redis") || msg.includes("cache")) return "cache";
    if (msg.includes("prisma") || msg.includes("database")) return "db";
    if (msg.includes("fetch") || msg.includes("network")) return "network";
  }
  return "unknown";
}
