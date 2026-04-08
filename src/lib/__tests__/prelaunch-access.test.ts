/**
 * @vitest-environment node
 *
 * Unit tests for redeemPrelaunchCoupon and getPrelaunchAccessStatus.
 * Covers: hardcoded coupons, DB promo happy path, maxUses exhaustion (TOCTOU),
 * already-paid short-circuit, expired codes, and invalid codes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const mockEnsureUserExists = vi.fn();
vi.mock("@/lib/utils/ensure-user", () => ({
  ensureUserExists: mockEnsureUserExists,
}));

const mockGetUserPlan = vi.fn();
const mockInvalidatePlanCache = vi.fn();
vi.mock("@/lib/middleware/plan-gate", () => ({
  getUserPlan: mockGetUserPlan,
  invalidatePlanCache: mockInvalidatePlanCache,
}));

const mockGrantCreditsInTransaction = vi.fn();
vi.mock("@/lib/services/credit.service", () => ({
  grantCreditsInTransaction: mockGrantCreditsInTransaction,
}));

// Hardcoded prelaunch config — keep ELITE15 / ELITE30 as valid
vi.mock("@/lib/config/prelaunch", () => ({
  normalizePrelaunchCoupon: (code?: string | null) => {
    if (!code) return null;
    return code.trim().toUpperCase().replace(/\s+/g, "") || null;
  },
  isAllowedPrelaunchCoupon: (code?: string | null) =>
    code === "ELITE15" || code === "ELITE30",
  PRELAUNCH_TRIAL_DAYS: 30,
}));

// Prisma mock — tx callback form
const mockTx = {
  userPreference: { findUnique: vi.fn(), upsert: vi.fn() },
  promoCode: { findUnique: vi.fn(), update: vi.fn() },
  creditTransaction: { findFirst: vi.fn() },
  user: { update: vi.fn() },
};

const mockPrisma = {
  promoCode: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDbPromo(overrides: Record<string, unknown> = {}) {
  return {
    id: "promo_db_1",
    isActive: true,
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    durationDays: 14,
    bonusCredits: 200,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("redeemPrelaunchCoupon", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEnsureUserExists.mockResolvedValue(undefined);
    mockGetUserPlan.mockResolvedValue("STARTER");
    mockInvalidatePlanCache.mockResolvedValue(undefined);
    mockGrantCreditsInTransaction.mockResolvedValue(500);

    // Default: tx callback runs successfully
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );
    mockTx.userPreference.findUnique.mockResolvedValue(null);
    mockTx.userPreference.upsert.mockResolvedValue({});
    mockTx.promoCode.findUnique.mockResolvedValue(null);
    mockTx.promoCode.update.mockResolvedValue({});
    mockTx.user.update.mockResolvedValue({});
    mockPrisma.promoCode.findUnique.mockResolvedValue(null);
  });

  it("returns error for empty / null coupon code", async () => {
    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    const res = await redeemPrelaunchCoupon("user_1", "");
    expect(res.success).toBe(false);
    expect((res as { error: string }).error).toMatch(/not found/i);
  });

  it("short-circuits with success when user is already on a paid plan", async () => {
    mockGetUserPlan.mockResolvedValue("ELITE");
    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    const res = await redeemPrelaunchCoupon("user_1", "ELITE15");
    expect(res.success).toBe(true);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockInvalidatePlanCache).toHaveBeenCalledWith("user_1");
  });

  it("accepts a hardcoded prelaunch coupon (ELITE15) without touching DB promo table", async () => {
    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    const res = await redeemPrelaunchCoupon("user_1", "ELITE15");
    expect(res.success).toBe(true);
    // Pre-flight DB lookup is skipped for hardcoded coupons
    expect(mockPrisma.promoCode.findUnique).not.toHaveBeenCalled();
    // tx.promoCode.findUnique is also skipped (isHardcodedPromo path)
    expect(mockTx.promoCode.findUnique).not.toHaveBeenCalled();
    expect(mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: "ELITE" }) }),
    );
    expect(mockInvalidatePlanCache).toHaveBeenCalledWith("user_1");
  });

  it("accepts a hardcoded prelaunch coupon (ELITE30)", async () => {
    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    const res = await redeemPrelaunchCoupon("user_1", "ELITE30");
    expect(res.success).toBe(true);
    expect(mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: "ELITE" }) }),
    );
  });

  it("uses PRELAUNCH_TRIAL_DAYS (30) for hardcoded coupon trial duration", async () => {
    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    await redeemPrelaunchCoupon("user_1", "ELITE15");
    const updateCall = mockTx.user.update.mock.calls[0][0] as { data: { trialEndsAt: Date } };
    const trialEndsAt = updateCall.data.trialEndsAt;
    const daysFromNow = Math.round((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    expect(daysFromNow).toBeGreaterThanOrEqual(29);
    expect(daysFromNow).toBeLessThanOrEqual(31);
  });

  it("accepts a valid DB promo code and increments usedCount inside the tx", async () => {
    const promo = makeDbPromo();
    mockPrisma.promoCode.findUnique.mockResolvedValue(promo);
    mockTx.promoCode.findUnique.mockResolvedValue(promo);

    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    const res = await redeemPrelaunchCoupon("user_1", "DBCODE1");
    expect(res.success).toBe(true);
    expect(mockTx.promoCode.update).toHaveBeenCalledWith({
      where: { id: "promo_db_1" },
      data: { usedCount: { increment: 1 } },
    });
    expect(mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: "ELITE" }) }),
    );
  });

  it("uses DB promo durationDays for the trial period", async () => {
    const promo = makeDbPromo({ durationDays: 14 });
    mockPrisma.promoCode.findUnique.mockResolvedValue(promo);
    mockTx.promoCode.findUnique.mockResolvedValue(promo);

    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    await redeemPrelaunchCoupon("user_1", "DBCODE1");
    const updateCall = mockTx.user.update.mock.calls[0][0] as { data: { trialEndsAt: Date } };
    const daysFromNow = Math.round(
      (updateCall.data.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    expect(daysFromNow).toBeGreaterThanOrEqual(13);
    expect(daysFromNow).toBeLessThanOrEqual(15);
  });

  it("returns error when DB promo pre-flight finds no promo (unknown code)", async () => {
    mockPrisma.promoCode.findUnique.mockResolvedValue(null);
    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    const res = await redeemPrelaunchCoupon("user_1", "UNKNOWN123");
    expect(res.success).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns error when DB promo is inactive (pre-flight)", async () => {
    mockPrisma.promoCode.findUnique.mockResolvedValue(makeDbPromo({ isActive: false }));
    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    const res = await redeemPrelaunchCoupon("user_1", "INACTIVE");
    expect(res.success).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns error when DB promo is expired (pre-flight)", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mockPrisma.promoCode.findUnique.mockResolvedValue(makeDbPromo({ expiresAt: past }));
    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    const res = await redeemPrelaunchCoupon("user_1", "EXPIRED");
    expect(res.success).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns error (TOCTOU) when maxUses is reached inside the transaction", async () => {
    // Pre-flight passes (usedCount=0, maxUses=1)
    mockPrisma.promoCode.findUnique.mockResolvedValue(makeDbPromo({ maxUses: 1, usedCount: 0 }));
    // Inside tx: re-fetch shows usedCount already at maxUses (race happened)
    mockTx.promoCode.findUnique.mockResolvedValue(makeDbPromo({ maxUses: 1, usedCount: 1 }));

    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    const res = await redeemPrelaunchCoupon("user_1", "RACEDBCODE");
    expect(res.success).toBe(false);
    // Ensure usedCount was NOT incremented
    expect(mockTx.promoCode.update).not.toHaveBeenCalled();
    // Ensure user was NOT upgraded
    expect(mockTx.user.update).not.toHaveBeenCalled();
  });

  it("succeeds when usedCount is below maxUses (no race)", async () => {
    const promo = makeDbPromo({ maxUses: 5, usedCount: 3 });
    mockPrisma.promoCode.findUnique.mockResolvedValue(promo);
    mockTx.promoCode.findUnique.mockResolvedValue(promo);

    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    const res = await redeemPrelaunchCoupon("user_1", "LIMITED");
    expect(res.success).toBe(true);
    expect(mockTx.promoCode.update).toHaveBeenCalledWith({
      where: { id: "promo_db_1" },
      data: { usedCount: { increment: 1 } },
    });
  });

  it("preserves onboarding state for users who have already completed onboarding", async () => {
    const promo = makeDbPromo();
    mockPrisma.promoCode.findUnique.mockResolvedValue(promo);
    mockTx.promoCode.findUnique.mockResolvedValue(promo);
    mockTx.userPreference.findUnique.mockResolvedValue({ onboardingCompleted: true });

    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    await redeemPrelaunchCoupon("user_1", "DBCODE1");

    const upsertCall = mockTx.userPreference.upsert.mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    // update should be empty — preserve existing state
    expect(Object.keys(upsertCall.update)).toHaveLength(0);
  });

  it("resets onboarding for users who have NOT completed onboarding", async () => {
    const promo = makeDbPromo();
    mockPrisma.promoCode.findUnique.mockResolvedValue(promo);
    mockTx.promoCode.findUnique.mockResolvedValue(promo);
    mockTx.userPreference.findUnique.mockResolvedValue({ onboardingCompleted: false });

    const { redeemPrelaunchCoupon } = await import("@/lib/prelaunch-access");
    await redeemPrelaunchCoupon("user_1", "DBCODE1");

    const upsertCall = mockTx.userPreference.upsert.mock.calls[0][0] as {
      update: { onboardingStep: number };
    };
    expect(upsertCall.update.onboardingStep).toBe(0);
  });
});

// ── getPrelaunchAccessStatus ──────────────────────────────────────────────────

describe("getPrelaunchAccessStatus", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEnsureUserExists.mockResolvedValue(undefined);
  });

  it("returns entitled=true for ELITE plan", async () => {
    mockGetUserPlan.mockResolvedValue("ELITE");
    const { getPrelaunchAccessStatus } = await import("@/lib/prelaunch-access");
    const status = await getPrelaunchAccessStatus("user_1");
    expect(status.entitled).toBe(true);
    expect(status.requiresCoupon).toBe(false);
    expect(status.plan).toBe("ELITE");
  });

  it("returns entitled=false for STARTER plan", async () => {
    mockGetUserPlan.mockResolvedValue("STARTER");
    const { getPrelaunchAccessStatus } = await import("@/lib/prelaunch-access");
    const status = await getPrelaunchAccessStatus("user_1");
    expect(status.entitled).toBe(false);
    expect(status.requiresCoupon).toBe(true);
  });

  it("returns entitled=true for PRO plan", async () => {
    mockGetUserPlan.mockResolvedValue("PRO");
    const { getPrelaunchAccessStatus } = await import("@/lib/prelaunch-access");
    const status = await getPrelaunchAccessStatus("user_1");
    expect(status.entitled).toBe(true);
  });

  it("returns entitled=true for ENTERPRISE plan", async () => {
    mockGetUserPlan.mockResolvedValue("ENTERPRISE");
    const { getPrelaunchAccessStatus } = await import("@/lib/prelaunch-access");
    const status = await getPrelaunchAccessStatus("user_1");
    expect(status.entitled).toBe(true);
  });
});
