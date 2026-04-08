/**
 * L1: Automated Lyra Evaluation Framework
 *
 * Runs a curated set of golden queries across tiers and plans, then scores
 * each response for structural correctness, section presence, follow-up count,
 * word budget adherence, and latency.
 *
 * Usage:
 *   npx tsx scripts/eval-lyra.ts                     # full suite
 *   npx tsx scripts/eval-lyra.ts --tier SIMPLE       # single tier
 *   npx tsx scripts/eval-lyra.ts --plan PRO          # single plan
 *   npx tsx scripts/eval-lyra.ts --compare baseline  # compare to saved baseline
 *
 * Results are saved to ./eval-results/<timestamp>.json for regression comparison.
 *
 * Con mitigations:
 * - Uses the same validateOutput logic from output-validation.ts (no separate rules to maintain)
 * - Golden queries are realistic user questions, not synthetic edge cases
 * - Scoring is deterministic (no LLM-as-judge) for reproducibility
 * - Zero runtime impact — CLI-only script
 */

import { generateLyraStream } from "@/lib/ai/service";
import { validateOutput, type OutputValidationResult } from "@/lib/ai/output-validation";
import { classifyQuery } from "@/lib/ai/query-classifier";
import type { LyraMessage } from "@/types/ai";
import type { LyraContext } from "@/lib/engines/types";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

// ─── Golden Queries ─────────────────────────────────────────────────────────
// Each query has an expected tier and asset type for validation.
const GOLDEN_QUERIES: Array<{
  query: string;
  expectedTier: string;
  assetType: string;
  plan: string;
  description: string;
}> = [
  // SIMPLE — Educational
  {
    query: "What is a P/E ratio?",
    expectedTier: "SIMPLE",
    assetType: "GLOBAL",
    plan: "STARTER",
    description: "Basic educational question",
  },
  {
    query: "How does compound interest work?",
    expectedTier: "SIMPLE",
    assetType: "GLOBAL",
    plan: "STARTER",
    description: "Educational finance concept",
  },
  // SIMPLE — Single asset
  {
    query: "How is AAPL doing?",
    expectedTier: "SIMPLE",
    assetType: "US_STOCK",
    plan: "PRO",
    description: "Simple stock check",
  },
  // MODERATE — Single asset analysis
  {
    query: "Analyze NVDA's current position and momentum",
    expectedTier: "MODERATE",
    assetType: "US_STOCK",
    plan: "PRO",
    description: "PRO moderate stock analysis",
  },
  {
    query: "What's happening with Bitcoin right now?",
    expectedTier: "MODERATE",
    assetType: "CRYPTO",
    plan: "ELITE",
    description: "ELITE crypto analysis",
  },
  // COMPLEX — Deep analysis
  {
    query: "Give me a comprehensive analysis of TSLA including valuation, momentum, and risk factors",
    expectedTier: "COMPLEX",
    assetType: "US_STOCK",
    plan: "ELITE",
    description: "ELITE complex stock deep-dive",
  },
  {
    query: "Analyze gold as a hedge in the current macro environment with cross-asset correlations",
    expectedTier: "COMPLEX",
    assetType: "COMMODITY",
    plan: "ELITE",
    description: "ELITE complex commodity analysis",
  },
  // GLOBAL — Market-wide
  {
    query: "What's the current market regime and what sectors look strongest?",
    expectedTier: "MODERATE",
    assetType: "GLOBAL",
    plan: "PRO",
    description: "PRO global macro question",
  },
];

// ─── Scoring ─────────────────────────────────────────────────────────────────
interface EvalScore {
  query: string;
  description: string;
  plan: string;
  classifiedTier: string;
  expectedTier: string;
  tierMatch: boolean;
  validation: OutputValidationResult;
  wordCount: number;
  latencyMs: number;
  score: number; // 0–100
  issues: string[];
}

