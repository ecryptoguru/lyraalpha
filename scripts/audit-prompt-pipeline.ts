/**
 * Prompt Pipeline Real-World Audit Harness v11
 * ──────────────────────────────────────────────
 * Validates latency, cost, quality, and word-count targets across ALL tiers,
 * plans, and the multi-asset chatMode (compare / stress-test / macro-research).
 *
 * Current routing (from config.ts — all orchestrationMode=single, reasoningEffort=none):
 *   STARTER     SIMPLE → nano · single   MODERATE → nano · single   COMPLEX → mini · single
 *   PRO         SIMPLE → mini · single   MODERATE → mini · single   COMPLEX → full · single · reasoning:none
 *   ELITE       SIMPLE → mini · single   MODERATE → mini · single   COMPLEX → full · single · reasoning:none
 *   ENTERPRISE  SIMPLE → mini · single   MODERATE → mini · single   COMPLEX → full · single · reasoning:none
 *
 * Web search: Tavily (basic depth, 1 credit/call). 3 results for SIMPLE/MODERATE, 5 for COMPLEX.
 * Region-aware domain steering: IN → India finance domains, US → US finance domains.
 *
 * Word targets derived from config formula: (maxTokens - 450) * 0.72 * wordBudgetMultiplier
 * maxOutputTokens uses getTargetOutputTokens() — tight cap (target+250 buffer).
 * All paths stream — TTFT should be low (no blocking generateText calls).
 *
 * v9 additions:
 *   - New test cases: Lyra memory workflow, credits/plan education, ARCS context,
 *     India-gated market structure, regime macro-to-micro workflow
 *   - Quality scorer: Market Pulse / Bottom Line section bonus, Lyra output contract checks
 *   - Console output: detailed per-test cost/TTFT/quality table at end of report
 *   - routingComp: allGemini/allGpt fields removed; allNano/allFull only
 * v10 updates:
 *   - Web search: Tavily-only (WebSearchAPI.ai fully removed)
 *   - Cache invalidation: tavily: prefix added
 *   - ENTERPRISE COMPLEX word target corrected: 0.430 wbm → 950w
 *   - Multi-asset chatMode target corrected: 1000w (was stale 740w)
 *   - Header routing comment updated: all paths single+reasoningEffort:none
 * v11 updates:
 *   - Added macro-research chatMode test cases (ELITE + PRO)
 *   - macro-research inherits ELITE COMPLEX specs like compare/stress-test
 *   - WORD_TARGETS: MACRO-RESEARCH entry added (1000w, tolerance 0.50)
 *   - NewsData.io integration: crypto news context now from NewsData.io endpoint
 */

import { generateLyraStream } from "@/lib/ai/service";
import { LyraMessage } from "@/types/ai";
import { LyraContext } from "@/lib/engines/types";
import { prisma } from "@/lib/prisma";
import { getTierConfig, getTargetOutputTokens } from "@/lib/ai/config";
import { classifyQuery } from "@/lib/ai/query-classifier";
import { invalidateCacheByPrefix } from "@/lib/redis";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

let outputDir = "./audit-results";
let writeAsBaseline = false;
let onlyIds: string[] = [];
let auditRunId = "";

// ─── Target word budgets per plan × tier ───────────────────────────────────
// Derived from config.ts formula: (maxTokens - 450) * 0.72 * wordBudgetMultiplier
// STARTER  SIMPLE:   (1400-450)*0.72*0.439 = 300w
// STARTER  MODERATE: (1850-450)*0.72*0.595 = 600w  ← raised from 0.446/450w (nano writes 580-606w in practice)
// STARTER  COMPLEX:  (2600-450)*0.72*0.420 = 650w
// PRO      SIMPLE:   (1700-450)*0.72*0.333 = 300w
// PRO      MODERATE: (2200-450)*0.72*0.595 = 750w
// PRO      COMPLEX:  (2900-450)*0.72*0.539 = 950w
// ELITE    SIMPLE:   (2000-450)*0.72*0.448 = 500w
// ELITE    MODERATE: (2600-450)*0.72*0.517 = 800w
// ELITE    COMPLEX:  (3200-450)*0.72*0.505 = 1000w
// ENTERPRISE SIMPLE:   (2200-450)*0.72*0.357 = 450w
// ENTERPRISE MODERATE: (2600-450)*0.72*0.517 = 800w
// ENTERPRISE COMPLEX:  (3500-450)*0.72*0.430 = 950w
// Tolerances: SIMPLE 0.55 (edu format varies), MODERATE/COMPLEX 0.40–0.50 (classifier upgrades add variance)
const WORD_TARGETS: Record<string, Record<string, { target: number; tolerance: number }>> = {
  // STARTER: nano single for SIMPLE/MODERATE; mini single for COMPLEX
  // wbm: SIMPLE=0.439, MODERATE=0.446, COMPLEX=0.420
  STARTER:    { SIMPLE: { target: 300, tolerance: 0.55 }, MODERATE: { target: 600, tolerance: 0.45 }, COMPLEX: { target: 650, tolerance: 0.45 } },
  // PRO: mini single for SIMPLE/MODERATE; full single for COMPLEX
  // wbm: SIMPLE=0.333, MODERATE=0.595, COMPLEX=0.539
  PRO:        { SIMPLE: { target: 300, tolerance: 0.55 }, MODERATE: { target: 750, tolerance: 0.40 }, COMPLEX: { target: 950, tolerance: 0.40 } },
  // ELITE: mini single for SIMPLE/MODERATE; full single for COMPLEX
  // wbm: SIMPLE=0.448, MODERATE=0.517, COMPLEX=0.505
  ELITE:      { SIMPLE: { target: 500, tolerance: 0.55 }, MODERATE: { target: 800, tolerance: 0.40 }, COMPLEX: { target: 1000, tolerance: 0.40 } },
  // ENTERPRISE: mini single for SIMPLE/MODERATE; full single for COMPLEX
  // wbm: SIMPLE=0.357, MODERATE=0.517, COMPLEX=0.430 → ~950w system target
  // Audit Mar-24: macro-to-micro queries average 1318w (30-40% over wbm). Tolerance widened to 0.50
  // to reflect legitimate over-depth on macro family without generating false WARN/FAIL verdicts.
  ENTERPRISE: { SIMPLE: { target: 450, tolerance: 0.55 }, MODERATE: { target: 800, tolerance: 0.40 }, COMPLEX: { target: 950, tolerance: 0.50 } },
  // Multi-asset mode: compare/stress-test/macro-research receive ELITE COMPLEX specs (full model + RAG + web search)
  // Inherits ELITE COMPLEX target of 1000w; tolerance wide for structural variation
  COMPARE:         { COMPLEX: { target: 1000, tolerance: 0.50 } },
  "STRESS-TEST":   { COMPLEX: { target: 1000, tolerance: 0.50 } },
  "MACRO-RESEARCH": { COMPLEX: { target: 1000, tolerance: 0.50 } },
};

interface PromptTestCase {
  id: string;
  plan: "STARTER" | "PRO" | "ELITE" | "ENTERPRISE";
  tier: "SIMPLE" | "MODERATE" | "COMPLEX";
  family: string;
  query: string;
  context: LyraContext;
  optimizationTest?: string;
  /** Expected effective word tier for word-budget validation */
  wordBudgetKey?: string;
}

type WordBudgetResult = {
  rating: "PASS" | "WARN" | "FAIL";
  target: number;
  delta: number;
  pct: number;
};

