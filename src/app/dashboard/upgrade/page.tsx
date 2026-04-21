"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/use-plan";
import { useRegion } from "@/lib/context/RegionContext";
import { getLocalizedCreditPackPrice, getPlanPrice, type UpgradeRegion } from "@/lib/billing/upgrade-pricing";
import { revalidateCreditViews } from "@/lib/credits/client";
import {
  CREDIT_PACK_FACTS,
  PLAN_MARKET_ACCESS,
  PLAN_TRIAL_FACTS,
  getCreditsFaqSummary,
  getEnterpriseHybridLabel,
  getPlanCreditsLabel,
  getPlanRoutingSummary,
} from "@/lib/plans/facts";
import {
  Check,
  Sparkles,
  ArrowRight,
  Brain,
  Layers,
  BarChart3,
  GraduationCap,
  ChevronLeft,
  Crown,
  ShieldCheck,
  Zap,
  Building2,
  Mail,
  ChevronDown,
  Coins,
  Gift,
  Star,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  Lock,
} from "lucide-react";

// ─── Plan Feature Matrix ────────────────────────────────────────────────────

interface FeatureRow {
  feature: string;
  starter: string | boolean;
  pro: string | boolean;
  elite: string | boolean;
  enterprise: string | boolean;
  category: string;
}

type CheckoutStatus = "success" | "credits_success" | "canceled";

const BANNER_CONFIG: Record<CheckoutStatus, {
  color: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}> = {
  success: {
    color: "border-success/30 bg-success/10 text-success dark:text-success",
    icon: <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />,
    title: "Payment successful — welcome aboard!",
    body: "Your plan has been activated. It may take a moment to reflect across the app.",
  },
  credits_success: {
    color: "border-success/30 bg-success/10 text-success dark:text-success",
    icon: <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />,
    title: "Credits added to your account!",
    body: "Your credits have been topped up and are ready to use with Lyra.",
  },
  canceled: {
    color: "border-warning/30 bg-warning/10 text-primary dark:text-warning",
    icon: <XCircle className="h-5 w-5 mt-0.5 shrink-0" />,
    title: "Checkout canceled",
    body: "No charge was made. You can upgrade or top up anytime below.",
  },
};

