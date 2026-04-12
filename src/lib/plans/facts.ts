import type { PlanTier, QueryComplexity } from "@/lib/ai/config";

export const PLAN_ORDER = ["STARTER", "PRO", "ELITE", "ENTERPRISE"] as const satisfies readonly PlanTier[];

export const MONTHLY_PLAN_CREDITS: Record<PlanTier, number> = {
  STARTER: 50,
  PRO: 500,
  ELITE: 1500,
  ENTERPRISE: 1500,
};

export const QUERY_CREDIT_COSTS: Record<QueryComplexity, number> = {
  SIMPLE: 1,
  MODERATE: 3,
  COMPLEX: 5,
};

export const PLAN_ROUTING_FACTS: Record<PlanTier, Record<QueryComplexity, "gpt-nano" | "gpt-mini" | "gpt-full">> = {
  STARTER:    { SIMPLE: "gpt-nano",  MODERATE: "gpt-nano",  COMPLEX: "gpt-mini" },
  PRO:        { SIMPLE: "gpt-mini",  MODERATE: "gpt-mini",  COMPLEX: "gpt-full" },
  ELITE:      { SIMPLE: "gpt-mini",  MODERATE: "gpt-mini",  COMPLEX: "gpt-full" },
  ENTERPRISE: { SIMPLE: "gpt-mini",  MODERATE: "gpt-mini",  COMPLEX: "gpt-full" },
};

export const PLAN_DISPLAY_NAMES: Record<PlanTier, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  ELITE: "Elite",
  ENTERPRISE: "Enterprise",
};

export const PLAN_MARKET_ACCESS: Record<PlanTier, string> = {
  STARTER: "Crypto (core tokens)",
  PRO: "Crypto (core + altcoins)",
  ELITE: "Crypto (full on-chain)",
  ENTERPRISE: "Crypto (full + custom feeds)",
};

export const PLAN_TRIAL_FACTS = {
  eliteMarketingLabel: "Promo-based Elite trial",
  eliteMarketingDetail: "Selected promo codes can unlock timed Elite access.",
  enterpriseMarketingLabel: "Custom pilot program",
  eliteSupportDetail:
    "Elite trials are promo-code driven and can vary by campaign. The UI may simplify this in marketing surfaces, but server-side enforcement uses the actual trial state.",
};

export const CREDIT_PACK_FACTS = {
  genericUpsell: "Credit packs are available when you need more Lyra usage.",
  genericSupport: "Credit-pack pricing can vary, so exact pack values should be shown from live package data when available.",
};

export function getMonthlyPlanCredits(plan: PlanTier): number {
  return MONTHLY_PLAN_CREDITS[plan];
}

export function getQueryCreditCost(complexity: QueryComplexity): number {
  return QUERY_CREDIT_COSTS[complexity];
}

export function getPlanRoutingSummary(plan: PlanTier): string {
  const routing = PLAN_ROUTING_FACTS[plan];
  return `SIMPLE: ${routing.SIMPLE.toUpperCase()} · MODERATE: ${routing.MODERATE.toUpperCase()} · COMPLEX: ${routing.COMPLEX.toUpperCase()}`;
}

export function getPlanCreditsLabel(plan: PlanTier): string {
  return `${getMonthlyPlanCredits(plan)}/mo`;
}

export function getCreditsFaqSummary(): string {
  return `Each Lyra query uses credits based on complexity: SIMPLE (${QUERY_CREDIT_COSTS.SIMPLE}), MODERATE (${QUERY_CREDIT_COSTS.MODERATE}), COMPLEX (${QUERY_CREDIT_COSTS.COMPLEX}).`;
}

export function getEnterpriseHybridLabel(): string {
  return "Custom commercial packaging with a managed runtime configuration";
}

