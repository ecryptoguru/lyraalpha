import { prisma } from "../prisma";
import { getGpt54Model } from "@/lib/ai/service";
import { buildHumanizerGuidance } from "@/lib/ai/prompts/humanizer";
import { generateText } from "ai";
import { createLogger } from "@/lib/logger";
import { safeJsonParse } from "@/lib/utils/json";

const logger = createLogger({ service: "trending-question-service" });

// Curated evergreen questions — used when DB is empty AND LLM generation fails.
// These are timeless enough to always feel relevant, covering all 6 categories.
const CURATED_FALLBACK_QUESTIONS = [
  { question: "What's driving the market right now?", category: "whats-moving" },
  { question: "Which sectors are leading and which are lagging?", category: "whats-moving" },
  { question: "What are the biggest risks in the market today?", category: "risk-check" },
  { question: "Is the current rally sustainable or overextended?", category: "risk-check" },
  { question: "How is inflation affecting different asset classes?", category: "big-picture" },
  { question: "What does the current interest rate path mean for crypto?", category: "big-picture" },
  { question: "How is Bitcoin performing relative to other crypto assets?", category: "compared-to" },
  { question: "Gold vs bonds — which is the better safe haven now?", category: "compared-to" },
  { question: "What makes a crypto's momentum score change?", category: "how-it-works" },
  { question: "How does market regime affect your portfolio?", category: "how-it-works" },
  { question: "Which AI crypto protocols have the strongest fundamentals?", category: "asset-spotlight" },
  { question: "Is Ethereum still undervalued compared to Bitcoin?", category: "asset-spotlight" },
];

export class TrendingQuestionService {
  /**
   * Returns 6 curated fallback questions (rotated by day-of-year for variety).
   */
  static getCuratedFallback(): Array<{ id: string; question: string; category: string; displayOrder: number }> {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const startIdx = (dayOfYear * 2) % CURATED_FALLBACK_QUESTIONS.length;
    const selected: typeof CURATED_FALLBACK_QUESTIONS = [];
    for (let i = 0; i < 6; i++) {
      selected.push(CURATED_FALLBACK_QUESTIONS[(startIdx + i) % CURATED_FALLBACK_QUESTIONS.length]);
    }
    return selected.map((q, i) => ({
      id: `curated-${i + 1}`,
      question: q.question,
      category: q.category,
      displayOrder: i + 1,
    }));
  }

  /**
   * Generates new trending questions using AI and updates the database
   */
  static async refreshTrendingQuestions() {
    logger.info("🤖 Generating new trending questions via AI");

    const prompt = `You are Lyra, a smart and approachable financial intelligence assistant. Generate 6 engaging questions that would make a curious investor want to click and learn more. These should feel like interesting things a smart friend might wonder about the markets today.

${buildHumanizerGuidance("trending questions")}

Requirements:
- Language: Clear, simple, no jargon. Anyone should understand these without a finance degree. Avoid words like "deconstruct", "regime", "tailwinds", "structural", "idiosyncratic", "confluence".
- Tone: Curious and thought-provoking — like headlines that make you go "hmm, I wonder about that".
- Topics: Mix of what's moving markets, risks to watch, big-picture trends, specific assets, comparisons, and how-things-work.
- Timeliness: Questions should feel relevant to today or this week — reference current events, earnings season, policy changes, or market moves.
- Analytical: No price predictions or financial advice. Focus on understanding WHY things are happening.
- Length: Maximum 12 words per question. Shorter is better.
- Variety: Each question must cover a different angle. No two questions about the same topic.
- Tickers: Never include exchange suffixes for crypto ticker symbols (e.g., write "BTC" instead of "BTC-USD").
- Keep the questions natural, like something a real person would type.

Categories (use exactly one per question):
- "whats-moving" — what's driving markets right now
- "risk-check" — what could go wrong, what to watch out for
- "big-picture" — macro themes, economic trends, policy shifts
- "asset-spotlight" — focused on a specific crypto asset
- "compared-to" — cross-asset comparisons or relative value
- "how-it-works" — educational, helps users understand market mechanics

Return ONLY a JSON array of 6 objects with this structure:
[
  {
    "question": "Question text here",
    "category": "whats-moving|risk-check|big-picture|asset-spotlight|compared-to|how-it-works"
  }
]`;

    try {
      const result = await generateText({
        model: getGpt54Model("lyra-nano"),
        prompt,
      });

      const response = result.text;

      // Clean and parse
      const cleanedResponse = response
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const newQuestions = safeJsonParse<{ question: string; category: string }[]>(cleanedResponse);

      if (!newQuestions || !Array.isArray(newQuestions) || newQuestions.length === 0) {
        throw new Error("Invalid question format from AI");
      }

      // Update database in a transaction
      await prisma.$transaction(async (tx) => {
        // Deactivate old
        await tx.trendingQuestion.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });

        // Batch insert — single round-trip instead of N sequential creates
        await tx.trendingQuestion.createMany({
          data: newQuestions.map((q: { question: string; category: string }, i: number) => ({
            question: q.question,
            category: q.category,
            displayOrder: i + 1,
            isActive: true,
            updatedAt: new Date(),
          })),
        });
      });

      logger.info(
        { count: newQuestions.length },
        "✅ Successfully refreshed trending questions",
      );
      return { success: true, count: newQuestions.length };
    } catch (error) {
      logger.error({ error }, "❌ Failed to refresh trending questions");
      throw error;
    }
  }
}
