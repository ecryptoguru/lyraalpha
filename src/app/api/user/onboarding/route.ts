import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { ensureUserPreferences, updateOnboardingState } from "@/lib/services/user-preferences.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "user-onboarding-api" });

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const body = await req.json();
    const { step, skipped, completed } = body;

    await ensureUserPreferences(userId);

    const updateData: Record<string, unknown> = {};

    if (typeof step === "number") {
      updateData.onboardingStep = step;
    }

    if (skipped === true) {
      updateData.onboardingSkipped = true;
      updateData.onboardingCompleted = true;
      updateData.onboardingCompletedAt = new Date();
    }

    if (completed === true) {
      updateData.onboardingCompleted = true;
      updateData.onboardingCompletedAt = new Date();
    }

    if (completed === false) {
      updateData.onboardingCompleted = false;
      updateData.onboardingCompletedAt = null;
      updateData.onboardingSkipped = false;
    }

    const preferences = await updateOnboardingState(userId, updateData);

    return NextResponse.json({
      success: true,
      step: preferences.onboardingStep,
      completed: preferences.onboardingCompleted,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to update onboarding");
    return apiError("Failed to update onboarding", 500);
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const preferences = await ensureUserPreferences(userId);

    return NextResponse.json({
      step: preferences?.onboardingStep ?? 0,
      completed: preferences?.onboardingCompleted ?? false,
      skipped: preferences?.onboardingSkipped ?? false,
      interests: preferences?.interests ?? [],
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch onboarding");
    return apiError("Failed to fetch onboarding", 500);
  }
}
