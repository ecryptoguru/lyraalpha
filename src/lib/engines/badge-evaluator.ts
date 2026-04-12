import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "badge-evaluator" });

// ─── Badge Definitions ───

export interface BadgeDefinition {
  slug: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name for UI
  category: "fundamentals" | "crypto" | "regime" | "discovery" | "streak" | "advanced" | "signals" | "portfolio" | "intelligence" | "platform";
  isEliteOnly: boolean;
  /** Module slugs that contribute to this badge */
  requiredModules?: string[];
  /** Minimum score (0-100) on required modules (optional) */
  minScore?: number;
  /** Minimum discovery cards explored (optional) */
  minDiscoveryExplores?: number;
  /** Minimum streak days (optional) */
  minStreakDays?: number;
  /** Minimum total modules completed (optional) */
  minModulesCompleted?: number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    slug: "trend-aware",
    name: "Trend Aware",
    description: "Understands how trend scores work and what they reveal about price direction consistency.",
    icon: "TrendingUp",
    category: "fundamentals",
    isEliteOnly: false,
    requiredModules: [
      "what-is-trend-score",
      "what-is-momentum",
      "what-is-volatility",
    ],
  },
  {
    slug: "momentum-scholar",
    name: "Momentum Scholar",
    description: "Deep understanding of momentum dynamics and how to read momentum signals in discovery.",
    icon: "Zap",
    category: "fundamentals",
    isEliteOnly: false,
    requiredModules: [
      "what-is-momentum",
      "what-is-trend-score",
      "score-inflections",
    ],
    minDiscoveryExplores: 5,
  },
  {
    slug: "risk-conscious",
    name: "Risk Conscious",
    description: "Completed all volatility and risk-related modules. Thinks risk-first.",
    icon: "ShieldAlert",
    category: "fundamentals",
    isEliteOnly: false,
    requiredModules: [
      "what-is-volatility",
      "what-is-liquidity",
      "what-is-trust-score",
    ],
  },
  {
    slug: "crypto-risk-conscious",
    name: "Crypto Risk Conscious",
    description: "Understands on-chain risk, structural vulnerabilities, and trust models in crypto.",
    icon: "Shield",
    category: "crypto",
    isEliteOnly: false,
    requiredModules: [
      "crypto-structural-risk",
      "understanding-network-activity",
      "holder-stability-explained",
      "crypto-trust-model",
    ],
  },
  {
    slug: "portfolio-transparency",
    name: "Portfolio Transparency",
    description: "Knows how to look through portfolio holdings to understand what you actually own.",
    icon: "Layers",
    category: "crypto",
    isEliteOnly: false,
    requiredModules: [
      "concentration-risk",
      "factor-exposure",
      "correlation-risk",
    ],
  },
  {
    slug: "regime-reader",
    name: "Regime Reader",
    description: "Understands market regimes and how they affect different asset classes.",
    icon: "Compass",
    category: "regime",
    isEliteOnly: false,
    requiredModules: [
      "what-is-market-regime",
      "regime-and-your-portfolio",
      "defensive-vs-risk-on",
    ],
  },
  {
    slug: "discovery-explorer",
    name: "Discovery Explorer",
    description: "Actively explores the discovery feed to find meaningful market signals.",
    icon: "Search",
    category: "discovery",
    isEliteOnly: false,
    minDiscoveryExplores: 50,
  },
  {
    slug: "streak-master",
    name: "Streak Master",
    description: "Maintained a 30-day learning streak. Consistency is the real edge.",
    icon: "Flame",
    category: "streak",
    isEliteOnly: false,
    minStreakDays: 30,
  },
  {
    slug: "complete-scholar",
    name: "Complete Scholar",
    description: "Completed 30+ learning modules across the entire curriculum.",
    icon: "BookOpen",
    category: "fundamentals",
    isEliteOnly: false,
    minModulesCompleted: 30,
  },
  {
    slug: "cross-asset-thinker",
    name: "Cross-Asset Thinker",
    description: "Completed advanced cross-asset analysis modules. Thinks in correlations, not isolation.",
    icon: "GitBranch",
    category: "advanced",
    isEliteOnly: true,
    requiredModules: [
      "cross-asset-correlation",
      "regime-transition-patterns",
      "historical-analogs",
    ],
  },
  {
    slug: "signal-reader",
    name: "Signal Reader",
    description: "Mastered the components of Signal Strength, confidence levels, and score dynamics.",
    icon: "Activity",
    category: "signals",
    isEliteOnly: false,
    requiredModules: [
      "what-is-signal-strength",
      "reading-confidence-levels",
      "score-dynamics-explained",
      "factor-alignment-explained",
    ],
  },
  {
    slug: "portfolio-builder",
    name: "Portfolio Builder",
    description: "Understands portfolio health, regime compatibility, and probabilistic modeling.",
    icon: "Briefcase",
    category: "portfolio",
    isEliteOnly: false,
    requiredModules: [
      "portfolio-health-explained",
      "monte-carlo-explained",
      "arcs-explained",
    ],
  },
  {
    slug: "stress-tester",
    name: "Stress Tester",
    description: "Mastered crash scenarios, the Shock Simulator, and comparative asset analysis.",
    icon: "ShieldAlert",
    category: "portfolio",
    isEliteOnly: true,
    requiredModules: [
      "stress-testing-basics",
      "compare-assets-guide",
      "shock-simulator-guide",
    ],
  },
  {
    slug: "lyra-user",
    name: "Lyra User",
    description: "Understands how to use Lyra effectively — query types, tiers, memory, and credits.",
    icon: "MessageSquare",
    category: "platform",
    isEliteOnly: false,
    requiredModules: [
      "ask-lyra-workflow",
      "how-lyra-tiers-work",
      "lyra-query-types",
      "lyra-memory-explained",
    ],
  },
  {
    slug: "market-analyst",
    name: "Market Analyst",
    description: "Reads analyst targets, insider buying, and sector rotation like a pro.",
    icon: "BarChart3",
    category: "intelligence",
    isEliteOnly: false,
    requiredModules: [
      "reading-analyst-signals",
      "insider-transactions-explained",
      "sector-rotation-basics",
    ],
  },
  {
    slug: "global-investor",
    name: "Global Investor",
    description: "Understands market structure nuances across different global regions.",
    icon: "Globe",
    category: "intelligence",
    isEliteOnly: false,
    requiredModules: [
      "india-market-structure",
      "defensive-vs-risk-on",
    ],
  },
];

