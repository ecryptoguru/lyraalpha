import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";
const logger = createLogger({ service: "lyra-api" });

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const history = await prisma.aIRequestLog.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        inputQuery: true,
        outputResponse: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, history });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Chat history fetch failed");
    return NextResponse.json(
      { success: false, error: "Failed to fetch history" },
      { status: 500 },
    );
  }
}
