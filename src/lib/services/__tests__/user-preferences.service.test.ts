/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    userPreference: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/utils/ensure-user", () => ({ ensureUserExists: vi.fn() }));
vi.mock("@/lib/notification-preferences", () => ({
  defaultNotificationPreferences: {
    emailNotifications: true, pushNotifications: false, newsAlerts: true,
    morningIntelligence: true, portfolioAlerts: true, opportunityAlerts: true,
    narrativeAlerts: true, shockWarnings: true, weeklyReports: true,
  },
  normalizeNotificationPreferences: (prefs: unknown) => {
    if (!prefs) return {
      emailNotifications: true, pushNotifications: false, newsAlerts: true,
      morningIntelligence: true, portfolioAlerts: true, opportunityAlerts: true,
      narrativeAlerts: true, shockWarnings: true, weeklyReports: true,
    };
    return prefs;
  },
  notificationPreferenceSelect: {
    emailNotifications: true, pushNotifications: true, newsAlerts: true,
    morningIntelligence: true, portfolioAlerts: true, opportunityAlerts: true,
    narrativeAlerts: true, shockWarnings: true, weeklyReports: true,
  },
}));

import {
  ensureUserPreferences, getNotificationPreferences, updateNotificationPreferences,
  updateDashboardModePreference, updateBlogSubscriptionPreference, updateOnboardingState,
  buildDefaultUserPreferenceData, DEFAULT_INTERESTS, DEFAULT_DASHBOARD_MODE,
} from "../user-preferences.service";

describe("buildDefaultUserPreferenceData", () => {
  it("creates default preferences with correct values", () => {
    const result = buildDefaultUserPreferenceData("user_123");
    expect(result.userId).toBe("user_123");
    expect(result.preferredRegion).toBe("US");
    expect(result.experienceLevel).toBe("BEGINNER");
    expect(result.dashboardMode).toBe("simple");
    expect(result.interests).toEqual(["CRYPTO"]);
    expect(result.blogSubscribed).toBe(true);
    expect(result.emailNotifications).toBe(true);
    expect(result.pushNotifications).toBe(false);
  });
});

describe("ensureUserPreferences", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns existing preferences when found", async () => {
    const existing = { userId: "user_123", dashboardMode: "advanced" };
    prismaMock.userPreference.findUnique.mockResolvedValue(existing);
    const result = await ensureUserPreferences("user_123");
    expect(result).toBe(existing);
    expect(prismaMock.userPreference.create).not.toHaveBeenCalled();
  });

  it("creates new preferences when not found", async () => {
    prismaMock.userPreference.findUnique.mockResolvedValue(null);
    const created = { userId: "user_123", dashboardMode: "simple" };
    prismaMock.userPreference.create.mockResolvedValue(created);
    const result = await ensureUserPreferences("user_123");
    expect(prismaMock.userPreference.create).toHaveBeenCalled();
    expect(result).toBe(created);
  });
});

describe("getNotificationPreferences", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns normalized preferences when found", async () => {
    const prefs = { emailNotifications: true, pushNotifications: true, weeklyDigest: false, priceAlerts: true };
    prismaMock.userPreference.findUnique.mockResolvedValue(prefs);
    const result = await getNotificationPreferences("user_123");
    expect(result).toEqual(prefs);
  });

  it("returns default preferences when not found", async () => {
    prismaMock.userPreference.findUnique.mockResolvedValue(null);
    const result = await getNotificationPreferences("user_123");
    expect(result).toEqual(expect.objectContaining({ emailNotifications: true, pushNotifications: false }));
  });
});

describe("updateNotificationPreferences", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates preferences when they exist", async () => {
    const updated = { emailNotifications: false, pushNotifications: true, newsAlerts: true, morningIntelligence: true, portfolioAlerts: true, opportunityAlerts: true, narrativeAlerts: true, shockWarnings: true, weeklyReports: true };
    prismaMock.userPreference.update.mockResolvedValue(updated);
    const result = await updateNotificationPreferences("user_123", { emailNotifications: false, pushNotifications: true, newsAlerts: true, morningIntelligence: true, portfolioAlerts: true, opportunityAlerts: true, narrativeAlerts: true, shockWarnings: true, weeklyReports: true });
    expect(result).toEqual(updated);
  });

  it("ensures preferences exist before updating", async () => {
    // First findUnique returns null (no preferences), create is called, then update succeeds
    prismaMock.userPreference.findUnique.mockResolvedValueOnce(null);
    prismaMock.userPreference.create.mockResolvedValueOnce({ userId: "user_123" });
    prismaMock.userPreference.update.mockResolvedValue({ emailNotifications: true, pushNotifications: false, newsAlerts: true, morningIntelligence: true, portfolioAlerts: true, opportunityAlerts: true, narrativeAlerts: true, shockWarnings: true, weeklyReports: true });
    const result = await updateNotificationPreferences("user_123", { emailNotifications: true, pushNotifications: false, newsAlerts: true, morningIntelligence: true, portfolioAlerts: true, opportunityAlerts: true, narrativeAlerts: true, shockWarnings: true, weeklyReports: true });
    expect(prismaMock.userPreference.create).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ emailNotifications: true }));
  });
});

