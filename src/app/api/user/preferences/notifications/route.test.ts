/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "./route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userPreference: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/ensure-user", () => ({
  ensureUserExists: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/user-preferences.service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/user-preferences.service")>(
    "@/lib/services/user-preferences.service"
  );

  return {
    ...actual,
    getNotificationPreferences: vi.fn(),
    updateNotificationPreferences: vi.fn(),
  };
});

import { auth } from "@/lib/auth";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/services/user-preferences.service";

describe("/api/user/preferences/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const req = new Request("http://localhost/api/user/preferences/notifications", {
      method: "PUT",
      body: JSON.stringify({
        emailNotifications: true,
        pushNotifications: false,
        newsAlerts: true,
        morningIntelligence: true,
        portfolioAlerts: true,
        opportunityAlerts: true,
        narrativeAlerts: true,
        shockWarnings: true,
        weeklyReports: true,
      }),
    });

    const res = await PUT(req as NextRequest);
    expect(res.status).toBe(401);
  });

  it("updates notification preferences through the shared service", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as never);

    vi.mocked(updateNotificationPreferences).mockResolvedValue({
      emailNotifications: true,
      pushNotifications: false,
      newsAlerts: true,
      morningIntelligence: true,
      portfolioAlerts: true,
      opportunityAlerts: true,
      narrativeAlerts: true,
      shockWarnings: true,
      weeklyReports: true,
    } as never);

    const req = new Request("http://localhost/api/user/preferences/notifications", {
      method: "PUT",
      body: JSON.stringify({
        emailNotifications: true,
        pushNotifications: false,
        newsAlerts: true,
        morningIntelligence: true,
        portfolioAlerts: true,
        opportunityAlerts: true,
        narrativeAlerts: true,
        shockWarnings: true,
        weeklyReports: true,
      }),
    });

    const res = await PUT(req as NextRequest);
    expect(res.status).toBe(200);

    expect(updateNotificationPreferences).toHaveBeenCalledOnce();
  });

  it("returns defaults when GET has no row", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as never);
    vi.mocked(getNotificationPreferences).mockResolvedValue({
      emailNotifications: true,
      pushNotifications: false,
      newsAlerts: true,
      morningIntelligence: true,
      portfolioAlerts: true,
      opportunityAlerts: true,
      narrativeAlerts: true,
      shockWarnings: true,
      weeklyReports: true,
    } as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notifications).toEqual({
      emailNotifications: true,
      pushNotifications: false,
      newsAlerts: true,
      morningIntelligence: true,
      portfolioAlerts: true,
      opportunityAlerts: true,
      narrativeAlerts: true,
      shockWarnings: true,
      weeklyReports: true,
    });
  });
});
