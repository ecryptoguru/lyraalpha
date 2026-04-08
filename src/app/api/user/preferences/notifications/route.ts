import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { NotificationPreferencesSchema } from "@/lib/schemas";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/services/user-preferences.service";

const logger = createLogger({ service: "notification-preferences-api" });

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const notifications = await getNotificationPreferences(userId);

    return NextResponse.json({ notifications });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to fetch notification preferences");
    return apiError("Failed to fetch notification preferences", 500);
  }
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const validation = NotificationPreferencesSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid request body", 400);
    }

    const notifications = await updateNotificationPreferences(userId, validation.data);

    return NextResponse.json({ notifications });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to update notification preferences");
    return apiError("Failed to update notification preferences", 500);
  }
}
