/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/engines/gamification", () => ({
  redeemXP: vi.fn(),
  XP_REDEMPTIONS: [
    { type: "PRO_TRIAL_7D_WITH_CREDITS", xpCost: 500, creditsGranted: 50, planGranted: "PRO", trialDays: 0, label: "PRO Credit Bundle", description: "" },
    { type: "ELITE_TRIAL_7D_WITH_CREDITS", xpCost: 1000, creditsGranted: 125, planGranted: "ELITE", trialDays: 0, label: "ELITE Credit Bundle", description: "" },
  ],
}));

import { POST } from "./route";
import { auth } from "@/lib/auth";
import { redeemXP } from "@/lib/engines/gamification";

describe("POST /api/learning/xp-redeem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const req = new Request("http://localhost/api/learning/xp-redeem", {
      method: "POST",
      body: JSON.stringify({ type: "PRO_TRIAL_7D_WITH_CREDITS" }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid redemption types", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as never);

    const req = new Request("http://localhost/api/learning/xp-redeem", {
      method: "POST",
      body: JSON.stringify({ type: "INVALID_TYPE" }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 402 when the user does not have enough XP", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as never);
    vi.mocked(redeemXP).mockResolvedValue({ success: false, insufficientXp: true } as never);

    const req = new Request("http://localhost/api/learning/xp-redeem", {
      method: "POST",
      body: JSON.stringify({ type: "PRO_TRIAL_7D_WITH_CREDITS" }),
    });

    const res = await POST(req as NextRequest);
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.reason).toBe("insufficient_xp");
  });

  it("returns the normalized success payload on redemption", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as never);
    vi.mocked(redeemXP).mockResolvedValue({
      success: true,
      creditsAdded: 50,
      planGranted: "PRO",
      newTotalXp: 500,
    } as never);

    const req = new Request("http://localhost/api/learning/xp-redeem", {
      method: "POST",
      body: JSON.stringify({ type: "PRO_TRIAL_7D_WITH_CREDITS" }),
    });

    const res = await POST(req as NextRequest);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      success: true,
      creditsAdded: 50,
      planGranted: "PRO",
      newTotalXp: 500,
    });
  });
});
