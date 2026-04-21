import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { createSupportMessage } from "@/lib/services/support.service";
import { checkPromptInjection } from "@/lib/ai/guardrails";
import { scrubPIIString } from "@/lib/ai/pii-scrub";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "support-messages" });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const plan = await getUserPlan(userId);
  if (plan !== "PRO" && plan !== "ELITE" && plan !== "ENTERPRISE") {
    return apiError("Chat requires PRO or Elite", 403);
  }

  try {
    const body = await req.json();
    const { conversationId, content, senderRole } = body;

    if (!conversationId || !content) {
      return apiError("Missing required fields", 400);
    }

    if (senderRole === "AGENT") {
      return apiError("Forbidden", 403);
    }

    // Guardrail: scan user content for prompt injection before persisting to DB
    const injectionCheck = checkPromptInjection(content);
    if (!injectionCheck.isValid) {
      logger.warn({ userId, reason: injectionCheck.reason }, "Prompt injection detected in support message");
      return apiError(injectionCheck.reason ?? "Invalid input", 400);
    }

    // Scrub PII from content before DB write
    const safeContent = scrubPIIString(content);

    const message = await createSupportMessage({
      conversationId,
      content: safeContent,
      senderId: userId,
      senderRole: "USER",
      allowedUserId: userId,
    });

    if (!message) {
      return apiError("Conversation not found", 404);
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to send support message");
    return apiError("Failed to send message", 500);
  }
}
