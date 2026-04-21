/**
 * @vitest-environment node
 *
 * Tests for Stripe webhook handler
 * - checkout.session.completed: activates subscription
 * - customer.subscription.updated: updates subscription status
 * - invoice.payment_succeeded: renews subscription
 * - charge.refunded: clawback credits
 * - Signature verification and replay protection
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───
vi.mock("@/lib/payments/webhook-verify", () => ({
  verifyStripeWebhook: vi.fn(),
}));

vi.mock("@/lib/payments/subscription.service", () => ({
  isEventProcessed: vi.fn(async () => false),
  recordEvent: vi.fn(),
  activateSubscription: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
  renewSubscription: vi.fn(),
  findUserByCustomerId: vi.fn(),
  linkCustomerId: vi.fn(),
  resolvePlan: vi.fn(() => "PRO"),
  logBillingAudit: vi.fn(),
}));

vi.mock("@/lib/services/credit.service", () => ({
  addCredits: vi.fn(),
  consumeCredits: vi.fn(),
  getCreditCost: vi.fn(() => 5),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    creditTransaction: {
      findFirst: vi.fn(),
    },
  },
  directPrisma: {},
}));

vi.mock("@/lib/middleware/plan-gate", () => ({
  invalidatePlanCache: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    customers: {
      retrieve: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  })),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: vi.fn((e) => e),
  createTimer: vi.fn(() => ({
    end: vi.fn(() => 100),
  })),
}));

// Import after mocks
import { POST } from "../stripe/route";
import { verifyStripeWebhook } from "@/lib/payments/webhook-verify";
import { isEventProcessed, findUserByCustomerId } from "@/lib/payments/subscription.service";

describe("Stripe Webhook Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
  });

  const createMockRequest = (event: { id: string; type: string; data: { object: Record<string, unknown> } }) => {
    return new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "stripe-signature": "test-signature",
      },
      body: JSON.stringify(event),
    });
  };

  describe("checkout.session.completed", () => {
    const checkoutEvent = {
      id: "evt_123",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          customer: "cus_123",
          metadata: { userId: "user_123" },
          subscription: "sub_123",
        },
      },
    };

    it("activates subscription for new checkout", async () => {
      (verifyStripeWebhook as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: true,
        event: checkoutEvent,
      });

      const mockSubscription = {
        id: "sub_123",
        status: "active",
        items: {
          data: [{
            price: { id: "price_123" },
            current_period_start: Date.now() / 1000,
            current_period_end: (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000,
          }],
        },
      };

      // Mock Stripe subscription retrieval
      const { default: Stripe } = await import("stripe");
      (Stripe as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        customers: {
          retrieve: vi.fn(async () => ({ id: "cus_123", metadata: { userId: "user_123" } })),
        },
        subscriptions: {
          retrieve: vi.fn(async () => mockSubscription),
        },
      }));

      const req = createMockRequest(checkoutEvent);
      const response = await POST(req);

      expect(response.status).toBe(200);
    });

    it("resolves user from customer metadata when not in DB", async () => {
      (verifyStripeWebhook as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: true,
        event: checkoutEvent,
      });

      // User not found in DB
      (findUserByCustomerId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      // Mock Stripe customer with metadata
      const { default: Stripe } = await import("stripe");
      (Stripe as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        customers: {
          retrieve: vi.fn(async () => ({
            id: "cus_123",
            deleted: false,
            metadata: { userId: "user_123" },
          })),
        },
      }));

      const req = createMockRequest(checkoutEvent);
      const response = await POST(req);

      expect(response.status).toBe(200);
    });
  });

  describe("customer.subscription.updated", () => {
    const subscriptionUpdatedEvent = {
      id: "evt_456",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "canceled",
          cancel_at_period_end: true,
          items: {
            data: [{
              price: { id: "price_123" },
            }],
          },
        },
      },
    };

    it("updates subscription status", async () => {
      (verifyStripeWebhook as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: true,
        event: subscriptionUpdatedEvent,
      });

      (findUserByCustomerId as ReturnType<typeof vi.fn>).mockResolvedValueOnce("user_123");

      const { updateSubscriptionStatus } = await import("@/lib/payments/subscription.service");

      const req = createMockRequest(subscriptionUpdatedEvent);
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(updateSubscriptionStatus).toHaveBeenCalled();
    });
  });

  describe("invoice.payment_succeeded", () => {
    const invoiceEvent = {
      id: "evt_789",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_123",
          customer: "cus_123",
          subscription: "sub_123",
          lines: {
            data: [{
              period: {
                start: Date.now() / 1000,
                end: (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000,
              },
            }],
          },
        },
      },
    };

    it("renews subscription on successful payment", async () => {
      (verifyStripeWebhook as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: true,
        event: invoiceEvent,
      });

      (findUserByCustomerId as ReturnType<typeof vi.fn>).mockResolvedValueOnce("user_123");

      // Import subscription service for potential future verification
      await import("@/lib/payments/subscription.service");

      const req = createMockRequest(invoiceEvent);
      const response = await POST(req);

      expect(response.status).toBe(200);
    });
  });

  describe("charge.refunded", () => {
    const refundEvent = {
      id: "evt_refund",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_123",
          amount_refunded: 5000, // $50.00 in cents
          refund_reason: "requested_by_customer",
        },
      },
    };

    it("claws back credits for refunded charge", async () => {
      (verifyStripeWebhook as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: true,
        event: refundEvent,
      });

      // Mock original purchase transaction
      const { prisma } = await import("@/lib/prisma");
      (prisma.creditTransaction.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "ctx_123",
        userId: "user_123",
        amount: 500, // 500 credits purchased
        type: "PURCHASE",
      });

      const { addCredits } = await import("@/lib/services/credit.service");

      const req = createMockRequest(refundEvent);
      const response = await POST(req);

      expect(response.status).toBe(200);
      // Should deduct credits (negative addCredits)
      expect(addCredits).toHaveBeenCalledWith(
        "user_123",
        expect.any(Number),
        "ADJUSTMENT",
        expect.stringContaining("refund"),
        expect.any(String),
      );
    });
  });

  describe("replay protection", () => {
    it("returns 200 for already processed event", async () => {
      (verifyStripeWebhook as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: true,
        event: {
          id: "evt_duplicate",
          type: "checkout.session.completed",
          data: { object: { id: "cs_123" } },
        },
      });

      // Event already processed
      (isEventProcessed as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

      const req = createMockRequest({
        id: "evt_duplicate",
        type: "checkout.session.completed",
        data: { object: { id: "cs_123" } },
      });
      const response = await POST(req);

      expect(response.status).toBe(200);
    });
  });

  describe("error handling", () => {
    it("returns 500 when webhook secret not configured", async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const req = createMockRequest({ id: "evt_1", type: "test", data: { object: {} } });
      const response = await POST(req);

      expect(response.status).toBe(500);
    });

    it("returns 400 for invalid signature", async () => {
      (verifyStripeWebhook as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: false,
        error: "Invalid signature",
      });

      const req = createMockRequest({ id: "evt_1", type: "test", data: { object: {} } });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it("returns 400 for invalid payload", async () => {
      (verifyStripeWebhook as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: true,
        event: { invalid: "data" },
      });

      const req = createMockRequest({ id: "evt_1", type: "test", data: { object: {} } });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });
  });
});
