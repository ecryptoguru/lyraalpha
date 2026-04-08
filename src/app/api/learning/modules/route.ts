import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getModuleRegistry } from "@/lib/learning/module-registry";
import { isElitePlan, normalizePlanTier } from "@/lib/middleware/plan-gate";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "learning-modules-api" });

/**
 * GET /api/learning/modules
 * Returns all learning modules with user's completion status.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("Unauthorized", 401);
    }

    // Get user plan for Elite-only gating
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        preferences: {
          select: { preferredRegion: true },
        },
      },
    });
    const isElite = isElitePlan(normalizePlanTier(user?.plan as string | null | undefined));
    const preferredRegion = user?.preferences?.preferredRegion ?? "US";

    // Get all module metadata from registry
    const allModules = getModuleRegistry();

    // Get user's completions
    const completions = await prisma.learningCompletion.findMany({
      where: { userId },
      select: { moduleSlug: true, completedAt: true, score: true },
    });
    const completionMap = new Map(
      completions.map(c => [c.moduleSlug, { completedAt: c.completedAt, score: c.score }]),
    );

    // Merge modules with completion status
    const modules = allModules
      .filter((m) => !m.regionOnly || preferredRegion === "BOTH" || m.regionOnly === preferredRegion)
      .map(m => {
        const completion = completionMap.get(m.slug);
        return {
          ...m,
          completed: !!completion,
          completedAt: completion?.completedAt ?? null,
          score: completion?.score ?? null,
          locked: m.isEliteOnly && !isElite,
        };
      });

    // Group by category
    const groupedMap = new Map<string, { category: string; modules: typeof modules; completedCount: number; totalCount: number }>();
    let completedVisibleModules = 0;
    let accessibleModules = 0;
    let completedAccessibleModules = 0;

    for (const learningModule of modules) {
      if (!groupedMap.has(learningModule.category)) {
        groupedMap.set(learningModule.category, {
          category: learningModule.category,
          modules: [],
          completedCount: 0,
          totalCount: 0,
        });
      }

      const group = groupedMap.get(learningModule.category)!;
      group.modules.push(learningModule);
      group.totalCount += 1;

      if (learningModule.completed) {
        group.completedCount += 1;
        completedVisibleModules += 1;
      }

      if (!learningModule.locked) {
        accessibleModules += 1;
        if (learningModule.completed) {
          completedAccessibleModules += 1;
        }
      }
    }

    const grouped = Array.from(groupedMap.values());

    return NextResponse.json({
      success: true,
      categories: grouped,
      totalModules: modules.length,
      completedModules: completedVisibleModules,
      accessibleModules,
      completedAccessibleModules,
    }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Modules list fetch failed");
    return NextResponse.json(
      { error: "Failed to fetch modules" },
      { status: 500 },
    );
  }
}
