export function isVercelProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

function isBypassRuntimeAllowed(): boolean {
  // NEVER allow bypass on Vercel (preview or production) — VERCEL_ENV is always set there.
  if (process.env.VERCEL_ENV) return false;
  // Allow bypass in local dev (NODE_ENV !== "production") OR when E2E_BYPASS=true.
  // The E2E_BYPASS flag is needed for Playwright tests that run `next start` (which
  // forces NODE_ENV=production) — without it, every E2E suite that relies on
  // SKIP_AUTH / SKIP_RATE_LIMIT breaks.
  return process.env.NODE_ENV !== "production" || process.env.E2E_BYPASS === "true";
}

export function isAuthBypassEnabled(): boolean {
  return process.env.SKIP_AUTH === "true"
    && isBypassRuntimeAllowed();
}

export function isRateLimitBypassEnabled(): boolean {
  return process.env.SKIP_RATE_LIMIT === "true"
    && isBypassRuntimeAllowed();
}

export function isAuthBypassHeaderEnabled(headerValue: string | null | undefined): boolean {
  return headerValue === "true" && isBypassRuntimeAllowed();
}

export function isRateLimitBypassHeaderEnabled(headerValue: string | null | undefined): boolean {
  return headerValue === "true" && isBypassRuntimeAllowed();
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getConfiguredAppUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return value ? value.replace(/\/+$/, "") : null;
}

export function getAppUrlFromRequest(requestUrl: string): string {
  return getConfiguredAppUrl() ?? new URL(requestUrl).origin;
}

/**
 * Vercel edge region for API routes.
 * Reads VERCEL_PREFERRED_REGION env var; defaults to "bom1" (Mumbai).
 * Import this instead of hardcoding `["bom1"]` in every route file.
 */
export const PREFERRED_REGION: string[] = (process.env.VERCEL_PREFERRED_REGION ?? "bom1")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);
