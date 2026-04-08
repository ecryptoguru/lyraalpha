import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { resolveSupportConversation } from "@/lib/services/support.service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "support-conversations" });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const plan = await getUserPlan(userId);
  if (plan !== "PRO" && plan !== "ELITE" && plan !== "ENTERPRISE") {
    return apiError("Chat requires PRO or Elite", 403);
  }

  try {
    const { id } = await params;

    const updated = await resolveSupportConversation(id, userId);

    if (!updated) {
      return apiError("Conversation not found", 404);
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to update conversation");
    return apiError("Failed to update conversation", 500);
  }
}
