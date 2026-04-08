import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "lyra-feedback" });

const FeedbackSchema = z.object({
  answerId: z.string().min(1).max(64),  // stable hash of the response content
  vote: z.union([z.literal(1), z.literal(-1)]),
  query: z.string().min(1).max(2000),
  responseSnippet: z.string().max(300).optional(),
  symbol: z.string().max(20).optional(),
  queryTier: z.enum(["SIMPLE", "MODERATE", "COMPLEX"]).optional(),
  model: z.string().max(100).optional(),
});

/**
 * POST /api/lyra/feedback
 * Submit thumbs up/down for a Lyra answer.
 * Enforces exactly one vote per (user, answer) pair via DB unique constraint.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    const body = await req.json();
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input", 400, parsed.error.flatten() );
    }

    const { answerId, vote, query, responseSnippet, symbol, queryTier, model } = parsed.data;

    // Upsert: if user already voted on this answer, update the vote; otherwise create.
    // The @@unique([userId, answerId]) constraint enforces one vote per answer in the DB.
    const feedback = await prisma.lyraFeedback.upsert({
      where: { userId_answerId: { userId, answerId } },
      create: { userId, answerId, vote, query, responseSnippet, symbol, queryTier, model },
      update: { vote },  // User can change their vote (flip) but only one vote persists
    });

    logger.info({ userId, vote, answerId, feedbackId: feedback.id }, "Lyra feedback recorded");
    return NextResponse.json({ success: true, id: feedback.id, vote: feedback.vote });
  } catch (error) {
    logger.error({ err: error }, "Feedback route failed");
    return apiError("Failed to save feedback", 500);
  }
}

/**
 * GET /api/lyra/feedback?answerId=<hash>
 * Read the current user's vote for a specific answer (for restoring UI state).
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("Unauthorized", 401);

    const answerId = req.nextUrl.searchParams.get("answerId") ?? "";
    if (!answerId) return NextResponse.json({ vote: null });

    const feedback = await prisma.lyraFeedback.findUnique({
      where: { userId_answerId: { userId, answerId } },
      select: { vote: true },
    });

    return NextResponse.json({ vote: feedback?.vote ?? null });
  } catch {
    return NextResponse.json({ vote: null });
  }
}