// ─── Evaluation Engine ───

export interface BadgeEvalResult {
  slug: string;
  eligible: boolean;
  alreadyEarned: boolean;
  progress: {
    modulesCompleted: number;
    modulesRequired: number;
    discoveryExplores?: number;
    discoveryRequired?: number;
    streakDays?: number;
    streakRequired?: number;
    totalModules?: number;
    totalRequired?: number;
  };
}

/** Evaluate a single badge for a user */
export async function evaluateBadge(
  userId: string,
  badgeSlug: string,
): Promise<BadgeEvalResult> {
  const badge = BADGE_DEFINITIONS.find(b => b.slug === badgeSlug);
  if (!badge) {
    return {
      slug: badgeSlug,
      eligible: false,
      alreadyEarned: false,
      progress: { modulesCompleted: 0, modulesRequired: 0 },
    };
  }

  // Check if already earned
  const existing = await prisma.userBadge.findUnique({
    where: { userId_badgeSlug: { userId, badgeSlug } },
  });

  if (existing) {
    return {
      slug: badgeSlug,
      eligible: true,
      alreadyEarned: true,
      progress: { modulesCompleted: 0, modulesRequired: 0 },
    };
  }

  // Evaluate requirements
  let modulesCompleted = 0;
  const modulesRequired = badge.requiredModules?.length ?? 0;

  if (badge.requiredModules && badge.requiredModules.length > 0) {
    const completions = await prisma.learningCompletion.findMany({
      where: {
        userId,
        moduleSlug: { in: badge.requiredModules },
      },
      select: { moduleSlug: true, score: true },
    });

    if (badge.minScore) {
      // Only count modules with sufficient score
      modulesCompleted = completions.filter(
        c => c.score !== null && c.score >= badge.minScore!,
      ).length;
    } else {
      modulesCompleted = completions.length;
    }
  }

  // Discovery explores check
  let discoveryExplores: number | undefined;
  if (badge.minDiscoveryExplores) {
    discoveryExplores = await prisma.xPTransaction.count({
      where: { userId, action: "discovery_explore" },
    });
  }

  // Streak check
  let streakDays: number | undefined;
  if (badge.minStreakDays) {
    const progress = await prisma.userProgress.findUnique({
      where: { userId },
      select: { streak: true },
    });
    streakDays = progress?.streak ?? 0;
  }

  // Total modules check
  let totalModules: number | undefined;
  if (badge.minModulesCompleted) {
    totalModules = await prisma.learningCompletion.count({
      where: { userId },
    });
  }

  // Determine eligibility
  const modulesMet = modulesRequired === 0 || modulesCompleted >= modulesRequired;
  const discoveryMet = !badge.minDiscoveryExplores || (discoveryExplores ?? 0) >= badge.minDiscoveryExplores;
  const streakMet = !badge.minStreakDays || (streakDays ?? 0) >= badge.minStreakDays;
  const totalMet = !badge.minModulesCompleted || (totalModules ?? 0) >= badge.minModulesCompleted;
  const eligible = modulesMet && discoveryMet && streakMet && totalMet;

  return {
    slug: badgeSlug,
    eligible,
    alreadyEarned: false,
    progress: {
      modulesCompleted,
      modulesRequired,
      discoveryExplores,
      discoveryRequired: badge.minDiscoveryExplores,
      streakDays,
      streakRequired: badge.minStreakDays,
      totalModules,
      totalRequired: badge.minModulesCompleted,
    },
  };
}

