"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Star, Zap, Gift, Users, CreditCard, ChevronRight,
  CheckCircle2, Lock, BookOpen, Flame, Sparkles,
  TrendingUp, Target, Trophy, Crown, Globe, ShoppingCart, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardPoints } from "@/hooks/use-dashboard-points";
import { toast } from "sonner";
import { ShareInsightButton } from "@/components/dashboard/share-insight-button";
import { buildRewardShareObject } from "@/lib/intelligence-share";

// ─── Static Data ─────────────────────────────────────────────────────────────

const TIERS = [
  { name: "Beginner",   emoji: "🌱", levels: "1–5",    xpRange: "0–500",        multiplier: "1.0x", color: "text-success", bg: "bg-success/5 border-success/10",  glow: "shadow-success/5",  icon: BookOpen },
  { name: "Explorer",   emoji: "🔭", levels: "6–10",   xpRange: "500–2,000",    multiplier: "1.1x", color: "text-info",     bg: "bg-info/5 border-info/10",          glow: "shadow-info/5",      icon: Globe },
  { name: "Analyst",    emoji: "⚡", levels: "11–15",  xpRange: "2,000–5,000",  multiplier: "1.25x",color: "text-warning",  bg: "bg-warning/5 border-warning/10",    glow: "shadow-warning/5",   icon: Zap },
  { name: "Strategist", emoji: "🎯", levels: "16–20",  xpRange: "5,000–12,000", multiplier: "1.4x", color: "text-warning",  bg: "bg-warning/5 border-warning/10",    glow: "shadow-warning/5",   icon: Target },
  { name: "Expert",     emoji: "🏆", levels: "21–25",  xpRange: "12,000–25,000",multiplier: "1.5x", color: "text-warning",   bg: "bg-warning/5 border-warning/10",      glow: "shadow-warning/5",    icon: Trophy },
  { name: "Master",     emoji: "👑", levels: "26–30",  xpRange: "25,000–50,000",multiplier: "1.6x", color: "text-danger",  bg: "bg-danger/5 border-danger/10",    glow: "shadow-danger/5",   icon: Crown },
];

const XP_ACTIONS = [
  { action: "Daily Login",              xp: 5,   cap: "1×/day",       cat: "engagement" },
  { action: "Explain This Score",       xp: 5,   cap: "10×/day",      cat: "analytics"  },
  { action: "Ask Lyra a Question",      xp: 5,   cap: "10×/day",      cat: "analytics"  },
  { action: "Complete a Module",        xp: 25,  cap: "3×/day",       cat: "learning"   },
  { action: "Complete a Learning Path", xp: 50,  cap: "1×/day",       cat: "learning"   },
  { action: "Pass a Quiz",              xp: 20,  cap: "3×/day",       cat: "learning"   },
  { action: "Explore a Discovery Card", xp: 5,   cap: "15×/day",      cat: "discovery"  },
  { action: "Add to Watchlist",         xp: 5,   cap: "5×/day",       cat: "engagement" },
  { action: "Share an Analysis",        xp: 5,   cap: "3×/day",       cat: "engagement" },
  { action: "7-Day Streak Milestone",   xp: 50,  cap: "1× per week",  cat: "streak"     },
  { action: "First Credit Purchase",    xp: 100, cap: "Once",         cat: "purchase"   },
];

const CAT_COLORS: Record<string, string> = {
  engagement: "text-info bg-info/10 border-info/15",
  analytics:  "text-info bg-info/10 border-info/15",
  learning:   "text-success bg-success/10 border-success/15",
  discovery:  "text-warning bg-warning/10 border-warning/15",
  streak:     "text-warning bg-warning/10 border-warning/15",
  purchase:   "text-danger bg-danger/10 border-danger/15",
};

