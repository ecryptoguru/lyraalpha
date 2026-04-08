import { NextResponse } from "next/server";

export interface RateLimitError {
  error: string;
  message: string;
  retryAfter: number;
  limit: number;
  remaining: number;
  reset: number;
}

export function createRateLimitErrorResponse(
  limit: number,
  remaining: number,
  reset: number,
): NextResponse<RateLimitError> {
  const retryAfter = Math.ceil((reset - Date.now()) / 1000);

  return NextResponse.json(
    {
      error: "Rate limit exceeded",
      message: "You have exceeded the rate limit. Please try again later.",
      retryAfter,
      limit,
      remaining,
      reset,
    },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
        "Retry-After": retryAfter.toString(),
      },
    },
  );
}

export function addRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  reset: number,
): NextResponse {
  response.headers.set("X-RateLimit-Limit", limit.toString());
  response.headers.set("X-RateLimit-Remaining", remaining.toString());
  response.headers.set("X-RateLimit-Reset", reset.toString());
  return response;
}
