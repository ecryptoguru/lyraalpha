/**
 * Sanitize error objects for structured logging
 * Extracts relevant error information while avoiding circular references
 */
export function sanitizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const sanitized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    if (error.cause) {
      sanitized.cause = sanitizeError(error.cause);
    }

    return sanitized;
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return { message: String(error) };
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Create a timer for measuring execution time
 */
export function createTimer() {
  const start = Date.now();
  return {
    end: () => Date.now() - start,
    endFormatted: () => formatDuration(Date.now() - start),
  };
}

/**
 * Redact sensitive data from objects
 * Useful for logging request/response bodies
 */
export function redactSensitive(
  obj: Record<string, unknown>,
  sensitiveKeys: string[] = ["password", "token", "apiKey", "secret"],
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    if (
      sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))
    ) {
      redacted[key] = "[REDACTED]";
    } else if (
      typeof obj[key] === "object" &&
      obj[key] !== null &&
      !Array.isArray(obj[key])
    ) {
      redacted[key] = redactSensitive(
        obj[key] as Record<string, unknown>,
        sensitiveKeys,
      );
    } else {
      redacted[key] = obj[key];
    }
  }

  return redacted;
}