export function buildMyraPlatformFacts(): string {
  return [
    "- Asset coverage: crypto-native intelligence across 50+ tokens — on-chain data, DeFi metrics, network signals",
    "- DSE Scores (0–100): Trend, Momentum, Volatility, Liquidity, Trust, Sentiment",
    "- Signal Strength: 4-layer composite directional signal — analytical signal, not a buy/sell recommendation",
    "- Score Velocity Badge: shows rising/falling score momentum direction on asset cards and watchlist rows",
    "- Market Regime: STRONG_RISK_ON → RISK_OFF — shown on Lyra Intel and asset pages",
    "- ARCS: Asset-Regime Compatibility Score",
    "- Lyra Intel: AI financial analyst at /dashboard/lyra — analyses assets, explains scores, and uses deeper live research on higher plans",
    "- Compare Assets (ELITE/ENTERPRISE): multi-asset cross-sector synthesis at /dashboard/compare — up to 4 assets; 5 credits for first + 3 per additional",
    "- Shock Simulator (ELITE/ENTERPRISE): historical stress scenario replay at /dashboard/stress-test — deterministic replay + Lyra interpretation; same credit pricing as Compare Assets",
    "- Portfolio Intelligence: available to all plans at /dashboard/portfolio — health, fragility, regime alignment, drawdown estimate, benchmark comparison, holdings P&L heatmap with DSE chips, Monte Carlo (PRO+)",
    "- Watchlist Drift Alert: badge when holdings fall below regime-compatibility threshold",
    "- Discovery Signal Cluster Banner: appears when a sector shows unusual high-DRS momentum burst",
    "- Briefing Staleness Indicator: shows on Lyra Intel when the cached daily briefing is older than expected",
    "- Same-Sector Movers: shown on individual asset pages with compatibility scores for peer context",
    `- Credits: monthly defaults — STARTER ${MONTHLY_PLAN_CREDITS.STARTER}, PRO ${MONTHLY_PLAN_CREDITS.PRO}, ELITE ${MONTHLY_PLAN_CREDITS.ELITE}, ENTERPRISE ${MONTHLY_PLAN_CREDITS.ENTERPRISE}; query costs — SIMPLE ${QUERY_CREDIT_COSTS.SIMPLE}, MODERATE ${QUERY_CREDIT_COSTS.MODERATE}, COMPLEX ${QUERY_CREDIT_COSTS.COMPLEX}; Compare Assets/Shock Simulator — 5 credits (first asset) + 3 per additional (up to 4)`,
    "- Daily Token Cap (secondary limit): STARTER 50k, PRO 200k, ELITE 500k, ENTERPRISE uncapped — resets midnight UTC",
    `- Plans: All plans use GPT-5.4 family — STARTER: nano (SIMPLE/MOD) + mini (COMPLEX); PRO/ELITE/ENTERPRISE: mini (SIMPLE/MOD) + full (COMPLEX)`,
    "- Onboarding: authenticated users complete a 3-step gate (Market → Experience → Interests) on first sign-in",
    `- Trials & packs: Elite trials are promo-based (trialEndsAt enforced server-side); credit-pack pricing should be described generically unless live package data is available`,
  ].join("\n");
}

export function buildPublicMyraPlatformFacts(): string {
  return [
    "- **Myra on landing**: public Beta support assistant — available to all visitors before sign-in for Beta access, onboarding, product coverage, and plan questions",
    "- **Audience**: public site visitors are not assumed to be signed in; do not describe them as being on Starter, Pro, Elite, or Enterprise unless they explicitly say so",
    "- **Beta access**: sign-up is the main public onboarding path; all new users get ELITE plan + 300 credits free during Beta; direct visitors to [sign up free](/sign-up)",
    "- **Beta entitlement**: Beta users receive ELITE plan access and 300 credits immediately on sign-up — no card, no invite required",
    "- **Asset coverage**: LyraAlpha covers crypto tokens with on-chain analysis, DeFi metrics, and network signals",
    "- **Lyra Intel**: the AI financial analyst lives inside the authenticated product; guide public visitors to [sign up](/sign-up) or [sign in](/sign-in) to access it",
    "- **Plans summary (generic)**: STARTER is free (50 credits/mo); PRO is $14.99/mo (500 credits); ELITE is $39.99/mo (1,500 credits + premium tools: Compare Assets, Shock Simulator); ENTERPRISE is custom — explain these if asked without assuming which plan the visitor is on",
    "- **Premium workflows**: Compare Assets and Shock Simulator are ELITE/Enterprise features available inside the authenticated dashboard",
    "- **Onboarding**: after sign-up, authenticated users complete a 3-step onboarding gate (Market, Experience, Interests) inside the dashboard",
    "- **Myra on public site**: I'm already answering here — no need to redirect a public visitor to 'find Myra' since they are already talking to me",
  ].join("\n");
}
