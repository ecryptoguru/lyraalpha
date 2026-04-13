import { NextRequest } from "next/server";
import { streamText } from "ai";
import {
  buildSupportPrompt,
  MYRA_MAX_TOKENS,
  getMyraResponseCache,
  setMyraResponseCache,
} from "@/lib/support/ai-responder";
import { checkPromptInjection } from "@/lib/ai/guardrails";
import { rateLimitChat } from "@/lib/rate-limit";
import { logFireAndForgetError } from "@/lib/fire-and-forget";
import { getClientIp } from "@/lib/rate-limit/utils";
import { getGpt54Model } from "@/lib/ai/service";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "public-chat" });

export const maxDuration = 30;
export const preferredRegion = "bom1";

export async function POST(req: NextRequest) {
  try {
    const identifier = getClientIp(req);
    const rateLimitResult = await rateLimitChat(identifier, { type: "plan", value: "STARTER" });
    if (rateLimitResult.response) {
      return rateLimitResult.response;
    }

    const body = await req.json();
    const { message, history } = body as {
      message: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    const cappedHistory = (history ?? []).slice(-8);

    if (!message?.trim()) {
      return apiError("Missing message", 400);
    }

    if (message.trim().length > 500) {
      return apiError("Message too long", 400);
    }

    const injectionCheck = checkPromptInjection(message.trim());
    if (!injectionCheck.isValid) {
      logger.warn({ ip: identifier }, "Prompt injection detected in public chat");
      return apiError(injectionCheck.reason ?? "Invalid input", 400);
    }

    const prompt = await buildSupportPrompt(
      "__public__",
      message.trim(),
      { plan: "STARTER", isLoggedIn: false, currentPage: "landing" },
      cappedHistory,
    );

    if (prompt.staticReply) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(prompt.staticReply));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Accel-Buffering": "no" },
      });
    }

    // ── Myra response cache: public FAQ traffic is highly repetitive ──
    const trimmedMessage = message.trim();
    const cachedResponse = await getMyraResponseCache(trimmedMessage, "STARTER", true);
    if (cachedResponse) {
      logger.info("Public Myra response cache HIT");
      const encoder = new TextEncoder();
      const cachedStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(cachedResponse));
          controller.close();
        },
      });
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
        } catch (e) {
          logger.error({ err: sanitizeError(e) }, "Public chat stream error");
        } finally {
          controller.close();
          if (fullText.trim()) {
            void setMyraResponseCache(trimmedMessage, "STARTER", true, fullText.trim()).catch((e) => logFireAndForgetError(e, "myra-public-cache"));
          }
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Accel-Buffering": "no" },
    });
  } catch (err) {
    logger.error({ err: sanitizeError(err) }, "Public chat failed");
    return apiError("Failed to generate reply", 500);
  }
}