function scoreResult(
  validation: OutputValidationResult,
  tierMatch: boolean,
  wordCount: number,
  latencyMs: number,
  classifiedTier: string,
): { score: number; issues: string[] } {
  let score = 100;
  const issues: string[] = [];

  // Section presence: -15 per missing section
  if (validation.missingSections.length > 0) {
    const penalty = validation.missingSections.length * 15;
    score -= penalty;
    issues.push(`Missing sections: ${validation.missingSections.join(", ")} (-${penalty})`);
  }

  // Follow-up count (MODERATE+ only): -10 if wrong count
  if (classifiedTier !== "SIMPLE" && validation.followUpCount > 0 && validation.followUpCount !== 3) {
    score -= 10;
    issues.push(`Follow-up count: ${validation.followUpCount} (expected 3) (-10)`);
  }

  // Word count check: -10 if too short (<80 words for non-SIMPLE)
  if (classifiedTier !== "SIMPLE" && wordCount < 80) {
    score -= 10;
    issues.push(`Very short response: ${wordCount} words (-10)`);
  }

  // Tier classification match: -5 if classifier disagrees
  if (!tierMatch) {
    score -= 5;
    issues.push(`Tier mismatch: expected ${classifiedTier} (-5)`);
  }

  // Latency: -10 if over 30s, -5 if over 20s
  if (latencyMs > 30_000) {
    score -= 10;
    issues.push(`High latency: ${(latencyMs / 1000).toFixed(1)}s (-10)`);
  } else if (latencyMs > 20_000) {
    score -= 5;
    issues.push(`Elevated latency: ${(latencyMs / 1000).toFixed(1)}s (-5)`);
  }

  return { score: Math.max(0, score), issues };
}

// ─── Runner ──────────────────────────────────────────────────────────────────
async function consumeStream(
  streamResult: AsyncIterable<string> | { textStream: AsyncIterable<string> },
): Promise<string> {
  let text = "";
  const iterable = "textStream" in streamResult
    ? streamResult.textStream
    : streamResult;
  for await (const chunk of iterable) {
    text += chunk;
  }
  return text;
}

async function runEval(filterTier?: string, filterPlan?: string): Promise<EvalScore[]> {
  const results: EvalScore[] = [];
  const queries = GOLDEN_QUERIES.filter((q) => {
    if (filterTier && q.expectedTier !== filterTier) return false;
    if (filterPlan && q.plan !== filterPlan) return false;
    return true;
  });

  console.log(`\n🧪 Running ${queries.length} golden queries...\n`);

  for (const gq of queries) {
    const label = `[${gq.plan}/${gq.expectedTier}] ${gq.description}`;
    process.stdout.write(`  ⏳ ${label}...`);

    const startMs = Date.now();
    try {
      const messages: LyraMessage[] = [{ role: "user", content: gq.query }];
      const context: LyraContext = { assetType: gq.assetType } as LyraContext;

      // Use a test user ID — this should be configured via env or a dedicated eval user
      const userId = process.env.EVAL_USER_ID || "eval-framework-user";

      const { result } = await generateLyraStream(
        messages,
        context,
        userId,
        { preResolvedPlan: gq.plan },
      );

      const text = await consumeStream(result);
      const latencyMs = Date.now() - startMs;

      // Classify the query to check tier match
      const classifiedTier = classifyQuery(gq.query, messages.length);
      const tierMatch = classifiedTier === gq.expectedTier;

      // Determine if educational
      const isEdu = gq.expectedTier === "SIMPLE" && /^(what is|how does|explain|define)/i.test(gq.query);

      // Validate output structure
      const validation = validateOutput(
        text,
        classifiedTier,
        gq.plan,
        isEdu,
        "default",
        gq.assetType,
      );

      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const { score, issues } = scoreResult(validation, tierMatch, wordCount, latencyMs, classifiedTier);

      const evalScore: EvalScore = {
        query: gq.query,
        description: gq.description,
        plan: gq.plan,
        classifiedTier,
        expectedTier: gq.expectedTier,
        tierMatch,
        validation,
        wordCount,
        latencyMs,
        score,
        issues,
      };

      results.push(evalScore);

      const icon = score >= 90 ? "✅" : score >= 70 ? "⚠️" : "❌";
      console.log(`\r  ${icon} ${label} — score: ${score}/100, ${wordCount}w, ${(latencyMs / 1000).toFixed(1)}s${issues.length > 0 ? `\n     Issues: ${issues.join("; ")}` : ""}`);
    } catch (e) {
      const latencyMs = Date.now() - startMs;
      console.log(`\r  ❌ ${label} — FAILED (${(latencyMs / 1000).toFixed(1)}s): ${e instanceof Error ? e.message : String(e)}`);
      results.push({
        query: gq.query,
        description: gq.description,
        plan: gq.plan,
        classifiedTier: gq.expectedTier,
        expectedTier: gq.expectedTier,
        tierMatch: false,
        validation: { valid: false, missingSections: ["GENERATION_FAILED"], followUpCount: 0, wordCount: 0, tier: gq.expectedTier, plan: gq.plan },
        wordCount: 0,
        latencyMs,
        score: 0,
        issues: [`Generation failed: ${e instanceof Error ? e.message : String(e)}`],
      });
    }
  }

  return results;
}

