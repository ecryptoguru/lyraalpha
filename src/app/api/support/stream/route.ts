import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { streamText } from "ai";
import { z } from "zod";
import { createSupportMessage } from "@/lib/services/support.service";
import {
  buildSupportPrompt,
  MYRA_MAX_TOKENS,
  getMyraResponseCache,
  setMyraResponseCache,
} from "@/lib/support/ai-responder";
import { checkPromptInjection } from "@/lib/ai/guardrails";
import { rateLimitChat } from "@/lib/rate-limit";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { getGpt54Model } from "@/lib/ai/service";
import { createLogger } from "@/lib/logger";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "support-stream" });

export const maxDuration = 60;
export const preferredRegion = "bom1";

const SupportStreamSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(5000, "Message is too long").trim(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  const userPlan = await getUserPlan(userId);
  if (userPlan !== "PRO" && userPlan !== "ELITE" && userPlan !== "ENTERPRISE") {
    return apiError("Support chat requires PRO or Elite", 403);
  }

  const rateLimitResult = await rateLimitChat(userId, userPlan);
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }

  const body = await req.json();
  const validation = SupportStreamSchema.safeParse(body);

  if (!validation.success) {
    return apiError("Invalid fields", 400, validation.error.flatten() );
  }

  const { conversationId, content } = validation.data;

  const injectionCheck = checkPromptInjection(content);
  if (!injectionCheck.isValid) {
    logger.warn({ userId, conversationId }, "Prompt injection detected in support stream");
    return apiError(injectionCheck.reason ?? "Invalid input", 400);
  }

  const conv = await prisma.supportConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, plan: true, userContext: true, status: true },
  });
  if (!conv) {
    return apiError("Not found", 404);
  }
  if (conv.status === "RESOLVED" || conv.status === "CLOSED") {
    return apiError("Conversation closed", 409);
  }

  const ctx = (conv.userContext ?? {}) as Record<string, unknown>;
  const prompt = await buildSupportPrompt(conversationId, content, {
    plan: conv.plan,
    email: ctx.email as string | undefined,
    credits: ctx.credits as number | undefined,
    currentPage: ctx.currentPage as string | undefined,
    region: ctx.region as string | undefined,
  });

  if (prompt.staticReply) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(prompt.staticReply!));
        controller.close();
      },
    });
    void createSupportMessage({
      conversationId,
      content: prompt.staticReply,
      senderId: "AI_ASSISTANT",
      senderRole: "AGENT",
      nextStatus: "PENDING",
    }).catch(() => {});
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Accel-Buffering": "no" },
    });
  }

  // ── Myra response cache: skip LLM for repeated FAQ queries ──
  const isPublic = false;
  const cachedResponse = await getMyraResponseCache(content, conv.plan, isPublic);
  if (cachedResponse) {
    logger.info({ conversationId }, "Myra response cache HIT");
    const encoder = new TextEncoder();
    const cachedStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(cachedResponse));
        controller.close();
      },
    });
    void createSupportMessage({
      conversationId,
      content: cachedResponse,
      senderId: "AI_ASSISTANT",
      senderRole: "AGENT",
      nextStatus: "PENDING",
    }).catch(() => {});
    return new Response(cachedStream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Accel-Buffering": "no" },
    });
  }

  const result = streamText({
    model: getGpt54Model("myra"),
    maxOutputTokens: MYRA_MAX_TOKENS,
    providerOptions: {
      openai: {
        textVerbosity: "medium" as const,
        promptCacheKey: "myra-system-v1",
      },
    },
    system: prompt.system,
    messages: prompt.messages,
  });

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          fullText += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } finally {
        controller.close();
        const usage = await result.usage;
        const u = usage as Record<string, unknown>;
        const inTok = (u?.inputTokens as number) ?? 0;
        const outTok = (u?.outputTokens as number) ?? 0;
        const cached = (u?.cachedInputTokens as number) ?? 0;
        const hitRate = inTok > 0 ? ((cached / inTok) * 100).toFixed(0) : 0;
        logger.info({ provider: "gpt-myra", inTok, cached, outTok, cacheHitRate: hitRate }, "Myra stream usage");
        if (fullText.trim()) {
          void createSupportMessage({
            conversationId,
            content: fullText.trim(),
            senderId: "AI_ASSISTANT",
            senderRole: "AGENT",
            nextStatus: "PENDING",
          }).catch(() => {});
          void setMyraResponseCache(content, conv.plan, isPublic, fullText.trim()).catch(() => {});
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Accel-Buffering": "no" },
  });
}
