/**
 * Safe JSON parsing utilities with error handling and validation.
 * Provides type-safe JSON parsing with proper error handling.
 */

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";
import { classifyError } from "@/lib/errors/classification";

const logger = createLogger({ service: "json-utils" });

/**
 * Safely parse JSON string with error handling
 * @param jsonString The JSON string to parse
 * @param fallback Optional fallback value to return if parsing fails
 * @returns Parsed JSON or fallback value
 */
export function safeJsonParse<T = unknown>(
  jsonString: string | null | undefined,
  fallback?: T
): T | null {
  if (!jsonString) {
    return fallback ?? null;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    const classifiedError = classifyError(error);
    logger.warn(
      { type: classifiedError.type, message: classifiedError.message },
      "Failed to parse JSON string"
    );
    return fallback ?? null;
  }
}

/**
 * Safely parse JSON string with Zod schema validation
 * @param jsonString The JSON string to parse
 * @param schema The Zod schema to validate against
 * @param fallback Optional fallback value to return if parsing or validation fails
 * @returns Validated parsed JSON or fallback value
 */
export function safeJsonParseWithSchema<T>(
  jsonString: string | null | undefined,
  schema: z.ZodSchema<T>,
  fallback?: T
): T | null {
  if (!jsonString) {
    return fallback ?? null;
  }

  try {
    const parsed = JSON.parse(jsonString);
    const validated = schema.parse(parsed);
    return validated;
  } catch (error) {
    const classifiedError = classifyError(error);
    logger.warn(
      { type: classifiedError.type, message: classifiedError.message },
      "Failed to parse or validate JSON string"
    );
    return fallback ?? null;
  }
}

/**
 * Safely stringify value to JSON with error handling
 * @param value The value to stringify
 * @param fallback Optional fallback value to return if stringification fails
 * @returns JSON string or fallback value
 */
export function safeJsonStringify(
  value: unknown,
  fallback?: string
): string | null {
  try {
    return JSON.stringify(value);
  } catch (error) {
    const classifiedError = classifyError(error);
    logger.warn(
      { type: classifiedError.type, message: classifiedError.message },
      "Failed to stringify value to JSON"
    );
    return fallback ?? null;
  }
}

/**
 * Deep clone an object using structuredClone (structured-clone polyfill available in all modern runtimes).
 * Falls back to JSON serialization if structuredClone fails (e.g. for non-cloneable values like functions).
 * @param value The value to clone
 * @returns Cloned value or null if cloning fails
 */
export function safeDeepClone<T>(value: T): T | null {
  try {
    return structuredClone(value);
  } catch {
    // Fallback for values not supported by structuredClone (functions, DOM nodes, etc.)
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch (error) {
      const classifiedError = classifyError(error);
      logger.warn(
        { type: classifiedError.type, message: classifiedError.message },
        "Failed to deep clone value"
      );
      return null;
    }
  }
}

/**
 * Parse JSON with context for better error messages
 * @param jsonString The JSON string to parse
 * @param context Additional context for error logging
 * @param fallback Optional fallback value
 * @returns Parsed JSON or fallback value
 */
export function parseJsonWithContext<T = unknown>(
  jsonString: string | null | undefined,
  context: { source: string; field?: string },
  fallback?: T
): T | null {
  if (!jsonString) {
    return fallback ?? null;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    const classifiedError = classifyError(error);
    logger.warn(
      {
        type: classifiedError.type,
        message: classifiedError.message,
        context,
      },
      `Failed to parse JSON from ${context.source}${context.field ? `.${context.field}` : ""}`
    );
    return fallback ?? null;
  }
}

/**
 * Type-safe cast with runtime type guard
 * @param value The value to cast
 * @param typeGuard Type guard function to validate the type
 * @param fallback Optional fallback value if validation fails
 * @returns Casted value or fallback
 */
export function safeCast<T>(
  value: unknown,
  typeGuard: (val: unknown) => val is T,
  fallback?: T
): T | null {
  if (typeGuard(value)) {
    return value;
  }
  logger.debug({ value }, "Type guard validation failed, using fallback");
  return fallback ?? null;
}

/**
 * Type-safe cast for Prisma InputJsonValue
 * @param value The value to cast
 * @param fallback Optional fallback value
 * @returns Casted value or fallback
 */
export function asPrismaJsonValue(
  value: unknown,
  fallback?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === null || value === undefined) {
    return fallback ?? undefined;
  }
  // Prisma.InputJsonValue accepts: string, number, boolean, null, array, object
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    Array.isArray(value) ||
    (typeof value === "object" && value !== null)
  ) {
    return value as Prisma.InputJsonValue;
  }
  logger.debug({ value }, "Value is not a valid Prisma InputJsonValue, using fallback");
  return fallback ?? undefined;
}
