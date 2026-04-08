"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  Flame, Trophy, BookOpen,
  ChevronRight, Lock, CheckCircle2, Clock,
  Star, Zap, Brain, Bitcoin, BarChart3,
  TrendingUp, Globe, Layers, Cpu, Search,
  Percent, Compass, ShieldCheck, GraduationCap, MessageSquare,
  ArrowRight, Target,
} from "lucide-react";
import Link from "next/link";
import { SectionErrorBoundary } from "@/components/error-boundary";
import { LearningPathsCarousel } from "@/components/dashboard/learning-paths";
import { ModuleOfTheDay } from "@/components/dashboard/module-of-the-day";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { usePlan } from "@/hooks/use-plan";
import { EliteTrigger } from "@/components/dashboard/elite-trigger";
import { PageHeader, StatChip } from "@/components/dashboard/page-header";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error ?? "Failed to load learning data");
  }

  return data;
};

// ─── Types ───

interface ProgressData {
  totalXp: number; level: number; streak: number; tierName: string;
  progressPercent: number; xpInCurrentLevel: number; xpNeededForNext: number;
  isMaxLevel: boolean; weeklyXp: number;
}

interface BadgeData {
  slug: string; name: string; description: string;
  icon: string; earned: boolean; earnedAt: string | null;
}

interface ModuleData {
  slug: string; title: string; category: string; xpReward: number;
  estimatedTime: string; description: string; completed: boolean;
  score: number | null; locked: boolean; isEliteOnly: boolean;
}

interface CategoryGroup {
  category: string; modules: ModuleData[];
  completedCount: number; totalCount: number;
}

interface ModulesResponse {
  categories: CategoryGroup[];
  totalModules: number;
  completedModules: number;
  accessibleModules: number;
  completedAccessibleModules: number;
}

// ─── Category Config (icon, color, emoji, tagline) ────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  label: string; icon: React.ComponentType<{ className?: string }>; color: string;
  glow: string; badge: string; tagline: string;
}> = {
  fundamentals: {
    label: "Score Fundamentals", icon: Brain,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    glow: "shadow-emerald-500/10",
    badge: "🧠", tagline: "Understand what the scores actually mean",
  },
  crypto: {
    label: "Crypto Intelligence", icon: Bitcoin,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    glow: "shadow-amber-500/10",
    badge: "⚡", tagline: "On-chain signals, not noise",
  },
  etf: {
    label: "ETF Transparency", icon: Layers,
    color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    glow: "shadow-sky-500/10",
    badge: "🔍", tagline: "Look through the wrapper",
  },
  mf: {
    label: "Mutual Fund Analysis", icon: Percent,
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    glow: "shadow-teal-500/10",
    badge: "📊", tagline: "Is your active fund secretly passive?",
  },
  commodity: {
    label: "Commodity Macro", icon: Globe,
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    glow: "shadow-orange-500/10",
    badge: "🌍", tagline: "Oil, gold and regime cycles",
  },
  regime: {
    label: "Market Regimes", icon: TrendingUp,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    glow: "shadow-emerald-500/10",
    badge: "📡", tagline: "Read the environment before the trade",
  },
  discovery: {
    label: "Discovery Feed", icon: Compass,
    color: "text-pink-400 bg-pink-500/10 border-pink-500/20",
    glow: "shadow-pink-500/10",
    badge: "🧭", tagline: "Turn discovery cards into insights",
  },
  advanced: {
    label: "Advanced — Elite", icon: Cpu,
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    glow: "shadow-yellow-500/10",
    badge: "🔬", tagline: "Cross-asset patterns and regime-level analysis",
  },
  signals: {
    label: "Signal Intelligence", icon: Zap,
    color: "text-primary bg-primary/10 border-primary/20",
    glow: "shadow-primary/10",
    badge: "⚡", tagline: "High confidence = fewer ideas, better ones",
  },
  portfolio: {
    label: "Portfolio Intelligence", icon: ShieldCheck,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    glow: "shadow-indigo-500/10",
    badge: "🛡️", tagline: "Build resilient, regime-aware portfolios",
  },
  platform: {
    label: "Platform Workflows", icon: MessageSquare,
    color: "text-primary bg-primary/10 border-primary/20",
    glow: "shadow-primary/10",
    badge: "�", tagline: "How each tool works and when to use it",
  },
  intelligence: {
    label: "Market Intelligence", icon: BarChart3,
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    glow: "shadow-rose-500/10",
    badge: "📰", tagline: "Narratives, catalysts, analyst signals and market structure",
  },
};

