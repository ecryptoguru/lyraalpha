import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createHash } from "crypto";
import { getGpt54Model } from "@/lib/ai/service";
import { resolveGptDeployment } from "@/lib/ai/orchestration";
import { calculateLLMCost } from "@/lib/ai/cost-calculator";
import { alertIfDailyCostExceeded } from "@/lib/ai/alerting";
import { checkPromptInjection } from "@/lib/ai/guardrails";
import { scrubPIIString } from "@/lib/ai/pii-scrub";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getCache, setCache } from "@/lib/redis";
import { apiError } from "@/lib/api-response";
import { logFireAndForgetError } from "@/lib/fire-and-forget";
import { rateLimitGeneral } from "@/lib/rate-limit";

const logger = createLogger({ service: "lyra-explain-signal" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

const ExplainSignalInputSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  score: z.number().min(0).max(100),
  definition: z.string().min(1).max(1000).trim(),
  drivers: z.array(z.string().max(200)).max(10).default([]),
  context: z.string().max(2000).trim().default(""),
  limitations: z.string().max(1000).trim().default(""),
});

type ExplainSignalRequest = z.infer<typeof ExplainSignalInputSchema>;

const ExplainSignalSchema = z.object({
  summary: z.string(),
  whatItMeans: z.string(),
  whatToWatch: z.string(),
  nextAction: z.string(),
});

type ExplainSignalResponse = z.infer<typeof ExplainSignalSchema>;

function cacheKey(payload: ExplainSignalRequest): string {
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return `lyra:explain-signal:${hash}`;
}

function buildFallback(payload: ExplainSignalRequest): ExplainSignalResponse {
  const driverText = payload.drivers.slice(0, 3).join(", ") || "the underlying signal mix";
  return {
    summary: `${payload.title} is reading ${payload.score}/100, which means ${payload.definition.toLowerCase()}`,
    whatItMeans: `The strongest visible drivers are ${driverText}. ${payload.context}`,
    whatToWatch: payload.limitations,
    nextAction: `Watch for confirmation that ${payload.title.toLowerCase()} keeps improving rather than fading back into noise.`,
  };
}


export async function POST(req: NextRequest) {
  let payload: ExplainSignalRequest | null = null;

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const rateLimitResponse = await rateLimitGeneral(userId, userId);
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const body = await req.json();
      const validation = ExplainSignalInputSchema.safeParse(body);
      if (!validation.success) {
        return apiError("Invalid request", 400, validation.error.flatten());
      }
      payload = validation.data;
    } catch {
      return apiError("Request body must be valid JSON", 400);
    }

    // Guardrail: prompt injection scan on user-provided text fields
    const userText = [payload.title, payload.definition, ...payload.drivers, payload.context, payload.limitations].join(" ");
    const injectionCheck = checkPromptInjection(userText);
    if (!injectionCheck.isValid) {
      logger.warn({ userId }, "Prompt injection detected in explain-signal");
      return apiError(injectionCheck.reason ?? "Invalid input", 400);
    }

    // PII scrubbing on user-provided text fields
    payload = {
      ...payload,
      title: scrubPIIString(payload.title),
      definition: scrubPIIString(payload.definition),
      drivers: payload.drivers.map((d: string) => scrubPIIString(d)),
      context: scrubPIIString(payload.context),
      limitations: scrubPIIString(payload.limitations),
    };

    const key = cacheKey(payload);
    const cached = await getCache<ExplainSignalResponse>(key);
    if (cached) {
      return NextResponse.json({ success: true, explanation: cached });
    }

    const prompt = `You are Lyra, a clear and concise market intelligence assistant.
Explain this signal to a user in plain English.

SIGNAL:
${JSON.stringify(payload)}

INSTRUCTIONS:
- Return ONLY valid JSON.
- Keep it short and practical.
- Avoid jargon.
- Explain what this signal means, why it matters, what could weaken it, and the next thing to watch.

JSON SHAPE:
{
  "summary": "1 sentence",
  "whatItMeans": "1 sentence",
  "whatToWatch": "1 sentence",
  "nextAction": "1 sentence"
}`;

    const { object: explanation, usage } = await generateObject({
      model: getGpt54Model("lyra-nano"),
      schema: ExplainSignalSchema,
      prompt,
    });

    // Cost tracking: feed actual LLM spend into daily cost alert
    try {
      const deployment = resolveGptDeployment("lyra-nano");
      const costBreakdown = calculateLLMCost({
        model: deployment,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        cachedInputTokens: usage.cachedInputTokens ?? 0,
      });
      alertIfDailyCostExceeded(costBreakdown.totalCost).catch((e) => logFireAndForgetError(e, "explain-signal-cost-alert"));
    } catch (e) {
      logFireAndForgetError(e, "explain-signal-cost-calc");
    }

    await setCache(key, explanation, 24 * 60 * 60).catch((e) => logFireAndForgetError(e, "explain-signal-cache"));

    return NextResponse.json({ success: true, explanation });
  } catch (error) {
    logger.warn({ err: sanitizeError(error) }, "Signal explanation failed; using fallback");
    return NextResponse.json({
      success: true,
      explanation: buildFallback(
        payload ?? {
          title: "Signal",
          score: 0,
          definition: "needs a fresh read",
          drivers: [],
          context: "The explanation service is temporarily unavailable.",
          limitations: "Treat this as a fallback until Lyra can generate a fresh explanation.",
        },
      ),
    });
  }
}
