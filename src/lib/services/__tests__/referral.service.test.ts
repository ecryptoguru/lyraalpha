/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, creditMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findFirst: vi.fn(), findUnique: vi.fn() },
    referral: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  creditMock: { grantCreditsInTransaction: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));
vi.mock("@/lib/logger/utils", () => ({ sanitizeError: (e: unknown) => String(e) }));
vi.mock("@/lib/services/credit.service", () => ({ grantCreditsInTransaction: (...args: unknown[]) => creditMock.grantCreditsInTransaction(...args) }));

import {
  createReferralCode, getReferralStats, trackReferralClick, createReferral,
  activateReferral, getReferralLink,
} from "../referral.service";

describe("createReferralCode", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns existing code prefix when referral exists", async () => {
    prismaMock.referral.findFirst.mockResolvedValue({ id: "ref_1" });
    const result = await createReferralCode("user_abc123xyz");
    // slice(0, 8) of "user_abc123xyz" is "user_abc" -> "USER_ABC"
    expect(result).toBe("USER_ABC");
  });

  it("returns deterministic prefix code when no existing referral", async () => {
    prismaMock.referral.findFirst.mockResolvedValue(null);
    const result = await createReferralCode("user_abc123");
    // Always returns userId prefix for deterministic lookup in trackReferralClick
    expect(result).toBe("USER_ABC");
  });
});

describe("getReferralStats", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("calculates referral statistics correctly", async () => {
    prismaMock.referral.findMany.mockResolvedValue([
      { id: "r1", status: "ACTIVATED", refereeCreditsAwarded: true, referrerCreditsAwarded: true, createdAt: new Date(), activatedAt: new Date() },
      { id: "r2", status: "PENDING", refereeCreditsAwarded: false, referrerCreditsAwarded: false, createdAt: new Date(), activatedAt: null },
      { id: "r3", status: "COMPLETED", refereeCreditsAwarded: true, referrerCreditsAwarded: true, createdAt: new Date(), activatedAt: new Date() },
    ]);

    const result = await getReferralStats("user_123");

    expect(result.totalReferrals).toBe(3);
    expect(result.activatedReferrals).toBe(2);
    expect(result.pendingReferrals).toBe(1);
    expect(result.totalCreditsEarned).toBe(150);
    expect(result.currentTier).toBe("bronze");
    expect(result.nextTier?.badge).toBe("silver");
    expect(result.nextTier?.referralsNeeded).toBe(1);
  });

  it("returns platinum tier for high referral counts", async () => {
    prismaMock.referral.findMany.mockResolvedValue(
      Array(30).fill(null).map((_, i) => ({
        id: `r${i}`, status: i < 25 ? "ACTIVATED" : "PENDING",
        refereeCreditsAwarded: true, referrerCreditsAwarded: i < 25,
        createdAt: new Date(), activatedAt: i < 25 ? new Date() : null,
      }))
    );

    const result = await getReferralStats("user_pro");

    expect(result.currentTier).toBe("platinum");
    expect(result.nextTier).toBeNull();
  });

  it("returns none tier for zero referrals", async () => {
    prismaMock.referral.findMany.mockResolvedValue([]);
    const result = await getReferralStats("user_new");
    expect(result.currentTier).toBe("none");
    expect(result.nextTier?.badge).toBe("bronze");
    expect(result.nextTier?.referralsNeeded).toBe(1);
  });
});

describe("trackReferralClick", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns user ID for valid referral code", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "user_abc123xyz" });
    const result = await trackReferralClick("USER_ABC");
    expect(result).toBe("user_abc123xyz");
  });

  it("returns null for invalid referral code", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    const result = await trackReferralClick("INVALID");
    expect(result).toBeNull();
  });
});

describe("createReferral", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns existing referral code when referral already exists", async () => {
    prismaMock.referral.findUnique.mockResolvedValue({ id: "existing" });
    const result = await createReferral("referrer_1", "referee_1");
    expect(result.success).toBe(true);
    expect(result.referralCode).toBe("REFERRER"); // slice(0, 8) of "referrer_1" is "referrer" -> "REFERRER"
    expect(prismaMock.referral.create).not.toHaveBeenCalled();
  });

  it("creates new referral when not exists", async () => {
    prismaMock.referral.findUnique.mockResolvedValue(null);
    prismaMock.referral.create.mockResolvedValue({ id: "new_ref" });
    const result = await createReferral("referrer_1", "referee_1");
    expect(result.success).toBe(true);
    expect(prismaMock.referral.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ referrerId: "referrer_1", refereeId: "referee_1", status: "PENDING" }),
    }));
  });

  it("returns error on creation failure", async () => {
    prismaMock.referral.findUnique.mockResolvedValue(null);
    prismaMock.referral.create.mockRejectedValue(new Error("DB error"));
    const result = await createReferral("referrer_1", "referee_1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to create referral");
  });
});

describe("activateReferral", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns false when no pending referral found", async () => {
    prismaMock.referral.findFirst.mockResolvedValue(null);
    const result = await activateReferral("referee_1");
    expect(result.success).toBe(false);
    expect(result.creditsAwarded).toBe(0);
  });

  it("awards signup bonus to referee", async () => {
    prismaMock.referral.findFirst.mockResolvedValue({
      id: "ref_1", referrerId: "ref_1", refereeCreditsAwarded: false, referrerCreditsAwarded: false,
      referrer: { email: "ref@test.com" },
    });
    prismaMock.user.findUnique.mockResolvedValue({ totalCreditsSpent: 0 });
    creditMock.grantCreditsInTransaction.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      // Mock the transaction object
      const mockTx = {
        referral: { update: vi.fn().mockResolvedValue({}) }
      };
      return cb(mockTx);
    });

    const result = await activateReferral("referee_1");
    expect(result.success).toBe(true);
    expect(result.creditsAwarded).toBe(50);
  });

  it("does not double-award referee bonus", async () => {
    prismaMock.referral.findFirst.mockResolvedValue({
      id: "ref_1", referrerId: "ref_1", refereeCreditsAwarded: true, referrerCreditsAwarded: false,
      referrer: { email: "ref@test.com" },
    });
    prismaMock.user.findUnique.mockResolvedValue({ totalCreditsSpent: 100 });
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({}));

    await activateReferral("referee_1");
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("activates and awards referrer when threshold met", async () => {
    prismaMock.referral.findFirst.mockResolvedValue({
      id: "ref_1", referrerId: "ref_1", refereeCreditsAwarded: false, referrerCreditsAwarded: false,
      referrer: { email: "ref@test.com" },
    });
    prismaMock.user.findUnique.mockResolvedValue({ totalCreditsSpent: 15 });
    creditMock.grantCreditsInTransaction.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        referral: { update: vi.fn().mockResolvedValue({}) }
      };
      return cb(mockTx);
    });

    const result = await activateReferral("referee_1");
    expect(result.success).toBe(true);
  });

  it("handles database errors gracefully", async () => {
    prismaMock.referral.findFirst.mockRejectedValue(new Error("DB error"));
    const result = await activateReferral("referee_1");
    expect(result.success).toBe(false);
    expect(result.creditsAwarded).toBe(0);
  });
});

describe("getReferralLink", () => {
  it("generates correct referral link", () => {
    const result = getReferralLink("ABC123", "https://lyraalpha.ai");
    expect(result).toBe("https://lyraalpha.ai/ref/ABC123");
  });

  it("uses default base URL when not provided", () => {
    const result = getReferralLink("ABC123");
    expect(result).toBe("https://lyraalpha.ai/ref/ABC123");
  });
});
