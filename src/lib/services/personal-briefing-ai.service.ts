import { generateObject } from "ai";
import { z } from "zod";
import { createHash } from "crypto";
import { getGpt54Model } from "@/lib/ai/service";
import { buildHumanizerGuidance } from "@/lib/ai/prompts/humanizer";
import type { DailyBriefing } from "@/lib/services/daily-briefing.service";
import type { PersonalBriefingResponse } from "@/lib/services/personal-briefing.service";
import { getCache, setCache } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { recordCronLlmCall } from "@/lib/ai/alerting";
import { calculateLLMCost } from "@/lib/ai/cost-calculator";
import { resolveGptDeployment } from "@/lib/ai/orchestration";

const logger = createLogger({ service: "personal-briefing-ai" });

const CACHE_TTL_SECONDS = 6 * 60 * 60;

export interface PersonalBriefingAIMemo {
  generatedAt: string;
  headline: string;
  summary: string;
  focus: string;
  nextAction: string;
  bullets: string[];
}

function cacheKey(userId: string, dailyBriefing: DailyBriefing | null, personalBriefing: PersonalBriefingResponse | null): string {
  const payload = {
    dailyBriefing: dailyBriefing
      ? {
          generatedAt: dailyBriefing.generatedAt,
          regimeLabel: dailyBriefing.regimeLabel,
          regimeSentence: dailyBriefing.regimeSentence,
          marketOverview: dailyBriefing.marketOverview,
          keyInsights: dailyBriefing.keyInsights,
          risksToWatch: dailyBriefing.risksToWatch,
        }
      : null,
    personalBriefing: personalBriefing?.briefing
      ? {
          date: personalBriefing.briefing.date,
          watchlistCount: personalBriefing.briefing.watchlistCount,
          topAssets: personalBriefing.briefing.topAssets.map((asset) => ({
            symbol: asset.symbol,
            signalScore: asset.signalScore,
            signalLabel: asset.signalLabel,
            compatibilityScore: asset.compatibilityScore,
            compatibilityLabel: asset.compatibilityLabel,
            changePercent: asset.changePercent,
            trendScore: asset.trendScore,
            momentumScore: asset.momentumScore,
          })),
          misaligned: personalBriefing.briefing.misaligned,
          strongMomentum: personalBriefing.briefing.strongMomentum,
          summary: personalBriefing.briefing.summary,
        }
      : { reason: personalBriefing?.reason ?? "no-personal-briefing" },
  };

  const fingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return `lyra:personal-briefing-ai:${userId}:${fingerprint}`;
}

function buildFallbackMemo(args: {
  dailyBriefing: DailyBriefing | null;
  personalBriefing: PersonalBriefingResponse | null;
}): PersonalBriefingAIMemo | null {
  const briefing = args.personalBriefing?.briefing;
  if (!briefing) return null;

  const topAsset = briefing.topAssets[0];
  const marketSentence = args.dailyBriefing?.marketOverview?.trim() ?? "The market brief is still loading.";

  return {
    generatedAt: new Date().toISOString(),
    headline: topAsset
      ? `${topAsset.symbol} is your highest-priority watchlist name today`
      : "Your watchlist is the clearest place to start today",
    summary: briefing.summary,
    focus: topAsset
      ? `${topAsset.symbol} has the strongest mix of signal strength and relevance in your current list.`
      : "Start with the most regime-sensitive names in your watchlist before expanding outward.",
    nextAction: args.dailyBriefing?.risksToWatch?.[0]
      ? `Keep an eye on the market risk: ${args.dailyBriefing.risksToWatch[0]}`
      : "Use the portfolio and discovery views to decide whether this is a protection day or a new-opportunity day.",
    bullets: [
      marketSentence,
      briefing.misaligned.length > 0
        ? `${briefing.misaligned.slice(0, 2).join(", ")} are the names most worth re-checking for regime mismatch.`
        : "No obvious regime mismatches surfaced in your watchlist right now.",
      briefing.strongMomentum.length > 0
        ? `${briefing.strongMomentum.slice(0, 2).join(", ")} are the strongest momentum names in your current list.`
        : "Momentum leadership is still mixed, so the setup is less about chasing and more about confirming direction.",
    ],
  };
}

