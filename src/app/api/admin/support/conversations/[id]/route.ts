import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { resolveSupportConversation } from "@/lib/services/support.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-support-conversation" });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const { id } = await params;

    const conversation = await resolveSupportConversation(id);

    if (!conversation) {
      return apiError("Conversation not found", 404);
    }

    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to resolve conversation");
    return apiError("Failed to resolve conversation", 500);
  }
}
