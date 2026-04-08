import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePlanTier, expireTrialIfNeeded } from "@/lib/middleware/plan-gate";
import { isVercelProduction } from "@/lib/runtime-env";
import { getUserCredits } from "@/lib/services/credit.service";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const debug = !isVercelProduction();

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, trialEndsAt: true },
    });

    let plan = normalizePlanTier(user?.plan as string | null | undefined);
    let trialEndsAt = user?.trialEndsAt ?? null;
    const credits = await getUserCredits(userId);

    ({ plan, trialEndsAt } = await expireTrialIfNeeded(userId, plan, trialEndsAt));

    const response = NextResponse.json({ plan, trialEndsAt, credits });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return NextResponse.json(
      debug
        ? { plan: "STARTER", trialEndsAt: null, credits: 0, debug: { resolved: false } }
        : { plan: "STARTER", trialEndsAt: null, credits: 0 },
    );
  }
}
