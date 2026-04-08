import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { DashboardModeSchema } from "@/lib/schemas";
import { apiError } from "@/lib/api-response";
import {
  DEFAULT_DASHBOARD_MODE,
  ensureUserPreferences,
  updateDashboardModePreference,
} from "@/lib/services/user-preferences.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ dashboardMode: DEFAULT_DASHBOARD_MODE }, { status: 401 });
  }

  try {
    const pref = await ensureUserPreferences(userId);

    const dashboardMode = pref.dashboardMode === "advanced" ? "advanced" : DEFAULT_DASHBOARD_MODE;
    return NextResponse.json({ dashboardMode });
  } catch {
    return NextResponse.json({ dashboardMode: DEFAULT_DASHBOARD_MODE });
  }
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = (await req.json()) as { dashboardMode?: unknown };
    const parsed = DashboardModeSchema.safeParse(body.dashboardMode);
    if (!parsed.success) {
      return apiError("Invalid dashboardMode", 400);
    }

    const pref = await updateDashboardModePreference(userId, parsed.data);

    return NextResponse.json({ dashboardMode: pref.dashboardMode });
  } catch {
    return apiError("Failed to update dashboard mode", 500);
  }
}
