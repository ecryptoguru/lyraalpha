/**
 * @vitest-environment node
 *
 * Tests for the Clerk webhook route — signature verification, user.created
 * (admin elevation), user.updated, user.deleted GDPR purge.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@/lib/logger/utils", () => ({
  sanitizeError: (e: unknown) => e,
}));

const mockVerify = vi.fn();
const mockWebhookConstructor = vi.fn();
vi.mock("svix", () => ({
  Webhook: mockWebhookConstructor,
}));

const mockHeadersFn = vi.fn();
vi.mock("next/headers", () => ({
  headers: mockHeadersFn,
}));

const mockDeleteUser = vi.fn();
const mockClerkClient = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: mockClerkClient,
}));

function restoreHeadersMock() {
  mockHeadersFn.mockResolvedValue({
    get: (key: string) => {
      const map: Record<string, string> = {
        "svix-id": "svix_id_test",
        "svix-timestamp": "1700000000",
        "svix-signature": "v1,abc123",
      };
      return map[key] ?? null;
    },
  });
}

const mockPrisma = {
  $transaction: vi.fn(),
  user: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  aIRequestLog: { deleteMany: vi.fn() },
  lyraFeedback: { deleteMany: vi.fn() },
  userMemoryNote: { deleteMany: vi.fn() },
  watchlistItem: { deleteMany: vi.fn() },
  portfolio: { deleteMany: vi.fn() },
  userPreference: { deleteMany: vi.fn(), upsert: vi.fn() },
  notification: { deleteMany: vi.fn() },
  creditTransaction: { deleteMany: vi.fn() },
  creditLot: { deleteMany: vi.fn() },
  subscription: { deleteMany: vi.fn() },
  billingAuditLog: { deleteMany: vi.fn() },
  paymentEvent: { deleteMany: vi.fn() },
  pointTransaction: { deleteMany: vi.fn() },
  userProgress: { deleteMany: vi.fn() },
  userBadge: { deleteMany: vi.fn() },
  xPTransaction: { deleteMany: vi.fn() },
  xPRedemption: { deleteMany: vi.fn() },
  learningCompletion: { deleteMany: vi.fn() },
  userSession: { deleteMany: vi.fn() },
  userActivityEvent: { deleteMany: vi.fn() },
  referral: { deleteMany: vi.fn() },
  supportMessage: { deleteMany: vi.fn() },
  supportConversation: { deleteMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockUpsertBrevoContact = vi.fn();
const mockSendBrevoEmail = vi.fn();
vi.mock("@/lib/email/brevo", () => ({
  upsertBrevoContact: mockUpsertBrevoContact,
  sendBrevoEmail: mockSendBrevoEmail,
}));
vi.mock("@/lib/email/templates", () => ({
  buildWelcomeEmail: vi.fn(() => ({ subject: "Welcome", html: "<p>Hi</p>", text: "Hi" })),
}));
vi.mock("@/lib/middleware/plan-gate", () => ({
  invalidatePlanCache: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  isPrivilegedEmail: vi.fn((email: string) => email.endsWith("@lyraalpha.com")),
}));
vi.mock("@/lib/services/credit.service", () => ({
  grantCreditsInTransaction: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: object): Request {
  return new Request("https://example.com/api/webhooks/clerk", {
    method: "POST",
    headers: {
      "svix-id": "svix_id_test",
      "svix-timestamp": "1700000000",
      "svix-signature": "v1,abc123",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function makeUserEvent(type: string, overrides: Record<string, unknown> = {}) {
  return {
    type,
    data: {
      id: "user_abc",
      email_addresses: [{ id: "ea_1", email_address: "test@example.com" }],
      primary_email_address_id: "ea_1",
      first_name: "Test",
      last_name: "User",
      unsafe_metadata: {},
      ...overrides,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/clerk", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    restoreHeadersMock();
    mockWebhookConstructor.mockImplementation(() => ({ verify: mockVerify }));
    process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
    mockDeleteUser.mockResolvedValue(undefined);
    mockClerkClient.mockResolvedValue({ users: { deleteUser: mockDeleteUser } });
    mockUpsertBrevoContact.mockResolvedValue(undefined);
    mockSendBrevoEmail.mockResolvedValue(true);

    mockPrisma.user.upsert.mockResolvedValue({ id: "user_abc", plan: "STARTER" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.userPreference.upsert.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((arg: unknown) => {
      // Array form (GDPR deletion) — just resolve
      if (Array.isArray(arg)) return Promise.resolve([]);
      // Callback form (credit grant) — execute the callback with a mock tx
      if (typeof arg === "function") return arg(mockPrisma);
      return Promise.resolve([]);
    });
  });

  // ── Signature / config guards ──────────────────────────────────────────────

  it("returns 500 when CLERK_WEBHOOK_SECRET is not set", async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(500);
  });

  it("returns 400 when webhook verification fails", async () => {
    mockVerify.mockImplementation(() => { throw new Error("bad signature"); });
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 200 and does not crash for unhandled event types", async () => {
    const event = { type: "session.created", data: { id: "sess_1" } };
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
  });

  // ── user.created ─────────────────────────────────────────────────────────────

  it("creates an ELITE user with zero balances on user.created (credits granted via transaction)", async () => {
    const event = makeUserEvent("user.created");
    mockVerify.mockReturnValue(event);
    mockPrisma.user.findUnique.mockResolvedValue({ totalCreditsEarned: 0 });
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "ELITE", credits: 0, bonusCreditsBalance: 0 }),
      }),
    );
  });

  it("grants 300 signup bonus credits on user.created", async () => {
    const event = makeUserEvent("user.created");
    mockVerify.mockReturnValue(event);
    mockPrisma.user.findUnique.mockResolvedValue({ totalCreditsEarned: 0 });
    const { grantCreditsInTransaction } = await import("@/lib/services/credit.service");
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(grantCreditsInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      "user_abc",
      300,
      expect.anything(),
      "Beta sign-up bonus — welcome to LyraAlpha!",
      "signup-bonus:user_abc",
      { countTowardEarned: true },
    );
  });

  it("does not double-grant signup bonus if totalCreditsEarned > 0", async () => {
    const event = makeUserEvent("user.created");
    mockVerify.mockReturnValue(event);
    mockPrisma.user.findUnique.mockResolvedValue({ totalCreditsEarned: 300 });
    const { grantCreditsInTransaction } = await import("@/lib/services/credit.service");
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(grantCreditsInTransaction).not.toHaveBeenCalled();
  });

  // ── user.created — admin elevation ────────────────────────────────────────

  it("admin email also gets ELITE plan on user.created", async () => {
    const event = makeUserEvent("user.created", {
      email_addresses: [{ id: "ea_1", email_address: "admin@lyraalpha.com" }],
    });
    mockVerify.mockReturnValue(event);
    mockPrisma.user.findUnique.mockResolvedValue({ totalCreditsEarned: 0 });
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "ELITE", credits: 0 }),
      }),
    );
  });

  it("sends welcome email on user.created", async () => {
    const event = makeUserEvent("user.created", {
      first_name: "John",
      last_name: "Doe",
    });
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    await POST(makeRequest(event));
    expect(mockUpsertBrevoContact).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      })
    );
    expect(mockSendBrevoEmail).toHaveBeenCalled();
  });

  it("creates user preferences on user.created", async () => {
    const event = makeUserEvent("user.created");
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    await POST(makeRequest(event));
    expect(mockPrisma.userPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user_abc",
          preferredRegion: "US",
          experienceLevel: "BEGINNER",
          interests: ["CRYPTO"],
          onboardingCompleted: false,
          blogSubscribed: true,
        }),
      })
    );
  });

  // ── user.deleted — GDPR purge ─────────────────────────────────────────────

  it("purges all user data in a transaction on user.deleted", async () => {
    const event = makeUserEvent("user.deleted");
    mockVerify.mockReturnValue(event);
    // user.deleted uses array-form $transaction
    mockPrisma.$transaction.mockResolvedValue([]);
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  // ── user.updated ──────────────────────────────────────────────────────────

  it("handles user.updated and does not crash", async () => {
    const event = makeUserEvent("user.updated");
    mockVerify.mockReturnValue(event);
    mockPrisma.user.findUnique.mockResolvedValue({ plan: "STARTER", totalCreditsEarned: 300 });
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
  });

  it("does not downgrade an already-ELITE user on user.updated", async () => {
    const event = makeUserEvent("user.updated");
    mockVerify.mockReturnValue(event);
    mockPrisma.user.findUnique.mockResolvedValue({ plan: "ELITE", totalCreditsEarned: 300 });
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    // Update object should not set plan: "STARTER"
    const upsertCall = mockPrisma.user.upsert.mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    expect(upsertCall.update.plan).not.toBe("STARTER");
  });

  it("grants signup bonus on user.updated when user doesn't exist (out-of-order webhook)", async () => {
    const event = makeUserEvent("user.updated");
    mockVerify.mockReturnValue(event);
    // First findUnique returns null (user doesn't exist yet), second returns { totalCreditsEarned: 0 }
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // pre-check
      .mockResolvedValueOnce({ totalCreditsEarned: 0 }); // inside tx
    const { grantCreditsInTransaction } = await import("@/lib/services/credit.service");
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(grantCreditsInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      "user_abc",
      300,
      expect.anything(),
      "Beta sign-up bonus — welcome to LyraAlpha!",
      "signup-bonus:user_abc",
      { countTowardEarned: true },
    );
  });
});
