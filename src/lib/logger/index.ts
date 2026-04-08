import pino from "pino";
import { sanitizeError } from "./utils";

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Core logger instance with environment-aware configuration
 * - Development: Pretty-printed, human-readable logs
 * - Production: JSON logs for machine parsing
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),

  formatters: {
    level: (label) => ({ level: label }),
  },

  timestamp: pino.stdTimeFunctions.isoTime,

  // Redact sensitive fields
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "apiKey",
      "*.apiKey",
      "secret",
      "*.secret",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
    ],
    remove: true,
  },

  // Pretty print in development
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
          singleLine: false,
        },
      }
    : undefined,
});

/**
 * Create a child logger with additional context
 * @param context - Additional fields to include in all logs
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log component errors caught by error boundaries
 * @param error - The error that was caught
 * @param errorInfo - React error info with component stack
 * @param context - Additional context to log
 */
export function logComponentError(
  error: Error,
  errorInfo: { componentStack: string },
  context?: Record<string, unknown>,
) {
  logger.error(
    {
      err: sanitizeError(error),
      componentStack: errorInfo.componentStack,
      ...context,
    },
    "Component error caught by boundary",
  );
}

/**
 * Log levels:
 * - trace: Very detailed debugging (function entry/exit)
 * - debug: Debugging information (variable values, flow)
 * - info: Normal operations (request started, completed)
 * - warn: Potential issues (rate limit approaching, slow query)
 * - error: Errors that are recoverable (API call failed)
 * - fatal: Critical failures (database down, service crash)
 */
