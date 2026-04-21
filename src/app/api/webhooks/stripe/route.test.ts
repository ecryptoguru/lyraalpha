/**
 * @vitest-environment node
 *
 * Tests for the Stripe webhook route — signature verification, idempotency,
 * checkout.session.completed, invoice.paid, and cancellation flows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: (e: unknown) => e,
  createTimer: () => ({ end: () => 0 }),
}));

const mockVerify = vi.fn();
vi.mock("@/lib/payments/webhook-verify", () => ({
  verifyStripeWebhook: mockVerify,
}));

const mockIsEventProcessed = vi.fn();
const mockRecordEvent = vi.fn();
const mockActivateSubscription = vi.fn();
const mockUpdateSubscriptionStatus = vi.fn();
const mockRenewSubscription = vi.fn();
const mockFindUserByCustomerId = vi.fn();
const mockLinkCustomerId = vi.fn();
const mockResolvePlan = vi.fn(() => "PRO" as const);
const mockLogBillingAudit = vi.fn();
vi.mock("@/lib/payments/subscription.service", () => ({
  isEventProcessed: mockIsEventProcessed,
  recordEvent: mockRecordEvent,
  activateSubscription: mockActivateSubscription,
  updateSubscriptionStatus: mockUpdateSubscriptionStatus,
  renewSubscription: mockRenewSubscription,
  findUserByCustomerId: mockFindUserByCustomerId,
  linkCustomerId: mockLinkCustomerId,
  resolvePlan: mockResolvePlan,
  logBillingAudit: mockLogBillingAudit,
}));

const mockAddCredits = vi.fn();
vi.mock("@/lib/services/credit.service", () => ({
  addCredits: mockAddCredits,
}));

vi.mock("@/lib/middleware/plan-gate", () => ({
  invalidatePlanCache: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: object, signature = "valid-sig"): Request {
  return new Request("https://example.com/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeEvent(type: string, obj: Record<string, unknown>, id = "evt_test") {
  return { id, type, data: { object: obj } };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockIsEventProcessed.mockResolvedValue(false);
    mockRecordEvent.mockResolvedValue(undefined);
    mockFindUserByCustomerId.mockResolvedValue(null);
    mockLinkCustomerId.mockResolvedValue(undefined);
    mockActivateSubscription.mockResolvedValue(undefined);
    mockUpdateSubscriptionStatus.mockResolvedValue(undefined);
    mockRenewSubscription.mockResolvedValue(undefined);
    mockAddCredits.mockResolvedValue(undefined);
    mockLogBillingAudit.mockResolvedValue(undefined);
  });

  it("returns 400 when webhook verification returns undefined (missing/bad secret)", async () => {
    mockVerify.mockReturnValue(undefined);
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    mockVerify.mockReturnValue({ valid: false, error: "bad sig" });
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 200 with duplicate=true for already-processed events", async () => {
    mockVerify.mockReturnValue({ valid: true, event: makeEvent("invoice.paid", {}) });
    mockIsEventProcessed.mockResolvedValue(true);
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(mockActivateSubscription).not.toHaveBeenCalled();
  });

  it("calls activateSubscription for checkout.session.completed (subscription mode)", async () => {
    const sub = {
      id: "sub_123",
      status: "active",
      items: { data: [{ price: { id: "price_pro" }, current_period_start: 1700000000, current_period_end: 1702592000 }] },
    };
    const event = makeEvent("checkout.session.completed", {
      id: "cs_test",
      customer: "cus_123",
      client_reference_id: "user_abc",
      mode: "subscription",
      payment_intent: null,
      metadata: {},
      subscription: sub,
    });
    mockVerify.mockReturnValue({ valid: true, event });
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockActivateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_abc", provider: "STRIPE", plan: "PRO" }),
    );
  });

  it("calls addCredits for checkout.session.completed (payment mode one-time)", async () => {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_test",
      customer: "cus_123",
      client_reference_id: "user_abc",
      mode: "payment",
      payment_intent: "pi_123",
      metadata: { credits: "100", packageId: "pkg_100", packageName: "100 Credits" },
      subscription: null,
    });
    mockVerify.mockReturnValue({ valid: true, event });
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockAddCredits).toHaveBeenCalledWith("user_abc", 100, "PURCHASE", expect.any(String), expect.any(String));
  });

  it("does not call addCredits for zero-credit payment metadata", async () => {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_test_zero",
      customer: "cus_123",
      client_reference_id: "user_abc",
      mode: "payment",
      payment_intent: "pi_123",
      metadata: { credits: "0", packageId: "pkg_zero", packageName: "Zero Credits" },
      subscription: null,
    });
    mockVerify.mockReturnValue({ valid: true, event });
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockAddCredits).not.toHaveBeenCalled();
  });

  it("calls updateSubscriptionStatus for customer.subscription.deleted", async () => {
    const sub = {
      id: "sub_del",
      customer: "cus_123",
      status: "canceled",
      items: { data: [{ price: { id: "price_pro" }, current_period_start: 1700000000, current_period_end: 1702592000 }] },
    };
    const event = makeEvent("customer.subscription.deleted", sub);
    mockVerify.mockReturnValue({ valid: true, event });
    mockFindUserByCustomerId.mockResolvedValue("user_abc");
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith(
      "sub_del",
      "CANCELED",
      undefined,
      "evt_test",
    );
  });

  it("records event on success", async () => {
    const event = makeEvent("invoice.payment_failed", {
      id: "in_fail",
      customer: "cus_123",
      subscription: "sub_123",
    });
    mockVerify.mockReturnValue({ valid: true, event });
    mockFindUserByCustomerId.mockResolvedValue("user_abc");
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockRecordEvent).toHaveBeenCalledWith(
      "STRIPE",
      event.id,
      "invoice.payment_failed",
      "user_abc",
      expect.any(Object),
    );
  });
});