/** Evaluate all badges for a user and award any newly eligible ones.
 *  Batch-optimized: 4 parallel queries instead of N*4 sequential ones. */
export async function evaluateAndAwardBadges(
  userId: string,
  isElite: boolean = false,
): Promise<{ awarded: string[]; progress: BadgeEvalResult[] }> {
  const eligibleBadges = BADGE_DEFINITIONS.filter(
    b => !b.isEliteOnly || isElite,
  );

  // Batch-fetch all data needed for evaluation (4 parallel queries)
  const [allCompletions, earnedBadges, discoveryCount, userProgress] = await Promise.all([
    prisma.learningCompletion.findMany({
      where: { userId },
      select: { moduleSlug: true, score: true },
    }),
    prisma.userBadge.findMany({
      where: { userId },
      select: { badgeSlug: true },
    }),
    prisma.xPTransaction.count({
      where: { userId, action: "discovery_explore" },
    }),
    prisma.userProgress.findUnique({
      where: { userId },
      select: { streak: true },
    }),
  ]);

  const completionMap = new Map(allCompletions.map(c => [c.moduleSlug, c.score]));
  const earnedSlugs = new Set(earnedBadges.map(b => b.badgeSlug));
  const totalModulesCompleted = allCompletions.length;
  const streakDays = userProgress?.streak ?? 0;

  const awarded: string[] = [];
  const progress: BadgeEvalResult[] = [];

  for (const badge of eligibleBadges) {
    // Already earned — skip
    if (earnedSlugs.has(badge.slug)) {
      progress.push({
        slug: badge.slug, eligible: true, alreadyEarned: true,
        progress: { modulesCompleted: 0, modulesRequired: 0 },
      });
      continue;
    }

    // Evaluate in-memory using pre-fetched data
    const modulesRequired = badge.requiredModules?.length ?? 0;
    let modulesCompleted = 0;
    if (badge.requiredModules && badge.requiredModules.length > 0) {
      for (const slug of badge.requiredModules) {
        const score = completionMap.get(slug);
        if (score !== undefined) {
          if (!badge.minScore || (score !== null && score >= badge.minScore)) {
            modulesCompleted++;
          }
        }
      }
    }

    const modulesMet = modulesRequired === 0 || modulesCompleted >= modulesRequired;
    const discoveryMet = !badge.minDiscoveryExplores || discoveryCount >= badge.minDiscoveryExplores;
    const streakMet = !badge.minStreakDays || streakDays >= badge.minStreakDays;
    const totalMet = !badge.minModulesCompleted || totalModulesCompleted >= badge.minModulesCompleted;
    const eligible = modulesMet && discoveryMet && streakMet && totalMet;

    progress.push({
      slug: badge.slug,
      eligible,
      alreadyEarned: false,
      progress: {
        modulesCompleted,
        modulesRequired,
        discoveryExplores: badge.minDiscoveryExplores ? discoveryCount : undefined,
        discoveryRequired: badge.minDiscoveryExplores,
        streakDays: badge.minStreakDays ? streakDays : undefined,
        streakRequired: badge.minStreakDays,
        totalModules: badge.minModulesCompleted ? totalModulesCompleted : undefined,
        totalRequired: badge.minModulesCompleted,
      },
    });

    if (eligible) {
      try {
        await prisma.userBadge.create({
          data: {
            userId,
            badgeSlug: badge.slug,
            metadata: {
              awardedBy: "auto-evaluator",
              evaluatedAt: new Date().toISOString(),
            },
          },
        });
        awarded.push(badge.slug);
        logger.info({ userId, badge: badge.slug }, "Badge awarded");
      } catch {
        logger.debug({ userId, badge: badge.slug }, "Badge already exists (race)");
      }
    }
  }

  return { awarded, progress };
}

/** Get all badges for a user (earned + available with progress) */
export async function getUserBadges(userId: string, isElite: boolean = false) {
  const earnedBadges = await prisma.userBadge.findMany({
    where: { userId },
    orderBy: { earnedAt: "desc" },
  });

  const earnedSlugs = new Set(earnedBadges.map(b => b.badgeSlug));

  const allBadges = BADGE_DEFINITIONS.filter(
    b => !b.isEliteOnly || isElite,
  ).map(def => ({
    ...def,
    earned: earnedSlugs.has(def.slug),
    earnedAt: earnedBadges.find(b => b.badgeSlug === def.slug)?.earnedAt ?? null,
  }));

  return {
    earned: allBadges.filter(b => b.earned),
    available: allBadges.filter(b => !b.earned),
    total: allBadges.length,
    earnedCount: earnedBadges.length,
  };
}

/** Get badge definition by slug */
export function getBadgeDefinition(slug: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find(b => b.slug === slug);
}
