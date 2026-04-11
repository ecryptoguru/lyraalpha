import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureUserExists } from "@/lib/utils/ensure-user";
import {
  defaultNotificationPreferences,
  normalizeNotificationPreferences,
  notificationPreferenceSelect,
  type NotificationPreferencePayload,
} from "@/lib/notification-preferences";

export const DEFAULT_INTERESTS = ["CRYPTO"] as const;
export const DEFAULT_DASHBOARD_MODE = "simple" as const;

export function buildDefaultUserPreferenceData(userId: string) {
  return {
    userId,
    preferredRegion: "US" as const,
    experienceLevel: "BEGINNER" as const,
    dashboardMode: DEFAULT_DASHBOARD_MODE,
    interests: [...DEFAULT_INTERESTS],
    blogSubscribed: true,
    ...defaultNotificationPreferences,
  };
}

export async function ensureUserPreferences(userId: string) {
  const existingPreferences = await prisma.userPreference.findUnique({
    where: { userId },
  });

  if (existingPreferences) {
    return existingPreferences;
  }

  await ensureUserExists(userId);

  return prisma.userPreference.create({
    data: buildDefaultUserPreferenceData(userId),
  });
}

function isMissingUserPreferenceError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function getNotificationPreferences(userId: string) {
  const prefs = await prisma.userPreference.findUnique({
    where: { userId },
    select: notificationPreferenceSelect,
  });

  return normalizeNotificationPreferences(prefs);
}

export async function updateNotificationPreferences(
  userId: string,
  notifications: NotificationPreferencePayload,
) {
  await ensureUserPreferences(userId);

  let updated = await prisma.userPreference.update({
    where: { userId },
    data: notifications,
    select: notificationPreferenceSelect,
  }).catch((error) => {
    if (isMissingUserPreferenceError(error)) {
      return null;
    }

    throw error;
  });

  if (!updated) {
    await ensureUserPreferences(userId);
    updated = await prisma.userPreference.update({
      where: { userId },
      data: notifications,
      select: notificationPreferenceSelect,
    });
  }

  return normalizeNotificationPreferences(updated);
}

export async function updateDashboardModePreference(
  userId: string,
  dashboardMode: "simple" | "advanced",
) {
  await ensureUserPreferences(userId);

  let updated = await prisma.userPreference.update({
    where: { userId },
    data: { dashboardMode },
    select: { dashboardMode: true },
  }).catch((error) => {
    if (isMissingUserPreferenceError(error)) {
      return null;
    }

    throw error;
  });

  if (!updated) {
    await ensureUserPreferences(userId);
    updated = await prisma.userPreference.update({
      where: { userId },
      data: { dashboardMode },
      select: { dashboardMode: true },
    });
  }

  return updated;
}

export async function updateBlogSubscriptionPreference(
  userId: string,
  blogSubscribed: boolean,
) {
  await ensureUserPreferences(userId);

  let updated = await prisma.userPreference.update({
    where: { userId },
    data: { blogSubscribed },
    select: { blogSubscribed: true },
  }).catch((error) => {
    if (isMissingUserPreferenceError(error)) {
      return null;
    }

    throw error;
  });

  if (!updated) {
    await ensureUserPreferences(userId);
    updated = await prisma.userPreference.update({
      where: { userId },
      data: { blogSubscribed },
      select: { blogSubscribed: true },
    });
  }

  return updated;
}

export async function updateOnboardingState(
  userId: string,
  fields: {
    onboardingStep?: number;
    onboardingSkipped?: boolean;
    onboardingCompleted?: boolean;
    onboardingCompletedAt?: Date | null;
  },
) {
  await ensureUserPreferences(userId);

  let updated = await prisma.userPreference.update({
    where: { userId },
    data: fields,
  }).catch((error) => {
    if (isMissingUserPreferenceError(error)) {
      return null;
    }

    throw error;
  });

  if (!updated) {
    await ensureUserPreferences(userId);
    updated = await prisma.userPreference.update({
      where: { userId },
      data: fields,
    });
  }

  return updated;
}
