import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getModuleBySlug } from "@/lib/learning/module-registry";
import { getModuleContent } from "@/lib/learning/module-loader";
import { awardXP } from "@/lib/engines/gamification";
import { evaluateAndAwardBadges } from "@/lib/engines/badge-evaluator";
import { isElitePlan, normalizePlanTier } from "@/lib/middleware/plan-gate";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "learning-module-api" });

/**
 * GET /api/learning/modules/[slug]
 * Returns module metadata + parsed markdown content.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { slug } = await params;
    const metadata = getModuleBySlug(slug);
    if (!metadata) {
      return apiError("Module not found", 404);
    }

    // Elite gating
    if (metadata.isEliteOnly) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      });
      const plan = normalizePlanTier(user?.plan as string | null | undefined);
      if (!isElitePlan(plan)) {
        return NextResponse.json(
          { error: "This module requires an Elite plan", locked: true, metadata },
          { status: 403 },
        );
      }
    }

    // Load markdown content
    const content = await getModuleContent(metadata.category, slug);
    if (!content) {
      return NextResponse.json(
        { error: "Module content not available yet", metadata },
        { status: 404 },
      );
    }

    // Check completion status
    const completion = await prisma.learningCompletion.findUnique({
      where: { userId_moduleSlug: { userId, moduleSlug: slug } },
    });

    return NextResponse.json({
      success: true,
      metadata,
      content,
      completed: !!completion,
      completedAt: completion?.completedAt ?? null,
      score: completion?.score ?? null,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Module fetch failed");
    return NextResponse.json(
      { error: "Failed to fetch module" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/learning/modules/[slug]
 * Mark module as completed + award XP.
 * Body: { score?: number } (0-100 from Quick Check)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    const { slug } = await params;
    const metadata = getModuleBySlug(slug);
    if (!metadata) {
      return apiError("Module not found", 404);
    }

    if (metadata.isEliteOnly) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      });
      const plan = normalizePlanTier(user?.plan as string | null | undefined);
      if (!isElitePlan(plan)) {
        return NextResponse.json(
          { error: "This module requires an Elite plan", locked: true, metadata },
          { status: 403 },
        );
      }
    }

    // Parse optional score from body
    let score: number | null = null;
    try {
      const body = await req.json();
      if (typeof body.score === "number" && body.score >= 0 && body.score <= 100) {
        score = body.score;
      }
    } catch {
      // No body or invalid JSON — that's fine, score is optional
    }

    // Check if already completed
    const existing = await prisma.learningCompletion.findUnique({
      where: { userId_moduleSlug: { userId, moduleSlug: slug } },
    });

    if (existing) {
      // Update score if provided and higher than existing
      if (score !== null && (existing.score === null || score > existing.score)) {
        await prisma.learningCompletion.update({
          where: { userId_moduleSlug: { userId, moduleSlug: slug } },
          data: { score },
        });
      }
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        score: score !== null ? Math.max(score, existing.score ?? 0) : existing.score,
      });
    }

    // Mark as completed
    await prisma.learningCompletion.create({
      data: { userId, moduleSlug: slug, score },
    });

    const xpResult = await awardXP(
      userId,
      "complete_module",
      `Completed: ${metadata.title}`,
    );

    // Evaluate badges
    const badgeResults = await evaluateAndAwardBadges(userId);

    logger.info({ userId, slug, score }, "Module completed");

    return NextResponse.json({
      success: true,
      alreadyCompleted: false,
      score,
      xp: xpResult,
      badges: {
        newlyAwarded: badgeResults.awarded,
      },
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Module completion failed");
    return NextResponse.json(
      { error: "Failed to complete module" },
      { status: 500 },
    );
  }
}
