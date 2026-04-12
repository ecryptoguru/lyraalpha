import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "api-response" });

export type ApiResponse<T = unknown> = 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string; details?: unknown };

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status });
}

export function apiError(error: string, status = 400, details?: unknown) {
  // Sanitize internal errors in production to prevent information leakage
  const isProduction = process.env.NODE_ENV === "production";
  const sanitizedError = isProduction && status >= 500 
    ? "An internal error occurred. Please try again later."
    : error;
  
  // Log original error for debugging (only in production)
  if (isProduction && status >= 500 && typeof error === "string") {
    logger.error({ originalError: error, status }, "Internal API error sanitized");
  }
  
  return NextResponse.json<ApiResponse>({ success: false, error: sanitizedError, details }, { status });
}
