/**
 * @vitest-environment node
 *
 * Tests for the Clerk webhook route — signature verification, user.created
 * (coupon flow, admin elevation, TOCTOU maxUses race, idempotency),
 * user.updated, user.deleted GDPR purge.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGrantCreditsInTransaction = vi.fn();

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
  $executeRaw: vi.fn(),
  promoCode: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  user: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  aIRequestLog: { deleteMany: vi.fn() },
  watchlistItem: { deleteMany: vi.fn() },
  portfolio: { deleteMany: vi.fn() },
  userPreference: { deleteMany: vi.fn(), upsert: vi.fn() },
  creditTransaction: { create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
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
  grantCreditsInTransaction: mockGrantCreditsInTransaction,
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

// Makes the $transaction mock run an interactive callback with a tx proxy that
// includes $executeRaw. This matches the new TOCTOU-safe transaction shape.
function setupTransactionWithTx(txOverrides: Partial<typeof mockPrisma> = {}) {
  const tx = { ...mockPrisma, ...txOverrides };
  mockPrisma.$transaction.mockImplementation(
    async (fn: unknown) => {
      if (typeof fn === "function") return (fn as (tx: typeof mockPrisma) => Promise<unknown>)(tx);
      // Array form (user.deleted)
      return Promise.resolve([]);
    },
  );
  return tx;
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

    // Default: interactive callback tx
    setupTransactionWithTx();

    mockPrisma.user.upsert.mockResolvedValue({ id: "user_abc", plan: "STARTER" });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.promoCode.findUnique.mockResolvedValue(null);
    mockPrisma.creditTransaction.findFirst.mockResolvedValue(null);
    mockPrisma.creditTransaction.create.mockResolvedValue({});
    mockPrisma.userPreference.upsert.mockResolvedValue({});
    mockPrisma.$executeRaw.mockResolvedValue(1); // 1 row updated = success
    mockGrantCreditsInTransaction.mockResolvedValue(0);
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

  // ── user.created — no coupon ───────────────────────────────────────────────

  it("creates a STARTER user when user.created has no coupon", async () => {
    const event = makeUserEvent("user.created");
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "STARTER" }),
      }),
    );
  });

  // ── user.created — admin elevation ────────────────────────────────────────

  it("elevates admin email to ELITE plan on user.created", async () => {
    const event = makeUserEvent("user.created", {
      email_addresses: [{ id: "ea_1", email_address: "admin@lyraalpha.com" }],
    });
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "ELITE" }),
      }),
    );
  });

  // ── user.created — hardcoded prelaunch coupon ──────────────────────────────

  it("applies ELITE15 hardcoded coupon — skips DB promo lookup", async () => {
    const event = makeUserEvent("user.created", {
      unsafe_metadata: { coupon_code: "ELITE15" },
    });
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    // isAllowedPrelaunchCoupon path — DB promo pre-flight should not be called
    expect(mockPrisma.promoCode.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "ELITE" }),
      }),
    );
  });

  it("grants 500 credits with ADJUSTMENT type for ELITE15 coupon", async () => {
    const event = makeUserEvent("user.created", {
      unsafe_metadata: { coupon_code: "ELITE15" },
    });
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    await POST(makeRequest(event));
    expect(mockGrantCreditsInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      "user_abc",
      500,
      "ADJUSTMENT",
      expect.stringContaining("ELITE15"),
      expect.any(String),
    );
  });

  it("does NOT grant credits when credit was already granted (idempotency)", async () => {
    const event = makeUserEvent("user.created", {
      unsafe_metadata: { coupon_code: "ELITE15" },
    });
    mockVerify.mockReturnValue(event);
    // Simulate existing credit transaction
    mockPrisma.creditTransaction.findFirst.mockResolvedValue({ id: "existing_tx" });
    const { POST } = await import("./route");
    await POST(makeRequest(event));
    expect(mockGrantCreditsInTransaction).not.toHaveBeenCalled();
  });

  // ── user.created — DB promo code ──────────────────────────────────────────

  it("applies a valid DB promo code and runs $executeRaw atomically", async () => {
    const promo = {
      id: "promo_db_1",
      isActive: true,
      expiresAt: null,
      durationDays: 30,
      bonusCredits: 300,
    };
    mockPrisma.promoCode.findUnique.mockResolvedValue(promo);
    mockPrisma.$executeRaw.mockResolvedValue(1);

    const event = makeUserEvent("user.created", {
      unsafe_metadata: { coupon_code: "DBCODE1" },
    });
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "ELITE" }),
      }),
    );
  });

  it("grants DB promo bonusCredits with ADJUSTMENT type", async () => {
    const promo = {
      id: "promo_db_1",
      isActive: true,
      expiresAt: null,
      durationDays: 14,
      bonusCredits: 200,
    };
    mockPrisma.promoCode.findUnique.mockResolvedValue(promo);
    mockPrisma.$executeRaw.mockResolvedValue(1);

    const event = makeUserEvent("user.created", {
      unsafe_metadata: { coupon_code: "DBCODE1" },
    });
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    await POST(makeRequest(event));
    expect(mockGrantCreditsInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      "user_abc",
      200,
      "ADJUSTMENT",
      expect.any(String),
      expect.any(String),
    );
  });

  it("rolls back and returns 500 when $executeRaw returns 0 (TOCTOU: maxUses exhausted in race)", async () => {
    const promo = {
      id: "promo_db_1",
      isActive: true,
      expiresAt: null,
      durationDays: 30,
      bonusCredits: 100,
    };
    mockPrisma.promoCode.findUnique.mockResolvedValue(promo);
    // $executeRaw returns 0 — another request consumed the last use concurrently
    mockPrisma.$executeRaw.mockResolvedValue(0);
    // Simulate the throw propagating out of the tx callback → $transaction rethrows
    mockPrisma.$transaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === "function") {
        const tx = {
          ...mockPrisma,
          $executeRaw: vi.fn().mockResolvedValue(0),
          creditTransaction: { findFirst: vi.fn().mockResolvedValue(null) },
        };
        // Run fn and let it throw PROMO_EXHAUSTED
        return (fn as (client: unknown) => Promise<unknown>)(tx);
      }
      return [];
    });

    const event = makeUserEvent("user.created", {
      unsafe_metadata: { coupon_code: "RACEDBCODE" },
    });
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    // Handler catches the thrown error and returns 500
    expect(res.status).toBe(500);
    // User must NOT have been upgraded
    expect(mockPrisma.user.upsert).not.toHaveBeenCalled();
  });

  it("creates STARTER user when DB promo code is inactive (pre-flight)", async () => {
    mockPrisma.promoCode.findUnique.mockResolvedValue({
      id: "promo_bad",
      isActive: false,
      expiresAt: null,
      durationDays: 30,
      bonusCredits: 50,
    });
    const event = makeUserEvent("user.created", {
      unsafe_metadata: { coupon_code: "INACTIVECODE" },
    });
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "STARTER" }),
      }),
    );
    // No atomic increment attempted
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("creates STARTER user when DB promo code is expired (pre-flight)", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mockPrisma.promoCode.findUnique.mockResolvedValue({
      id: "promo_exp",
      isActive: true,
      expiresAt: past,
      durationDays: 30,
      bonusCredits: 50,
    });
    const event = makeUserEvent("user.created", {
      unsafe_metadata: { coupon_code: "EXPIREDCODE" },
    });
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "STARTER" }),
      }),
    );
  });

  it("creates STARTER user for a completely unknown coupon code", async () => {
    mockPrisma.promoCode.findUnique.mockResolvedValue(null);
    const event = makeUserEvent("user.created", {
      unsafe_metadata: { coupon_code: "TOTALLYUNKNOWN" },
    });
    mockVerify.mockReturnValue(event);
    const { POST } = await import("./route");
    const res = await POST(makeRequest(event));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan: "STARTER" }),
      }),
    );
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
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
