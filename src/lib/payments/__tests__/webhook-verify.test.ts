/**
 * @vitest-environment node
 *
 * Tests for webhook-verify.ts — Stripe + Razorpay signature verification and replay protection.
 */
import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

import { verifyStripeWebhook, verifyRazorpayWebhook } from "../webhook-verify";

const SECRET = "test_webhook_secret_123";

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifyRazorpayWebhook", () => {
  it("returns valid for correct signature and fresh timestamp", () => {
    const event = { event: "payment.captured", created_at: Math.floor(Date.now() / 1000) };
    const body = JSON.stringify(event);
    const sig = sign(body, SECRET);

    const result = verifyRazorpayWebhook(body, sig, SECRET);
    expect(result.valid).toBe(true);
    expect(result.event).toEqual(event);
  });

  it("rejects missing signature", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const result = verifyRazorpayWebhook(body, null, SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Missing");
  });

  it("rejects invalid signature (wrong length triggers catch)", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const result = verifyRazorpayWebhook(body, "invalid_sig", SECRET);
    expect(result.valid).toBe(false);
    // timingSafeEqual throws when buffer lengths differ → falls to catch
    expect(result.error).toBeDefined();
  });

  it("rejects invalid signature (correct length, wrong content)", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    // Generate a valid-length hex string (64 chars) that doesn't match
    const wrongSig = "a".repeat(64);
    const result = verifyRazorpayWebhook(body, wrongSig, SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid signature");
  });

  it("rejects replay attack — event older than 5 minutes", () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago
    const event = { event: "payment.captured", created_at: oldTimestamp };
    const body = JSON.stringify(event);
    const sig = sign(body, SECRET);

    const result = verifyRazorpayWebhook(body, sig, SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too old");
  });

  it("accepts event within 5-minute window", () => {
    const recentTimestamp = Math.floor(Date.now() / 1000) - 120; // 2 minutes ago
    const event = { event: "payment.captured", created_at: recentTimestamp };
    const body = JSON.stringify(event);
    const sig = sign(body, SECRET);

    const result = verifyRazorpayWebhook(body, sig, SECRET);
    expect(result.valid).toBe(true);
  });

  it("accepts event without created_at (legacy payloads)", () => {
    const event = { event: "payment.captured" };
    const body = JSON.stringify(event);
    const sig = sign(body, SECRET);

    const result = verifyRazorpayWebhook(body, sig, SECRET);
    expect(result.valid).toBe(true);
  });

  it("rejects malformed JSON body", () => {
    const body = "not json at all {{{";
    const sig = sign(body, SECRET);

    const result = verifyRazorpayWebhook(body, sig, SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Verification failed");
  });
});

// ─── Stripe webhook tests ─────────────────────────────────────────────────────

function stripeSign(body: string, secret: string, timestamp?: number): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${body}`;
  const sig = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return `t=${ts},v1=${sig}`;
}

describe("verifyStripeWebhook", () => {
  it("returns valid for correct signature and fresh timestamp", () => {
    const event = { id: "evt_123", type: "checkout.session.completed" };
    const body = JSON.stringify(event);
    const signature = stripeSign(body, SECRET);

    const result = verifyStripeWebhook(body, signature, SECRET);
    expect(result.valid).toBe(true);
    expect(result.event).toEqual(event);
  });

  it("rejects missing signature header", () => {
    const body = JSON.stringify({ id: "evt_123" });
    const result = verifyStripeWebhook(body, null, SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Missing");
  });

  it("rejects signature with wrong secret", () => {
    const body = JSON.stringify({ id: "evt_123" });
    const signature = stripeSign(body, "wrong_secret");

    const result = verifyStripeWebhook(body, signature, SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid signature");
  });

  it("rejects malformed signature header (no t= or v1=)", () => {
    const body = JSON.stringify({ id: "evt_123" });
    const result = verifyStripeWebhook(body, "garbage_header", SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid signature format");
  });

  it("rejects replay attack — timestamp older than 5 minutes", () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400;
    const body = JSON.stringify({ id: "evt_123" });
    const signature = stripeSign(body, SECRET, oldTimestamp);

    const result = verifyStripeWebhook(body, signature, SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too old");
  });

  it("accepts event within 5-minute window", () => {
    const recentTimestamp = Math.floor(Date.now() / 1000) - 120;
    const body = JSON.stringify({ id: "evt_123" });
    const signature = stripeSign(body, SECRET, recentTimestamp);

    const result = verifyStripeWebhook(body, signature, SECRET);
    expect(result.valid).toBe(true);
  });

  it("accepts multiple v1= signatures (key rotation)", () => {
    const body = JSON.stringify({ id: "evt_123" });
    const ts = Math.floor(Date.now() / 1000);
    const signedPayload = `${ts}.${body}`;
    const correctSig = crypto.createHmac("sha256", SECRET).update(signedPayload, "utf8").digest("hex");
    // Prepend a stale/wrong v1= signature (as Stripe does during key rotation)
    const signature = `t=${ts},v1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,v1=${correctSig}`;

    const result = verifyStripeWebhook(body, signature, SECRET);
    expect(result.valid).toBe(true);
  });

  it("rejects malformed JSON body (valid signature, bad JSON)", () => {
    const body = "not json {{{";
    const signature = stripeSign(body, SECRET);

    const result = verifyStripeWebhook(body, signature, SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Verification failed");
  });

  it("rejects tampered body (signature computed on original)", () => {
    const originalBody = JSON.stringify({ id: "evt_123", amount: 1000 });
    const tamperedBody = JSON.stringify({ id: "evt_123", amount: 9999 });
    const signature = stripeSign(originalBody, SECRET);

    const result = verifyStripeWebhook(tamperedBody, signature, SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid signature");
  });
});