function CheckoutBanner({ status, onDismiss }: { status: CheckoutStatus; onDismiss: () => void }) {
  const cfg = BANNER_CONFIG[status];
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-4 shadow-lg", cfg.color)}>
      {cfg.icon}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{cfg.title}</p>
        <p className="text-xs mt-0.5 opacity-80">{cfg.body}</p>
      </div>
      <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

const FEATURES: FeatureRow[] = [
  // Access & Billing
  {
    category: "Access & Billing",
    feature: "Market access",
    starter: PLAN_MARKET_ACCESS.STARTER,
    pro: PLAN_MARKET_ACCESS.PRO,
    elite: PLAN_MARKET_ACCESS.ELITE,
    enterprise: PLAN_MARKET_ACCESS.ENTERPRISE,
  },
  {
    category: "Access & Billing",
    feature: "Trial access",
    starter: false,
    pro: false,
    elite: PLAN_TRIAL_FACTS.eliteMarketingLabel,
    enterprise: PLAN_TRIAL_FACTS.enterpriseMarketingLabel,
  },
  {
    category: "Access & Billing",
    feature: "Post-trial billing",
    starter: "N/A",
    pro: "N/A",
    elite: "Auto-upgrade to Elite monthly unless canceled",
    enterprise: "Annual contract",
  },
  {
    category: "Access & Billing",
    feature: "Payment confirmation",
    starter: false,
    pro: "Required",
    elite: "Required",
    enterprise: "Invoice billing",
  },
  // Lyra AI
  { category: "Lyra AI", feature: "AI-powered analysis", starter: true, pro: true, elite: true, enterprise: true },
  { category: "Lyra AI", feature: "Response depth", starter: "Concise educational", pro: "Diagnostic", elite: "Deep + scenarios", enterprise: "Custom depth + team systems" },
  { category: "Lyra AI", feature: "Lyra credits", starter: getPlanCreditsLabel("STARTER"), pro: getPlanCreditsLabel("PRO"), elite: getPlanCreditsLabel("ELITE"), enterprise: getPlanCreditsLabel("ENTERPRISE") },
  { category: "Lyra AI", feature: "Lyra routing", starter: getPlanRoutingSummary("STARTER"), pro: getPlanRoutingSummary("PRO"), elite: getPlanRoutingSummary("ELITE"), enterprise: getEnterpriseHybridLabel() },
  { category: "Lyra AI", feature: "Cross-sector correlation", starter: false, pro: "COMPLEX queries only", elite: true, enterprise: true },
  { category: "Lyra AI", feature: "Elite Lyra modules", starter: false, pro: false, elite: "3 modules: Discovery, Crypto On-Chain, Macro Strategist", enterprise: "All modules + custom" },
  { category: "Lyra AI", feature: "Factor DNA context", starter: false, pro: false, elite: true, enterprise: true },
  { category: "Lyra AI", feature: "Custom AI fine-tuning", starter: false, pro: false, elite: false, enterprise: true },
  // Discovery
  { category: "Discovery", feature: "Discovery Crypto (themes + sectors)", starter: true, pro: true, elite: true, enterprise: true },
  { category: "Discovery", feature: "Discovery Feed items", starter: "5", pro: "15", elite: "100", enterprise: "Unlimited" },
  { category: "Discovery", feature: "Cross-asset patterns", starter: "Teaser only", pro: "Teaser only", elite: true, enterprise: true },
  { category: "Discovery", feature: "Score inflection alerts", starter: true, pro: true, elite: true, enterprise: true },
  { category: "Discovery", feature: "Custom signal alerts", starter: false, pro: false, elite: false, enterprise: true },
  // Intelligence Engines
  { category: "Intelligence", feature: "Portfolio lookthrough", starter: false, pro: "1 per session", elite: "Up to 3 per session", enterprise: "Unlimited" },
  { category: "Intelligence", feature: "Factor DNA", starter: "Teaser only", pro: "Teaser only", elite: "Full", enterprise: "Full + custom factors" },
  { category: "Intelligence", feature: "Concentration & overlap", starter: false, pro: "1 per session", elite: "Up to 3 per session — full overlap detection", enterprise: "Unlimited + portfolio-level" },
  { category: "Intelligence", feature: "Crypto on-chain data", starter: false, pro: false, elite: "Full structural risk", enterprise: "Full + DeFi analytics" },
  { category: "Intelligence", feature: "Cross-asset correlations", starter: false, pro: "Up to 3", elite: "Up to 10", enterprise: "Unlimited + custom baskets" },
  // Learning
  { category: "Learning", feature: "Learning modules", starter: "Fundamentals", pro: "Fundamentals + Intermediate", elite: "All (incl. Advanced)", enterprise: "All + custom training" },
  { category: "Learning", feature: "XP multiplier", starter: "1.0x", pro: "1.0x", elite: "1.5x", enterprise: "2.0x" },
  { category: "Learning", feature: "Advanced badges", starter: false, pro: false, elite: true, enterprise: true },
  // Portfolio
  { category: "Portfolio", feature: "Portfolio tracking", starter: true, pro: true, elite: true, enterprise: true },
  { category: "Portfolio", feature: "Concentration & overlap detection", starter: false, pro: false, elite: true, enterprise: true },
  // Enterprise Exclusive
  { category: "Enterprise", feature: "Dedicated account manager", starter: false, pro: false, elite: false, enterprise: true },
  { category: "Enterprise", feature: "SSO / SAML authentication", starter: false, pro: false, elite: false, enterprise: true },
  { category: "Enterprise", feature: "Team seats & admin console", starter: false, pro: false, elite: false, enterprise: "Unlimited" },
  { category: "Enterprise", feature: "API access", starter: false, pro: false, elite: false, enterprise: "Full REST + WebSocket" },
  { category: "Enterprise", feature: "Custom data integrations", starter: false, pro: false, elite: false, enterprise: true },
  { category: "Enterprise", feature: "SLA & uptime guarantee", starter: false, pro: false, elite: false, enterprise: "99.9% SLA" },
  { category: "Enterprise", feature: "Priority support", starter: false, pro: false, elite: false, enterprise: "24/7 dedicated" },
  { category: "Enterprise", feature: "On-premise deployment", starter: false, pro: false, elite: false, enterprise: "Available" },
  { category: "Enterprise", feature: "White-label option", starter: false, pro: false, elite: false, enterprise: "Available" },
];

function getPricingFaqs(proPriceLabel: string, elitePriceLabel: string) {
  return [
  {
    question: "Which plan should I choose as a new user?",
    answer:
      "Start with the free Starter plan to explore the platform. Upgrade to Pro for a much larger monthly credit balance and stronger day-to-day analysis. Choose Elite for premium systems like Compare and Stress Test plus deeper GPT-routed analysis. Enterprise is handled as a custom commercial plan.",
  },
  {
    question: "How do Elite trials work?",
    answer:
      `${PLAN_TRIAL_FACTS.eliteSupportDetail} If a promo-backed Elite trial converts to billing, normal plan billing rules apply unless canceled in time.`,
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. You can cancel your active subscription anytime from Settings. Your plan remains active until the end of your current billing period.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "We offer full refunds within 14 days of purchase for annual plans, and 7 days for monthly plans. Contact support for account-specific cases.",
  },
  {
    question: "Does Pro include a trial?",
    answer:
      `No. Pro is a paid monthly plan at ${proPriceLabel}/month with no trial period. However, Starter users get free credits to try basic features.`,
  },
  {
    question: "What is the difference between Pro and Elite?",
    answer:
      `Pro (${proPriceLabel}/mo) gives ${getPlanCreditsLabel("PRO")} for regular analytical use. Elite (${elitePriceLabel}/mo) raises that to ${getPlanCreditsLabel("ELITE")} and adds the platform's premium systems plus deeper GPT-routed higher-complexity analysis.`,
  },
  {
    question: "Will I lose access if I downgrade?",
    answer:
      "Your account and data remain safe. Premium features adjust to the new tier after the billing period ends. Any purchased credit packs stay in your account.",
  },
  {
    question: "When is Enterprise available?",
    answer:
      "Enterprise is handled as a custom commercial plan. Teams can contact enterprise@lyraalpha.ai to discuss pilot access, pricing, and dedicated infrastructure.",
  },
  // Credit System FAQs
  {
    question: "How do credits work?",
    answer:
      `Credits power Lyra AI usage. ${getCreditsFaqSummary()} Monthly plan credits reset each billing cycle and differ by tier.`,
  },
  {
    question: "What happens if I run out of credits?",
    answer:
      `${CREDIT_PACK_FACTS.genericUpsell} Credit packs are available for one-time purchase from the upgrade page.`,
  },
  {
    question: "Do credits expire?",
    answer:
      "Purchased credit packs remain available until used. Plan-based monthly credits reset each billing cycle.",
  },
  {
    question: "Which queries cost the most credits?",
    answer:
      "Complex queries (multi-asset comparisons, scenario analysis, cross-sector patterns) cost the most credits. Simple educational queries cost the least.",
  },
  {
    question: "How many free credits do I get?",
    answer:
      "New Starter users receive 50 free credits. Additional credits can be purchased or earned through promotions.",
  },
  {
    question: "Is there a pay-as-you-go option?",
    answer:
      `${CREDIT_PACK_FACTS.genericSupport} You can stay on Starter and buy packs as needed when that option is available.`,
  },
];
}

// ─── 4 Pillars ──────────────────────────────────────────────────────────────

const PILLARS = [
  {
    icon: Brain,
    title: "Deeper Understanding",
    description: "Specialist-level analysis across crypto on-chain, macro, and cross-asset patterns.",
  },
  {
    icon: Layers,
    title: "Full Transparency",
    description: "Lookthrough, overlap detection, structural risk, and correlation matrices.",
  },
  {
    icon: BarChart3,
    title: "Complete Discovery",
    description: "Unlimited Discovery with score shifts, peer divergence, and structural anomalies across 669+ assets.",
  },
  {
    icon: GraduationCap,
    title: "Advanced Learning",
    description: "Cross-asset correlation, regime transitions, and historical analogs. Plus 1.5x XP multiplier.",
  },
];

// ─── Page ───────────────────────────────────────────────────────────────────

function CheckoutStatusReader({ onStatus }: { onStatus: (s: CheckoutStatus | null) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    onStatus(searchParams.get("checkout") as CheckoutStatus | null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function UpgradePage() {
  const { plan, isElite, revalidate } = usePlan();
  const { region } = useRegion();
  const upgradeRegion = region as UpgradeRegion;
  const starterPrice = getPlanPrice(upgradeRegion, "starter");
  const proPrice = getPlanPrice(upgradeRegion, "pro");
  const elitePrice = getPlanPrice(upgradeRegion, "elite");
  const pricingFaqs = getPricingFaqs(proPrice.label, elitePrice.label);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const creditsSWR = useSWR<{
    packages?: Array<{
      id: string;
      name: string;
      credits: number;
      bonusCredits: number;
      priceUsd: number;
      priceInr: number;
      stripePriceId?: string | null;
      isPopular: boolean;
    }>;
    balance?: number;
  }>("/api/user/credits", async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch credits");
    return response.json();
  }, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    keepPreviousData: true,
  });
  const creditPackages = creditsSWR.data?.packages ?? [];
  const loadingPackages = creditsSWR.isLoading;
  const creditBalance = typeof creditsSWR.data?.balance === "number" ? creditsSWR.data.balance : null;

  // When user lands back from a successful checkout, immediately revalidate the plan
  // so the sidebar / header update without a full page reload.
  useEffect(() => {
    if (checkoutStatus === "success" || checkoutStatus === "credits_success") {
      revalidate();
      void revalidateCreditViews();
      void creditsSWR.mutate();
    }
  }, [checkoutStatus, creditsSWR, revalidate]);

  const startCheckout = useCallback((planKey: "pro" | "elite") => {
    setLoadingPlan(planKey);
    window.location.href = `/api/stripe/checkout?plan=${planKey}&region=${upgradeRegion}`;
  }, [upgradeRegion]);

  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const handlePurchaseClick = async (packageId: string) => {
    setPurchasingId(packageId);
    try {
      const res = await fetch("/api/stripe/checkout/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, region: upgradeRegion }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        // Silent fail - checkout error, user stays on page
        return;
      }
      window.location.href = data.url;
    } catch {
      // Silent fail - checkout error, user stays on page
    } finally {
      setPurchasingId(null);
    }
  };

  const bottomCtaLabel = plan === "STARTER" ? "Unlock Pro systems" : "Unlock Elite systems";
  const bottomCtaPlan: "pro" | "elite" = plan === "STARTER" ? "pro" : "elite";
  const bottomCtaHint =
    plan === "STARTER"
      ? "Best when you want stronger everyday portfolio, discovery, and Lyra usage."
      : "Best when your system includes Compare, Shock Simulator, and deeper cross-asset reasoning.";

  const enterpriseIsCurrent = plan === "ENTERPRISE";
  const eliteIsCurrent = plan === "ELITE" || plan === "ENTERPRISE";
  const proIsCurrent = plan === "PRO";
  const starterIsCurrent = plan === "STARTER";
  const contactEmail = "enterprise@lyraalpha.ai";

  return (
    <div className="relative pb-24 p-3 sm:p-4 md:p-6">
      <Suspense fallback={null}>
        <CheckoutStatusReader onStatus={setCheckoutStatus} />
      </Suspense>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-16 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-32 -left-24 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
      </div>

      {/* Loading overlay while redirecting to Stripe */}
      {loadingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl">
          <div className="flex flex-col items-center gap-4 rounded-4xl border border-white/10 bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-primary" />
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground">Preparing your checkout</p>
              <p className="mt-1 text-xs text-muted-foreground">Redirecting to Stripe’s secure payment page…</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/5 bg-background/60 px-3 py-1.5">
              <Lock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">256-bit SSL encrypted</span>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:gap-8 md:gap-10">
        {checkoutStatus && !bannerDismissed && (
          <CheckoutBanner
            status={checkoutStatus}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}

        <section className="grid gap-4 sm:gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-4xl border border-white/10 bg-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl sm:p-8">
            <Link
              href="/dashboard"
              className="inline-flex w-fit items-center gap-1 rounded-full border border-white/10 bg-background/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground transition hover:border-primary/30 hover:text-primary"
            >
              <ChevronLeft className="h-3 w-3" />
              Back to Dashboard
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3 w-3" />
              system-Led Intelligence Plans
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-foreground md:text-6xl md:leading-[0.95]">
              Upgrade into
              <span className="premium-gradient-text block">the systems you actually use</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground md:text-base">
              Pro for heavier day-to-day analysis. Elite for Compare, Shock Simulator, and the full cross-asset intelligence layer.
            </p>
            <div className="mt-6 grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-background/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">system Fit</p>
                <p className="mt-2 text-lg font-bold text-foreground">Portfolio · Narrative · Lyra</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-background/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Elite system Layer</p>
                <p className="mt-2 text-lg font-bold text-foreground">Compare + Shock + Deep Lyra</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-background/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Upgrade Logic</p>
                <p className="mt-2 text-lg font-bold text-foreground">Pay for the depth you need</p>
              </div>
            </div>
          </div>

          <div className="rounded-4xl border border-primary/20 bg-linear-to-b from-primary/10 via-card/85 to-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(251,191,36,0.22)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Elite Focus</span>
              <Crown className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">Best for investors who move between portfolio risk, market narratives, compare decisions, and scenario testing.</p>
            <ul className="mt-4 space-y-2">
              {[
                "All markets including crypto",
                "Cross-asset patterns fully unlocked",
                "Deep intelligence modules + full matrices",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {!eliteIsCurrent && (
              <button
                onClick={() => startCheckout("elite")}
                disabled={loadingPlan !== null}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingPlan === "elite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {loadingPlan === "elite" ? "Redirecting…" : "Unlock Elite systems"}
              </button>
            )}
          </div>
        </section>

        <section className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <article className="group flex h-full flex-col rounded-4xl border border-white/10 bg-linear-to-br from-white via-card/90 to-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.24)] dark:text-foreground">
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Starter</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground dark:text-foreground/40">{starterPrice.label}</p>
              <p className="text-[12px] leading-5 text-muted-foreground dark:text-muted-foreground/80">Best for exploring the product, learning the system, and using core analytics with lighter daily usage.</p>
            </div>

            <div className="mt-6 space-y-2.5">
              {[
                "Discovery Feed (5 items)",
                "IN + US market access",
                "GPT-5.4 Nano AI for all query types",
                "50 Lyra credits/month",
                "Core learning modules",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-[12px] leading-5 text-foreground/85 dark:text-muted-foreground/85">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary dark:text-muted-foreground" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-7">
              {starterIsCurrent ? (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-background/75 px-3 py-2 text-xs font-bold text-foreground dark:border-border/80 dark:bg-foreground/70 dark:text-muted-foreground">
                  <Check className="h-3.5 w-3.5" />
                  Current Plan
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-background/75 px-3 py-2 text-xs font-bold text-muted-foreground dark:border-border/80 dark:bg-foreground/70 dark:text-muted-foreground/80">
                  Free Forever
                </div>
              )}
            </div>
          </article>

          <article className="group flex h-full flex-col rounded-4xl border border-white/10 bg-linear-to-br from-white via-card/90 to-card/70 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.24)] dark:text-foreground">
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Pro</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground dark:text-foreground/40">{proPrice.label}<span className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground">/month</span></p>
              <p className="text-[12px] leading-5 text-muted-foreground dark:text-muted-foreground/80">Best for investors who use Lyra, portfolio intelligence, and discovery regularly and need stronger day-to-day depth.</p>
            </div>

            <div className="mt-6 space-y-2.5">
              {[
                "500 Lyra credits/month",
                "Discovery Feed (15 items)",
                "IN + US market access",
                "Portfolio lookthrough (1 per session)",
                "GPT-5.4 Nano AI + Mini for COMPLEX queries",
                "Intermediate learning modules",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-[12px] leading-5 text-foreground/85 dark:text-muted-foreground/85">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary dark:text-muted-foreground" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-7">
              {proIsCurrent ? (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-background/75 px-3 py-2 text-xs font-bold text-foreground dark:border-border/80 dark:bg-foreground/70 dark:text-muted-foreground">
                  <Check className="h-3.5 w-3.5" />
                  Current Plan
                </div>
              ) : isElite ? (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-background/75 px-3 py-2 text-xs font-bold text-muted-foreground dark:border-border/80 dark:bg-foreground/70 dark:text-muted-foreground/80">
                  Included in Elite
                </div>
              ) : (
                <button
                  onClick={() => startCheckout("pro")}
                  disabled={loadingPlan !== null}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2.5 min-h-[44px] text-xs font-bold text-primary transition hover:bg-primary/15 disabled:opacity-60 disabled:cursor-not-allowed dark:border-border/70 dark:bg-muted-foreground/70 dark:text-foreground/40 dark:hover:bg-muted-foreground/20"
                >
                  {loadingPlan === "pro" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Redirecting…</> : "Unlock Pro systems"}
                </button>
              )}
            </div>
          </article>

          <article className="group relative z-10 flex h-full flex-col overflow-hidden rounded-4xl border border-primary/30 bg-card/80 p-5 shadow-[0_24px_80px_-32px_rgba(251,191,36,0.24)] backdrop-blur-xl sm:p-6 lg:scale-105">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground">
              Recommended
            </div>

            <div className="space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Elite</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground dark:text-foreground/40">{elitePrice.label}<span className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground">/month</span></p>
              <p className="text-[12px] leading-5 text-muted-foreground dark:text-muted-foreground/80">Full cross-asset intelligence with GPT-routed deeper analysis and promo-based trial access.</p>
            </div>

            <div className="mt-6 space-y-2.5">
              {[
                "1500 Lyra credits/month",
                "All markets + crypto access",
                "Discovery Feed (100 items)",
                "5 specialist Lyra AI modules",
                "GPT routing for MODERATE + COMPLEX queries",
                "Portfolio lookthrough (up to 3)",
                "Factor DNA + crypto on-chain + macro strategist",
                "All learning modules + 1.5× XP",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-[12px] leading-5 text-foreground/85 dark:text-muted-foreground/85">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary dark:text-muted-foreground" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-7">
              {eliteIsCurrent ? (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-background/75 px-3 py-2 text-xs font-bold text-foreground dark:border-border/80 dark:bg-foreground/70 dark:text-muted-foreground">
                  <Check className="h-3.5 w-3.5" />
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={() => startCheckout("elite")}
                  disabled={loadingPlan !== null}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2.5 min-h-[44px] text-xs font-bold text-primary transition hover:bg-primary/15 disabled:opacity-60 disabled:cursor-not-allowed dark:border-border/70 dark:bg-muted-foreground/70 dark:text-foreground/40 dark:hover:bg-muted-foreground/20"
                >
                  {loadingPlan === "elite" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Redirecting…</> : "Explore Elite Trial Options"}
                </button>
              )}
            </div>
          </article>

          <article className="group relative flex h-full flex-col rounded-4xl border border-border/60 bg-[#0a0a0a]/80 p-5 shadow-[0_24px_80px_-36px_rgba(2,6,23,0.72)] backdrop-blur-xl transition-all duration-300 hover:bg-[#0a0a0a] sm:p-6">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-muted/50 px-3 py-0.5 text-[9px] font-bold uppercase tracking-widest text-foreground dark:bg-muted/50 dark:text-foreground">
              For Teams
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Enterprise</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white">Coming Soon</p>
              <p className="text-[12px] leading-5 text-muted-foreground">Tailored for teams, advisors, and institutions. Packaging, support, and infrastructure are handled directly.</p>
            </div>

            <div className="mt-6 space-y-2.5">
              {[
                "Commercial packaging + managed rollout",
                "Pilot access + managed onboarding",
                "Custom AI fine-tuning",
                "SSO / SAML authentication",
                "Team seats & admin console",
                "Full API access (REST + WebSocket)",
                "Custom data integrations",
                "Dedicated account manager",
                "99.9% SLA guarantee",
                "Priority 24/7 support",
                "On-premise & white-label options",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-[12px] leading-5 text-muted-foreground/90">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-7 space-y-2">
              {enterpriseIsCurrent ? (
                <div className="inline-flex items-center gap-2 rounded-2xl border border-border/50 bg-foreground/70 px-4 py-2 text-xs font-bold text-muted-foreground">
                  <Check className="h-3.5 w-3.5" />
                  Current Plan
                </div>
              ) : (
                <a
                  href={`mailto:${contactEmail}?subject=Enterprise%20Plan%20Inquiry`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/30 bg-white px-4 py-3 min-h-[44px] text-sm font-bold text-foreground transition hover:bg-muted/30 dark:bg-muted/50 dark:hover:bg-muted/50"
                >
                  <Mail className="h-4 w-4" />
                  Contact Us
                  <ArrowRight className="h-4 w-4" />
                </a>
              )}
              <p className="text-[11px] text-muted-foreground">Custom pricing based on team size and requirements.</p>
            </div>
          </article>
        </section>

        {/* Credit Packages Section */}
        {(!loadingPackages && creditPackages.length > 0) ? (
          <section className="rounded-3xl border border-warning/30 bg-linear-to-br from-warning/5 via-card to-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-warning" />
                <h2 className="text-lg font-bold tracking-tight text-foreground">Need More Credits?</h2>
              </div>
              {creditBalance !== null && (
                <div className="flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1">
                  <Zap className="h-3 w-3 text-warning" />
                  <span className="text-xs font-bold text-primary dark:text-warning">{creditBalance.toLocaleString()} credits</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Purchase additional credits to unlock more Lyra queries. Credits never expire.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" id="credit-packages">
              {creditPackages.map((pkg) => {
                const isLoading = purchasingId === pkg.id;
                const isDisabled = purchasingId !== null;
                const localizedPrice = getLocalizedCreditPackPrice(pkg);
                return (
                <div
                  key={pkg.id}
                  className={cn(
                    "relative rounded-2xl border p-4 transition flex flex-col",
                    isDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
                    pkg.isPopular
                      ? "border-warning/50 bg-warning/10 shadow-warning/20"
                      : "border-white/5 bg-background/60 hover:border-warning/30"
                  )}
                >
                {pkg.isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-warning px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-warning-foreground">
                    Popular
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-sm text-foreground">{pkg.name}</p>
                  {pkg.isPopular && <Star className="h-3.5 w-3.5 text-warning fill-warning" />}
                </div>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-xl font-bold text-foreground">{localizedPrice.label}</span>
                  <span className="text-xs text-muted-foreground">{localizedPrice.currencyCode}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm mb-4">
                  <Gift className="h-3.5 w-3.5 text-success" />
                  <span className="font-semibold text-success dark:text-success">
                    {pkg.credits.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">+</span>
                  <span className="font-semibold text-success dark:text-success">
                    {pkg.bonusCredits}
                  </span>
                  <span className="text-xs text-muted-foreground">credits</span>
                </div>
                <button
                  onClick={() => handlePurchaseClick(pkg.id)}
                  disabled={isDisabled}
                  className={cn(
                    "mt-auto w-full rounded-2xl py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-wide transition",
                    pkg.isPopular
                      ? "bg-warning text-warning-foreground hover:bg-warning"
                      : "bg-warning/15 text-primary dark:text-warning hover:bg-warning/25",
                    isDisabled && "pointer-events-none"
                  )}
                >
                  {isLoading ? "Redirecting…" : "Buy Now"}
                </button>
              </div>
                );
              })}
          </div>
          
          <p className="text-[11px] text-muted-foreground mt-4 text-center">
            Credits are one-time purchases and can be used at any time. No subscription required.
          </p>
        </section>
        ) : null}

        <section className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
          {PILLARS.map((pillar) => (
            <article key={pillar.title} className="group rounded-2xl border border-white/5 bg-card/40 p-5 shadow-sm backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_15px_30px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_15px_30px_rgba(2,132,199,0.12)]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                  <pillar.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{pillar.title}</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{pillar.description}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-border/35 bg-card/35 p-4 sm:p-5 md:p-6">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">Feature comparison</h2>
          <div className="mt-4 grid grid-cols-[minmax(140px,1.2fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)] gap-3 border-b border-border/25 pb-3">
            <div />
            <div className="rounded-2xl border border-border/30 bg-background/55 px-3 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Starter</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{starterPrice.label}</p>
            </div>
            <div className="rounded-2xl border border-border/30 bg-background/55 px-3 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Pro</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{proPrice.label}/month</p>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-primary/8 px-3 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Elite</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{elitePrice.label}/month</p>
            </div>
          </div>

          <div className="divide-y divide-border/15">
            {FEATURES.filter((row) => row.category !== "Enterprise").map((row) => (
              <article
                key={row.feature}
                className="grid grid-cols-[minmax(140px,1.2fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)] gap-3 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{row.feature}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{row.category}</p>
                </div>
                <div className="text-[12px] leading-5 text-foreground/85">
                  <InlineFeatureValue value={row.starter} />
                </div>
                <div className="text-[12px] leading-5 text-foreground/85">
                  <InlineFeatureValue value={row.pro} />
                </div>
                <div className="text-[12px] leading-5 text-foreground/85">
                  <InlineFeatureValue value={row.elite} highlight />
                </div>
              </article>
            ))}
          </div>
        </section>

        {!isElite && (
          <section className="rounded-3xl border border-primary/30 bg-linear-to-r from-primary/8 via-card to-card p-6 text-center shadow-[0_20px_40px_rgba(0,0,0,0.15)] dark:border-primary/30 dark:from-card dark:to-card dark:shadow-[0_20px_40px_rgba(2,132,199,0.1)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Upgrade when you&apos;re ready</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground">More credits, more depth, more tools.</h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{bottomCtaHint}</p>
            <button
              onClick={() => startCheckout(bottomCtaPlan)}
              disabled={loadingPlan !== null}
              className="mx-auto mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingPlan === bottomCtaPlan ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
              ) : (
                <><Sparkles className="h-4 w-4" /><span>{bottomCtaLabel}</span><ArrowRight className="h-4 w-4" /></>
              )}
            </button>
            <p className="mt-3 text-[11px] text-muted-foreground/80">Elite monthly checkout requires payment confirmation and auto-renews after trial unless canceled.</p>
          </section>
        )}

        <section className="rounded-3xl border border-border/45 bg-card/40 p-5 backdrop-blur-2xl md:p-6">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">FAQ</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground md:text-2xl">Common questions</h2>
            <p className="mt-2 text-sm text-muted-foreground">Trials, cancellations, billing, and which plan fits best.</p>
          </div>

          <div className="mt-5 space-y-2">
            {pricingFaqs.map((item, index) => (
              <details
                key={item.question}
                open={index === 0}
                className="group rounded-2xl border border-border/35 bg-background/60 px-4 py-3 transition hover:border-primary/30"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-bold text-foreground">
                  <span>{item.question}</span>
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <p className="pt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function InlineFeatureValue({ value, highlight, enterprise }: { value: string | boolean; highlight?: boolean; enterprise?: boolean }) {
  if (typeof value === "boolean") {
    return (
      <span
        className={cn(
          "font-medium",
          value
            ? enterprise
              ? "text-muted-foreground dark:text-muted-foreground"
              : highlight
                ? "text-primary"
                : "text-success"
            : "text-muted-foreground/60",
        )}
      >
        {value ? "Included" : "Not included"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "font-medium",
        enterprise ? "text-muted-foreground dark:text-muted-foreground" : highlight ? "text-primary" : "text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}
