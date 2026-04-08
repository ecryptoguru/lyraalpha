import OpenAI from "openai";
import {
  DISCOVERY_BASE_SYSTEM,
  BUILD_WHY_INCLUDED_PROMPT,
} from "@/lib/ai/prompts/discovery";
import { AI_CONFIG, getAzureOpenAIApiKey, getAzureOpenAIBaseURL, getGpt54Deployment } from "@/lib/ai/config";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";

const logger = createLogger({ service: "lyra-service" });

let _openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({
      apiKey: getAzureOpenAIApiKey(),
      baseURL: getAzureOpenAIBaseURL(),
    });
  }
  return _openaiClient;
}

const CACHE_VERSION = "v2"; // Increment this to force-reset all cached explanations

export class LyraService {
  /**
   * Core logic: fetch mapping, build prompt, generate explanation.
   */
  private static async generateExplanation(assetId: string, sectorId: string): Promise<string> {
    const mapping = await prisma.stockSector.findUnique({
      where: { assetId_sectorId: { assetId, sectorId } },
      include: {
        asset: { include: { scores: { take: 6, orderBy: { date: "desc" } } } },
        sector: true,
        EvidenceReference: true,
      },
    });

    if (!mapping) throw new Error("Mapping not found for explanation");

    const institutionalSignals = {
      trend: 0, momentum: 0, volatility: 0, liquidity: 0, sentiment: 0, trust: 0,
    };
    mapping.asset.scores?.forEach((s) => {
      const type = s.type.toLowerCase() as keyof typeof institutionalSignals;
      if (type in institutionalSignals) institutionalSignals[type] = s.value;
    });

    const promptData = {
      stockName: mapping.asset.name,
      stockSymbol: mapping.asset.symbol,
      sectorName: mapping.sector.name,
      inclusionType: mapping.inclusionType,
      inclusionReason: mapping.inclusionReason || "Structural business alignment",
      scores: {
        R: mapping.relevanceScore, E: mapping.freshnessScore,
        B: mapping.strengthScore, N: mapping.densityScore, M: mapping.behaviorScore,
      },
      institutionalSignals,
      evidenceRefs: mapping.EvidenceReference.map((e) => ({
        sourceType: e.sourceType, title: e.title,
      })),
    };

    const openai = getOpenAIClient();
    const deployment = getGpt54Deployment("lyra-nano");
    const response = await openai.chat.completions.create({
      model: deployment,
      messages: [
        { role: "system", content: DISCOVERY_BASE_SYSTEM },
        { role: "user", content: BUILD_WHY_INCLUDED_PROMPT(promptData) },
      ],
      temperature: AI_CONFIG.temperature,
      max_tokens: 600,
    });

    return (response.choices[0]?.message?.content || "").trim();
  }

  /**
   * Generates an institutional "Why this stock is here" explanation.
   * Uses Next.js unstable_cache when available, falls back to direct execution.
   */
  static async explainInclusion(assetId: string, sectorId: string): Promise<string> {
    try {
      // Standalone script check: unstable_cache requires a Next.js request context.
      const isNextContext = typeof (global as unknown as { incrementalCache?: unknown }).incrementalCache !== 'undefined';

      if (isNextContext) {
        const cachedGenerator = unstable_cache(
          () => this.generateExplanation(assetId, sectorId),
          [`lyra-explanation-${CACHE_VERSION}-${assetId}-${sectorId}`],
          { revalidate: 60 * 60 * 24 * 7, tags: [`explanation-${assetId}`] },
        );
        return await cachedGenerator();
      }

      return await this.generateExplanation(assetId, sectorId);
    } catch (error) {
      logger.error(
        { err: sanitizeError(error), assetId, sectorId },
        "Explanation generation failed",
      );
      return "An explanation is currently unavailable for this inclusion.";
    }
  }
}
