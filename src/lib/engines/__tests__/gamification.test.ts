/**
 * @vitest-environment node
 *
 * Tests for the unified gamification engine (XP, badges, redemptions).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGrantCreditsInTransaction } = vi.hoisted(() => ({
  mockGrantCreditsInTransaction: vi.fn(),
}));

const { mockTx } = vi.hoisted(() => ({
  mockTx: {
    userProgress: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    xPTransaction: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    userBadge: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    xPRedemption: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    creditTransaction: {
      create: vi.fn(),
    },
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...mockTx,
    $transaction: vi.fn(async (cb) => cb(mockTx)),
  },
}));

vi.mock("@/lib/services/credit.service", () => ({
  grantCreditsInTransaction: mockGrantCreditsInTransaction,
}));

import {
  awardXP,
  redeemXP,
  computeLevel,
  getXPMultiplierForLevel,
  canGenerateReferral,
} from "../gamification";

describe("gamification engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGrantCreditsInTransaction.mockResolvedValue(0);
  });

  describe("computeLevel & multipliers", () => {
    it("returns correct level for XP amounts", () => {
      expect(computeLevel(0)).toBe(1);
      expect(computeLevel(99)).toBe(1);
      expect(computeLevel(100)).toBe(2);
      expect(computeLevel(500)).toBe(5);
      expect(computeLevel(750)).toBe(6);
      expect(computeLevel(50000)).toBe(30);
      expect(computeLevel(100000)).toBe(30); // max cap
    });

    it("returns correct multiplier based on level", () => {
      expect(getXPMultiplierForLevel(1)).toBe(1.0); // Beginner
      expect(getXPMultiplierForLevel(6)).toBe(1.1); // Explorer
      expect(getXPMultiplierForLevel(12)).toBe(1.25); // Analyst
      expect(getXPMultiplierForLevel(30)).toBe(1.6); // Master
    });
  });

  describe("awardXP", () => {
    it("awards base XP and respects daily caps", async () => {
      // Mock daily cap count check (0 today so far)
      mockTx.xPTransaction.count.mockResolvedValue(0);
      
      // Mock progress fetch
      mockTx.userProgress.findUnique.mockResolvedValue({
        totalXp: 0,
        level: 1,
        streak: 0,
        weeklyXp: 0,
        lastActiveDate: null,
        weeklyResetAt: null,
      });

      const res = await awardXP("user_1", "daily_login");
      expect(res.awarded).toBe(true);
      expect(res.amount).toBe(5); // base 5 * 1.0 multiplier
      expect(res.newTotalXp).toBe(5);
      expect(mockTx.userProgress.update).toHaveBeenCalled();
      expect(mockTx.xPTransaction.create).toHaveBeenCalled();
    });

    it("rejects award if daily cap is reached", async () => {
      // "daily_login" cap is 1. Mock DB returning 1 existing tx today.
      mockTx.xPTransaction.count.mockResolvedValue(1);
      mockTx.userProgress.findUnique.mockResolvedValue({
        totalXp: 10,
        level: 1,
        streak: 1,
      });

      const res = await awardXP("user_1", "daily_login");
      expect(res.awarded).toBe(false);
      expect(res.reason).toMatch(/Daily cap reached/);
      expect(mockTx.xPTransaction.create).not.toHaveBeenCalled();
    });

    it("applies level-based multiplier correctly", async () => {
      mockTx.xPTransaction.count.mockResolvedValue(0);
      // Level 12 = Analyst = 1.25x multiplier
      mockTx.userProgress.findUnique.mockResolvedValue({
        totalXp: 3000,
        level: 12,
        streak: 5,
        weeklyXp: 100,
      });

      // "complete_module" base is 25 XP
      // 25 * 1.25 = 31.25 -> rounded to 31
      const res = await awardXP("user_1", "complete_module");
      expect(res.awarded).toBe(true);
      expect(res.amount).toBe(31);
      expect(res.newTotalXp).toBe(3031);
    });

    it("awards tier badges accurately upon leveling into a new tier", async () => {
      mockTx.xPTransaction.count.mockResolvedValue(0);
      // Level 5 (Beginner) reaching Level 6 (Explorer) threshold (750 XP)
      mockTx.userProgress.findUnique.mockResolvedValue({
        totalXp: 700,
        level: 5,
        streak: 1,
        weeklyXp: 0,
      });

      // Awarding 100 XP base -> Level 5 multiplier = 1.0x -> 100 XP total -> 800 XP total = Level 6
      const res = await awardXP("user_1", "first_purchase"); // base 100
      expect(res.amount).toBe(100);
      expect(res.newLevel).toBe(6);
      expect(res.leveledUp).toBe(true);
      expect(res.newTierUnlocked).toBe(true);
      
      // Should have upserted the badge
      expect(mockTx.userBadge.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_badgeSlug: { userId: "user_1", badgeSlug: "tier_explorer" } }
        })
      );
    });
  });

  describe("redeemXP", () => {
    it("deducts XP and grants plan trial/credits when requested", async () => {
      mockTx.xPRedemption.findMany.mockResolvedValue([]);

      // Mock sufficient balance
      mockTx.userProgress.findUnique.mockResolvedValue({
        totalXp: 1000,
        level: 7,
      });

      const res = await redeemXP("user_1", "PRO_TRIAL_7D_WITH_CREDITS");
      
      expect(res.success).toBe(true);
      expect(res.creditsAdded).toBe(50);
      expect(res.planGranted).toBe("PRO");
      expect(res.newTotalXp).toBe(500); // 1000 - 500 cost

      // Verify db calls
      expect(mockTx.userProgress.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { totalXp: 500, level: 5 } })
      );
      expect(mockTx.xPRedemption.create).toHaveBeenCalled();
      expect(mockTx.user.update).toHaveBeenCalled(); // adding credits + plan
      expect(mockGrantCreditsInTransaction).toHaveBeenCalled();
    });

    it("rejects redemption if user has insufficient XP", async () => {
      mockTx.xPRedemption.findMany.mockResolvedValue([]);
      mockTx.userProgress.findUnique.mockResolvedValue({
        totalXp: 200, // costs 500
        level: 2,
      });

      const res = await redeemXP("user_1", "PRO_TRIAL_7D_WITH_CREDITS");
      expect(res.success).toBe(false);
      expect(res.insufficientXp).toBe(true);
      expect(mockTx.user.update).not.toHaveBeenCalled();
    });

    it("allows multiple redemptions of the same type", async () => {
      // We removed the uniqueness constraint, so historical redemptions do not block new ones
      mockTx.userProgress.findUnique.mockResolvedValue({
        totalXp: 5000, // Costs 1500 typically
        level: 10,
      });

      const res = await redeemXP("user_1", "ELITE_TRIAL_7D_WITH_CREDITS");
      expect(res.success).toBe(true);
      expect(mockTx.user.update).toHaveBeenCalled();
    });
  });

  describe("canGenerateReferral", () => {
    it("allows active paid PRO subscribers to refer", async () => {
      mockTx.user.findUnique.mockResolvedValue({
        plan: "PRO",
        trialEndsAt: null, // null means paid, not trial
        subscriptions: [{ status: "ACTIVE", plan: "PRO" }],
      });

      const res = await canGenerateReferral("user_1");
      expect(res).toBe(true);
    });

    it("blocks PRO/ELITE trials from referring", async () => {
      mockTx.user.findUnique.mockResolvedValue({
        plan: "PRO",
        trialEndsAt: new Date(Date.now() + 86400000), // trial ends tomorrow
        subscriptions: [], // no paid subscription
      });

      const res = await canGenerateReferral("user_1");
      expect(res).toBe(false);
    });

    it("blocks STARTER plans from referring", async () => {
      mockTx.user.findUnique.mockResolvedValue({
        plan: "STARTER",
        trialEndsAt: null,
        subscriptions: [],
      });

      const res = await canGenerateReferral("user_1");
      expect(res).toBe(false);
    });
  });
});
