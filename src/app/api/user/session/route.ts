import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "session-api" });

export const preferredRegion = "bom1";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const body = await request.json().catch(() => ({}));
  const { action, sessionId, eventType, path, metadata, deviceInfo, ipAddress } = body;

  try {
    switch (action) {
      case "start": {
        // Start a new session
        const newSession = await prisma.userSession.create({
          data: {
            userId,
            deviceInfo: deviceInfo || null,
            ipAddress: ipAddress || null,
          },
        });
        return NextResponse.json({ sessionId: newSession.id });
      }

      case "heartbeat": {
        // Update session activity timestamp
        if (!sessionId) {
          return apiError("sessionId required", 400);
        }
        await prisma.userSession.updateMany({
          where: { id: sessionId, userId },
          data: { lastActivityAt: new Date() },
        });
        return NextResponse.json({ success: true });
      }

      case "end": {
        // End a session
        if (!sessionId) {
          return apiError("sessionId required", 400);
        }
        await prisma.userSession.updateMany({
          where: { id: sessionId, userId },
          data: { 
            isActive: false, 
            endedAt: new Date() 
          },
        });
        return NextResponse.json({ success: true });
      }

      case "track": {
        // Track an activity event + update session heartbeat in parallel
        await Promise.all([
          prisma.userActivityEvent.create({
            data: {
              userId,
              sessionId: sessionId || null,
              eventType: eventType || "page_view",
              path: path || null,
              metadata: metadata || null,
            },
          }),
          sessionId
            ? prisma.userSession.updateMany({
                where: { id: sessionId, userId },
                data: { lastActivityAt: new Date() },
              }).catch(() => {})
            : Promise.resolve(),
        ]);
        return NextResponse.json({ success: true });
      }

      default:
        return apiError("Invalid action", 400);
    }
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Session POST failed");
    return apiError("Internal error", 500);
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    // Get or create active session
    const activeSession = await prisma.userSession.findFirst({
      where: { userId, isActive: true },
      orderBy: { lastActivityAt: "desc" },
    });

    return NextResponse.json({ 
      sessionId: activeSession?.id || null,
      hasActiveSession: !!activeSession 
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Session GET failed");
    return apiError("Internal error", 500);
  }
}