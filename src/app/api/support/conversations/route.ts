import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { createSupportConversation, getUserOpenSupportConversation } from "@/lib/services/support.service";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "support-conversations-api" });

const CreateConversationSchema = z.object({
  subject: z.string().max(200).optional(),
  userContext: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const plan = await getUserPlan(userId);
  if (plan !== "PRO" && plan !== "ELITE" && plan !== "ENTERPRISE") {
    return apiError("Chat requires PRO or Elite", 403);
  }

  try {
    const conversation = await getUserOpenSupportConversation(userId);

    return NextResponse.json({ conversation });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to fetch support conversation");
    return apiError("Failed to fetch conversation", 500);
  }
}

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
    const validation = CreateConversationSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid request body", 400);
    }
    const { subject, userContext } = validation.data;

    const conversation = await createSupportConversation(userId, plan, {
      subject,
      userContext,
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to create support conversation");
    return apiError("Failed to create conversation", 500);
  }
}