// ─── Main Page ───

export default function LearningPage() {
  return (
    <SectionErrorBoundary>
      <LearningHubContent />
    </SectionErrorBoundary>
  );
}

function LearningHubContent() {
  const { plan } = usePlan();
  const isEliteEquivalent = plan === "ELITE" || plan === "ENTERPRISE";
  const { data: progressRes, isLoading: progressLoading } = useSWR("/api/learning/progress", fetcher, { dedupingInterval: 30000, revalidateOnFocus: false });
  const { data: badgesRes, isLoading: badgesLoading } = useSWR("/api/learning/badges", fetcher, { dedupingInterval: 30000, revalidateOnFocus: false });
  const { data: modulesRes, isLoading: modulesLoading } = useSWR("/api/learning/modules", fetcher, { dedupingInterval: 30000, revalidateOnFocus: false });

  const progress: ProgressData = progressRes?.progress ?? {
    totalXp: 0, level: 1, streak: 0, tierName: "Beginner",
    progressPercent: 0, xpInCurrentLevel: 0, xpNeededForNext: 100,
    isMaxLevel: false, weeklyXp: 0,
  };

  const earnedBadges: BadgeData[] = badgesRes?.earned ?? [];
  const availableBadges: BadgeData[] = badgesRes?.available ?? [];
  const modulesData: ModulesResponse | null = modulesRes ?? null;
  const categories: CategoryGroup[] = useMemo(() => modulesData?.categories ?? [], [modulesData]);
  const totalModules: number = modulesData?.totalModules ?? 0;
  const accessibleModules: number = modulesData?.accessibleModules ?? 0;
  const completedAccessibleModules: number = modulesData?.completedAccessibleModules ?? 0;
  const showGlobalSkeleton = progressLoading && badgesLoading && modulesLoading;

  const [searchQuery, setSearchQuery] = useState("");

  const completedSlugs = useMemo(() => {
    const set = new Set<string>();
    categories.forEach(c => c.modules.forEach(m => { if (m.completed) set.add(m.slug); }));
    return set;
  }, [categories]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.map(cat => ({
      ...cat,
      modules: cat.modules.filter(m =>
        cat.category.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      )
    })).filter(cat => cat.modules.length > 0);
  }, [categories, searchQuery]);

  const nextIncompleteModule = useMemo(() => {
    if (accessibleModules === 0 || completedAccessibleModules === accessibleModules) return null;
    for (const cat of categories) {
      const incomplete = cat.modules.find(m => !m.completed && !m.locked);
      if (incomplete) return incomplete;
    }
    return null;
  }, [accessibleModules, categories, completedAccessibleModules]);

  // Percentage complete
  const overallPct = accessibleModules > 0 ? Math.round((completedAccessibleModules / accessibleModules) * 100) : 0;

  return (
    <div className="relative flex flex-col gap-6 md:gap-10 pb-24 p-3 sm:p-4 md:p-6 w-full min-w-0 overflow-x-hidden">
      <div className="relative z-10 animate-slide-up-fade">
        <PageHeader
          icon={<GraduationCap className="h-5 w-5" />}
          title="Learning Hub"
          eyebrow="Learn how to read the signals"
          chips={
            <>
              <StatChip value={`${completedAccessibleModules}/${accessibleModules}`} label="Modules" variant="amber" />
              <StatChip value={`${overallPct}%`} label="Done" variant={overallPct === 100 ? "green" : "muted"} />
              <StatChip value={progress.totalXp.toLocaleString()} label="XP" variant="blue" />
              {progress.streak > 0 && (
                <StatChip value={`${progress.streak}d`} label="Streak" variant="amber" />
              )}
            </>
          }
        />
      </div>

      {/* ── PROGRESS CARD ── */}
      <div className="animate-slide-up-fade animation-delay-100">
        <ProgressHeader progress={progress} isLoading={progressLoading} />
      </div>

      {/* ── STAT TILES ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 animate-slide-up-fade animation-delay-200">
        {[
          { icon: <Zap className="h-4 w-4 text-primary" />, label: "XP Earned", value: progress.totalXp.toLocaleString(), sub: "lifetime", bg: "bg-primary/5 border-primary/10" },
          { icon: <Flame className="h-4 w-4 text-orange-400" />, label: "Learning Streak", value: `${progress.streak}d`, sub: progress.streak >= 7 ? "🔥 on fire!" : "keep going", bg: "bg-orange-500/5 border-orange-500/10" },
          { icon: <Trophy className="h-4 w-4 text-amber-400" />, label: "Badges Earned", value: `${earnedBadges.length}/${earnedBadges.length + availableBadges.length}`, sub: earnedBadges.length === 0 ? "first one awaits" : "collected", bg: "bg-amber-500/5 border-amber-500/10" },
          { icon: <BookOpen className="h-4 w-4 text-sky-400" />, label: "Modules Done", value: `${completedAccessibleModules}/${accessibleModules}`, sub: `${overallPct}% accessible progress`, bg: "bg-sky-500/5 border-sky-500/10" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.4, ease: "easeOut" }}
            className={cn("rounded-2xl p-4 border", stat.bg)}
          >
            <div className="flex items-center gap-2 mb-1">
              {stat.icon}
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </div>
            <div className="text-xl font-bold text-foreground">{stat.value}</div>
            <div className="text-[10px] text-muted-foreground/50 mt-0.5">{stat.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* ── CONTINUE LEARNING BANNER ── */}
      {nextIncompleteModule && !searchQuery && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="animate-slide-up-fade"
        >
          <Link
            href={`/dashboard/learning/${nextIncompleteModule.slug}`}
            className="group flex items-center justify-between gap-4 bg-primary/8 hover:bg-primary/12 border border-primary/20 hover:border-primary/40 rounded-2xl px-5 py-4 transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-0.5">Continue where you left off</div>
                <div className="text-sm font-bold text-foreground">{nextIncompleteModule.title}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary shrink-0">
              <span className="hidden sm:block">Resume</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </motion.div>
      )}

      {/* ── MODULE OF THE DAY ── */}
      {!modulesLoading && categories.length > 0 && (
        <div className="animate-slide-up-fade animation-delay-200">
          <ModuleOfTheDay modules={categories.flatMap(c => c.modules)} />
        </div>
      )}

      {/* ── LEARNING PATHS ── */}
      {!modulesLoading && categories.length > 0 && (
        <div className="animate-slide-up-fade animation-delay-300 pt-2">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-bold uppercase tracking-wider">Learning paths</h2>
            <span className="text-[10px] text-muted-foreground/50 font-medium">· topic-by-topic sequences</span>
          </div>
          <p className="text-xs text-muted-foreground/60 mb-4 max-w-lg">
            Not sure where to start? Follow a curated path and earn bonus XP when you finish all modules in it.
          </p>
          <LearningPathsCarousel completedSlugs={completedSlugs} isElite={isEliteEquivalent} />
        </div>
      )}

      {/* ── BADGE SHOWCASE ── */}
      {badgesLoading ? (
        <div className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl animate-pulse h-28" />
      ) : (earnedBadges.length > 0 || availableBadges.length > 0) && (
        <div className="animate-slide-up-fade animation-delay-400">
          <BadgeShowcase earned={earnedBadges} available={availableBadges} />
        </div>
      )}

      {/* ── COURSE CATALOG ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2 animate-slide-up-fade animation-delay-500">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Full Course Catalog</h2>
          <p className="text-xs text-muted-foreground">
            {totalModules} visible modules across {categories.length} active topics. {accessibleModules} are available on your current plan.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-3xl border border-white/10 bg-card/70 pl-9 pr-4 text-xs font-medium placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors sm:w-64"
          />
        </div>
      </div>

      {/* ── MODULE GRID ── */}
      <div className="space-y-10 animate-slide-up-fade animation-delay-500">
        {modulesLoading ? (
          <div className="space-y-8">
            {Array.from({ length: showGlobalSkeleton ? 3 : 2 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-5 w-48 rounded-xl bg-muted/20 animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.from({ length: 3 }).map((__, j) => (
                    <div key={j} className="h-32 rounded-2xl bg-muted/10 border border-border/10 animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Search className="h-8 w-8 mx-auto opacity-20 mb-3" />
            <p className="text-sm font-bold">No modules match &quot;{searchQuery}&quot;</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Try shorter keywords like &quot;volatility&quot; or &quot;regime&quot;</p>
          </div>
        ) : (
          filteredCategories.map((cat, idx) => (
            <CategorySection key={cat.category} category={cat} animationDelay={idx * 0.06} />
          ))
        )}

        {!isEliteEquivalent && (
          <EliteTrigger context="learning_advanced_locked" plan={plan} variant="banner" />
        )}
      </div>
    </div>
  );
}

// ─── Progress Header ────────────────────────────────────────────────────────

function ProgressHeader({ progress, isLoading }: { progress: ProgressData; isLoading?: boolean }) {
  const tierEmoji: Record<string, string> = {
    Beginner: "🌱", Explorer: "🔭", Analyst: "📊",
    Expert: "⚡", Master: "🏆",
  };
  const emoji = tierEmoji[progress.tierName] ?? "🎯";

  return (
    <div className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
              <span className="text-2xl font-bold text-primary">{progress.level}</span>
            </div>
            {progress.streak >= 7 && (
              <div className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                <Flame className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span>{emoji}</span>
              <span>Level {progress.level} · {progress.tierName}</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
              {isLoading ? "—" : `${progress.totalXp.toLocaleString()} XP`}
            </div>
            {!progress.isMaxLevel && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {(progress.xpNeededForNext - progress.xpInCurrentLevel).toLocaleString()} XP until{" "}
                <span className="text-primary font-semibold">Level {progress.level + 1}</span>
              </div>
            )}
            {progress.isMaxLevel && (
              <div className="text-xs text-primary font-bold mt-0.5">🏆 Maximum level reached</div>
            )}
          </div>
        </div>

        <div className="flex-1 max-w-md space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <span>Level Progress</span>
            <span className="text-primary">{progress.progressPercent}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-primary/80 to-primary transition-all duration-1000 ease-out"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-primary" />
              {progress.weeklyXp} XP this week
            </span>
            {progress.streak > 0 && (
              <span className="flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-400" />
                {progress.streak}-day streak
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Badge Showcase ─────────────────────────────────────────────────────────

const BADGE_EMOJI: Record<string, string> = {
  "trend-aware": "📈",
  "risk-conscious": "🛡️",
  "regime-reader": "📡",
  "signal-reader": "⚡",
  "portfolio-builder": "🏗️",
  "stress-tester": "🔬",
  "momentum-scholar": "🚀",
  "cross-asset-thinker": "🌐",
  "market-analyst": "📰",
  "global-investor": "🌍",
  "etf-transparency": "🔍",
  "crypto-risk-conscious": "₿",
  "lyra-user": "🤖",
};

function BadgeShowcase({ earned, available }: { earned: BadgeData[]; available: BadgeData[] }) {
  const all = [...earned, ...available.slice(0, Math.max(0, 6 - earned.length))];
  return (
    <div className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-bold uppercase tracking-wider">Badges</span>
          <span className="text-[10px] text-muted-foreground/50 font-medium">· {earned.length} earned</span>
        </div>
        {earned.length === 0 && (
          <span className="text-[10px] text-muted-foreground/40 italic">Complete modules to unlock</span>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {all.map((badge) => {
          const isEarned = badge.earned;
          const emoji = BADGE_EMOJI[badge.slug] ?? "🎖️";
          return (
            <div
              key={badge.slug}
              title={badge.description}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-semibold transition-all duration-200",
                isEarned
                  ? "bg-primary/10 border-primary/25 text-primary hover:bg-primary/15 hover:border-primary/40"
                  : "bg-muted/10 border-border/10 text-muted-foreground/40 grayscale"
              )}
            >
              <span className={cn("text-base leading-none", !isEarned && "opacity-30")}>{emoji}</span>
              <span>{badge.name}</span>
              {isEarned ? (
                <CheckCircle2 className="h-3 w-3 text-primary/70 shrink-0" />
              ) : (
                <Lock className="h-3 w-3 opacity-30 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Category Section ────────────────────────────────────────────────────────

function CategorySection({ category, animationDelay = 0 }: { category: CategoryGroup; animationDelay?: number }) {
  const cfg = CATEGORY_CONFIG[category.category];
  const label = cfg?.label ?? category.category;
  const Icon = cfg?.icon ?? BookOpen;
  const percent = category.totalCount > 0
    ? Math.round((category.completedCount / category.totalCount) * 100) : 0;
  const isComplete = percent === 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay, duration: 0.4, ease: "easeOut" }}
      className="space-y-4"
    >
      {/* Category Header */}
      <div className="flex items-center gap-3">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center border shrink-0", cfg?.color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground leading-tight">{label}</h2>
              {cfg?.tagline && (
                <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-medium">{cfg.tagline}</p>
              )}
            </div>
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-widest shrink-0",
              isComplete ? "text-emerald-400" : "text-muted-foreground/50"
            )}>
              {isComplete ? "✓ Done" : `${category.completedCount}/${category.totalCount}`}
            </span>
          </div>
          {/* Category progress bar */}
          <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden mt-2">
            <div
              className={cn("h-full rounded-full transition-all duration-1000", isComplete ? "bg-emerald-500" : "bg-primary/50")}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-11">
        {category.modules.map((mod) => (
          <ModuleCard key={mod.slug} module={mod} categoryColor={cfg?.color} />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Module Card ─────────────────────────────────────────────────────────────

function ModuleCard({ module: mod, categoryColor }: { module: ModuleData; categoryColor?: string }) {
  const isLocked = mod.locked;
  const isCompleted = mod.completed;

  const inner = (
    <div className="flex items-start justify-between gap-3 h-full">
      <div className="flex-1 min-w-0">
        {/* Status + Title row */}
        <div className="flex items-center gap-1.5 mb-1.5">
          {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
          {isLocked && <Lock className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
          {mod.isEliteOnly && !isLocked && (
            <span className="text-[8px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20 shrink-0">
              Elite
            </span>
          )}
          <h3 className={cn(
            "text-sm font-bold leading-tight truncate",
            isCompleted ? "text-primary" : isLocked ? "text-muted-foreground/40" : "text-foreground",
          )}>
            {mod.title}
          </h3>
        </div>

        {/* Description */}
        <p className={cn(
          "text-xs leading-relaxed line-clamp-2",
          isLocked ? "text-muted-foreground/30" : "text-muted-foreground/70",
        )}>
          {mod.description}
        </p>

        {/* Footer: time + xp + score */}
        <div className="flex items-center gap-3 mt-2.5">
          <span className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground/50">
            <Clock className="h-2.5 w-2.5" />
            {mod.estimatedTime}
          </span>
          <span className={cn(
            "flex items-center gap-1 text-[9px] font-bold",
            isLocked ? "text-muted-foreground/30" : "text-primary/60",
          )}>
            <Zap className="h-2.5 w-2.5" />
            +{mod.xpReward} XP
          </span>
          {mod.score !== null && (
            <span className="text-[9px] font-bold text-emerald-400/70">
              {mod.score}% score
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      {!isLocked && (
        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
      )}
    </div>
  );

  const baseClass = cn(
    "group rounded-2xl p-4 border transition-all duration-300 flex",
    isLocked
      ? "bg-muted/5 border-border/10 opacity-50 cursor-not-allowed"
      : isCompleted
      ? cn("bg-primary/5 hover:bg-primary/8 border-primary/15 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5", categoryColor?.includes("border") ? "" : "")
      : "bg-card/60 hover:bg-card/80 border-border/15 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5"
  );

  if (isLocked) {
    return (
      <div className={baseClass} role="presentation" aria-label={`${mod.title} – Locked`}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={`/dashboard/learning/${mod.slug}`} className={baseClass}>
      {inner}
    </Link>
  );
}