// ─── Reporting ───────────────────────────────────────────────────────────────
function printSummary(results: EvalScore[]): void {
  const avg = results.reduce((s, r) => s + r.score, 0) / results.length;
  const passing = results.filter((r) => r.score >= 70).length;
  const failing = results.filter((r) => r.score < 70).length;
  const avgLatency = results.reduce((s, r) => s + r.latencyMs, 0) / results.length;

  console.log("\n" + "═".repeat(60));
  console.log("  LYRA EVALUATION SUMMARY");
  console.log("═".repeat(60));
  console.log(`  Total queries:    ${results.length}`);
  console.log(`  Average score:    ${avg.toFixed(1)}/100`);
  console.log(`  Passing (≥70):    ${passing}`);
  console.log(`  Failing (<70):    ${failing}`);
  console.log(`  Avg latency:      ${(avgLatency / 1000).toFixed(1)}s`);
  console.log("═".repeat(60));

  if (failing > 0) {
    console.log("\n  ❌ FAILING QUERIES:");
    for (const r of results.filter((r) => r.score < 70)) {
      console.log(`     • [${r.plan}/${r.classifiedTier}] ${r.description} — ${r.score}/100`);
      for (const issue of r.issues) {
        console.log(`       ↳ ${issue}`);
      }
    }
  }
  console.log("");
}

function saveResults(results: EvalScore[], compareBaseline?: string): void {
  const dir = "./eval-results";
  mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filepath = join(dir, `${timestamp}.json`);
  writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`  📄 Results saved to ${filepath}`);

  // Compare to baseline if requested
  if (compareBaseline) {
    try {
      const baselinePath = join(dir, `${compareBaseline}.json`);
      const baseline: EvalScore[] = JSON.parse(readFileSync(baselinePath, "utf-8"));
      const baselineAvg = baseline.reduce((s, r) => s + r.score, 0) / baseline.length;
      const currentAvg = results.reduce((s, r) => s + r.score, 0) / results.length;
      const diff = currentAvg - baselineAvg;
      const icon = diff > 0 ? "📈" : diff < 0 ? "📉" : "➡️";
      console.log(`  ${icon} vs baseline "${compareBaseline}": ${diff > 0 ? "+" : ""}${diff.toFixed(1)} points (${baselineAvg.toFixed(1)} → ${currentAvg.toFixed(1)})`);
    } catch {
      console.log(`  ⚠️  Baseline "${compareBaseline}" not found — skipping comparison`);
    }
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  let filterTier: string | undefined;
  let filterPlan: string | undefined;
  let compareBaseline: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tier" && args[i + 1]) filterTier = args[++i];
    if (args[i] === "--plan" && args[i + 1]) filterPlan = args[++i];
    if (args[i] === "--compare" && args[i + 1]) compareBaseline = args[++i];
  }

  const results = await runEval(filterTier, filterPlan);
  printSummary(results);
  saveResults(results, compareBaseline);

  // Exit with non-zero if any query scored below 50 (hard failures)
  const hardFailures = results.filter((r) => r.score < 50);
  if (hardFailures.length > 0) {
    console.log(`\n  🚨 ${hardFailures.length} hard failure(s) detected — exiting with code 1\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Eval framework error:", e);
  process.exit(1);
});
