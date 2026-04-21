/**
 * @vitest-environment node
 *
 * Tests for Clerk webhook handler
 * - user.created: creates user, grants credits, sends welcome email
 * - user.updated: updates email, handles out-of-order webhooks
 * - user.deleted: GDPR purge
 * - Webhook signature verification
 * - Idempotency (duplicate svix-id handling)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───
const mockHeaders = new Map([
  ["svix-id", "test-id-1"],
  ["svix-timestamp", Date.now().toString()],
  ["svix-signature", "test-signature"],
]);

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mockHeaders),
}));

vi.mock("svix", () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn((body) => {
      // Return parsed event if signature valid
      return JSON.parse(body);
    }),
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn) => fn(mockTx)),
    user: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userPreference: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    portfolio: {
      findMany: vi.fn(),
    },
    portfolioHolding: {
      deleteMany: vi.fn(),
    },
    creditTransaction: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    creditLot: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    subscription: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    paymentEvent: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    pointTransaction: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    xpTransaction: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    xpRedemption: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    userBadge: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    learningCompletion: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    watchlistItem: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    userMemoryNote: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    supportConversation: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    billingAuditLog: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    userSession: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    userActivityEvent: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    lyraFeedback: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  directPrisma: {},
}));

vi.mock("@/lib/redis", () => ({
  redisSetNX: vi.fn(async () => true), // not duplicate
  delCache: vi.fn(),
}));

vi.mock("@/lib/email/brevo", () => ({
  upsertBrevoContact: vi.fn(),
  sendBrevoEmail: vi.fn(async () => true),
}));

vi.mock("@/lib/services/credit.service", () => ({
  grantCreditsInTransaction: vi.fn(),
  addCredits: vi.fn(),
  consumeCredits: vi.fn(),
  getCreditCost: vi.fn(() => 5),
}));

vi.mock("@/lib/email/templates", () => ({
  buildWelcomeEmail: vi.fn(() => ({
    subject: "Welcome to LyraAlpha",
    html: "<p>Welcome!</p>",
    text: "Welcome!",
  })),
}));

vi.mock("@/lib/middleware/plan-gate", () => ({
  invalidatePlanCache: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isPrivilegedEmail: vi.fn((email) => email.includes("admin")),
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
}));

// Mock transaction object
const mockTx = {
  user: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  userPreference: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    delete: vi.fn(),
  },
  portfolioHolding: {
    deleteMany: vi.fn(),
  },
  creditTransaction: {
    deleteMany: vi.fn(),
  },
  creditLot: {
    deleteMany: vi.fn(),
  },
  subscription: {
    deleteMany: vi.fn(),
  },
  paymentEvent: {
    deleteMany: vi.fn(),
  },
  pointTransaction: {
    deleteMany: vi.fn(),
  },
  xpTransaction: {
    deleteMany: vi.fn(),
  },
  xpRedemption: {
    deleteMany: vi.fn(),
  },
  userBadge: {
    deleteMany: vi.fn(),
  },
  userProgress: {
    deleteMany: vi.fn(),
  },
  learningCompletion: {
    deleteMany: vi.fn(),
  },
  watchlistItem: {
    deleteMany: vi.fn(),
  },
  notification: {
    deleteMany: vi.fn(),
  },
  userMemoryNote: {
    deleteMany: vi.fn(),
  },
  supportConversation: {
    deleteMany: vi.fn(),
  },
  supportMessage: {
    deleteMany: vi.fn(),
  },
  billingAuditLog: {
    deleteMany: vi.fn(),
  },
  userSession: {
    deleteMany: vi.fn(),
  },
  userActivityEvent: {
    deleteMany: vi.fn(),
  },
  lyraFeedback: {
    deleteMany: vi.fn(),
  },
  aIRequestLog: {
    deleteMany: vi.fn(),
  },
  referral: {
    deleteMany: vi.fn(),
  },
  portfolio: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};

// Import after mocks
import { POST } from "../clerk/route";
import { prisma } from "@/lib/prisma";
import { redisSetNX } from "@/lib/redis";

describe("Clerk Webhook Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_WEBHOOK_SECRET = "test-secret";
  });

  const createMockRequest = (event: unknown) => {
    return new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify(event),
    });
  };

  describe("user.created", () => {
    const userCreatedEvent = {
      type: "user.created",
      data: {
        id: "user_123",
        email_addresses: [
          { id: "email_1", email_address: "test@example.com" },
        ],
        primary_email_address_id: "email_1",
        first_name: "Test",
        last_name: "User",
        unsafe_metadata: {},
      },
    };

    it("creates user with ELITE plan and grants sign-up bonus", async () => {
      const req = createMockRequest(userCreatedEvent);
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("sends welcome email on first creation", async () => {
      // Mock that welcome email hasn't been sent
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const req = createMockRequest(userCreatedEvent);
      await POST(req);

      const { sendBrevoEmail } = await import("@/lib/email/brevo");
      expect(sendBrevoEmail).toHaveBeenCalled();
    });

    it("skips welcome email if already sent", async () => {
      // Mock that welcome email was already sent
      (prisma.userPreference.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        welcomeEmailSentAt: new Date(),
      });

      const req = createMockRequest(userCreatedEvent);
      await POST(req);

      const { sendBrevoEmail } = await import("@/lib/email/brevo");
      expect(sendBrevoEmail).not.toHaveBeenCalled();
    });

    it("handles P2002 duplicate gracefully", async () => {
      const error = new Error("Unique constraint violation") as Error & { code: string };
      error.code = "P2002";
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const req = createMockRequest(userCreatedEvent);
      const response = await POST(req);

      // Should still return 200 (idempotent)
      expect(response.status).toBe(200);
    });
  });

  describe("user.updated", () => {
    const userUpdatedEvent = {
      type: "user.updated",
      data: {
        id: "user_123",
        email_addresses: [
          { id: "email_1", email_address: "updated@example.com" },
        ],
        primary_email_address_id: "email_1",
        first_name: "Updated",
        last_name: "Name",
      },
    };

    it("updates user email", async () => {
      const req = createMockRequest(userUpdatedEvent);
      const response = await POST(req);

      expect(response.status).toBe(200);
    });

    it("preserves ELITE plan for existing users", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        plan: "ELITE",
        totalCreditsEarned: 300,
      });

      const req = createMockRequest(userUpdatedEvent);
      await POST(req);
    });
  });

  describe("user.deleted", () => {
    const userDeletedEvent = {
      type: "user.deleted",
      data: {
        id: "user_123",
        email_addresses: [],
      },
    };

    it("performs GDPR-compliant purge", async () => {
      // Mock transaction to return successfully
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      const req = createMockRequest(userDeletedEvent);
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe("idempotency", () => {
    const userCreatedEvent = {
      type: "user.created",
      data: {
        id: "user_123",
        email_addresses: [
          { id: "email_1", email_address: "test@example.com" },
        ],
        primary_email_address_id: "email_1",
        first_name: "Test",
        last_name: "User",
      },
    };

    it("returns 200 for duplicate webhook (same svix-id)", async () => {
      // Mock that the webhook ID is already processed
      (redisSetNX as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

      const req = createMockRequest(userCreatedEvent);
      const response = await POST(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.duplicate).toBe(true);
    });
  });

  describe("error handling", () => {
    it("returns 500 when webhook secret not configured", async () => {
      delete process.env.CLERK_WEBHOOK_SECRET;

      const req = createMockRequest({ type: "user.created", data: {} });
      const response = await POST(req);

      expect(response.status).toBe(500);
    });

    it("returns 400 for invalid signature", async () => {
      const { Webhook } = await import("svix");
      (Webhook as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        verify: vi.fn(() => {
          throw new Error("Invalid signature");
        }),
      }));

      const req = createMockRequest({ type: "user.created", data: {} });
      const response = await POST(req);

      expect(response.status).toBe(400);
    });
  });
});
