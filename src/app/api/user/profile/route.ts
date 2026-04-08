import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ProfileUpdateSchema } from "@/lib/schemas";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { rateLimitGeneral } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "user-profile-api" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const rateLimitResponse = await rateLimitGeneral(`profile_${userId}`, userId);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const [clerk, dbUser] = await Promise.all([
      clerkClient(),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          plan: true,
          createdAt: true,
          subscriptions: {
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              plan: true,
              provider: true,
              status: true,
              currentPeriodStart: true,
              currentPeriodEnd: true,
              cancelAtPeriodEnd: true,
            },
          },
        },
      }),
    ]);

    let user: Awaited<ReturnType<typeof clerk.users.getUser>> | null = null;
    const isDevBypassUser = userId === "test-user-id";

    if (!isDevBypassUser) {
      try {
        user = await clerk.users.getUser(userId);
      } catch (error) {
        logger.warn({ err: sanitizeError(error), userId }, "Clerk profile fetch failed; serving DB fallback profile");
      }
    }

    const activeSub = dbUser?.subscriptions?.[0] || null;

    return NextResponse.json({
      profile: {
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        email: user?.emailAddresses?.[0]?.emailAddress || dbUser?.email || "",
        phone: user?.phoneNumbers?.[0]?.phoneNumber || "",
        imageUrl: user?.imageUrl || null,
        createdAt: user?.createdAt ? new Date(user.createdAt).toISOString() : dbUser?.createdAt?.toISOString() || null,
        lastSignInAt: user?.lastSignInAt ? new Date(user.lastSignInAt).toISOString() : null,
      },
      plan: dbUser?.plan || "STARTER",
      subscription: activeSub
        ? {
            plan: activeSub.plan,
            provider: activeSub.provider,
            status: activeSub.status,
            currentPeriodEnd: activeSub.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: activeSub.cancelAtPeriodEnd,
          }
        : null,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to fetch profile");
    return apiError("Failed to fetch profile", 500);
  }
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const rateLimitResponse = await rateLimitGeneral(`profile_update_${userId}`, userId);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await req.json();
    const validation = ProfileUpdateSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid request body", 400, validation.error.flatten() );
    }

    const { firstName, lastName } = validation.data;

    const clerk = await clerkClient();
    const updatedUser = await clerk.users.updateUser(userId, {
      firstName,
      lastName,
    });

    return NextResponse.json({
      profile: {
        firstName: updatedUser.firstName || "",
        lastName: updatedUser.lastName || "",
        email: updatedUser.emailAddresses?.[0]?.emailAddress || "",
        phone: updatedUser.phoneNumbers?.[0]?.phoneNumber || "",
      },
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to update profile");
    return apiError("Failed to update profile", 500);
  }
}