const REDEMPTIONS = [
  {
    type: "PRO_TRIAL_7D_WITH_CREDITS",
    label: "PRO Credit Bundle",
    sub: "50 Credits",
    xpCost: 500,
    credits: 50,
    plan: "PRO",
    color: "from-info/15 to-info/5",
    border: "border-info/20",
    glow: "hover:shadow-info/10",
  },
  {
    type: "ELITE_TRIAL_7D_WITH_CREDITS",
    label: "ELITE Credit Bundle",
    sub: "125 Credits",
    xpCost: 1000,
    credits: 125,
    plan: "ELITE",
    color: "from-primary/15 to-primary/5",
    border: "border-primary/20",
    glow: "hover:shadow-primary/10",
  },
];

const QUICK_EXAMPLES = [
  {
    title: "New user, first week",
    result: "~435 XP",
    color: "text-success",
    bg: "bg-success/5 border-success/15",
    steps: ["Login 7 days → 7 × 5 = 35 XP", "Ask Lyra 10×/day × 7 days → 350 XP", "2 modules → 50 XP"],
    note: "Almost Explorer tier already!",
  },
  {
    title: "Level 12 Analyst — multiplier in action",
    result: "+25% on all XP",
    color: "text-warning",
    bg: "bg-warning/5 border-warning/15",
    steps: ["Base 5 XP × 1.25 = 6 XP per Lyra Q", "Base 25 XP × 1.25 = 31 XP per module", "Applies to every single action you take"],
    note: "Your tier multiplier compounds over time.",
  },
  {
    title: "Redeeming a PRO Credit Bundle at 500 XP",
    result: "~14 active days",
    color: "text-info",
    bg: "bg-info/5 border-info/15",
    steps: ["Login 14 days → 70 XP", "Lyra 10q/day × 14 days → 350 XP", "4 modules → 100 XP = 520 XP"],
    note: "Reach it in under 2 weeks of normal use.",
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────
const VALID_TABS = new Set(["credits", "referral", "xp", "tiers"]);

function RewardsPageInner() {
  const { points, isLoading, mutate } = useDashboardPoints();
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") ?? "credits") as "credits" | "referral" | "xp" | "tiers";
  const [activeTab, setActiveTab] = useState<"credits" | "referral" | "xp" | "tiers">(
    VALID_TABS.has(initialTab) ? initialTab : "credits",
  );

  // Sync if user navigates to a different ?tab= while already on the page
  useEffect(() => {
    const t = searchParams.get("tab") as "credits" | "referral" | "xp" | "tiers";
    if (t && VALID_TABS.has(t)) setActiveTab(t);
  }, [searchParams]);

  const userXP: number = points?.xp ?? 0;
  const userLevel: number = points?.level ?? 1;
  const tierName: string = points?.tierName ?? "Beginner";
  const tierEmoji: string = points?.tierEmoji ?? "🌱";
  const progressPct: number = points?.progressPercent ?? 0;
  const weeklyXp: number = points?.weeklyXp ?? 0;
  const streak: number = points?.streak ?? 0;
  const xpNeeded: number = points?.xpNeededForNext ?? 100;
  const xpIn: number = points?.xpInCurrentLevel ?? 0;
  const isMax: boolean = points?.isMaxLevel ?? false;
  const userCredits: number = points?.credits ?? 0;
  const totalCreditsEarned: number = points?.totalCreditsEarned ?? 0;
  const referralCreditsEarned: number = points?.referralCreditsEarned ?? 0;

  const redeemedTypes = useMemo<Set<string>>(
    () => new Set((points?.redemptions ?? []).filter((r) => r.alreadyRedeemed).map((r) => r.type)),
    [points?.redemptions],
  );

  const currentTier = TIERS.find(t => t.name === tierName) ?? TIERS[0];
  const rewardShare = buildRewardShareObject({
    title: `${tierName} level momentum on LyraAlpha`,
    href: "/dashboard/rewards?tab=xp",
    takeaway: `I have reached Level ${userLevel} with ${userXP.toLocaleString()} XP and a ${currentTier.multiplier}x XP multiplier on LyraAlpha.`,
    context: `Rewards turn consistent research, learning and discovery into credits you can reinvest into portfolio reads, compare systems and shock simulations.`,
    scoreValue: `${userLevel}`,
  });

  async function handleRedeem(type: string) {
    setRedeeming(type);
    try {
      const res = await fetch("/api/learning/xp-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? "Redemption failed.", {
          description: "Check your XP balance and try again.",
        });
        return;
      }
      const json = await res.json().catch(() => ({}));
      toast.success("Credits added! 🎉", {
        description: `+${json.creditsAdded ?? ""} credits deposited to your balance.`,
      });
      // Global mutate — instantly updates rewards page, sidebar badge, and header credit display
      await mutate();
    } catch {
      toast.error("Network error", { description: "Please check your connection and try again." });
    } finally {
      setRedeeming(null);
    }
  }

  return (
    <div className="relative flex flex-col gap-6 md:gap-10 pb-24 p-3 sm:p-4 md:p-6 w-full min-w-0 overflow-x-hidden">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] animate-slide-up-fade">
        <div className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3 w-3" />
            LyraAlpha AI · Credits & XP
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-[0.92]">
            Your
            <span className="premium-gradient-text block">Credits & XP</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Credits are what you spend. XP is what you earn. Higher XP means faster accumulation and more credits to redeem.
          </p>
          <div className="mt-5">
            <ShareInsightButton share={rewardShare} label="Share milestone" />
          </div>
        </div>

        <div className="rounded-4xl border border-white/10 bg-background/60 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.52)] backdrop-blur-xl sm:p-7 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Credits snapshot</p>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-card/60 px-3 py-1">
              <span className="text-[10px]">{tierEmoji}</span>
              <span className="text-[10px] font-bold text-foreground">{currentTier.multiplier}</span>
              <span className="text-[10px] text-muted-foreground">{tierName}</span>
            </div>
          </div>

          {/* Credits row */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Available balance</div>
              <div className="text-lg font-bold text-foreground leading-tight">
                {isLoading ? "—" : `${userCredits.toLocaleString()} credits`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isLoading ? "—" : `${totalCreditsEarned.toLocaleString()} earned all-time`}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Toward 1,500 credits earned</span>
              <span className="text-primary">{isLoading ? "—" : `${Math.min(100, Math.round((totalCreditsEarned / 1500) * 100))}%`}</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-primary/80 to-primary transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(100, Math.round((totalCreditsEarned / 1500) * 100))}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground/80">
              {isLoading ? "" : totalCreditsEarned >= 1500 ? "Milestone reached 🎉" : `${(1500 - totalCreditsEarned).toLocaleString()} credits to milestone`}
            </div>
          </div>

          <div className="border-t border-white/8" />

          {/* XP level + progress bar */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
                <span className="text-xl font-bold text-primary">{userLevel}</span>
              </div>
              {streak >= 7 && (
                <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-warning flex items-center justify-center shadow-lg">
                  <Flame className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>{tierEmoji}</span>
                <span>Level {userLevel} · {tierName}</span>
              </div>
              <div className="text-lg font-bold text-foreground leading-tight">
                {isLoading ? "—" : `${userXP.toLocaleString()} XP`}
              </div>
              {!isMax && (
                <div className="text-xs text-muted-foreground">
                  {(xpNeeded - xpIn).toLocaleString()} XP until{" "}
                  <span className="text-primary font-semibold">Level {userLevel + 1}</span>
                </div>
              )}
              {isMax && <div className="text-xs text-primary font-bold">👑 Maximum level reached</div>}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Level Progress</span>
              <span className="text-primary">{progressPct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-primary/80 to-primary transition-all duration-1000 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground/80">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-primary" />
                {weeklyXp} XP this week
              </span>
              {streak > 0 && (
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-warning" />
                  {streak}-day streak
                </span>
              )}
            </div>
          </div>
        </div>
      </section>



      {/* ── Tabs ── */}
      <div className="animate-slide-up-fade animation-delay-300">
        <div className="flex gap-2 rounded-3xl border border-white/10 bg-card/70 p-1.5 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.52)] backdrop-blur-xl">
          {([
            { key: "credits" as const,  label: "Credits",     icon: CreditCard,  activeColor: "bg-primary text-primary-foreground shadow-lg shadow-primary/30 border-primary/50" },
            { key: "referral" as const,  label: "Referral",    icon: Users,       activeColor: "bg-info text-info-foreground shadow-lg shadow-info/30 border-info/50" },
            { key: "xp" as const,       label: "XP System",   icon: Zap,         activeColor: "bg-warning text-warning-foreground shadow-lg shadow-warning/30 border-warning/50" },
            { key: "tiers" as const,    label: "Tier Badges",  icon: Trophy,      activeColor: "bg-info text-info-foreground shadow-lg shadow-info/30 border-info/50" },
          ]).map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 border cursor-pointer select-none",
                  isActive
                    ? tab.activeColor
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-card/60 border-transparent hover:border-white/8",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "" : "opacity-60")} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ XP TAB ══ */}
      {activeTab === "xp" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

          {/* Earn XP Table */}
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest">How you earn XP</span>
            </div>
            <div className="divide-y divide-white/5">
              {XP_ACTIONS.map((a, i) => (
                <motion.div
                  key={a.action}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-white/2 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border capitalize tracking-wider", CAT_COLORS[a.cat])}>
                      {a.cat}
                    </span>
                    <span className="text-sm text-foreground font-medium">{a.action}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[10px] text-muted-foreground/50 font-bold">{a.cap}</span>
                    <span className="text-sm font-bold text-primary w-16 text-right">+{a.xp} XP</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Redemptions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest">Redeem XP for credits</span>
              <span className="text-[10px] text-muted-foreground/50 font-medium ml-1">— deposited to your balance immediately</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {REDEMPTIONS.map(r => {
                const redeemed = redeemedTypes.has(r.type);
                const canAfford = userXP >= r.xpCost;
                const isRedeeming = redeeming === r.type;
                return (
                  <div key={r.type} className={cn(
                    "rounded-4xl border p-6 bg-linear-to-br shadow-xl transition-all duration-300",
                    r.color, r.border, r.glow,
                  )}>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="font-bold text-sm uppercase tracking-wider">{r.label}</p>
                        <p className={cn("text-xs font-bold mt-0.5", r.type.includes("ELITE") ? "text-primary" : "text-info")}>{r.sub}</p>
                      </div>
                      {redeemed && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5 text-primary fill-primary/30" />
                        <span className="text-base font-bold text-primary">{r.xpCost} XP</span>
                      </div>
                      <button
                        onClick={() => handleRedeem(r.type)}
                        disabled={!canAfford || isRedeeming}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
                          canAfford
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                            : "bg-muted/30 text-muted-foreground cursor-not-allowed",
                        )}
                      >
                        {isRedeeming ? "Redeeming..." : canAfford
                          ? "Claim Bundle"
                          : <><Lock className="h-3 w-3 mr-1" />Need {(r.xpCost - userXP).toLocaleString()} XP</>}
                      </button>
                    </div>
                    {redeemed && (
                      <p className="mt-3 text-[10px] font-medium text-success/90">
                        You have redeemed this bundle before.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Examples */}
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
              <Flame className="h-4 w-4 text-warning" />
              <span className="text-xs font-bold uppercase tracking-widest">Real examples</span>
            </div>
            <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
              {QUICK_EXAMPLES.map((ex, i) => (
                <motion.div
                  key={ex.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="px-6 py-5 space-y-3"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{ex.title}</p>
                  <ul className="space-y-1.5">
                    {ex.steps.map(s => (
                      <li key={s} className="flex items-start gap-2 text-xs text-muted-foreground/70">
                        <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-primary/40" />
                        {s}
                      </li>
                    ))}
                  </ul>
                  <div>
                    <span className={cn("text-base font-bold", ex.color)}>{ex.result}</span>
                    <p className="text-[10px] text-muted-foreground/50 italic mt-0.5">{ex.note}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ══ TIERS TAB ══ */}
      {activeTab === "tiers" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <p className="text-xs text-muted-foreground max-w-lg">
            Tier is based on lifetime XP. Each tier multiplies everything you earn going forward. Badges awarded automatically.
          </p>
          {TIERS.map((tier, i) => {
            const isCurrent = tier.name === tierName;

            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className={cn(
                  "rounded-4xl border border-white/10 bg-card/70 p-5 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl transition-all duration-300",
                  tier.bg, tier.glow,
                  isCurrent && "ring-1 ring-primary/30 shadow-primary/10",
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-card/80 border border-white/5 flex items-center justify-center shrink-0 text-2xl shadow-lg">
                    {tier.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={cn("font-bold text-sm uppercase tracking-wider", tier.color)}>{tier.name}</span>
                      {isCurrent && (
                        <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/15 text-primary px-2 py-0.5 rounded-full border border-primary/30">
                          YOU ARE HERE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Levels {tier.levels} &bull; {tier.xpRange} XP
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-2xl font-bold", tier.color)}>{tier.multiplier}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">XP multiplier</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground/80 dark:text-muted-foreground/60 mt-4 pl-16">
                  {i === 0 && "Starting out. XP earns at base rate — no multiplier yet."}
                  {i === 1 && "10% on top of every action. It adds up faster than it sounds."}
                  {i === 2 && "A quarter more XP on everything. Research and modules compound well here."}
                  {i === 3 && "40% extra on all XP. Daily habits at this tier build credits quickly."}
                  {i === 4 && "Half again on every XP action. Credit bundles within reach most weeks."}
                  {i === 5 && "Maximum tier. 1.6× on all XP — this is the ceiling."}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ══ CREDITS TAB ══ */}
      {activeTab === "credits" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Header with Buy Credits CTA */}
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Current Balance</p>
            <a
              href="/dashboard/upgrade"
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 hover:border-primary/50 transition-all duration-200 cursor-pointer"
            >
              <ShoppingCart className="h-3 w-3" />
              Buy Credits
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>

          {/* Current Credit Balance Card */}
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {
                icon: <CreditCard className="h-4 w-4 text-primary" />,
                label: "Current Balance",
                value: isLoading ? "—" : userCredits.toLocaleString(),
                sub: "available to spend",
                bg: "bg-primary/5 border-primary/10",
                color: "text-primary",
              },
              {
                icon: <TrendingUp className="h-4 w-4 text-success" />,
                label: "Total Earned",
                value: isLoading ? "—" : totalCreditsEarned.toLocaleString(),
                sub: "all-time credits received",
                bg: "bg-success/5 border-success/10",
                color: "text-success",
              },
              {
                icon: <Zap className="h-4 w-4 text-warning" />,
                label: "XP Bundles Unlocked",
                value: isLoading ? "—" : redeemedTypes.size.toLocaleString(),
                sub: "bundle types redeemed",
                bg: "bg-warning/5 border-warning/10",
                color: "text-warning",
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className={cn("rounded-2xl p-4 border", stat.bg)}
              >
                <div className="flex items-center gap-2 mb-2">
                  {stat.icon}
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                </div>
                <div className={cn("text-2xl font-bold", stat.color)}>{stat.value}</div>
                <div className="text-[10px] text-muted-foreground/50 mt-0.5">{stat.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Credit Cost Table */}
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest">Credit Cost per Action</span>
            </div>
            <div className="divide-y divide-white/5">
              {[
                { action: "Viewing Asset Intel Page",   cost: "Free",      note: "per asset load" },
                { action: "Viewing Sector Theme Page",  cost: "Free",      note: "per theme load" },
                { action: "Lyra Research (Sidebar)",    cost: "1 credit",  note: "per insight gen" },
                { action: "Simple Lyra question",       cost: "1 credit",  note: "casual queries" },
                { action: "Moderate analysis query",    cost: "3 credits", note: "detailed research" },
                { action: "Lyra Asset Intel Query",     cost: "5 credits", note: "in-depth brief" },
                { action: "Complex research query",     cost: "5 credits", note: "multi-step reasoning" },
                { action: "Compare Assets",            cost: "5 credits + 3 per extra asset", note: "up to 3 assets" },
                { action: "Shock Simulator",           cost: "5 credits + 3 per extra asset", note: "historical simulation · up to 3 assets" },
              ].map(row => (
                <div key={row.action} className="flex items-center justify-between px-6 py-3.5 hover:bg-white/2 transition-colors group">
                  <div>
                    <span className="text-sm text-foreground/80 font-medium">{row.action}</span>
                    <span className="hidden sm:inline text-[10px] text-muted-foreground/40 ml-2">— {row.note}</span>
                  </div>
                  <span className="font-bold text-primary shrink-0">{row.cost}</span>
                </div>
              ))}
            </div>
          </div>

          {/* XP → Credits Conversion */}
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
              <Zap className="h-4 w-4 text-warning" />
              <span className="text-xs font-bold uppercase tracking-widest">XP → Credits Conversion</span>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Spend your XP on credits, not plan trials. The credits land in your balance straight away and you can redeem as many times as you want.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  {
                    xp: 500, credits: 50, plan: "PRO",
                    ratio: "1 XP = 0.10 credits",
                    color: "text-info", bg: "bg-info/5 border-info/15",
                    badge: "bg-info/15 text-info border-info/20",
                  },
                  {
                    xp: 1000, credits: 125, plan: "ELITE",
                    ratio: "1 XP = 0.125 credits",
                    color: "text-primary", bg: "bg-primary/5 border-primary/15",
                    badge: "bg-primary/15 text-primary border-primary/20",
                  },
                ].map(row => (
                  <div key={row.plan} className={cn("rounded-2xl border p-5 space-y-3", row.bg)}>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border", row.badge)}>{row.plan} Bundle</span>
                      <span className="text-[10px] text-muted-foreground/50 font-bold">{row.ratio}</span>
                    </div>
                    <div className="flex items-end gap-1">
                      <span className={cn("text-3xl font-bold", row.color)}>{row.xp}</span>
                      <span className="text-sm text-muted-foreground mb-1 font-bold">XP</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 mb-1" />
                      <span className={cn("text-3xl font-bold", row.color)}>{row.credits}</span>
                      <span className="text-sm text-muted-foreground mb-1 font-bold">Credits</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Credits land instantly. No limit on how many times you redeem.</p>
                    <div className="text-[10px] text-muted-foreground/50">
                      You currently have <span className={cn("font-bold", userXP >= row.xp ? "text-success" : row.color)}>{userXP.toLocaleString()} XP</span>
                      {userXP >= row.xp
                        ? <span className="text-success font-bold ml-1">✓ Eligible</span>
                        : <span className="ml-1">— need {(row.xp - userXP).toLocaleString()} more XP</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ways to Earn Credits */}
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
              <Gift className="h-4 w-4 text-success" />
              <span className="text-xs font-bold uppercase tracking-widest">Ways to Get Credits</span>
            </div>
            <div className="divide-y divide-white/5">
              {[
                { way: "New account signup",                    credits: "+50 free",                           color: "text-success", cat: "signup" },
                { way: "Monthly PRO plan",                      credits: "+500 / month",                        color: "text-info",     cat: "plan" },
                { way: "Monthly ELITE plan",                    credits: "+1,500 / month",                      color: "text-primary",     cat: "plan" },
                { way: "Refer a paid user",                     credits: "+75 on their activation",             color: "text-info", cat: "referral" },
                { way: "Sign up via referral link",             credits: "+50 on Paid (PRO or ELITE) sub",      color: "text-info", cat: "referral" },
                { way: "Redeem 500 XP (PRO)",                  credits: "+50 (repeatable bundle)",             color: "text-warning",  cat: "xp" },
                { way: "Redeem 1,000 XP (ELITE)",              credits: "+125 (repeatable bundle)",            color: "text-warning",  cat: "xp" },
              ].map(row => (
                <div key={row.way} className="flex items-center justify-between px-6 py-3.5 hover:bg-white/2 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-full border capitalize tracking-wider",
                      row.cat === "plan" ? "text-info bg-info/10 border-info/15" :
                      row.cat === "referral" ? "text-info bg-info/10 border-info/15" :
                      row.cat === "xp" ? "text-warning bg-warning/10 border-warning/15" :
                      "text-success bg-success/10 border-success/15"
                    )}>{row.cat}</span>
                    <span className="text-sm text-foreground/80 font-medium">{row.way}</span>
                  </div>
                  <span className={cn("font-bold text-sm shrink-0", row.color)}>{row.credits}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ══ REFERRAL TAB ══ */}
      {activeTab === "referral" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Current Referral Credit Stats */}
          <div className="grid sm:grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-5 bg-info/5 border border-info/15"
            >
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-info" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total Referral Credits</span>
              </div>
              <div className="text-3xl font-bold text-info">
                {isLoading ? "—" : referralCreditsEarned.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground/50 mt-1">from referrals</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 }}
              className="rounded-2xl p-5 bg-info/5 border border-info/15"
            >
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-info" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Current Credit Balance</span>
              </div>
              <div className="text-3xl font-bold text-info">
                {isLoading ? "—" : userCredits.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground/50 mt-1">ready to spend</div>
            </motion.div>
          </div>

          {/* Main referral card */}
          <div className="overflow-hidden rounded-4xl border border-white/10 bg-card/70 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
              <Users className="h-4 w-4 text-info" />
              <span className="text-xs font-bold uppercase tracking-widest">Referral System</span>
            </div>
            <div className="p-6 space-y-5">

              {/* Eligibility */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/8 border border-primary/20">
                <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Who can refer?</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Only <strong className="text-foreground">active PRO or ELITE subscribers</strong> can generate a referral link — trial users on either XP or promo trials are excluded.
                  </p>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">How it works</p>
                {[
                  { n: "1", title: "Share your referral link", desc: "Go to Profile Settings to grab your link. Only active PRO and ELITE subscribers get one.", color: "bg-info/15 text-info border-info/20" },
                  { n: "2", title: "Someone signs up through your link", desc: "They create an account. Nothing happens yet — the trigger is their first paid plan.", color: "bg-info/15 text-info border-info/20" },
                  { n: "3", title: "They activate PRO or ELITE", desc: "They get +50 credits added to their balance when their plan starts.", color: "bg-warning/15 text-warning border-warning/20" },
                  { n: "4", title: "You get +75 credits", desc: "Credited to you automatically at the same moment. No manual step needed.", color: "bg-success/15 text-success border-success/20" },
                ].map((s, i) => (
                  <motion.div
                    key={s.n}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.07 }}
                    className="flex gap-3 p-4 rounded-2xl border border-white/5 bg-card/40 hover:bg-card/60 transition-colors"
                  >
                    <div className={cn("flex items-center justify-center w-7 h-7 rounded-xl text-[10px] font-bold shrink-0 border", s.color)}>{s.n}</div>
                    <div>
                      <p className="text-sm font-bold">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Reward table */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">Credit breakdown</p>
                <div className="rounded-2xl border border-white/5 overflow-hidden">
                  <div className="grid grid-cols-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/10 px-5 py-2.5">
                    <span>Who</span>
                    <span className="text-center">When</span>
                    <span className="text-right">Credit Reward</span>
                  </div>
                  {[
                    { who: "You (paid PRO/ELITE)",  when: "When they activate PRO or ELITE",  credits: "+75 credits",  color: "text-info" },
                    { who: "New user (referee)",     when: "On activating a paid plan",         credits: "+50 credits",  color: "text-info"    },
                  ].map(r => (
                    <div key={r.who} className="grid grid-cols-3 text-xs px-5 py-3.5 border-t border-white/5 hover:bg-white/2 transition-colors">
                      <span className="text-foreground/70 font-medium">{r.who}</span>
                      <span className="text-center text-muted-foreground/50">{r.when}</span>
                      <span className={cn("text-right font-bold", r.color)}>{r.credits}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Credit cap note */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/10 border border-white/5">
                <Star className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  Referral credits go straight to your balance — they have nothing to do with your XP. You can refer as many people as you want.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function RewardsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6 p-3 sm:p-4 md:p-6 w-full animate-pulse">
        <div className="h-48 rounded-4xl bg-muted/20 border border-border/20" />
        <div className="h-12 rounded-3xl bg-muted/20 border border-border/20" />
        <div className="h-64 rounded-4xl bg-muted/20 border border-border/20" />
      </div>
    }>
      <RewardsPageInner />
    </Suspense>
  );
}
