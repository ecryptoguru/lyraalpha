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
  watchlistItem: { deleteMany: vi.fn() },
  portfolio: { deleteMany: vi.fn() },
  userPreference: { deleteMany: vi.fn(), upsert: vi.fn() },
  creditTransaction: { deleteMany: vi.fn() },
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
    mockPrisma.$transaction.mockResolvedValue([]);
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

  it("creates an ELITE user with 500 bonus credits on user.created", async () => {
    const event = makeUserEvent("user.created");
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "ELITE", credits: 500, bonusCreditsBalance: 500 }),
      }),
    );
  });

  // ── user.created — admin elevation ────────────────────────────────────────

  it("admin email also gets ELITE plan + 500 bonus credits on user.created", async () => {
    const event = makeUserEvent("user.created", {
      email_addresses: [{ id: "ea_1", email_address: "admin@lyraalpha.com" }],
    });
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "ELITE", credits: 500 }),
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
    mockPrisma.user.findUnique.mockResolvedValue({ plan: "STARTER" });
    mockPrisma.user.upsert.mockResolvedValue({ id: "user_abc", plan: "STARTER" });
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
  });

  it("does not downgrade an already-ELITE user on user.updated", async () => {
    const event = makeUserEvent("user.updated");
    mockVerify.mockReturnValue(event);
    mockPrisma.user.findUnique.mockResolvedValue({ plan: "ELITE" });
    mockPrisma.user.upsert.mockResolvedValue({ id: "user_abc", plan: "ELITE" });
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    // Update object should not set plan: "STARTER"
    const upsertCall = mockPrisma.user.upsert.mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    expect(upsertCall.update.plan).not.toBe("STARTER");
  });
});
