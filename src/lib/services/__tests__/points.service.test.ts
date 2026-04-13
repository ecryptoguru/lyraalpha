/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, gamificationMock, creditMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    creditTransaction: { aggregate: vi.fn(), count: vi.fn() },
  },
  gamificationMock: {
    getUserProgressWithMeta: vi.fn(),
    getRecentXPTransactions: vi.fn(),
  },
  creditMock: { getUserCredits: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/engines/gamification", () => ({
  canGenerateReferral: vi.fn(),
  getUserProgressWithMeta: gamificationMock.getUserProgressWithMeta,
  getRecentXPTransactions: gamificationMock.getRecentXPTransactions,
  XP_REDEMPTIONS: [
    { type: "CREDITS", xpCost: 500, creditsGranted: 50, label: "50 Credits", planGranted: "FREE", trialDays: 0 },
    { type: "PRO", xpCost: 1000, creditsGranted: 100, label: "Pro Trial", planGranted: "PRO", trialDays: 7 },
  ],
}));
vi.mock("@/lib/services/credit.service", () => ({ getUserCredits: creditMock.getUserCredits }));

import { getUserPoints, getPointHistory, getRedemptionOptions } from "../points.service";

describe("getUserPoints", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("combines XP progress with credit data correctly", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ totalCreditsEarned: 200 });
    creditMock.getUserCredits.mockResolvedValue(50);
    gamificationMock.getUserProgressWithMeta.mockResolvedValue({
      totalXp: 1500, level: 5, tierName: "Silver", tierEmoji: "🥈", multiplier: 1.5,
      progressPercent: 75, xpInCurrentLevel: 500, xpNeededForNext: 200, isMaxLevel: false,
      badges: [{ id: "early_adopter", name: "Early Adopter" }],
      redemptions: [{ type: "CREDITS", redeemedAt: new Date() }],
    });
    prismaMock.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: 100 } });
    prismaMock.creditTransaction.count.mockResolvedValue(3);

    const result = await getUserPoints("user_123");

    expect(result.xp).toBe(1500);
    expect(result.level).toBe(5);
    expect(result.tierName).toBe("Silver");
    expect(result.tierEmoji).toBe("🥈");
    expect(result.multiplier).toBe(1.5);
    expect(result.credits).toBe(50);
    expect(result.totalCreditsEarned).toBe(200);
    expect(result.referralCreditsEarned).toBe(100);
    expect(result.referralCount).toBe(3);
    expect(result.badges).toHaveLength(1);
    expect(result.redemptions).toHaveLength(1);
  });

  it("handles missing user gracefully", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    creditMock.getUserCredits.mockResolvedValue(0);
    gamificationMock.getUserProgressWithMeta.mockResolvedValue({
      totalXp: 0, level: 1, tierName: "Bronze", tierEmoji: "🥉", multiplier: 1,
      progressPercent: 0, xpInCurrentLevel: 0, xpNeededForNext: 100, isMaxLevel: false,
      badges: [], redemptions: [],
    });
    prismaMock.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prismaMock.creditTransaction.count.mockResolvedValue(0);

    const result = await getUserPoints("user_unknown");

    expect(result.totalCreditsEarned).toBe(0);
    expect(result.referralCreditsEarned).toBe(0);
  });

  it("handles max level state", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ totalCreditsEarned: 1000 });
    creditMock.getUserCredits.mockResolvedValue(100);
    gamificationMock.getUserProgressWithMeta.mockResolvedValue({
      totalXp: 10000, level: 50, tierName: "Platinum", tierEmoji: "💎", multiplier: 3,
      progressPercent: 100, xpInCurrentLevel: 0, xpNeededForNext: 0, isMaxLevel: true,
      badges: [], redemptions: [],
    });
    prismaMock.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prismaMock.creditTransaction.count.mockResolvedValue(0);

    const result = await getUserPoints("user_max");

    expect(result.isMaxLevel).toBe(true);
    expect(result.xpNeededForNext).toBe(0);
  });
});

describe("getPointHistory", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns formatted XP transactions", async () => {
    const transactions = [
      { id: "tx1", amount: 100, context: "Daily login", action: "LOGIN", createdAt: new Date("2026-04-14") },
      { id: "tx2", amount: 50, context: null, action: "REFERRAL", createdAt: new Date("2026-04-13") },
    ];
    gamificationMock.getRecentXPTransactions.mockResolvedValue(transactions);

    const result = await getPointHistory("user_123", 10);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({
      id: "tx1", amount: 100, description: "Daily login", type: "XP",
    }));
    expect(result[1]).toEqual(expect.objectContaining({
      id: "tx2", amount: 50, description: "REFERRAL", type: "XP",
    }));
  });

  it("respects the limit parameter", async () => {
    gamificationMock.getRecentXPTransactions.mockResolvedValue([]);
    await getPointHistory("user_123", 5);
    expect(gamificationMock.getRecentXPTransactions).toHaveBeenCalledWith("user_123", 5);
  });

  it("returns empty array when no transactions", async () => {
    gamificationMock.getRecentXPTransactions.mockResolvedValue([]);
    const result = await getPointHistory("user_123");
    expect(result).toEqual([]);
  });
});

describe("getRedemptionOptions", () => {
  it("returns formatted redemption options", () => {
    const options = getRedemptionOptions();
    expect(options).toHaveLength(2);
    expect(options[0]).toEqual(expect.objectContaining({
      type: "CREDITS", name: "50 Credits", xpCost: 500, credits: 50, plan: "FREE", trialDays: 0,
    }));
    expect(options[1]).toEqual(expect.objectContaining({
      type: "PRO", name: "Pro Trial", xpCost: 1000, credits: 100, plan: "PRO", trialDays: 7,
    }));
  });
});

describe("canGenerateReferral re-export", () => {
  it("is callable", async () => {
    const { canGenerateReferral: mockCanGenerate } = await import("@/lib/engines/gamification");
    expect(typeof mockCanGenerate).toBe("function");
  });
});
