import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { createSupportMessage } from "@/lib/services/support.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-support-messages" });

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;
  const adminUserId = check.userId;

  try {
    const body = await req.json();
    const { conversationId, content } = body;

    if (!conversationId || !content) {
      return apiError("Missing required fields", 400);
    }

    const message = await createSupportMessage({
      conversationId,
      content,
      senderId: adminUserId,
      senderRole: "AGENT",
      nextStatus: "PENDING",
    });

    if (!message) {
      return apiError("Conversation not found", 404);
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to send admin message");
    return apiError("Failed to send message", 500);
  }
}
