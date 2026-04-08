import crypto from "crypto";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "webhook-verify" });

// ─── Stripe Webhook Verification ─────────────────────────────────────────────

interface StripeVerifyResult {
  valid: boolean;
  event?: Record<string, unknown>;
  error?: string;
}

export function verifyStripeWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
): StripeVerifyResult {
  if (!signature) {
    return { valid: false, error: "Missing Stripe-Signature header" };
  }

  try {
    const elements = signature.split(",");
    const timestampElement = elements.find((e) => e.startsWith("t="));
    // Stripe may send multiple v1= signatures during key rotation — collect all
    const signatureElements = elements.filter((e) => e.startsWith("v1="));

    if (!timestampElement || signatureElements.length === 0) {
      return { valid: false, error: "Invalid signature format" };
    }

    const timestamp = timestampElement.split("=")[1];

    // Replay protection: reject events older than 5 minutes
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (timestampAge > 300) {
      logger.warn({ timestampAge }, "Stripe webhook timestamp too old — possible replay");
      return { valid: false, error: "Webhook timestamp too old" };
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${rawBody}`;
    const computedSig = crypto
      .createHmac("sha256", secret)
      .update(signedPayload, "utf8")
      .digest("hex");

    const computedBuf = Buffer.from(computedSig, "hex");

    // Check against ALL v1= signatures (key rotation support)
    // timingSafeEqual requires equal-length buffers — guard length before comparing
    const isValid = signatureElements.some((el) => {
      const expected = el.split("=")[1];
      const expectedBuf = Buffer.from(expected, "hex");
      if (computedBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(computedBuf, expectedBuf);
    });

    if (!isValid) {
      logger.warn("Stripe webhook signature mismatch");
      return { valid: false, error: "Invalid signature" };
    }

    const event = JSON.parse(rawBody);
    return { valid: true, event };
  } catch (err) {
    logger.error({ err }, "Stripe webhook verification error");
    return { valid: false, error: "Verification failed" };
  }
}

// ─── Razorpay Webhook Verification ───────────────────────────────────────────

interface RazorpayVerifyResult {
  valid: boolean;
  event?: Record<string, unknown>;
  error?: string;
}

export function verifyRazorpayWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
): RazorpayVerifyResult {
  if (!signature) {
    return { valid: false, error: "Missing X-Razorpay-Signature header" };
  }

  try {
    const computedSig = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");

    const computedBuf = Buffer.from(computedSig, "hex");
    const expectedBuf = Buffer.from(signature, "hex");

    if (computedBuf.length !== expectedBuf.length) {
      logger.warn("Razorpay webhook signature length mismatch");
      return { valid: false, error: "Invalid signature" };
    }

    if (!crypto.timingSafeEqual(computedBuf, expectedBuf)) {
      logger.warn("Razorpay webhook signature mismatch");
      return { valid: false, error: "Invalid signature" };
    }

    const event = JSON.parse(rawBody);

    // Replay protection
    const createdAt = event.created_at as number | undefined;
    if (createdAt) {
      const eventAge = Math.floor(Date.now() / 1000) - createdAt;
      if (eventAge > 300) {
        logger.warn({ eventAge }, "Razorpay webhook timestamp too old — possible replay");
        return { valid: false, error: "Webhook timestamp too old" };
      }
    } else {
      logger.warn({ eventType: event.event }, "Razorpay webhook missing created_at — replay protection skipped");
    }

    return { valid: true, event };
  } catch (err) {
    logger.error({ err }, "Razorpay webhook verification error");
    return { valid: false, error: "Verification failed" };
  }
}

// ─── Razorpay Payment Verification (for checkout callback) ───────────────────

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): boolean {
  const payload = `${orderId}|${paymentId}`;
  const computedSig = crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  const computedBuf = Buffer.from(computedSig, "hex");
  const expectedBuf = Buffer.from(signature, "hex");
  if (computedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(computedBuf, expectedBuf);
}
