import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { generateText } from "ai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DailyBriefingService } from "@/lib/services/daily-briefing.service";
import { getGpt54Model } from "@/lib/ai/service";
import { buildHumanizerGuidance } from "@/lib/ai/prompts/humanizer";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { getCache, setCache } from "@/lib/redis";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "portfolio-decision-memo" });

export const dynamic = "force-dynamic";

interface DecisionMemoResponse {
  headline: string;
  summary: string;
  focus: string;
  nextAction: string;
  bullets: string[];
}

function cacheKey(portfolioId: string, fingerprint: string): string {
  return `portfolio:decision-memo:${portfolioId}:${fingerprint}`;
}

function buildFallback(input: {
  portfolioName: string;
  regimeLabel: string;
  summary: string;
  holdings: Array<{ symbol: string; compatibilityScore: number | null; changePercent: number | null }>;
}): DecisionMemoResponse {
  const topHolding = input.holdings[0];
  return {
    headline: `${input.portfolioName} is being driven by ${input.regimeLabel.toLowerCase()} conditions`,
    summary: input.summary,
    focus: topHolding
      ? `${topHolding.symbol} is the main name to review because it is the first holding in the current read.`
      : "No holdings were found, so the memo should start with portfolio setup.",
    nextAction: `Use the current market brief to decide whether to defend, trim or add to ${topHolding?.symbol ?? "your core positions"}.`,
    bullets: [
      topHolding ? `${topHolding.symbol} is the most immediate position to inspect.` : "Add holdings to unlock a more useful memo.",
      input.regimeLabel,
      input.summary,
    ].filter(Boolean),
  };
}

async function generateMemo(input: {
  portfolioName: string;
  region: string;
  regimeLabel: string;
  summary: string;
  holdings: Array<{ symbol: string; name: string; type: string; changePercent: number | null; compatibilityScore: number | null; }>; 
  dailyBriefing: Awaited<ReturnType<typeof DailyBriefingService.getBriefing>>;
}): Promise<DecisionMemoResponse> {
  const prompt = `You are Lyra, a concise institutional portfolio analyst.
Write a decision memo for the user's portfolio.

${buildHumanizerGuidance("portfolio decision memo")}

PORTFOLIO:
${JSON.stringify({
  portfolioName: input.portfolioName,
  region: input.region,
  regimeLabel: input.regimeLabel,
  summary: input.summary,
  holdings: input.holdings,
}, null, 2)}

MARKET BRIEF:
${input.dailyBriefing ? JSON.stringify({
  marketOverview: input.dailyBriefing.marketOverview,
  keyInsights: input.dailyBriefing.keyInsights,
  risksToWatch: input.dailyBriefing.risksToWatch,
  regimeLabel: input.dailyBriefing.regimeLabel,
  regimeSentence: input.dailyBriefing.regimeSentence,
}, null, 2) : "No daily briefing available."}

INSTRUCTIONS:
- Return ONLY valid JSON.
- Keep it short, direct and useful.
- Focus on portfolio posture, biggest risk, and the next practical decision.
- Do not give financial advice or price predictions.
- Write in plain English so a non-expert can understand it on the first read.
- Avoid sounding like a generic market report.

JSON SHAPE:
{
  "headline": "short title",
  "summary": "1-2 short sentences in plain English",
  "focus": "one short sentence",
  "nextAction": "one short sentence",
  "bullets": ["bullet 1", "bullet 2", "bullet 3"]
}`;

  const result = await generateText({
    model: getGpt54Model("lyra-mini"),
    prompt,
    maxOutputTokens: 280,
    temperature: 0.25,
  });

  const cleaned = result.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<DecisionMemoResponse>;

  if (!parsed.headline || !parsed.summary || !parsed.focus || !parsed.nextAction) {
    throw new Error("Invalid portfolio decision memo format");
  }

  return {
    headline: parsed.headline,
    summary: parsed.summary,
    focus: parsed.focus,
    nextAction: parsed.nextAction,
    bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 3).filter((item): item is string => typeof item === "string") : [],
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let fallbackInput: {
    portfolioName: string;
    regimeLabel: string;
    summary: string;
    holdings: Array<{ symbol: string; compatibilityScore: number | null; changePercent: number | null }>;
  } | null = null;

  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;
    const portfolio = await prisma.portfolio.findFirst({
      where: { id, userId },
      include: {
        holdings: {
          include: {
            asset: {
              select: {
                symbol: true,
                name: true,
                type: true,
                changePercent: true,
                compatibilityScore: true,
              },
            },
          },
        },
        healthSnapshots: {
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    });

    if (!portfolio) {
      return apiError("Portfolio not found", 404);
    }

    const region = portfolio.region ?? "US";
    const dailyBriefing = await DailyBriefingService.getBriefing(region);
    const latestSnapshot = portfolio.healthSnapshots[0] ?? null;
    const holdings = portfolio.holdings.map((holding) => {
      const price = holding.asset.changePercent;
      return {
        symbol: holding.asset.symbol,
        name: holding.asset.name,
        type: holding.asset.type,
        changePercent: price,
        compatibilityScore: holding.asset.compatibilityScore,
      };
    });
    fallbackInput = {
      portfolioName: portfolio.name,
      regimeLabel: latestSnapshot?.regime ? String(latestSnapshot.regime) : region,
      summary: latestSnapshot
        ? `Health ${Math.round(latestSnapshot.healthScore ?? 0)}/100 · fragility ${Math.round(latestSnapshot.fragilityScore ?? 0)}/100`
        : "Health data is still warming up.",
      holdings,
    };

    const fingerprint = createHash("sha256").update(JSON.stringify({
      portfolioId: portfolio.id,
      holdings,
      latestSnapshot: latestSnapshot?.date?.toISOString?.() ?? null,
      dailyBriefingAt: dailyBriefing?.generatedAt ?? null,
    })).digest("hex");

    const key = cacheKey(portfolio.id, fingerprint);
    const cached = await getCache<DecisionMemoResponse>(key);
    if (cached) {
      return NextResponse.json({ success: true, memo: cached });
    }

    const memo = await generateMemo({
      portfolioName: portfolio.name,
      region,
      regimeLabel: latestSnapshot?.regime ? String(latestSnapshot.regime) : region,
      summary: fallbackInput.summary,
      holdings,
      dailyBriefing,
    });

    await setCache(key, memo, 6 * 60 * 60).catch(() => {});
    return NextResponse.json({ success: true, memo });
  } catch (error) {
    logger.warn({ err: sanitizeError(error) }, "Portfolio decision memo generation failed; using fallback");
    return NextResponse.json({
      success: true,
      memo: buildFallback(
        fallbackInput ?? {
          portfolioName: "Portfolio",
          regimeLabel: "mixed",
          summary: "The portfolio memo generator is temporarily unavailable.",
          holdings: [],
        },
      ),
    });
  }
}