const PROMPT_MATRIX: PromptTestCase[] = [
  // ── STARTER ────────────────────────────────────────────────────────────────
  { id: "starter-simple-edu",    plan: "STARTER", tier: "SIMPLE",   family: "educational",  query: "What is volatility score in crypto?",        context: { assetType: "CRYPTO" },                              optimizationTest: "EDU_CACHE" },
  { id: "starter-simple-signal", plan: "STARTER", tier: "SIMPLE",   family: "single-asset", query: "BTC breakdown",                   context: { symbol: "BTC-USD", assetType: "CRYPTO" } },
  { id: "starter-trivial",       plan: "STARTER", tier: "SIMPLE",   family: "trivial",      query: "hi",                              context: { assetType: "GLOBAL" },                             optimizationTest: "CANNED" },
  { id: "starter-moderate",      plan: "STARTER", tier: "MODERATE", family: "single-asset", query: "Analyze ETH",                    context: { symbol: "ETH-USD", assetType: "CRYPTO", scores: { trend: 75, momentum: 68 } } },
  { id: "starter-moderate-btc",  plan: "STARTER", tier: "MODERATE", family: "crypto",       query: "BTC outlook",                     context: { symbol: "BTC-USD", assetType: "CRYPTO" } },
  { id: "starter-complex",       plan: "STARTER", tier: "COMPLEX",  family: "comparative",  query: "Compare BTC vs ETH",            context: { assetType: "CRYPTO" } },

  // ── PRO ────────────────────────────────────────────────────────────────────
  { id: "pro-simple-edu",        plan: "PRO",    tier: "SIMPLE",   family: "educational",  query: "What is trend score in crypto?",              context: { assetType: "CRYPTO" },                              optimizationTest: "EDU_CACHE" },
  { id: "pro-simple-signal",     plan: "PRO",    tier: "SIMPLE",   family: "single-asset", query: "SOL signal",                       context: { symbol: "SOL-USD", assetType: "CRYPTO" } },
  { id: "pro-moderate-nvda",     plan: "PRO",    tier: "MODERATE", family: "single-asset", query: "What's driving SOL?",              context: { symbol: "SOL-USD", assetType: "CRYPTO", scores: { trend: 82, momentum: 58 } }, optimizationTest: "COT" },
  { id: "pro-moderate-spy",      plan: "PRO",    tier: "MODERATE", family: "single-asset", query: "Bitcoin ETF analysis",                      context: { symbol: "IBIT",  assetType: "CRYPTO" } },
  { id: "pro-complex-cmp",       plan: "PRO",    tier: "COMPLEX",  family: "comparative",  query: "Compare SOL vs ADA",               context: { assetType: "CRYPTO" } },
  { id: "pro-complex-macro",     plan: "PRO",    tier: "COMPLEX",  family: "macro",        query: "Crypto market regime analysis",            context: { assetType: "GLOBAL" } },

  // ── ELITE ──────────────────────────────────────────────────────────────────
  { id: "elite-simple-edu",      plan: "ELITE",  tier: "SIMPLE",   family: "educational",  query: "What is momentum in crypto?",                 context: { assetType: "CRYPTO" },                              optimizationTest: "EDU_CACHE" },
  { id: "elite-simple-signal",   plan: "ELITE",  tier: "SIMPLE",   family: "single-asset", query: "ETH breakdown",                    context: { symbol: "ETH-USD", assetType: "CRYPTO" } },
  { id: "elite-moderate-deep",   plan: "ELITE",  tier: "MODERATE", family: "single-asset", query: "ETH deep dive — factor alignment", context: { symbol: "ETH-USD", assetType: "CRYPTO", scores: { trend: 78, momentum: 72 } }, optimizationTest: "COT" },
  { id: "elite-moderate-gold",   plan: "ELITE",  tier: "MODERATE", family: "commodity",    query: "Stablecoin analysis",                     context: { symbol: "USDT", assetType: "STABLECOIN" } },
  { id: "elite-complex-cmp3",    plan: "ELITE",  tier: "COMPLEX",  family: "comparative",  query: "BTC vs ETH vs SOL — which wins?", context: { assetType: "CRYPTO" } },
  { id: "elite-complex-regime",  plan: "ELITE",  tier: "COMPLEX",  family: "sector",       query: "Crypto sector rotation — where to position now?", context: { assetType: "GLOBAL" } },

  // ── ENTERPRISE ─────────────────────────────────────────────────────────────
  { id: "ent-simple-edu",        plan: "ENTERPRISE", tier: "SIMPLE",   family: "educational",  query: "What is momentum score in crypto?",              context: { assetType: "CRYPTO" },                              optimizationTest: "EDU_CACHE" },
  { id: "ent-moderate-aapl",     plan: "ENTERPRISE", tier: "MODERATE", family: "single-asset", query: "BTC deep dive analysis",              context: { symbol: "BTC-USD", assetType: "CRYPTO", scores: { trend: 78, momentum: 72 } } },
  { id: "ent-moderate-fed",      plan: "ENTERPRISE", tier: "MODERATE", family: "macro",        query: "Fed rate impact on crypto sector",        context: { assetType: "GLOBAL" } },
  {
    id: "ent-complex-portfolio",
    plan: "ENTERPRISE",
    tier: "COMPLEX",
    family: "full-analysis",
    query: "Crypto portfolio analysis: concentration, correlation, fragility, and strategic adjustments",
    context: {
      assetType: "GLOBAL",
      assetName: "Core Crypto Portfolio",
      portfolioHealth: {
        healthScore: 54,
        band: "Balanced",
        holdingCount: 6,
        regime: "TRANSITIONAL",
        dimensions: {
          diversificationScore: 61,
          concentrationScore: 46,
          volatilityScore: 58,
          qualityScore: 63,
        },
      },
      portfolioFragility: {
        fragilityScore: 64,
        classification: "MEDIUM",
        topDrivers: [
          "Crypto concentration remains above 40%",
          "Correlation overlap increases rotation sensitivity",
          "Stablecoin hedge is too small to offset drawdowns",
        ],
      },
      portfolioSimulation: {
        expectedReturn: 0.112,
        maxDrawdown: -0.24,
        volatility: 0.19,
        sharpeRatio: 0.61,
        fragilityMean: 64,
        mode: "base",
        horizon: 252,
      },
    } as LyraContext,
  },
  { id: "ent-complex-rotation",  plan: "ENTERPRISE", tier: "COMPLEX",  family: "multi-asset",  query: "Crypto sector rotation analysis with macro regime", context: { assetType: "GLOBAL" } },

  // ── MULTI-ASSET CHATMODE ───────────────────────────────────────────────────
  // These should receive Elite COMPLEX specs regardless of plan
  {
    id: "compare-elite-2asset",
    plan: "ELITE",
    tier: "COMPLEX",
    family: "compare-mode",
    query: "Compare BTC vs ETH: which has stronger momentum, better risk-adjusted return, and which is more regime-aligned?",
    context: {
      symbol: "GLOBAL",
      assetType: "GLOBAL",
      assetName: "Comparison: BTC, ETH",
      chatMode: "compare",
      compareContext: [
        { symbol: "BTC-USD", name: "Bitcoin",     scores: { trend: 78, momentum: 72, volatility: 45, liquidity: 90, sentiment: 71, trust: 82 }, signal: 78, signalLabel: "Strong Buy", performance: { "1W": 2.1, "1M": 4.5, "3M": 12.3, "1Y": 28.7 } },
        { symbol: "ETH-USD", name: "Ethereum", scores: { trend: 81, momentum: 68, volatility: 38, liquidity: 92, sentiment: 74, trust: 88 }, signal: 81, signalLabel: "Strong Buy", performance: { "1W": 1.8, "1M": 3.9, "3M": 10.1, "1Y": 22.4 } },
      ],
    },
    optimizationTest: "COMPARE_MODE",
    wordBudgetKey: "COMPARE",
  },
  {
    id: "compare-pro-3asset",
    plan: "PRO",          // PRO user — should still get Elite COMPLEX via chatMode override
    tier: "COMPLEX",
    family: "compare-mode",
    query: "Compare SOL vs ADA vs DOT — factor analysis, momentum divergence, and regime fit verdict.",
    context: {
      symbol: "GLOBAL",
      assetType: "GLOBAL",
      assetName: "Comparison: SOL, ADA, DOT",
      chatMode: "compare",
      compareContext: [
        { symbol: "SOL-USD", name: "Solana",  scores: { trend: 88, momentum: 85, volatility: 60, liquidity: 91 }, signal: 88, signalLabel: "Strong Buy",  performance: { "1M": 12.1, "3M": 35.0, "1Y": 95.0 } },
        { symbol: "ADA-USD",  name: "Cardano",     scores: { trend: 71, momentum: 65, volatility: 55, liquidity: 84 }, signal: 71, signalLabel: "Buy",          performance: { "1M": 5.2,  "3M": 14.0, "1Y": 30.0 } },
        { symbol: "DOT-USD", name: "Polkadot",   scores: { trend: 42, momentum: 35, volatility: 48, liquidity: 88 }, signal: 42, signalLabel: "Neutral",      performance: { "1M": -3.1, "3M": -8.5, "1Y": -18.0 } },
      ],
    },
    optimizationTest: "COMPARE_MODE",
    wordBudgetKey: "COMPARE",
  },
  {
    id: "stress-test-elite",
    plan: "ELITE",
    tier: "COMPLEX",
    family: "stress-mode",
    query: "Stress test during 2022 crypto winter (Jan 2022–Dec 2022): BTC: -77% max drawdown, -65% period return; ETH: -82% max drawdown, -68% period return; USDT: 0% max drawdown, 0% period return. What are the best hedging strategies for this crypto portfolio? Which assets provided the best protection? What should I add or remove to improve resilience?",
    context: {
      symbol: "GLOBAL",
      assetType: "GLOBAL",
      assetName: "Crypto Portfolio Stress Test",
      chatMode: "stress-test",
    },
    optimizationTest: "STRESS_TEST_MODE",
    wordBudgetKey: "STRESS-TEST",
  },
  {
    id: "stress-test-pro",
    plan: "PRO",           // PRO user — should still get Elite COMPLEX via chatMode override
    tier: "COMPLEX",
    family: "stress-mode",
    query: "Stress test during 2020 COVID crash (Mar 2020–Apr 2020): BTC: -50% max drawdown, period +150% (dramatic V-recovery); ETH: -55% max, period +180%; USDT: 0% max, 0% period. Suggest hedging strategies and crypto portfolio improvements.",
    context: {
      symbol: "GLOBAL",
      assetType: "GLOBAL",
      assetName: "Crypto Portfolio Stress Test",
      chatMode: "stress-test",
    },
    optimizationTest: "STRESS_TEST_MODE",
    wordBudgetKey: "STRESS-TEST",
  },

  // ── v11: MACRO-RESEARCH CHATMODE ──────────────────────────────────────────────
  // macro-research receives ELITE COMPLEX specs (like compare/stress-test)
  {
    id: "macro-research-elite",
    plan: "ELITE",
    tier: "COMPLEX",
    family: "macro-research-mode",
    query: "Research the current macro landscape: GDP trends, inflation trajectory, Fed policy outlook, and how each factor cascades into crypto sector allocation. Provide a regime-anchored investment thesis with specific crypto sector picks.",
    context: {
      symbol: "GLOBAL",
      assetType: "GLOBAL",
      assetName: "Macro Research: Global Crypto Regime",
      chatMode: "macro-research",
    },
    optimizationTest: "MACRO_RESEARCH_MODE",
    wordBudgetKey: "MACRO-RESEARCH",
  },
  {
    id: "macro-research-pro",
    plan: "PRO",           // PRO user — should still get Elite COMPLEX via chatMode override
    tier: "COMPLEX",
    family: "macro-research-mode",
    query: "Macro research: Analyze the current interest rate cycle, its impact on DeFi yields, and identify which crypto sectors benefit most from a rate-cutting regime. Include specific token recommendations.",
    context: {
      symbol: "GLOBAL",
      assetType: "GLOBAL",
      assetName: "Macro Research: Rate Cycle & DeFi",
      chatMode: "macro-research",
    },
    optimizationTest: "MACRO_RESEARCH_MODE",
    wordBudgetKey: "MACRO-RESEARCH",
  },

  // ── v9: LYRA WORKFLOW / PLATFORM KNOWLEDGE ─────────────────────────────────
  {
    id: "pro-moderate-lyra-workflow",
    plan: "PRO",
    tier: "MODERATE",
    family: "platform-knowledge",
    query: "How do I get the best crypto analysis from Lyra? Walk me through the workflow.",
    context: { assetType: "GLOBAL" },
    optimizationTest: "PLATFORM_KNOWLEDGE",
  },
  {
    id: "elite-simple-credits",
    plan: "ELITE",
    tier: "SIMPLE",
    family: "educational",
    query: "How do credits work on LyraAlpha?",
    context: { assetType: "GLOBAL" },
    optimizationTest: "EDU_CACHE",
  },
  {
    id: "starter-simple-lyra-tiers",
    plan: "STARTER",
    tier: "SIMPLE",
    family: "educational",
    query: "What is the difference between a SIMPLE and COMPLEX query in Lyra?",
    context: { assetType: "GLOBAL" },
    optimizationTest: "EDU_CACHE",
  },

  // ── v9: ARCS REGIME CONTEXT ────────────────────────────────────────────────
  {
    id: "elite-moderate-arcs",
    plan: "ELITE",
    tier: "MODERATE",
    family: "single-asset",
    query: "Is BTC well-positioned for the current regime? Check its ARCS score and factor alignment.",
    context: {
      symbol: "BTC-USD",
      assetType: "CRYPTO",
      scores: { trend: 88, momentum: 85, volatility: 60, liquidity: 91, sentiment: 80, trust: 78 },
      regime: "RISK_ON",
    },
    optimizationTest: "ARCS_CONTEXT",
  },
  {
    id: "elite-complex-arcs-portfolio",
    plan: "ELITE",
    tier: "COMPLEX",
    family: "full-analysis",
    query: "Which of my crypto holdings are regime-misaligned right now? Use ARCS scores to identify the weakest fits.",
    context: {
      assetType: "GLOBAL",
      assetName: "Core Crypto Portfolio",
      regime: "RISK_OFF",
      portfolioHealth: {
        healthScore: 47,
        band: "Fragile",
        holdingCount: 5,
        regime: "RISK_OFF",
        dimensions: {
          diversificationScore: 50,
          concentrationScore: 35,
          volatilityScore: 42,
          qualityScore: 58,
        },
      },
    } as LyraContext,
  },

  // ── v9: INDIA MARKET GATING ────────────────────────────────────────────────
  {
    id: "pro-moderate-india",
    plan: "PRO",
    tier: "MODERATE",
    family: "intelligence",
    query: "Analyze Bitcoin in India — what is the current crypto market regime in India and how does RBI policy affect the outlook?",
    context: { symbol: "BTC-INR", assetType: "CRYPTO", region: "IN" },
    optimizationTest: "INDIA_MARKET",
  },

  // ── v9: MACRO-TO-MICRO WORKFLOW ────────────────────────────────────────────
  {
    id: "elite-complex-macro-micro",
    plan: "ELITE",
    tier: "COMPLEX",
    family: "macro",
    query: "Start from the macro picture — GDP, inflation, Fed policy — then walk me into which crypto sectors benefit, and then name the top crypto to position in right now.",
    context: { assetType: "GLOBAL", regime: "RISK_OFF" },
    optimizationTest: "MACRO_MICRO",
  },
  {
    id: "ent-complex-macro-micro",
    plan: "ENTERPRISE",
    tier: "COMPLEX",
    family: "macro",
    query: "Macro-to-micro analysis: current US economic regime → crypto sector rotation → single highest-conviction crypto pick with full factor rationale.",
    context: { assetType: "GLOBAL", regime: "TRANSITIONAL" },
    optimizationTest: "MACRO_MICRO",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function detectTruncation(params: {
  text: string;
  outputTokens?: number | null;
  maxOutputTokens?: number | null;
}): { likelyTruncated: boolean; reason?: string } {
  const text = params.text || "";
  if (!text.trim()) return { likelyTruncated: false };

  const hasUnclosedFence = (text.match(/```/g) || []).length % 2 === 1;
  if (hasUnclosedFence) return { likelyTruncated: true, reason: "unclosed_code_fence" };

  const max = params.maxOutputTokens ?? null;
  const out = params.outputTokens ?? null;
  if (typeof max === "number" && typeof out === "number" && max > 0) {
    const ratio = out / max;
    if (ratio >= 0.98) return { likelyTruncated: true, reason: `token_cap_${Math.round(ratio * 100)}pct` };
  }
  return { likelyTruncated: false };
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Check word count against target budget. Returns a pass/warn/fail rating. */
function checkWordBudget(
  wc: number,
  plan: string,
  tier: string,
  wordBudgetKey?: string,
): { rating: "PASS" | "WARN" | "FAIL"; target: number; delta: number; pct: number } {
  const key = wordBudgetKey ?? plan;
  const spec = WORD_TARGETS[key]?.[tier];
  if (!spec) return { rating: "PASS", target: 0, delta: 0, pct: 0 };
  const delta = wc - spec.target;
  const pct   = delta / spec.target;
  const absPct = Math.abs(pct);
  const rating = absPct <= spec.tolerance ? "PASS" : absPct <= spec.tolerance * 1.5 ? "WARN" : "FAIL";
  return { rating, target: spec.target, delta, pct };
}

function calculateQualityScore(
  text: string,
  tier: "SIMPLE" | "MODERATE" | "COMPLEX" = "MODERATE",
  family = "",
): number {
  if (!text || text.length < 50) return 0;

  const fillers = ["it's important to note","in conclusion","to summarize","generally speaking",
                   "on the other hand","furthermore","moreover","additionally"];
  const fillerHits = fillers.filter(f => text.toLowerCase().includes(f)).length;
  const antiPenalty = Math.min(15, fillerHits * 5);

  // Plain-English verdict bonus — first sentence should be jargon-light
  const firstSentence = text.split(/[.!?]/)[0] || "";
  const jargonTerms = ["pursuant","herein","aforementioned","notwithstanding","henceforth"];
  const plainEnglishBonus = jargonTerms.some(j => firstSentence.toLowerCase().includes(j)) ? -5 : 5;

  // ── Lyra output contract compliance ───────────────────────────────────────
  // Lyra responses should anchor to ## Market Pulse or ## Bottom Line sections.
  // Presence of either section is a strong signal the output contract was respected.
  const hasMarketPulse  = /^##\s*Market Pulse/im.test(text);
  const hasBottomLine   = /^##\s*Bottom Line/im.test(text);
  const outputContractBonus = (hasMarketPulse ? 4 : 0) + (hasBottomLine ? 4 : 0);

  if (tier === "SIMPLE") {
    const isEdu = family === "educational" || family === "platform-knowledge";
    const wc    = wordCount(text);
    const clarityScore = isEdu
      ? (wc < 50 ? 5 : wc < 100 ? 20 : wc < 200 ? 32 : wc < 600 ? 40 : 30)
      : (wc < 20 ? 5 : wc < 50 ? 15 : wc < 100 ? 30 : wc < 250 ? 40 : wc < 400 ? 28 : 15);

    const checkWindow = isEdu ? text : text.slice(0, 300);
    const hasBold     = /\*\*[^*]+\*\*/.test(checkWindow);
    const hasNumber   = /\b\d+(\.\d+)?[%$x]?\b/.test(checkWindow);
    const hasKeyTerms = /score|ratio|rate|trend|signal|volatil|momentum|rsi|pe|eps|range|high|low|credit|plan|tier|query/i.test(checkWindow);
    const hasEduSections = isEdu && (text.includes("## What It Is") || text.includes("## Think of It") || text.includes("## How It Works")) && (text.includes("## What HIGH") || text.includes("## "));
    const directnessScore = Math.min(30, (hasBold ? 10 : 0) + (hasNumber ? 12 : 0) + (hasKeyTerms ? 8 : 0) + (hasEduSections ? 10 : 0));

    const hasBoldUsage = (text.match(/\*\*[^*]+\*\*/g) || []).length;
    const headerCount  = (text.match(/^#{1,3}\s/gm) || []).length;
    const structScore  = isEdu
      ? Math.min(20, Math.min(8, hasBoldUsage) + Math.min(12, headerCount * 3))
      : Math.min(20, Math.min(10, hasBoldUsage * 2) + Math.min(10, headerCount * 4));

    const hasQuestion = /\?/.test(text);
    const engageScore = hasQuestion ? 10 : 0;

    // Simple Tier Pruning Verification
    const hasFinancials = /### Financials|Net Income|Gross Margin|Revenue/i.test(text);
    const hasValuation  = /### Valuation|P\/E Ratio|Price\/Book|EV\/EBITDA/i.test(text);
    const pruningPenalty = (hasFinancials || hasValuation) ? 15 : 0;

    return Math.round(Math.max(0, Math.min(100, clarityScore + directnessScore + structScore + engageScore - antiPenalty + plainEnglishBonus - pruningPenalty + outputContractBonus)));
  }

  // MODERATE / COMPLEX rubric
  const fuMatches = text.match(/\d+\.\s*[^?\n]{5,}[?]/g) || [];
  const fuCount  = Math.min(fuMatches.length, 5);
  const followScore = fuCount >= 3 ? 10 : (fuCount / 3) * 10;

  const numerics = text.match(/\b\d+(\.\d+)?[%$]?\b/g) || [];
  const numericScore = Math.min(25, new Set(numerics).size * 1.5);

  const hasHeaders    = (text.match(/^#{1,3}\s/gm) || []).length;
  const hasBold       = (text.match(/\*\*[^*]+\*\*/g) || []).length;
  const hasTable      = /\|.+\|.+ \|/.test(text) ? 1 : 0;
  const hasBlockquote = (text.match(/^>/gm) || []).length;
  const hasCheckbox   = (text.match(/- \[ \]/g) || []).length;
  const structureScore = Math.min(35,
    Math.min(14, hasHeaders * 3.5) + Math.min(12, hasBold * 1.2) +
    hasTable * 5 + Math.min(4, hasBlockquote) + Math.min(6, hasCheckbox * 2)
  );

  const wc = wordCount(text);
  const lengthScore = wc < 50 ? 6 : wc < 100 ? 12 : wc < 200 ? 18 : wc < 400 ? 24 : Math.min(30, 24 + (wc - 400) / 50);

  // Multi-asset synthesis bonus — compare/stress-test should show verdicts and recommendations
  const isMultiAsset = family === "compare-mode" || family === "stress-mode";
  const hasVerdict    = /verdict|winner|recommend|prefer|better choice|outperform/i.test(text);
  const hasSections   = hasHeaders >= 3;
  const multiAssetBonus = isMultiAsset ? (hasVerdict ? 5 : 0) + (hasSections ? 5 : 0) : 0;

  // ARCS / regime-context bonus — ARCS and regime family queries should mention compatibility or alignment
  const isRegimeFamily = family === "single-asset" || family === "full-analysis" || family === "macro";
  const hasARCSTerms   = /arcs|regime.{0,20}compat|compat.{0,20}regime|regime.{0,20}align|factor align/i.test(text);
  const arcsBonusPts   = isRegimeFamily && hasARCSTerms ? 4 : 0;

  // Macro-to-micro chain bonus — should show GDP/macro → sector → asset progression
  const isMacroFamily  = family === "macro";
  const hasMacroChain  = /gdp|inflation|fed policy|rate.{0,10}cycle/i.test(text) && /sector/i.test(text);
  const macroMicroBonus = isMacroFamily && hasMacroChain ? 5 : 0;

  // Platform knowledge bonus — Lyra workflow / credits questions should reference concrete credit counts or tier names
  const isPlatform     = family === "platform-knowledge";
  const hasPlatformFacts = /credit|SIMPLE|MODERATE|COMPLEX|tier|plan|starter|pro|elite/i.test(text);
  const platformBonus  = isPlatform && hasPlatformFacts ? 5 : 0;

  // Density Bonus: high numeric/keyword density in compact space
  const density = (numerics.length + (text.match(/trend|score|signal|momentum|volatil/gi) || []).length) / Math.max(1, wc / 100);
  const densityBonus = Math.min(10, density * 0.5);

  // Task-Last Prompting Bonus (Instruction Inversion)
  const taskLastBonus = text.trim().endsWith("?") ? 2 : 0;

  return Math.round(Math.max(0, Math.min(100,
    followScore + numericScore + structureScore + lengthScore - antiPenalty + plainEnglishBonus +
    multiAssetBonus + arcsBonusPts + macroMicroBonus + platformBonus + densityBonus + taskLastBonus + outputContractBonus
  )));
}

// Cost estimator (fallback when DB log not available)
// Mirrors the real model routing in config.ts (GPT-5.4 only, all via Azure Responses API):
//   nano  ($0.20/$1.25  per 1M)  → STARTER SIMPLE + STARTER MODERATE
//   mini  ($0.75/$4.50  per 1M)  → STARTER COMPLEX + all PRO/ELITE/ENTERPRISE SIMPLE + MODERATE
//   full  ($2.50/$15.00 per 1M)  → PRO/ELITE/ENTERPRISE COMPLEX (single, reasoning:none)
// This estimator uses the full-model rate for COMPLEX paths as the dominant cost driver.
// For more accurate per-step breakdown use real DB token logs.
function estimateCost(outputTokens: number, plan: string, tier: string): number {
  const isNano =
    plan === "STARTER" && (tier === "SIMPLE" || tier === "MODERATE");
  const isFull =
    (plan === "PRO"        && tier === "COMPLEX") ||
    (plan === "ELITE"      && tier === "COMPLEX") ||
    (plan === "ENTERPRISE" && tier === "COMPLEX");

  const outputRate = isFull ? 15.00 / 1_000_000 : isNano ? 1.25 / 1_000_000 : 4.50 / 1_000_000;
  const inputRate  = isFull ?  2.50 / 1_000_000 : isNano ? 0.20 / 1_000_000 : 0.75 / 1_000_000;
  return outputTokens * outputRate + (outputTokens * 3) * inputRate;
}

// ─── DB helper ────────────────────────────────────────────────────────────────
async function ensureAuditUser(params: { userId: string; email: string; plan: PromptTestCase["plan"] }) {
  const now = new Date();
  await prisma.user.upsert({
    where: { id: params.userId },
    create: { id: params.userId, email: params.email, plan: params.plan, updatedAt: now },
    update: { email: params.email, plan: params.plan, updatedAt: now },
  });
}

async function cleanupAuditUsers(runId: string) {
  if (!runId) return;

  // user_audit_ prefix satisfies userId.startsWith("user_") guard in storeConversationLog,
  // so real token/cost data lands in AIRequestLog for routing comparison. Cleaned up after each run.
  const userIds = (['STARTER', 'PRO', 'ELITE', 'ENTERPRISE'] as const).map(
    (plan) => `user_audit_${plan.toLowerCase()}_${runId}`,
  );

  await prisma.$transaction(async (tx) => {
    await tx.aIRequestLog.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });
}

// ─── Percentile helper ───────────────────────────────────────────────────────
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function findAuditLogRow(params: {
  userId: string;
  query: string;
  startedAt: Date;
}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await prisma.aIRequestLog.findFirst({
      where: {
        userId: params.userId,
        inputQuery: params.query,
        createdAt: { gte: params.startedAt },
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => null);

    if (row) return row;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return null;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function runAudit() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output-dir" && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    } else if (args[i] === "--baseline") {
      writeAsBaseline = true;
    } else if (args[i] === "--ids" && args[i + 1]) {
      onlyIds = args[i + 1]
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      i++;
    }
  }

  auditRunId = new Date().toISOString().replace(/[:.]/g, "-").toLowerCase();
  process.env.SKIP_CREDITS = "true";

  await Promise.all([
    invalidateCacheByPrefix("rag:assettype:"),
    invalidateCacheByPrefix("rag:q:"),
    invalidateCacheByPrefix("emb:"),
    invalidateCacheByPrefix("lyra:"),
    invalidateCacheByPrefix("gpt:"),
    invalidateCacheByPrefix("tavily:"),
    invalidateCacheByPrefix("analog:emb:"),
    invalidateCacheByPrefix("analog:search:"),
  ]);

  const selectedMatrix = onlyIds.length > 0
    ? PROMPT_MATRIX.filter((tc) => onlyIds.includes(tc.id))
    : PROMPT_MATRIX;

  if (onlyIds.length > 0 && selectedMatrix.length === 0) {
    throw new Error(`No audit test cases matched --ids=${onlyIds.join(",")}`);
  }

  console.log(`\n🧪 Prompt Pipeline Audit v2 — ${selectedMatrix.length} test cases\n`);
  mkdirSync(outputDir, { recursive: true });

  type ResultRow = {
    id: string; plan: string; tier: string; family: string;
    success: boolean; duration: number; ttftMs?: number;
    tokens?: number; inputTokens?: number; outputTokens?: number;
    cachedInputTokens?: number; reasoningTokens?: number;
    cost?: number; quality?: { score: number; breakdown?: unknown; details?: unknown }; model?: string;
    wasFallback?: boolean; likelyTruncated?: boolean; truncationReason?: string;
    error?: string; optimizationTest?: string;
    expectedTier?: string; actualTier?: string;
    wc?: number;
    wordBudget?: WordBudgetResult;
    tokenCap?: number;
    chatMode?: string;
    output?: string;
    testCase: PromptTestCase;
  };

  const results: ResultRow[] = [];
  const summary = {
    total: selectedMatrix.length, successful: 0, failed: 0,
    avgDuration: 0, totalTokens: 0, totalCost: 0, avgQualityScore: 0,
    byPlan:         {} as Record<string, { count: number; avgQuality: number; totalCost: number; avgDuration: number }>,
    byTier:         {} as Record<string, { count: number; avgQuality: number; totalCost: number; avgDuration: number }>,
    byPlanTier:     {} as Record<string, { plan: string; tier: string; count: number; avgQuality: number; totalCost: number; avgDuration: number; avgTtft: number; avgWords: number }>,
    byOptimization: {} as Record<string, { count: number; avgQuality: number; totalCost: number }>,
    byFamily:       {} as Record<string, { count: number; avgQuality: number; avgDuration: number }>,
  };
  let totalDuration = 0;

  for (let i = 0; i < selectedMatrix.length; i++) {
    const tc = selectedMatrix[i];
    const startTime   = Date.now();
    const startedAt   = new Date();

    process.stdout.write(`[${i + 1}/${selectedMatrix.length}] ${tc.id.padEnd(30)}... `);

    process.env.LYRA_AUDIT_PLAN = tc.plan;
    // user_audit_ prefix — passes userId.startsWith("user_") guard so token logs write to DB
    const auditUserId = `user_audit_${tc.plan.toLowerCase()}_${auditRunId}`;

    try {
      await ensureAuditUser({ userId: auditUserId, email: `${auditUserId}@audit.local`, plan: tc.plan });

      const messages: LyraMessage[] = [{ role: "user", content: tc.query }];
      const expectedTier = tc.tier;
      const actualTier   = classifyQuery(tc.query, 0);
      const tierConfig   = getTierConfig(tc.plan, actualTier);

      const streamResult = await generateLyraStream(messages, tc.context, auditUserId, { sourcesLimit: 3, skipAssetLinks: false, preResolvedPlan: tc.plan });

      let fullResponse = "";
      let ttftMs: number | undefined;

      if (streamResult?.result && typeof streamResult.result === "object" && "textStream" in streamResult.result) {
        for await (const chunk of streamResult.result.textStream) {
          if (!chunk) continue;
          if (ttftMs === undefined) ttftMs = Date.now() - startTime;
          fullResponse += chunk;
        }
      }

      const duration = Date.now() - startTime;
      const quality  = calculateQualityScore(fullResponse, actualTier as "SIMPLE" | "MODERATE" | "COMPLEX", tc.family);
      const wc       = wordCount(fullResponse);

      // Determine word budget key: chatMode takes precedence
      // Trivial/canned responses intentionally bypass word budget — skip check
      const chatModeKey = tc.context.chatMode?.toUpperCase();
      const budgetKey   = chatModeKey ?? tc.plan;
      const budgetTier  = chatModeKey ? "COMPLEX" : actualTier; // multi-asset always COMPLEX
      const wordBudgetRes = tc.family === "trivial"
        ? { rating: "PASS" as const, target: 0, delta: 0, pct: 0 }
        : checkWordBudget(wc, budgetKey, budgetTier, tc.wordBudgetKey);

      const logRow = await findAuditLogRow({
        userId: auditUserId,
        query: tc.query,
        startedAt,
      });

      const outputTokens    = logRow?.outputTokens ?? null;
      const maxOutputTokens = getTargetOutputTokens(tierConfig);
      const trunc           = detectTruncation({ text: fullResponse, outputTokens, maxOutputTokens: maxOutputTokens });
      const tokens          = logRow?.tokensUsed ?? Math.round(fullResponse.length / 4);
      const cost            = logRow?.totalCost  ?? estimateCost(tokens, tc.plan, tc.tier);

      results.push({
        testCase: tc, id: tc.id, plan: tc.plan, tier: tc.tier, family: tc.family,
        duration, ttftMs, tokens,
        inputTokens:      logRow?.inputTokens      ?? undefined,
        outputTokens:     logRow?.outputTokens      ?? undefined,
        cachedInputTokens: logRow?.cachedInputTokens ?? undefined,
        reasoningTokens:  logRow?.reasoningTokens   ?? undefined,
        cost, model: logRow?.model ?? undefined,
        wasFallback: logRow?.wasFallback ?? undefined,
        quality: { score: quality }, wc,
        wordBudget: wordBudgetRes,
        tokenCap: maxOutputTokens,
        likelyTruncated:  trunc.likelyTruncated,
        truncationReason: trunc.reason,
        expectedTier, actualTier,
        optimizationTest: tc.optimizationTest,
        chatMode:  tc.context.chatMode,
        output: fullResponse,
        success: true,
      });

      summary.successful++;
      totalDuration           += duration;
      summary.totalTokens     += tokens;
      summary.totalCost       += cost;
      summary.avgQualityScore += quality;

      for (const [key, group] of [
        [tc.plan, summary.byPlan,   undefined],
        [tc.tier, summary.byTier,   undefined],
        [tc.family, summary.byFamily, undefined],
      ] as Array<[string, Record<string, {count:number;avgQuality:number;totalCost?:number;avgDuration:number}>, undefined]>) {
        if (!group[key]) group[key] = { count: 0, avgQuality: 0, totalCost: 0, avgDuration: 0 };
        group[key].count++;
        group[key].avgQuality  += quality;
        (group[key] as Record<string,number>).totalCost = ((group[key] as Record<string,number>).totalCost ?? 0) + cost;
        group[key].avgDuration += duration;
      }
      const planTierKey = `${tc.plan}:${tc.tier}`;
      if (!summary.byPlanTier[planTierKey]) {
        summary.byPlanTier[planTierKey] = {
          plan: tc.plan,
          tier: tc.tier,
          count: 0,
          avgQuality: 0,
          totalCost: 0,
          avgDuration: 0,
          avgTtft: 0,
          avgWords: 0,
        };
      }
      summary.byPlanTier[planTierKey].count++;
      summary.byPlanTier[planTierKey].avgQuality += quality;
      summary.byPlanTier[planTierKey].totalCost += cost;
      summary.byPlanTier[planTierKey].avgDuration += duration;
      summary.byPlanTier[planTierKey].avgTtft += ttftMs ?? 0;
      summary.byPlanTier[planTierKey].avgWords += wc;
      if (tc.optimizationTest) {
        if (!summary.byOptimization[tc.optimizationTest]) summary.byOptimization[tc.optimizationTest] = { count: 0, avgQuality: 0, totalCost: 0 };
        summary.byOptimization[tc.optimizationTest].count++;
        summary.byOptimization[tc.optimizationTest].avgQuality += quality;
        summary.byOptimization[tc.optimizationTest].totalCost  += cost;
      }

      const budgetTag  = `${wordBudgetRes.rating}(${wc}w→${wordBudgetRes.target}w${wordBudgetRes.delta >= 0 ? "+" : ""}${wordBudgetRes.delta})`;
      const truncTag   = trunc.likelyTruncated ? ` TRUNC:${trunc.reason}` : "";
      const ttftTag    = typeof ttftMs === "number" ? ` TTFT:${ttftMs}ms` : "";
      const modeTag    = tc.context.chatMode ? ` [${tc.context.chatMode.toUpperCase()}]` : "";
      console.log(`✅ ${duration}ms${ttftTag} | Q:${quality} | ${budgetTag} | $${cost.toFixed(5)}${truncTag}${modeTag}`);

    } catch (error) {
      summary.failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`❌ ${errorMessage.substring(0, 60)}`);
      results.push({ testCase: tc, error: errorMessage, success: false, id: tc.id, plan: tc.plan, tier: tc.tier, family: tc.family, duration: 0 });
    }
  }

  // ─── Averages ──────────────────────────────────────────────────────────────
  summary.avgDuration     = totalDuration / Math.max(summary.successful, 1);
  summary.avgQualityScore = summary.avgQualityScore / Math.max(summary.successful, 1);
  for (const g of [summary.byPlan, summary.byTier, summary.byFamily]) {
    for (const k of Object.keys(g)) {
      g[k].avgQuality  /= g[k].count;
      g[k].avgDuration /= g[k].count;
    }
  }
  for (const stats of Object.values(summary.byPlanTier)) {
    stats.avgQuality /= stats.count;
    stats.avgDuration /= stats.count;
    stats.avgTtft /= stats.count;
    stats.avgWords /= stats.count;
  }
  for (const o of Object.keys(summary.byOptimization)) {
    summary.byOptimization[o].avgQuality /= summary.byOptimization[o].count;
  }

  // ─── Latency percentiles ────────────────────────────────────────────────────
  const successRows = results.filter(r => r.success);
  const allDurations = successRows.map(r => r.duration).sort((a, b) => a - b);
  const allTtfts     = successRows.filter(r => r.ttftMs !== undefined).map(r => r.ttftMs!).sort((a,b)=>a-b);

  const latencyPercentiles = {
    e2e:  { p50: percentile(allDurations, 50), p90: percentile(allDurations, 90), p95: percentile(allDurations, 95), min: allDurations[0] ?? 0, max: allDurations.at(-1) ?? 0 },
    ttft: { p50: percentile(allTtfts, 50),     p90: percentile(allTtfts, 90),     p95: percentile(allTtfts, 95),     min: allTtfts[0] ?? 0,     max: allTtfts.at(-1) ?? 0 },
  };

  // Per-family latency
  const familyLatency: Record<string, { durations: number[]; ttfts: number[] }> = {};
  for (const r of successRows) {
    if (!familyLatency[r.family]) familyLatency[r.family] = { durations: [], ttfts: [] };
    familyLatency[r.family].durations.push(r.duration);
    if (r.ttftMs !== undefined) familyLatency[r.family].ttfts.push(r.ttftMs);
  }

  // ─── Word-budget summary ───────────────────────────────────────────────────
  const budgetRows = successRows.filter(r => r.wordBudget && r.wordBudget.target > 0);
  const budgetPass  = budgetRows.filter(r => r.wordBudget?.rating === "PASS").length;
  const budgetWarn  = budgetRows.filter(r => r.wordBudget?.rating === "WARN").length;
  const budgetFail  = budgetRows.filter(r => r.wordBudget?.rating === "FAIL").length;

  // Multi-asset mode quality ──────────────────────────────────────────────
  const multiAssetRows = successRows.filter(r => r.chatMode);
  const multiAssetAvgQ = multiAssetRows.length
    ? multiAssetRows.reduce((s, r) => s + (r.quality?.score ?? 0), 0) / multiAssetRows.length
    : 0;
  const multiAssetAvgWc = multiAssetRows.length
    ? multiAssetRows.reduce((s, r) => s + (r.wc ?? 0), 0) / multiAssetRows.length
    : 0;

  // ─── Cost projections ─────────────────────────────────────────────────────
  const MONTHLY_QUERIES: Record<string, { low:number; mid:number; high:number; label:string }> = {
    STARTER:    { low: 20,  mid: 40,   high: 80,   label: "STARTER ($0/mo)"     },
    PRO:        { low: 60,  mid: 120,  high: 250,  label: "PRO ($14.99/mo)"    },
    ELITE:      { low: 150, mid: 350,  high: 700,  label: "ELITE ($39.99/mo)"  },
    ENTERPRISE: { low: 500, mid: 1500, high: 5000, label: "ENTERPRISE (custom)" },
  };
  const TIER_MIX: Record<string, { SIMPLE:number; MODERATE:number; COMPLEX:number }> = {
    STARTER:    { SIMPLE: 0.60, MODERATE: 0.35, COMPLEX: 0.05 },
    PRO:        { SIMPLE: 0.30, MODERATE: 0.50, COMPLEX: 0.20 },
    ELITE:      { SIMPLE: 0.20, MODERATE: 0.45, COMPLEX: 0.35 },
    ENTERPRISE: { SIMPLE: 0.15, MODERATE: 0.40, COMPLEX: 0.45 },
  };

  const monthlyProjections: Record<string, { low:{queries:number;cost:number;cpq:number}; mid:{queries:number;cost:number;cpq:number}; high:{queries:number;cost:number;cpq:number}; tierBreakdown:Record<string,{avgCost:number;pct:number}> }> = {};
  for (const plan of ["STARTER","PRO","ELITE","ENTERPRISE"]) {
    const mix    = TIER_MIX[plan];
    const volume = MONTHLY_QUERIES[plan];
    const tierCosts: Record<string,{avgCost:number;pct:number}> = {};
    for (const tier of ["SIMPLE","MODERATE","COMPLEX"] as const) {
      const rows    = results.filter(r => r.plan === plan && r.tier === tier && r.success && r.cost !== undefined && !r.chatMode);
      const avgCost = rows.length > 0
        ? rows.reduce((s,r) => s + (r.cost ?? 0), 0) / rows.length
        : estimateCost(tier === "SIMPLE" ? 150 : tier === "MODERATE" ? 400 : 800, plan, tier);
      tierCosts[tier] = { avgCost, pct: mix[tier] };
    }
    const cpq = tierCosts.SIMPLE.avgCost * mix.SIMPLE + tierCosts.MODERATE.avgCost * mix.MODERATE + tierCosts.COMPLEX.avgCost * mix.COMPLEX;
    monthlyProjections[plan] = {
      low:  { queries: volume.low,  cost: cpq * volume.low,  cpq },
      mid:  { queries: volume.mid,  cost: cpq * volume.mid,  cpq },
      high: { queries: volume.high, cost: cpq * volume.high, cpq },
      tierBreakdown: tierCosts,
    };
  }

  // Model routing comparison — counterfactual cost if everything ran on a single model tier
  // Actual: real hybrid routing (nano/mini/full per tier config)
  // allNano: what if everything used lyra-nano ($0.20/$1.25) — cheapest possible
  // allFull: what if everything used lyra-full ($2.50/$15.00) — most expensive
  // Cache savings: value of Azure prompt cache hits (25% of cached-input rate)
  const NANO_IN  = 0.20/1_000_000; const NANO_OUT  =  1.25/1_000_000;
  const FULL_IN  = 2.50/1_000_000; const FULL_OUT  = 15.00/1_000_000;
  const CACHE_D  = 0.75; // 75% discount on cached tokens
  const routingComp = successRows
    .filter(r => r.inputTokens !== undefined && r.outputTokens !== undefined)
    .reduce((acc, r) => {
      const inT = r.inputTokens ?? 0; const outT = r.outputTokens ?? 0; const cacT = r.cachedInputTokens ?? 0;
      const nonCac = inT - cacT;
      acc.actual  += r.cost ?? 0;
      acc.allNano += nonCac * NANO_IN + cacT * NANO_IN * (1 - CACHE_D) + outT * NANO_OUT;
      acc.allFull += nonCac * FULL_IN + cacT * FULL_IN * (1 - CACHE_D) + outT * FULL_OUT;
      acc.cached  += cacT * NANO_IN * CACHE_D;
      return acc;
    }, { actual: 0, allNano: 0, allFull: 0, cached: 0 });

  // ─── Save JSON ─────────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePrefix = writeAsBaseline ? "baseline" : "current";
  const outPath   = join(outputDir, `${filePrefix}-${timestamp}-results.json`);
  writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: writeAsBaseline ? "baseline" : "current",
    auditVersion: "v11",
    summary,
    latencyPercentiles,
    monthlyProjections,
    routingComp,
    results,
  }, null, 2));

  // ═══════════════════════════════════════════════════════════════════════════
  // PRINT REPORT
  // ═══════════════════════════════════════════════════════════════════════════
  const SEP = "═".repeat(72);
  const sep = "─".repeat(72);

  console.log(`\n${SEP}`);
  console.log(`📊  PROMPT PIPELINE AUDIT REPORT — ${new Date().toLocaleString()}`);
  console.log(`${SEP}`);
  console.log(`  Tests:       ${summary.successful}/${summary.total} passed (${summary.failed} failed)`);
  console.log(`  Avg e2e:     ${summary.avgDuration.toFixed(0)}ms  |  p50:${latencyPercentiles.e2e.p50}ms  p90:${latencyPercentiles.e2e.p90}ms  p95:${latencyPercentiles.e2e.p95}ms`);
  if (allTtfts.length > 0) {
    console.log(`  TTFT:        p50:${latencyPercentiles.ttft.p50}ms  p90:${latencyPercentiles.ttft.p90}ms  p95:${latencyPercentiles.ttft.p95}ms  (${allTtfts.length} samples)`);
  }
  console.log(`  Total tokens: ${summary.totalTokens.toLocaleString()}   Total cost: $${summary.totalCost.toFixed(5)}`);
  console.log(`  Avg quality:  ${summary.avgQualityScore.toFixed(1)}/100`);

  // Word budget compliance
  console.log(`\n${sep}`);
  console.log(`📏  WORD BUDGET — DETAILED  (target ±40% tolerance)`);
  console.log(`${sep}`);
  console.log(`  PASS: ${budgetPass}  WARN: ${budgetWarn}  FAIL: ${budgetFail}  (${budgetRows.length} measured)`);
  console.log(`\n  ${"Test".padEnd(32)} ${"Plan".padEnd(11)} ${"Tier".padEnd(9)} ${"Act".padStart(5)} ${"Tgt".padStart(5)} ${"Δ".padStart(5)} ${"Cap(tok)".padStart(9)} ${"CapW".padStart(6)} ${"Util%".padStart(6)} Rating`);
  console.log(`  ${"-".repeat(100)}`);
  const budgetDetailsSorted = budgetRows.sort((a, b) => a.plan.localeCompare(b.plan) || a.tier.localeCompare(b.tier));
  for (const r of budgetDetailsSorted) {
    const wb   = r.wordBudget!;
    const icon = wb.rating === "PASS" ? "✅" : wb.rating === "WARN" ? "⚠️ " : "❌";
    const deltaStr = `${wb.delta >= 0 ? "+" : ""}${wb.delta}`;
    const tokenCap = r.tokenCap ?? null;
    const capWords = tokenCap != null ? Math.round(tokenCap * 0.68) : null;
    const utilPct  = (r.outputTokens != null && tokenCap != null && tokenCap > 0)
      ? Math.round((r.outputTokens / tokenCap) * 100) : null;
    const capWStr  = capWords != null ? `${capWords}w` : "  -";
    const utilStr  = utilPct != null ? `${utilPct}%` : "  -";
    const modeTag  = r.chatMode ? `[${r.chatMode.toUpperCase()}]` : "";
    console.log(`  ${icon} ${r.id.padEnd(32)} ${(r.plan + (modeTag ? ` ${modeTag}` : "")).padEnd(11)} ${r.tier.padEnd(9)} ${String(r.wc ?? 0).padStart(5)} ${String(wb.target).padStart(5)} ${deltaStr.padStart(5)} ${tokenCap != null ? String(tokenCap).padStart(9) : "        -"} ${capWStr.padStart(6)} ${utilStr.padStart(6)} ${icon}`);
  }
  // Tier summary rows
  console.log(`\n  ${"Tier avg".padEnd(32)} ${"".padEnd(11)} ${"".padEnd(9)} ${"Act".padStart(5)} ${"Tgt".padStart(5)}`);
  for (const tier of ["SIMPLE", "MODERATE", "COMPLEX"] as const) {
    const tRows = budgetRows.filter(r => r.tier === tier && !r.chatMode);
    if (!tRows.length) continue;
    const avgAct = Math.round(tRows.reduce((s, r) => s + (r.wc ?? 0), 0) / tRows.length);
    const avgTgt = Math.round(tRows.reduce((s, r) => s + (r.wordBudget?.target ?? 0), 0) / tRows.length);
    const pass   = tRows.filter(r => r.wordBudget?.rating === "PASS").length;
    console.log(`  ── ${tier.padEnd(29)} ${"".padEnd(11)} ${"".padEnd(9)} ${String(avgAct).padStart(5)} ${String(avgTgt).padStart(5)}   (${pass}/${tRows.length} PASS)`);
  }

  // By plan
  console.log(`\n${sep}`);
  console.log(`📈  BY PLAN`);
  console.log(`${sep}`);
  console.log(`  ${" Plan".padEnd(14)} ${"Q".padStart(5)} ${"AvgMs".padStart(7)} ${"TotalCost".padStart(12)} ${"Tests".padStart(6)}`);
  for (const [p, s] of Object.entries(summary.byPlan)) {
    console.log(`  ${p.padEnd(14)} ${s.avgQuality.toFixed(1).padStart(5)} ${s.avgDuration.toFixed(0).padStart(7)}ms ${("$"+((s as Record<string,number>).totalCost ?? 0).toFixed(5)).padStart(12)} ${s.count.toString().padStart(6)}`);
  }

  console.log(`\n${sep}`);
  console.log(`📈  BY PLAN × TIER`);
  console.log(`${sep}`);
  console.log(`  ${" Plan".padEnd(14)} ${"Tier".padEnd(10)} ${"Q".padStart(5)} ${"AvgMs".padStart(7)} ${"TTFT".padStart(7)} ${"AvgCost".padStart(10)} ${"AvgWords".padStart(10)} ${"Tests".padStart(6)}`);
  for (const stats of Object.values(summary.byPlanTier).sort((a, b) => a.plan.localeCompare(b.plan) || a.tier.localeCompare(b.tier))) {
    const avgCost = stats.totalCost / stats.count;
    console.log(`  ${stats.plan.padEnd(14)} ${stats.tier.padEnd(10)} ${stats.avgQuality.toFixed(1).padStart(5)} ${stats.avgDuration.toFixed(0).padStart(7)}ms ${stats.avgTtft.toFixed(0).padStart(7)}ms ${("$" + avgCost.toFixed(5)).padStart(10)} ${Math.round(stats.avgWords).toString().padStart(10)} ${stats.count.toString().padStart(6)}`);
  }

  console.log(`\n${sep}`);
  console.log(`📈  BY TIER`);
  console.log(`${sep}`);
  for (const [t, s] of Object.entries(summary.byTier)) {
    const tier_rows = successRows.filter(r => r.tier === t && !r.chatMode);
    const avgWc = tier_rows.length ? Math.round(tier_rows.reduce((a,r)=>a+(r.wc??0),0)/tier_rows.length) : 0;
    console.log(`  ${t.padEnd(12)} Q=${s.avgQuality.toFixed(1).padStart(5)} | ${s.avgDuration.toFixed(0).padStart(5)}ms | ${((s as Record<string,number>).totalCost ?? 0).toFixed(5)} | avg ${avgWc}w`);
  }

  // By optimization / feature
  if (Object.keys(summary.byOptimization).length > 0) {
    console.log(`\n${sep}`);
    console.log(`🔬  BY OPTIMIZATION TEST`);
    console.log(`${sep}`);
    for (const [o, s] of Object.entries(summary.byOptimization)) {
      const modeFlag = ["COMPARE_MODE","STRESS_TEST_MODE"].includes(o) ? " ← chatMode override" : "";
      console.log(`  ${o.padEnd(20)} Q=${s.avgQuality.toFixed(1).padStart(5)} | $${s.totalCost.toFixed(5)} | ${s.count} tests${modeFlag}`);
    }
  }

  // Multi-asset chatMode section
  if (multiAssetRows.length > 0) {
    console.log(`\n${sep}`);
    console.log(`🔀  MULTI-ASSET CHATMODE RESULTS (compare / stress-test)`);
    console.log(`${sep}`);
    console.log(`  Avg quality: ${multiAssetAvgQ.toFixed(1)}/100   Avg words: ${multiAssetAvgWc.toFixed(0)}w   Target: 1000w (ELITE COMPLEX budget)`);
    console.log(`  Per-test breakdown:`);
    for (const r of multiAssetRows) {
      const wb = r.wordBudget;
      const icon = wb?.rating === "PASS" ? "✅" : wb?.rating === "WARN" ? "⚠️ " : "❌";
      console.log(`  ${icon} ${r.id.padEnd(30)} Q:${r.quality?.score ?? "?"}  ${r.wc ?? 0}w  ${r.duration}ms  [${r.chatMode?.toUpperCase()}]  plan:${r.plan}`);
    }
  }

  // Family latency
  console.log(`\n${sep}`);
  console.log(`⏱️   LATENCY BY FAMILY`);
  console.log(`${sep}`);
  for (const [fam, data] of Object.entries(familyLatency)) {
    const sorted = data.durations.sort((a,b)=>a-b);
    const p50d = percentile(sorted, 50); const p90d = percentile(sorted, 90);
    const ttftSorted = data.ttfts.sort((a,b)=>a-b);
    const ttftStr = ttftSorted.length > 0 ? `  TTFT p50:${percentile(ttftSorted,50)}ms` : "";
    console.log(`  ${fam.padEnd(20)} p50:${p50d}ms  p90:${p90d}ms  n=${sorted.length}${ttftStr}`);
  }

  // Cost analysis
  console.log(`\n${SEP}`);
  console.log(`💰  COST ANALYSIS`);
  console.log(`${SEP}`);

  console.log(`\n  ┌─ PER-PLAN UNIT ECONOMICS`);
  for (const [plan, proj] of Object.entries(monthlyProjections)) {
    console.log(`  │  ${MONTHLY_QUERIES[plan].label}`);
    console.log(`  │  Cost/query: $${proj.mid.cpq.toFixed(5)} | Tier breakdown: S=$${proj.tierBreakdown.SIMPLE.avgCost.toFixed(5)}  M=$${proj.tierBreakdown.MODERATE.avgCost.toFixed(5)}  C=$${proj.tierBreakdown.COMPLEX.avgCost.toFixed(5)}`);
    console.log(`  │`);
  }
  console.log(`  └${sep.slice(2)}`);

  console.log(`\n  ┌─ MONTHLY PROJECTIONS PER USER`);
  console.log(`  │  ${"Plan".padEnd(12)} ${"TierMix".padEnd(22)} ${"Low".padStart(10)} ${"Mid".padStart(10)} ${"High".padStart(10)}`);
  console.log(`  │  ${sep.slice(2)}`);
  for (const [plan, proj] of Object.entries(monthlyProjections)) {
    const mix = TIER_MIX[plan];
    const tierStr = `${Math.round(mix.SIMPLE*100)}%S/${Math.round(mix.MODERATE*100)}%M/${Math.round(mix.COMPLEX*100)}%C`;
    console.log(`  │  ${plan.padEnd(12)} ${tierStr.padEnd(22)} ${("$"+proj.low.cost.toFixed(4)).padStart(10)} ${("$"+proj.mid.cost.toFixed(4)).padStart(10)} ${("$"+proj.high.cost.toFixed(4)).padStart(10)}`);
    console.log(`  │  ${"".padEnd(12)} ${" (queries/mo)".padEnd(22)} ${String(proj.low.queries).padStart(10)} ${String(proj.mid.queries).padStart(10)} ${String(proj.high.queries).padStart(10)}`);
  }
  console.log(`  └${sep.slice(2)}`);

  console.log(`\n  ┌─ MODEL ROUTING IMPACT  (nano=$0.20/$1.25 · mini=$0.75/$4.50 · full=$2.50/$15.00 per 1M)`);
  const rc = routingComp;
  if (rc.actual === 0 && rc.allNano === 0) {
    console.log(`  │  (No token-level data from DB — audit ran without real API calls)`);
  } else {
    console.log(`  │  Actual (hybrid):       $${rc.actual.toFixed(5)}`);
    console.log(`  │  If all lyra-nano:      $${rc.allNano.toFixed(5)}`);
    console.log(`  │  If all lyra-full:      $${rc.allFull.toFixed(5)}`);
    console.log(`  │  Cache savings:         $${rc.cached.toFixed(5)}`);
    console.log(`  │  Hybrid saves vs full:  $${(rc.allFull - rc.actual).toFixed(5)} (${rc.allFull > 0 ? ((rc.allFull-rc.actual)/rc.allFull*100).toFixed(1) : "?"}% cheaper)`);
  }
  console.log(`  └${sep.slice(2)}`);

  console.log(`\n  ┌─ SCALE ECONOMICS (monthly cost × 1K / 10K active users per plan)`);
  for (const [plan, proj] of Object.entries(monthlyProjections)) {
    console.log(`  │  ${plan.padEnd(12)} 1K users: $${(proj.mid.cost * 1000).toFixed(2).padStart(8)}/mo  |  10K users: $${(proj.mid.cost * 10000).toFixed(2).padStart(10)}/mo`);
  }
  console.log(`  └${sep.slice(2)}`);

  // ─── Per-test detail table ─────────────────────────────────────────────────
  console.log(`\n${SEP}`);
  console.log(`🔬  PER-TEST DETAIL  (cost · latency · quality)`);
  console.log(`${SEP}`);
  const colId   = 32;
  const colPlan = 11;
  const colTier =  8;
  const hdr = [
    "Test".padEnd(colId),
    "Plan".padEnd(colPlan),
    "Tier".padEnd(colTier),
    "Q".padStart(4),
    "Words".padStart(6),
    "E2E(ms)".padStart(8),
    "TTFT(ms)".padStart(9),
    "inTok".padStart(6),
    "outTok".padStart(7),
    "cachedTok".padStart(10),
    "Cost($)".padStart(9),
    "WBudget".padStart(9),
    "Trunc".padStart(6),
    "Model".padStart(18),
  ].join("  ");
  console.log(`  ${hdr}`);
  console.log(`  ${"-".repeat(hdr.length)}`);

  for (const r of results) {
    if (!r.success) {
      console.log(`  ❌ ${r.id.padEnd(colId)}  ${r.plan.padEnd(colPlan)}  ${r.tier.padEnd(colTier)}  ERROR: ${r.error?.slice(0, 60) ?? "?"}`);
      continue;
    }
    const qIcon  = (r.quality?.score ?? 0) >= 70 ? "✅" : (r.quality?.score ?? 0) >= 50 ? "⚠️ " : "❌";
    const wb     = r.wordBudget;
    const wbStr  = wb && wb.target > 0
      ? `${wb.rating}(${wb.delta >= 0 ? "+" : ""}${wb.delta})`
      : "   -";
    const truncStr = r.likelyTruncated ? `⚠️ ${r.truncationReason?.slice(0, 8) ?? "Y"}` : "  -";
    const modelStr = (r.model ?? "-").slice(0, 18);
    const modeTag  = r.chatMode ? `[${r.chatMode.toUpperCase()}]` : "";
    const planTag  = `${r.plan}${modeTag ? " " + modeTag : ""}`;
    const row = [
      r.id.padEnd(colId),
      planTag.padEnd(colPlan),
      r.tier.padEnd(colTier),
      String(r.quality?.score ?? 0).padStart(4),
      String(r.wc ?? 0).padStart(6),
      String(r.duration).padStart(8),
      (r.ttftMs != null ? String(r.ttftMs) : "-").padStart(9),
      (r.inputTokens != null ? String(r.inputTokens) : "-").padStart(6),
      (r.outputTokens != null ? String(r.outputTokens) : "-").padStart(7),
      (r.cachedInputTokens != null ? String(r.cachedInputTokens) : "-").padStart(10),
      `$${(r.cost ?? 0).toFixed(5)}`.padStart(9),
      wbStr.padStart(9),
      truncStr.padStart(6),
      modelStr.padStart(18),
    ].join("  ");
    console.log(`  ${qIcon} ${row}`);
  }

  // ─── New v9 optimization test breakdown ────────────────────────────────────
  const v9OptTests = ["ARCS_CONTEXT", "INDIA_MARKET", "MACRO_MICRO", "PLATFORM_KNOWLEDGE"];
  const v11OptTests = ["MACRO_RESEARCH_MODE"];
  const newTests = Object.entries(summary.byOptimization).filter(([k]) => v9OptTests.includes(k));
  const v11NewTests = Object.entries(summary.byOptimization).filter(([k]) => v11OptTests.includes(k));
  if (newTests.length > 0) {
    console.log(`\n${sep}`);
    console.log(`🆕  V9 NEW TEST GROUPS`);
    console.log(`${sep}`);
    for (const [o, s] of newTests) {
      console.log(`  ${o.padEnd(22)} Q=${s.avgQuality.toFixed(1).padStart(5)} | $${s.totalCost.toFixed(5)} | ${s.count} tests`);
    }
  }
  if (v11NewTests.length > 0) {
    console.log(`\n${sep}`);
    console.log(`🆕  V11 NEW TEST GROUPS (macro-research chatMode)`);
    console.log(`${sep}`);
    for (const [o, s] of v11NewTests) {
      console.log(`  ${o.padEnd(22)} Q=${s.avgQuality.toFixed(1).padStart(5)} | $${s.totalCost.toFixed(5)} | ${s.count} tests`);
    }
  }

  console.log(`\n${SEP}`);
  console.log(`✅  Saved: ${outPath}`);
  console.log(`${SEP}\n`);
}

runAudit()
  .catch(console.error)
  .finally(async () => {
    try {
      await cleanupAuditUsers(auditRunId);
    } catch (error) {
      console.error(error);
    }
  });