describe("updateDashboardModePreference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.userPreference.update.mockReset();
    prismaMock.userPreference.create.mockReset();
  });

  it("updates dashboard mode to advanced", async () => {
    prismaMock.userPreference.update.mockResolvedValue({ dashboardMode: "advanced" });
    const result = await updateDashboardModePreference("user_123", "advanced");
    expect(result).toEqual({ dashboardMode: "advanced" });
  });

  it("updates dashboard mode to simple", async () => {
    prismaMock.userPreference.update.mockResolvedValue({ dashboardMode: "simple" });
    const result = await updateDashboardModePreference("user_123", "simple");
    expect(result).toEqual({ dashboardMode: "simple" });
  });

  it("creates preferences if missing before updating", async () => {
    prismaMock.userPreference.findUnique.mockResolvedValueOnce(null);
    prismaMock.userPreference.create.mockResolvedValueOnce({ userId: "user_123" });
    prismaMock.userPreference.update.mockResolvedValue({ dashboardMode: "advanced" });
    const result = await updateDashboardModePreference("user_123", "advanced");
    expect(result).toEqual({ dashboardMode: "advanced" });
  });
});

describe("updateBlogSubscriptionPreference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.userPreference.update.mockReset();
  });

  it("enables blog subscription", async () => {
    prismaMock.userPreference.update.mockResolvedValue({ blogSubscribed: true });
    const result = await updateBlogSubscriptionPreference("user_123", true);
    expect(result).toEqual({ blogSubscribed: true });
  });

  it("disables blog subscription", async () => {
    prismaMock.userPreference.update.mockResolvedValue({ blogSubscribed: false });
    const result = await updateBlogSubscriptionPreference("user_123", false);
    expect(result).toEqual({ blogSubscribed: false });
  });
});

describe("updateOnboardingState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.userPreference.update.mockReset();
    prismaMock.userPreference.create.mockReset();
  });

  it("updates onboarding step", async () => {
    prismaMock.userPreference.update.mockResolvedValue({ onboardingStep: 3 });
    const result = await updateOnboardingState("user_123", { onboardingStep: 3 });
    expect(result?.onboardingStep).toBe(3);
  });

  it("marks onboarding as completed", async () => {
    const completedAt = new Date();
    prismaMock.userPreference.update.mockResolvedValue({
      onboardingCompleted: true, onboardingCompletedAt: completedAt, onboardingSkipped: false,
    });
    const result = await updateOnboardingState("user_123", { onboardingCompleted: true, onboardingCompletedAt: completedAt });
    expect(result?.onboardingCompleted).toBe(true);
  });

  it("marks onboarding as skipped", async () => {
    prismaMock.userPreference.update.mockResolvedValue({ onboardingSkipped: true, onboardingCompleted: false });
    const result = await updateOnboardingState("user_123", { onboardingSkipped: true });
    expect(result?.onboardingSkipped).toBe(true);
  });

  it("handles missing preferences by creating them first", async () => {
    prismaMock.userPreference.findUnique.mockResolvedValueOnce(null);
    prismaMock.userPreference.create.mockResolvedValueOnce({ userId: "user_123" });
    prismaMock.userPreference.update.mockResolvedValue({ onboardingStep: 2 });
    const result = await updateOnboardingState("user_123", { onboardingStep: 2 });
    expect(result).toEqual(expect.objectContaining({ onboardingStep: 2 }));
  });
});

describe("constants", () => {
  it("DEFAULT_INTERESTS contains CRYPTO", () => {
    expect(DEFAULT_INTERESTS).toContain("CRYPTO");
  });

  it("DEFAULT_DASHBOARD_MODE is simple", () => {
    expect(DEFAULT_DASHBOARD_MODE).toBe("simple");
  });
});
