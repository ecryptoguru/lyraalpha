/**
 * CRON Authentication Middleware
 *
 * Production: validates QStash signature (Upstash-Signature JWT) via Receiver.
 * Development/test: falls back to CRON_SECRET Bearer token for local testing.
 *
 * QStash gives automatic retries, delivery guarantees, and deduplication.
 * No cron route files need to change — only this middleware changed.
 *
 * Required env vars (production):
 *   QSTASH_CURRENT_SIGNING_KEY   — from Upstash QStash console
 *   QSTASH_NEXT_SIGNING_KEY      — from Upstash QStash console
 *
 * Optional env vars (dev / CI):
 *   CRON_SECRET                  — Bearer fallback for local testing
 */

import { Receiver } from "@upstash/qstash";
import { NextResponse } from "next/server";
import type { Logger } from "pino";
import { sanitizeError } from "@/lib/logger/utils";

export interface CronAuthResult {
  authorized: boolean;
  error?: {
    status: number;
    message: string;
  };
}

type RequestWithHeaders = {
  headers: Headers;
  text?: () => Promise<string>;
};

// Lazily initialised — avoids throwing at module load if env vars are absent in dev.
let _receiver: Receiver | null = null;

function getReceiver(): Receiver | null {
  if (_receiver) return _receiver;
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!current || !next) return null;
  _receiver = new Receiver({ currentSigningKey: current, nextSigningKey: next });
  return _receiver;
}

function isDevFallbackAllowed(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

/**
 * Validates cron auth.
 * - Production: QStash JWT signature (Upstash-Signature header).
 * - Dev/preview: CRON_SECRET Bearer fallback.
 *
 * NOTE: QStash path requires the raw request body for body-hash verification,
 * so we accept an optional `bodyText` param (pre-read outside this fn).
 * Bearer fallback is header-only and needs no body.
 */
export async function validateCronAuth(
  request: RequestWithHeaders,
  bodyText?: string,
  requestUrl?: string,
): Promise<CronAuthResult> {
  const receiver = getReceiver();

  // ── QStash signature path ─────────────────────────────────────────────────
  if (receiver) {
    const signature = request.headers.get("upstash-signature");
    if (signature) {
      try {
        const isValid = await receiver.verify({
          signature,
          body: bodyText ?? "",
          url: requestUrl,
        });
        if (isValid) return { authorized: true };
        return { authorized: false, error: { status: 401, message: "Invalid QStash signature" } };
      } catch (e) {
        return { authorized: false, error: { status: 401, message: `QStash signature verification failed: ${e instanceof Error ? e.message : String(e)}` } };
      }
    }
  }

  // ── CRON_SECRET Bearer fallback (dev / preview only) ─────────────────────
  if (isDevFallbackAllowed()) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader === `Bearer ${cronSecret}`) return { authorized: true };
      if (authHeader) return { authorized: false, error: { status: 401, message: "Invalid CRON_SECRET" } };
    }
  }

  // ── No valid auth ─────────────────────────────────────────────────────────
  if (!receiver && !isDevFallbackAllowed()) {
    return { authorized: false, error: { status: 500, message: "QStash signing keys not configured" } };
  }

  return { authorized: false, error: { status: 401, message: "Missing authorization" } };
}

function getCronRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `cron_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

export async function withCronAuthAndLogging(
  request: RequestWithHeaders,
  args: { logger: Logger; job: string },
  handler: (ctx: { requestId: string }) => Promise<NextResponse>,
): Promise<NextResponse> {
  // Read body once here — QStash Receiver needs the raw text for body-hash verification.
  // Body is discarded after auth; cron handlers don't use request body.
  let bodyText = "";
  try {
    if (typeof request.text === "function") bodyText = await request.text();
  } catch {
    // Body read failed — auth will proceed with empty string (harmless for GET crons)
  }

  const requestUrl = (request as { url?: string }).url;
  const authResult = await validateCronAuth(request, bodyText, requestUrl);

  if (!authResult.authorized) {
    const res = NextResponse.json(
      { error: authResult.error!.message },
      { status: authResult.error!.status },
    );
    return res;
  }

  const requestId = getCronRequestId();
  const startedAt = Date.now();
  args.logger.info({ requestId, job: args.job }, "Cron started");

  try {
    const res = await handler({ requestId });
    const durationMs = Date.now() - startedAt;
    args.logger.info({ requestId, job: args.job, durationMs }, "Cron succeeded");
    res.headers.set("x-cron-request-id", requestId);
    return res;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    args.logger.error(
      { requestId, job: args.job, durationMs, err: sanitizeError(err) },
      "Cron failed",
    );
    const res = NextResponse.json(
      { success: false, error: "Cron failed", requestId },
      { status: 500 },
    );
    res.headers.set("x-cron-request-id", requestId);
    return res;
  }
}

