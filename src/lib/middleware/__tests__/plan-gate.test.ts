/**
 * @vitest-environment node
 *
 * Tests for plan-gate.ts — direct DB getUserPlan (no Redis cache), feature limits.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  delCache: vi.fn().mockResolvedValue(undefined),
  withStaleWhileRevalidate: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth", () => ({
  isPrivilegedEmail: vi.fn().mockReturnValue(false),
}));

import { prisma } from "@/lib/prisma";
import { delCache } from "@/lib/redis";
import {
  getUserPlan,
  expireTrialIfNeeded,
  invalidatePlanCache,
  _clearPlanCacheForTest,
  getPlanLimit,
  isElitePlan,
  canAccessAssetType,
  canAccessRegion,
  hasFeatureAccess,
  getFeatureLevel,
} from "../plan-gate";

describe("plan-gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearPlanCacheForTest();
  });

  // ─── getUserPlan ───────────────────────────────────────────────

  describe("getUserPlan", () => {
    it("returns plan from DB on first call", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ plan: "ELITE" } as any);

      const plan = await getUserPlan("user_1");
      expect(plan).toBe("ELITE");
      expect(prisma.user.findUnique).toHaveBeenCalledOnce();
    });

    it("hits DB on every call (no cache)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ plan: "PRO" } as any);

      await getUserPlan("user_2");
      await getUserPlan("user_2");

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it("returns updated plan immediately on next call", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ plan: "PRO" } as any);

      await getUserPlan("user_3");
      expect(prisma.user.findUnique).toHaveBeenCalledOnce();

      vi.mocked(prisma.user.findUnique).mockResolvedValue({ plan: "ELITE" } as any);

      const plan = await getUserPlan("user_3");
      expect(plan).toBe("ELITE");
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it("returns STARTER as fallback when user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const plan = await getUserPlan("nonexistent");
      expect(plan).toBe("STARTER");
    });

    it("returns STARTER on DB error", async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("DB down"));

      const plan = await getUserPlan("error_user");
      expect(plan).toBe("STARTER");
    });

    it("different users get independent cache entries", async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({ plan: "PRO" } as any)
        .mockResolvedValueOnce({ plan: "ELITE" } as any);

      const planA = await getUserPlan("user_a");
      const planB = await getUserPlan("user_b");

      expect(planA).toBe("PRO");
      expect(planB).toBe("ELITE");
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  // ─── invalidatePlanCache ───────────────────────────────────────

  describe("invalidatePlanCache", () => {
    it("is a no-op — plan is always read fresh from DB", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ plan: "PRO" } as any);

      await getUserPlan("user_inv");
      await invalidatePlanCache("user_inv"); // no-op

      vi.mocked(prisma.user.findUnique).mockResolvedValue({ plan: "ELITE" } as any);
      const plan = await getUserPlan("user_inv");
      expect(plan).toBe("ELITE"); // always reflects DB
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it("each user gets independent DB reads", async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({ plan: "PRO" } as any)
        .mockResolvedValueOnce({ plan: "ELITE" } as any)
        .mockResolvedValueOnce({ plan: "ELITE" } as any);

      await getUserPlan("user_x");
      await getUserPlan("user_y");
      await invalidatePlanCache("user_x"); // no-op

      // user_y re-fetches from DB
      const planY = await getUserPlan("user_y");
      expect(planY).toBe("ELITE");
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(3);
    });
  });

  // ─── Feature Limits ────────────────────────────────────────────

  describe("getPlanLimit", () => {
    it("returns correct limits for discovery_feed", () => {
      expect(getPlanLimit("STARTER", "discovery_feed")).toBe(5);
      expect(getPlanLimit("PRO", "discovery_feed")).toBe(15);
      expect(getPlanLimit("ELITE", "discovery_feed")).toBe(100);
      expect(getPlanLimit("ENTERPRISE", "discovery_feed")).toBe(100);
    });

    it("returns 0 for unknown feature (fallback)", () => {
      expect(getPlanLimit("STARTER", "nonexistent" as any)).toBe(0);
    });
  });

  describe("isElitePlan", () => {
    it("returns true for ELITE and ENTERPRISE", () => {
      expect(isElitePlan("ELITE")).toBe(true);
      expect(isElitePlan("ENTERPRISE")).toBe(true);
    });

    it("returns false for STARTER and PRO", () => {
      expect(isElitePlan("STARTER")).toBe(false);
      expect(isElitePlan("PRO")).toBe(false);
    });
  });

  describe("canAccessAssetType", () => {
    it("blocks CRYPTO for STARTER and PRO — Elite required", () => {
      expect(canAccessAssetType("STARTER", "CRYPTO")).toBe(false);
      expect(canAccessAssetType("PRO", "CRYPTO")).toBe(false);
    });

    it("allows CRYPTO for ELITE and ENTERPRISE", () => {
      expect(canAccessAssetType("ELITE", "CRYPTO")).toBe(true);
      expect(canAccessAssetType("ENTERPRISE", "CRYPTO")).toBe(true);
    });

    it("allows CRYPTO for all plans", () => {
      expect(canAccessAssetType("STARTER", "CRYPTO")).toBe(true);
      expect(canAccessAssetType("PRO", "CRYPTO")).toBe(true);
    });
  });

  describe("canAccessRegion", () => {
    it("allows US and IN for all plans", () => {
      expect(canAccessRegion("STARTER", "US")).toBe(true);
      expect(canAccessRegion("STARTER", "IN")).toBe(true);
    });

    it("blocks other regions for non-elite plans", () => {
      expect(canAccessRegion("STARTER", "EU")).toBe(false);
      expect(canAccessRegion("PRO", "JP")).toBe(false);
    });

    it("allows all regions for elite plans", () => {
      expect(canAccessRegion("ELITE", "EU")).toBe(true);
      expect(canAccessRegion("ENTERPRISE", "JP")).toBe(true);
    });
  });

  describe("hasFeatureAccess", () => {
    it("returns true when limit > 0", () => {
      expect(hasFeatureAccess("PRO", "portfolio_lookthrough")).toBe(true);
    });

    it("returns false when limit is 0", () => {
      expect(hasFeatureAccess("STARTER", "macro_correlations")).toBe(false);
    });
  });

  describe("getFeatureLevel", () => {
    it("is an alias for getPlanLimit", () => {
      expect(getFeatureLevel("ELITE", "learning_modules")).toBe(getPlanLimit("ELITE", "learning_modules"));
    });
  });

  // ─── expireTrialIfNeeded (I4) ──────────────────────────────────

  describe("expireTrialIfNeeded (I4 — await before return)", () => {
    it("returns current plan unchanged when trial has not ended", async () => {
      const future = new Date(Date.now() + 86_400_000); // +1 day
      const result = await expireTrialIfNeeded("user_1", "PRO", future);
      expect(result).toEqual({ plan: "PRO", trialEndsAt: future });
      expect(vi.mocked(prisma.user.findUnique)).not.toHaveBeenCalled();
    });

    it("returns current plan unchanged when trialEndsAt is null", async () => {
      const result = await expireTrialIfNeeded("user_1", "PRO", null);
      expect(result).toEqual({ plan: "PRO", trialEndsAt: null });
    });

    it("returns current plan unchanged when already STARTER", async () => {
      const past = new Date(Date.now() - 86_400_000);
      const result = await expireTrialIfNeeded("user_1", "STARTER", past);
      expect(result).toEqual({ plan: "STARTER", trialEndsAt: past });
    });

    it("downgrades to STARTER and awaits DB + cache bust when trial has expired (I4)", async () => {
      vi.mocked(prisma.user as any).update = vi.fn().mockResolvedValue({});
      const past = new Date(Date.now() - 86_400_000);
      const result = await expireTrialIfNeeded("user_1", "PRO", past);
      expect(result).toEqual({ plan: "STARTER", trialEndsAt: null });
      expect(vi.mocked(delCache)).toHaveBeenCalledWith("plan:user_1");
    });

    it("still returns STARTER even when DB write fails (graceful degradation)", async () => {
      vi.mocked(prisma.user as any).update = vi.fn().mockRejectedValue(new Error("DB down"));
      const past = new Date(Date.now() - 86_400_000);
      const result = await expireTrialIfNeeded("user_1", "ELITE", past);
      expect(result).toEqual({ plan: "STARTER", trialEndsAt: null });
    });
  });

  // ─── getUserPlan — trial and subscription edge cases ─────────────────────

  describe("getUserPlan — trial and subscription logic", () => {
    it("promotes to PRO when active trial is present (trialEndsAt in future)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        plan: "STARTER",
        trialEndsAt: new Date(Date.now() + 86_400_000),
        subscriptions: [],
        email: "user@example.com",
      } as any);

      const plan = await getUserPlan("user_trial");
      expect(plan).toBe("PRO");
    });

    it("does NOT promote STARTER to PRO when active subscription has plan STARTER (O6 — filter)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        plan: "STARTER",
        trialEndsAt: null,
        subscriptions: [], // filtered out by plan: { not: "STARTER" }
        email: "user@example.com",
      } as any);

      const plan = await getUserPlan("user_starter_sub");
      expect(plan).toBe("STARTER");
    });

    it("returns ELITE for privileged (admin) email regardless of DB plan", async () => {
      const { isPrivilegedEmail } = await import("@/lib/auth");
      vi.mocked(isPrivilegedEmail).mockReturnValueOnce(true);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        plan: "STARTER",
        trialEndsAt: null,
        subscriptions: [],
        email: "admin@multiassetai.com",
      } as any);

      const plan = await getUserPlan("user_admin");
      expect(plan).toBe("ELITE");
    });

    it("promotes STARTER to PRO when paid subscription exists", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        plan: "STARTER",
        trialEndsAt: null,
        subscriptions: [{ plan: "PRO" }],
        email: "user@example.com",
      } as any);

      const plan = await getUserPlan("user_paid");
      expect(plan).toBe("PRO");
    });

    it("returns DB plan unchanged when no trial, no subscription", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        plan: "ELITE",
        trialEndsAt: null,
        subscriptions: [],
        email: "user@example.com",
      } as any);

      const plan = await getUserPlan("user_elite");
      expect(plan).toBe("ELITE");
    });
  });
});
