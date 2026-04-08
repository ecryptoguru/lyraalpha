/**
 * API Error Handler Middleware
 * 
 * Provides standardized error responses across all API routes.
 * Ensures consistent error format and proper HTTP status codes.
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { validateOrigin } from "./csrf";

/**
 * Typed HTTP error with an explicit status code.
 * Throw this instead of plain Error to guarantee correct HTTP status mapping.
 *
 * @example
 * throw new HttpError(404, "Asset not found");
 */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
  timestamp?: string;
}

/**
 * Standard error response builder.
 * 
 * @param message - Error message
 * @param status - HTTP status code
 * @param details - Optional additional error details
 * @returns NextResponse with standardized error format
 */
export function errorResponse(
  message: string,
  status: number = 500,
  details?: unknown
): NextResponse<ApiError> {
  const error: ApiError = {
    error: getErrorType(status),
    message,
    timestamp: new Date().toISOString(),
  };

  if (details) {
    error.details = details;
  }

  return NextResponse.json(error, { status });
}

/**
 * Get error type string from HTTP status code.
 */
function getErrorType(status: number): string {
  switch (status) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 409:
      return "Conflict";
    case 422:
      return "Validation Error";
    case 429:
      return "Too Many Requests";
    case 500:
      return "Internal Server Error";
    case 503:
      return "Service Unavailable";
    default:
      return "Error";
  }
}

/**
 * Handle Zod validation errors with detailed field information.
 */
export function handleValidationError(error: ZodError): NextResponse<ApiError> {
  const fieldErrors = error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  return errorResponse(
    "Validation failed",
    422,
    { fields: fieldErrors }
  );
}

/**
 * Async error handler wrapper for API routes.
 * Catches and formats errors consistently.
 * 
 * @param handler - Async API route handler
 * @returns Wrapped handler with error handling
 * 
 * @example
 * ```typescript
 * export const GET = withErrorHandler(async (request: NextRequest) => {
 *   const data = await fetchData();
 *   return NextResponse.json(data);
 * });
 * ```
 */
export function withErrorHandler<T extends (...args: never[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      // M5: CSRF Origin check for mutation routes
      const firstArg = args[0];
      if (firstArg && typeof firstArg === "object" && "method" in firstArg) {
        const csrfError = validateOrigin(firstArg as NextRequest);
        if (csrfError) return csrfError;
      }
      return await handler(...args);
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof ZodError) {
        return handleValidationError(error);
      }

      // Typed HttpError — use its status code directly, no string-sniffing
      if (error instanceof HttpError) {
        const safeMessage =
          error.statusCode >= 500 && process.env.NODE_ENV === "production"
            ? "An unexpected error occurred"
            : error.message;
        return errorResponse(safeMessage, error.statusCode);
      }

      if (error instanceof Error) {
        // 🔒 Never leak internal error details in production
        const safeMessage =
          process.env.NODE_ENV === "production"
            ? "An unexpected error occurred"
            : error.message;
        return errorResponse(safeMessage, 500);
      }

      // Unknown error type
      return errorResponse("An unexpected error occurred", 500);
    }
  }) as T;
}

/**
 * Common error response helpers for specific scenarios.
 */
export const ApiErrors = {
  badRequest: (message: string = "Invalid request") =>
    errorResponse(message, 400),

  unauthorized: (message: string = "Authentication required") =>
    errorResponse(message, 401),

  forbidden: (message: string = "Access denied") =>
    errorResponse(message, 403),

  notFound: (message: string = "Resource not found") =>
    errorResponse(message, 404),

  conflict: (message: string = "Resource conflict") =>
    errorResponse(message, 409),

  validation: (message: string = "Validation failed", details?: unknown) =>
    errorResponse(message, 422, details),

  rateLimit: (message: string = "Too many requests") =>
    errorResponse(message, 429),

  internal: (message: string = "Internal server error") =>
    errorResponse(message, 500),

  unavailable: (message: string = "Service temporarily unavailable") =>
    errorResponse(message, 503),
} as const;
