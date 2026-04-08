/**
 * M5: CSRF protection via Origin header validation.
 *
 * Modern browsers always send the Origin header on cross-origin requests.
 * This middleware rejects mutation requests (POST/PATCH/PUT/DELETE) whose
 * Origin doesn't match the app's own origin — blocking cross-site request
 * forgery without tokens or double-submit cookies.
 *
 * SameSite=Lax already covers most CSRF vectors; this adds defense-in-depth.
 * Webhook routes and CRON routes are excluded via path prefix.
 */

import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-response";

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const EXEMPT_PATH_PREFIXES = [
  "/api/webhooks/",  // Stripe/external webhooks have their own signature verification
  "/api/cron/",      // Vercel cron jobs — no browser origin
];

/**
 * Validate that the Origin header matches the request's own origin.
 * Returns null if valid, or an error Response if the check fails.
 */
export function validateOrigin(request: NextRequest): ReturnType<typeof apiError> | null {
  if (!MUTATION_METHODS.has(request.method)) return null;

  const pathname = new URL(request.url).pathname;
  if (EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  const origin = request.headers.get("origin");

  // Missing Origin header — could be same-origin fetch or non-browser client.
  // Allow it through; SameSite=Lax cookies already protect against CSRF in this case.
  if (!origin) return null;

  const requestOrigin = new URL(request.url).origin;
  const allowedOrigins = new Set([requestOrigin]);

  // Support explicit override for preview deploys / custom domains
  const extraOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
  if (extraOrigins) {
    for (const o of extraOrigins) allowedOrigins.add(o);
  }

  if (!allowedOrigins.has(origin)) {
    return apiError("Forbidden: origin mismatch", 403);
  }

  return null;
}
