import { NextRequest, NextResponse } from "next/server";
import { getGpt54Model } from "@/lib/ai/service";
import { z } from "zod";
import { generateObject } from "ai";
import { auth } from "@/lib/auth";
import { rateLimitChat } from "@/lib/rate-limit";
import { getUserPlan } from "@/lib/middleware/plan-gate";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { isRateLimitBypassEnabled } from "@/lib/runtime-env";

const RelatedSchema = z.object({
  topic: z.string().max(500).optional(),
  currentQuestion: z.string().max(500).optional(),
});

const logger = createLogger({ service: "lyra-related-api" });

/**
 * POST /api/lyra/related
 * Generate contextually related follow-up questions
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check — prevent unauthenticated LLM calls
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting (shares chat budget) — fetch plan once for correct tier limits
    const isTest = isRateLimitBypassEnabled();
    let rateLimitHeaders: Record<string, string> | undefined;
    if (!isTest) {
      const userPlan = await getUserPlan(userId);
      const { response: rateLimitError, success } = await rateLimitChat(userId, userPlan);
      if (rateLimitError) return rateLimitError;
      rateLimitHeaders = success?.headers;
    }

    const body = await request.json();
    const validation = RelatedSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
    }
    const { topic, currentQuestion } = validation.data;

    if (!topic && !currentQuestion) {
      return NextResponse.json(
        { success: false, error: "Topic or current question required" },
        { status: 400 },
      );
    }

    try {
      const { object } = await generateObject({
        model: getGpt54Model("lyra-nano"),
        schema: z.object({
          questions: z
            .array(z.string())
            .min(1)
            .max(3)
            .describe("List of 3 related follow-up questions"),
        }),
        prompt: `You are Lyra, a smart financial intelligence assistant. Based on the user's question, generate exactly 3 follow-up questions they'd naturally want to ask next.

User's Question: ${currentQuestion || topic}

DIVERSITY RULES (each question must be a DIFFERENT type):
1. **Deeper dive** — dig deeper into the same topic (e.g., "What's driving that volatility spike?")
2. **Risk angle** — surface a risk or concern (e.g., "What's the biggest risk if I hold this?")
3. **Comparison or context** — compare to a benchmark or zoom out to macro (e.g., "How does this compare to BTC?")

STYLE RULES:
- Maximum 12 words per question. Shorter = better.
- Simple language anyone can understand. No jargon.
- Conversational tone — like texting a smart friend.
- Questions should make the user think "oh yeah, I want to know that too."
- No buy/sell advice. Analytical framing only.
- Never include exchange suffixes for crypto ticker symbols (e.g., write "BTC" instead of "BTC-USD").`,
      });

      const response = NextResponse.json({
        success: true,
        questions: object.questions.slice(0, 3),
      });
      if (rateLimitHeaders) {
        for (const [k, v] of Object.entries(rateLimitHeaders)) response.headers.set(k, v);
      }
      return response;
    } catch (error) {
      logger.warn({ err: sanitizeError(error) }, "Related question generation failed, using fallback");

      // Fallback to generic questions
      const fallbackQuestions = [
        "What are the biggest risks to watch out for?",
        "How does this compare to similar investments?",
        "What key factors are moving the price right now?",
      ];

      const response = NextResponse.json({
        success: true,
        questions: fallbackQuestions,
      });
      if (rateLimitHeaders) {
        for (const [k, v] of Object.entries(rateLimitHeaders)) response.headers.set(k, v);
      }
      return response;
    }
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Related questions API failed");
    return NextResponse.json(
      { success: false, error: "Failed to generate related questions" },
      { status: 500 },
    );
  }
}
