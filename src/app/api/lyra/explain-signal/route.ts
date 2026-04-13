import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createHash } from "crypto";
import { getGpt54Model } from "@/lib/ai/service";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getCache, setCache } from "@/lib/redis";
import { apiError } from "@/lib/api-response";
import { logFireAndForgetError } from "@/lib/fire-and-forget";

const logger = createLogger({ service: "lyra-explain-signal" });

export const dynamic = "force-dynamic";
export const preferredRegion = "bom1";

interface ExplainSignalRequest {
  title: string;
  score: number;
  definition: string;
  drivers: string[];
  context: string;
  limitations: string;
}

interface ExplainSignalResponse {
  summary: string;
  whatItMeans: string;
  whatToWatch: string;
  nextAction: string;
}

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

async function generateExplanation(payload: ExplainSignalRequest): Promise<ExplainSignalResponse> {
  const prompt = `You are Lyra, a clear and concise market intelligence assistant.
Explain this signal to a user in plain English.

SIGNAL:
${JSON.stringify(payload, null, 2)}

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

  const result = await generateText({
    model: getGpt54Model("lyra-nano"),
    prompt,
    maxOutputTokens: 220,
  });

  const cleaned = result.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<ExplainSignalResponse>;

  if (!parsed.summary || !parsed.whatItMeans || !parsed.whatToWatch || !parsed.nextAction) {
    throw new Error("Invalid signal explanation format");
  }

  return {
    summary: parsed.summary,
    whatItMeans: parsed.whatItMeans,
    whatToWatch: parsed.whatToWatch,
    nextAction: parsed.nextAction,
  };
}

export async function POST(req: NextRequest) {
  let payload: ExplainSignalRequest | null = null;

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    try {
      payload = (await req.json()) as ExplainSignalRequest;
    } catch {
      return apiError("Request body must be valid JSON", 400);
    }
    if (!payload?.title || typeof payload.score !== "number" || !payload.definition) {
      return apiError("Invalid request", 400);
    }

    const key = cacheKey(payload);
    const cached = await getCache<ExplainSignalResponse>(key);
    if (cached) {
      return NextResponse.json({ success: true, explanation: cached });
    }

    const explanation = await generateExplanation(payload);
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