async function generateMemo(args: {
  dailyBriefing: DailyBriefing | null;
  personalBriefing: PersonalBriefingResponse | null;
}): Promise<PersonalBriefingAIMemo | null> {
  const briefing = args.personalBriefing?.briefing;
  if (!briefing) return null;

  const prompt = `You are Lyra, an institutional-grade market intelligence assistant.
Write a personalized morning memo for a user based on their watchlist context and today's market brief.

${buildHumanizerGuidance("personalized morning memo")}

TODAY'S MARKET BRIEF:
${args.dailyBriefing ? JSON.stringify({
  marketOverview: args.dailyBriefing.marketOverview,
  keyInsights: args.dailyBriefing.keyInsights,
  risksToWatch: args.dailyBriefing.risksToWatch,
  regimeLabel: args.dailyBriefing.regimeLabel,
  regimeSentence: args.dailyBriefing.regimeSentence,
}) : "No daily briefing available."}

PERSONALIZED WATCHLIST CONTEXT:
${JSON.stringify(briefing)}

INSTRUCTIONS:
- Return ONLY valid JSON.
- Keep it short, concrete, and useful.
- No financial advice.
- Focus on what matters today and what to check next.
- Write like a person talking to a user, not like a template.
- Keep the language plain and easy to scan.

JSON SHAPE:
{
  "headline": "short title",
  "summary": "1-2 short sentences in plain English",
  "focus": "one short sentence about the main focus",
  "nextAction": "one short sentence about the next step",
  "bullets": ["bullet 1", "bullet 2", "bullet 3"]
}`;

  const memoSchema = z.object({
    headline: z.string(),
    summary: z.string(),
    focus: z.string(),
    nextAction: z.string(),
    bullets: z.array(z.string()).max(3),
  });

  const llmStart = Date.now();
  let object: z.infer<typeof memoSchema>;
  try {
    ({ object } = await generateObject({
      model: getGpt54Model("lyra-nano"),
      schema: memoSchema,
      prompt,
    }));
  } catch (llmError) {
    const latencyMs = Date.now() - llmStart;
    recordCronLlmCall({ job: "personal-briefing", costUsd: 0, latencyMs, success: false }).catch(() => {});
    throw llmError;
  }

  // P1: Wire cron LLM call into alerting
  const latencyMs = Date.now() - llmStart;
  const deployment = resolveGptDeployment("lyra-nano");
  const costBreakdown = calculateLLMCost({ model: deployment, inputTokens: Math.round(prompt.length / 4), outputTokens: Math.round(JSON.stringify(object).length / 4) });
  recordCronLlmCall({ job: "personal-briefing", costUsd: costBreakdown.totalCost, latencyMs, success: true }).catch(() => {});

  return {
    generatedAt: new Date().toISOString(),
    headline: object.headline,
    summary: object.summary,
    focus: object.focus,
    nextAction: object.nextAction,
    bullets: object.bullets,
  };
}

export class PersonalBriefingAiService {
  static async getMemo(userId: string, args: {
    dailyBriefing: DailyBriefing | null;
    personalBriefing: PersonalBriefingResponse | null;
  }): Promise<PersonalBriefingAIMemo | null> {
    const key = cacheKey(userId, args.dailyBriefing, args.personalBriefing);

    try {
      const cached = await getCache<PersonalBriefingAIMemo>(key);
      if (cached) return cached;
    } catch {
      // Redis unavailable — fall through to generation
    }

    try {
      const memo = await generateMemo(args);
      if (!memo) return null;
      await setCache(key, memo, CACHE_TTL_SECONDS).catch((err) => {
        logger.debug({ err: sanitizeError(err), userId }, "Failed to cache personal briefing AI memo (non-critical)");
      });
      return memo;
    } catch (error) {
      logger.warn({ err: sanitizeError(error), userId }, "Personal briefing AI memo generation failed; using fallback");
      return buildFallbackMemo(args);
    }
  }
}
