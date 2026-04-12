import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserPreferencesSchema } from "@/lib/schemas";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { rateLimitGeneral } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";
import {
  buildDefaultUserPreferenceData,
  DEFAULT_DASHBOARD_MODE,
  ensureUserPreferences,
} from "@/lib/services/user-preferences.service";

const logger = createLogger({ service: "user-preferences-api" });

function isMissingUserPreferenceError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const rl = await rateLimitGeneral(`prefs_${userId}`, userId);
  if (rl) return rl;

  try {
    const preferences = await ensureUserPreferences(userId);
    const response = NextResponse.json({ preferences });
    response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
    return response;
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to fetch preferences");
    return apiError("Failed to fetch preferences", 500);
  }
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const rl = await rateLimitGeneral(`prefs_update_${userId}`, userId);
  if (rl) return rl;

  try {
    const body = await req.json();
    const validation = UserPreferencesSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid request body", 400);
    }

    // Single read — get existing row (including onboardingCompletedAt) in one shot.
    // If missing, bootstrap it then update. Avoids two separate DB calls.
    const existing = await prisma.userPreference.findUnique({
      where: { userId },
      select: { onboardingCompletedAt: true },
    });

    if (!existing) {
      await ensureUserPreferences(userId);
    }

    const {
      preferredRegion,
      experienceLevel,
      dashboardMode,
      interests,
      onboardingCompleted,
      tourCompleted,
    } = validation.data;

    const updateData = {
      preferredRegion,
      experienceLevel,
      ...(dashboardMode ? { dashboardMode } : {}),
      interests: interests as ("CRYPTO")[],
      onboardingCompleted,
      onboardingCompletedAt: onboardingCompleted
        ? existing?.onboardingCompletedAt || new Date()
        : null,
      tourCompleted,
    };

    let preferences = await prisma.userPreference.update({
      where: { userId },
      data: updateData,
    }).catch((error) => {
      if (isMissingUserPreferenceError(error)) return null;
      throw error;
    });

    if (!preferences) {
      await prisma.userPreference.upsert({
        where: { userId },
        create: buildDefaultUserPreferenceData(userId),
        update: {},
      });
      preferences = await prisma.userPreference.update({
        where: { userId },
        data: { ...updateData, dashboardMode: dashboardMode ?? DEFAULT_DASHBOARD_MODE },
      });
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to save preferences");
    return apiError("Failed to save preferences", 500);
  }
}
