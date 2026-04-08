import { cache } from "react";
import type { PlanTier } from "@/lib/ai/config";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { prisma } from "@/lib/prisma";
import { ensureUserExists } from "@/lib/utils/ensure-user";

interface DashboardViewer {
  userId: string | null;
  plan: PlanTier;
  onboardingCompleted: boolean;
}

export const getDashboardViewer = cache(async (): Promise<DashboardViewer> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      userId: null,
      plan: "STARTER",
      onboardingCompleted: false,
    };
  }

  try {
    const [, plan, preferences] = await Promise.all([
      ensureUserExists(userId),
      getUserPlan(userId),
      prisma.userPreference.findUnique({
        where: { userId },
        select: { onboardingCompleted: true },
      }),
    ]);

    return {
      userId,
      plan,
      onboardingCompleted: Boolean(preferences?.onboardingCompleted),
    };
  } catch {
    return {
      userId,
      plan: "STARTER",
      onboardingCompleted: false,
    };
  }
});
