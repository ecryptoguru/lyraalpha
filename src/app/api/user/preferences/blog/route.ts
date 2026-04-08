import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BlogSubscriptionSchema } from "@/lib/schemas";
import { subscribeToBrevoBlogList, unsubscribeFromBrevoBlogList } from "@/lib/email/brevo";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { updateBlogSubscriptionPreference } from "@/lib/services/user-preferences.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "user-blog-pref-api" });

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const validation = BlogSubscriptionSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid request body", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    await updateBlogSubscriptionPreference(userId, validation.data.blogSubscribed);

    if (user?.email) {
      const synced = validation.data.blogSubscribed
        ? await subscribeToBrevoBlogList(user.email)
        : await unsubscribeFromBrevoBlogList(user.email);

      if (!synced) {
        logger.warn(
          { userId, email: user.email, blogSubscribed: validation.data.blogSubscribed },
          "Blog preference saved but Brevo sync failed",
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to update blog preference");
    return apiError("Failed to update blog preference", 500);
  }
}
