/**
 * Audit Comparison Module
 * 
 * Compares baseline vs current audit runs and generates delta reports.
 * 
 * Usage:
 *   npx tsx scripts/compare-audit-runs.ts --baseline <file> --current <file>
 * 
 * Or auto-detect:
 *   npx tsx scripts/compare-audit-runs.ts --output-dir ./audit-results
 */

import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from "fs";
import { join } from "path";

interface TestCase {
  id: string;
  plan: string;
  tier: string;
  family: string;
  query: string;
  context: Record<string, unknown>;
}

interface RunResult {
  testCase: TestCase;
  id: string;
  plan: string;
  tier: string;
  family: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  ttftMs?: number;
  quality?: { score: number; breakdown?: unknown; details?: unknown };
  tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  cost?: number;
  model?: string;
  wc?: number;
  likelyTruncated?: boolean;
  truncationReason?: string;
  wordBudget?: {
    rating: "PASS" | "WARN" | "FAIL";
    target: number;
    delta: number;
    pct: number;
  };
  actualTier?: string;
  expectedTier?: string;
  chatMode?: string;
}

interface RunSummary {
  total: number;
  successful: number;
  failed: number;
  avgDuration: number;
  totalTokens: number;
  totalCost: number;
  avgQualityScore: number;
  byPlan: Record<string, { count: number; avgQuality: number; totalCost: number; avgDuration: number }>;
  byTier: Record<string, { count: number; avgQuality: number; totalCost: number; avgDuration: number }>;
  byPlanTier?: Record<string, { plan: string; tier: string; count: number; avgQuality: number; totalCost: number; avgDuration: number; avgTtft: number; avgWords: number }>;
  byFamily: Record<string, { count: number; avgQuality: number; totalCost: number; avgDuration: number }>;
}

interface MonthlyProjectionBucket {
  queries: number;
  cost: number;
  cpq: number;
}

interface MonthlyProjection {
  low: MonthlyProjectionBucket;
  mid: MonthlyProjectionBucket;
  high: MonthlyProjectionBucket;
  tierBreakdown: Record<string, { avgCost: number; pct: number }>;
}

interface PlanTierStats {
  plan: string;
  tier: string;
  count: number;
  avgQuality: number;
  totalCost: number;
  avgCost: number;
  avgDuration: number;
  avgTtft: number;
  avgWords: number;
}

interface AuditRun {
  generatedAt?: string;
  mode?: string;
  summary: RunSummary;
  latencyPercentiles?: {
    e2e?: { p50: number; p90: number; p95: number; min: number; max: number };
    ttft?: { p50: number; p90: number; p95: number; min: number; max: number };
  };
  monthlyProjections?: Record<string, MonthlyProjection>;
  routingComp?: { actual: number; allNano: number; allFull: number; cached: number; allGemini?: number; allGpt?: number };
  results: RunResult[];
}

function wordBudgetRank(rating?: "PASS" | "WARN" | "FAIL"): number {
  if (rating === "PASS") return 3;
  if (rating === "WARN") return 2;
  if (rating === "FAIL") return 1;
  return 0;
}

// Tests that depend on external infra (web search + zero RAG embeddings) are inherently
// flaky when Tavily is down. Downgrade their quality regressions to "minor" so
// a transient 500 from an external vendor never produces a BLOCKED verdict.
// To add a new test: include its id and the reason it's infra-dependent.
const KNOWN_INFRA_FLAKY: Record<string, string> = {
  "pro-moderate-india": "Relies on web search (no ^NSEI RAG embeddings) — Tavily failures cause score drop",
};

function loadRun(filePath: string): AuditRun {
  const content = readFileSync(filePath, "utf-8");
  const data = JSON.parse(content);
  
  if (data.results && Array.isArray(data.results)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.results = data.results.map((r: any) => {
      if (!r.quality && r.qualityScore !== undefined) {
        r.quality = { score: r.qualityScore };
      }
      if (!r.id && r.testCase?.id) r.id = r.testCase.id;
      if (!r.plan && r.testCase?.plan) r.plan = r.testCase.plan;
      if (!r.tier && r.testCase?.tier) r.tier = r.testCase.tier;
      if (!r.family && r.testCase?.family) r.family = r.testCase.family;
      return r;
    });
  }
  
  return data;
}

function collectResultFiles(dirPath: string): string[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectResultFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith("-results.json")) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

function buildPlanTierStats(run: AuditRun): Record<string, PlanTierStats> {
  const stats: Record<string, PlanTierStats> = {};
  for (const row of run.results.filter((result) => result.success)) {
    const key = `${row.plan}:${row.tier}`;
    if (!stats[key]) {
      stats[key] = {
        plan: row.plan,
        tier: row.tier,
        count: 0,
        avgQuality: 0,
        totalCost: 0,
        avgCost: 0,
        avgDuration: 0,
        avgTtft: 0,
        avgWords: 0,
      };
    }
    stats[key].count++;
    stats[key].avgQuality += row.quality?.score ?? 0;
    stats[key].totalCost += row.cost ?? 0;
    stats[key].avgDuration += row.duration;
    stats[key].avgTtft += row.ttftMs ?? 0;
    stats[key].avgWords += row.wc ?? 0;
  }

  for (const stat of Object.values(stats)) {
    stat.avgQuality /= stat.count;
    stat.avgDuration /= stat.count;
    stat.avgTtft /= stat.count;
    stat.avgWords /= stat.count;
    stat.avgCost = stat.totalCost / stat.count;
  }

  return stats;
}

function buildProjectionDelta(baseline: AuditRun, current: AuditRun) {
  const plans = new Set([
    ...Object.keys(baseline.monthlyProjections ?? {}),
    ...Object.keys(current.monthlyProjections ?? {}),
  ]);

  const deltas: Record<string, {
    baseline?: MonthlyProjection;
    current?: MonthlyProjection;
    cpqDelta: number;
    lowCostDelta: number;
    midCostDelta: number;
    highCostDelta: number;
  }> = {};

  for (const plan of plans) {
    const baselineProjection = baseline.monthlyProjections?.[plan];
    const currentProjection = current.monthlyProjections?.[plan];
    if (!baselineProjection && !currentProjection) continue;

    deltas[plan] = {
      baseline: baselineProjection,
      current: currentProjection,
      cpqDelta: (currentProjection?.mid.cpq ?? 0) - (baselineProjection?.mid.cpq ?? 0),
      lowCostDelta: (currentProjection?.low.cost ?? 0) - (baselineProjection?.low.cost ?? 0),
      midCostDelta: (currentProjection?.mid.cost ?? 0) - (baselineProjection?.mid.cost ?? 0),
      highCostDelta: (currentProjection?.high.cost ?? 0) - (baselineProjection?.high.cost ?? 0),
    };
  }

  return deltas;
}

function compareRuns(baseline: AuditRun, current: AuditRun): {
  summary: {
    totalRuns: number;
    baselineSuccessful: number;
    currentSuccessful: number;
    qualityDelta: number;
    costDelta: number;
    costDeltaPercent: number;
    avgDurationDelta: number;
    avgDurationDeltaPercent: number;
    p50LatencyDelta: number;
    p90LatencyDelta: number;
    p50TtftDelta: number;
    p90TtftDelta: number;
    truncatedDelta: number;
    wordBudgetPassDelta: number;
  };
  byPlan: Record<string, {
    baseline: RunSummary["byPlan"][string];
    current: RunSummary["byPlan"][string];
    qualityDelta: number;
    costDelta: number;
    avgDurationDelta: number;
    qualityPercentChange: number;
  }>;
  byTier: Record<string, {
    baseline: RunSummary["byTier"][string];
    current: RunSummary["byTier"][string];
    qualityDelta: number;
    costDelta: number;
    avgDurationDelta: number;
    qualityPercentChange: number;
  }>;
  byPlanTier: Record<string, {
    baseline: PlanTierStats;
    current: PlanTierStats;
    delta: {
      quality: number;
      totalCost: number;
      avgCost: number;
      avgDuration: number;
      avgTtft: number;
      avgWords: number;
    };
  }>;
  monthlyProjectionDelta: ReturnType<typeof buildProjectionDelta>;
  routingDelta: { actual: number; allNano: number; allFull: number; cached: number };
  regressions: Array<{
    testId: string;
    metric: string;
    baseline: number;
    current: number;
    delta: number;
    severity: "critical" | "major" | "minor";
  }>;
  improvements: Array<{
    testId: string;
    metric: string;
    baseline: number;
    current: number;
    delta: number;
  }>;
} {
  const baselineSummary = baseline.summary ?? ({} as Partial<RunSummary>);
  const currentSummary = current.summary ?? ({} as Partial<RunSummary>);
  const baselineBudgetPass = baseline.results.filter((r) => r.wordBudget?.rating === "PASS").length;
  const currentBudgetPass = current.results.filter((r) => r.wordBudget?.rating === "PASS").length;
  const baselineTruncated = baseline.results.filter((r) => r.likelyTruncated).length;
  const currentTruncated = current.results.filter((r) => r.likelyTruncated).length;
  const baselineP50 = baseline.latencyPercentiles?.e2e?.p50 ?? 0;
  const currentP50 = current.latencyPercentiles?.e2e?.p50 ?? 0;
  const baselineP90 = baseline.latencyPercentiles?.e2e?.p90 ?? 0;
  const currentP90 = current.latencyPercentiles?.e2e?.p90 ?? 0;
  const baselineTtftP50 = baseline.latencyPercentiles?.ttft?.p50 ?? 0;
  const currentTtftP50 = current.latencyPercentiles?.ttft?.p50 ?? 0;
  const baselineTtftP90 = baseline.latencyPercentiles?.ttft?.p90 ?? 0;
  const currentTtftP90 = current.latencyPercentiles?.ttft?.p90 ?? 0;
  const baselinePlanTier = buildPlanTierStats(baseline);
  const currentPlanTier = buildPlanTierStats(current);
  const monthlyProjectionDelta = buildProjectionDelta(baseline, current);
  const routingDelta = {
    actual:  (current.routingComp?.actual  ?? 0) - (baseline.routingComp?.actual  ?? 0),
    // allGemini/allGpt aliases are legacy compat for older baseline JSON files
    allNano: (current.routingComp?.allNano ?? current.routingComp?.allGemini ?? 0) - (baseline.routingComp?.allNano ?? baseline.routingComp?.allGemini ?? 0),
    allFull: (current.routingComp?.allFull ?? current.routingComp?.allGpt    ?? 0) - (baseline.routingComp?.allFull ?? baseline.routingComp?.allGpt    ?? 0),
    cached:  (current.routingComp?.cached  ?? 0) - (baseline.routingComp?.cached  ?? 0),
  };

  const result = {
    summary: {
      totalRuns: baseline.results.length,
      baselineSuccessful: baselineSummary.successful ?? 0,
      currentSuccessful: currentSummary.successful ?? 0,
      qualityDelta: (currentSummary.avgQualityScore ?? 0) - (baselineSummary.avgQualityScore ?? 0),
      costDelta: (currentSummary.totalCost ?? 0) - (baselineSummary.totalCost ?? 0),
      costDeltaPercent: (baselineSummary.totalCost ?? 0) > 0 
        ? (((currentSummary.totalCost ?? 0) - (baselineSummary.totalCost ?? 0)) / (baselineSummary.totalCost ?? 0)) * 100
        : 0,
      avgDurationDelta: (currentSummary.avgDuration ?? 0) - (baselineSummary.avgDuration ?? 0),
      avgDurationDeltaPercent: (baselineSummary.avgDuration ?? 0) > 0
        ? (((currentSummary.avgDuration ?? 0) - (baselineSummary.avgDuration ?? 0)) / (baselineSummary.avgDuration ?? 0)) * 100
        : 0,
      p50LatencyDelta: currentP50 - baselineP50,
      p90LatencyDelta: currentP90 - baselineP90,
      p50TtftDelta: currentTtftP50 - baselineTtftP50,
      p90TtftDelta: currentTtftP90 - baselineTtftP90,
      truncatedDelta: currentTruncated - baselineTruncated,
      wordBudgetPassDelta: currentBudgetPass - baselineBudgetPass,
    },
    byPlan: {} as Record<string, {
      baseline: RunSummary["byPlan"][string];
      current: RunSummary["byPlan"][string];
      qualityDelta: number;
      costDelta: number;
      avgDurationDelta: number;
      qualityPercentChange: number;
    }>,
    byTier: {} as Record<string, {
      baseline: RunSummary["byTier"][string];
      current: RunSummary["byTier"][string];
      qualityDelta: number;
      costDelta: number;
      avgDurationDelta: number;
      qualityPercentChange: number;
    }>,
    byPlanTier: {} as Record<string, {
      baseline: PlanTierStats;
      current: PlanTierStats;
      delta: {
        quality: number;
        totalCost: number;
        avgCost: number;
        avgDuration: number;
        avgTtft: number;
        avgWords: number;
      };
    }>,
    monthlyProjectionDelta,
    routingDelta,
    regressions: [] as Array<{
      testId: string;
      metric: string;
      baseline: number;
      current: number;
      delta: number;
      severity: "critical" | "major" | "minor";
    }>,
    improvements: [] as Array<{
      testId: string;
      metric: string;
      baseline: number;
      current: number;
      delta: number;
    }>,
  };

  const baselineByPlan = baseline.summary.byPlan ?? {};
  const currentByPlan = current.summary.byPlan ?? {};
  const baselineByTier = baseline.summary.byTier ?? {};
  const currentByTier = current.summary.byTier ?? {};

  // Compare by plan
  for (const plan of new Set([...Object.keys(baselineByPlan), ...Object.keys(currentByPlan)])) {
    const b = baselineByPlan[plan];
    const c = currentByPlan[plan];
    if (b && c) {
      result.byPlan[plan] = {
        baseline: b,
        current: c,
        qualityDelta: c.avgQuality - b.avgQuality,
        costDelta: c.totalCost - b.totalCost,
        avgDurationDelta: c.avgDuration - b.avgDuration,
        qualityPercentChange: b.avgQuality > 0 ? ((c.avgQuality - b.avgQuality) / b.avgQuality) * 100 : 0,
      };
    }
  }

  for (const tier of new Set([...Object.keys(baselineByTier), ...Object.keys(currentByTier)])) {
    const b = baselineByTier[tier];
    const c = currentByTier[tier];
    if (b && c) {
      result.byTier[tier] = {
        baseline: b,
        current: c,
        qualityDelta: c.avgQuality - b.avgQuality,
        costDelta: c.totalCost - b.totalCost,
        avgDurationDelta: c.avgDuration - b.avgDuration,
        qualityPercentChange: b.avgQuality > 0 ? ((c.avgQuality - b.avgQuality) / b.avgQuality) * 100 : 0,
      };
    }
  }

  for (const key of new Set([...Object.keys(baselinePlanTier), ...Object.keys(currentPlanTier)])) {
    const b = baselinePlanTier[key];
    const c = currentPlanTier[key];
    if (!b || !c) continue;
    result.byPlanTier[key] = {
      baseline: b,
      current: c,
      delta: {
        quality: c.avgQuality - b.avgQuality,
        totalCost: c.totalCost - b.totalCost,
        avgCost: c.avgCost - b.avgCost,
        avgDuration: c.avgDuration - b.avgDuration,
        avgTtft: c.avgTtft - b.avgTtft,
        avgWords: c.avgWords - b.avgWords,
      },
    };
  }

  // Find regressions and improvements per-test
  const getResultId = (r: RunResult): string | undefined => r.testCase?.id ?? r.id;
  const baselineMap = new Map(baseline.results.map((r) => [getResultId(r), r]).filter(([id]) => Boolean(id)) as Array<[string, RunResult]>);
  const currentMap = new Map(current.results.map((r) => [getResultId(r), r]).filter(([id]) => Boolean(id)) as Array<[string, RunResult]>);

  for (const [testId, baselineResult] of baselineMap) {
    const currentResult = currentMap.get(testId);
    if (!currentResult || !baselineResult.quality || !currentResult.quality) continue;

    const qualityDelta = currentResult.quality.score - baselineResult.quality.score;
    const costDelta = (currentResult.cost || 0) - (baselineResult.cost || 0);
    const durationDelta = currentResult.duration - baselineResult.duration;
    const ttftDelta = (currentResult.ttftMs ?? 0) - (baselineResult.ttftMs ?? 0);
    const budgetDelta = (currentResult.wordBudget?.pct ?? 0) - (baselineResult.wordBudget?.pct ?? 0);
    const baselineBudgetRank = wordBudgetRank(baselineResult.wordBudget?.rating);
    const currentBudgetRank = wordBudgetRank(currentResult.wordBudget?.rating);
    const budgetImproved = currentBudgetRank > baselineBudgetRank;
    const qualityImprovedMeaningfully = qualityDelta >= 5;
    const isInfraFlaky = testId in KNOWN_INFRA_FLAKY;

    if (qualityDelta < -10) {
      result.regressions.push({
        testId,
        metric: "quality",
        baseline: baselineResult.quality.score,
        current: currentResult.quality.score,
        delta: qualityDelta,
        // Infra-flaky tests: never escalate to critical/major — they signal external vendor outage, not pipeline regression
        severity: isInfraFlaky ? "minor" : qualityDelta < -20 ? "critical" : "major",
      });
    } else if (qualityDelta < -5) {
      result.regressions.push({
        testId,
        metric: "quality",
        baseline: baselineResult.quality.score,
        current: currentResult.quality.score,
        delta: qualityDelta,
        severity: "minor",
      });
    }

    if (qualityDelta > 5) {
      result.improvements.push({
        testId,
        metric: "quality",
        baseline: baselineResult.quality.score,
        current: currentResult.quality.score,
        delta: qualityDelta,
      });
    }

    if (baselineResult.wordBudget && currentResult.wordBudget && baselineBudgetRank !== currentBudgetRank) {
      const entry = {
        testId,
        metric: "word_budget_rating",
        baseline: baselineBudgetRank,
        current: currentBudgetRank,
        delta: currentBudgetRank - baselineBudgetRank,
      };
      if (budgetImproved) {
        result.improvements.push(entry);
      } else {
        result.regressions.push({
          ...entry,
          severity: currentBudgetRank <= 1 ? "major" : "minor",
        });
      }
    }

    if (durationDelta > 4000 && !budgetImproved && !qualityImprovedMeaningfully) {
      result.regressions.push({
        testId,
        metric: "latency",
        baseline: baselineResult.duration,
        current: currentResult.duration,
        delta: durationDelta,
        severity: durationDelta > 10000 ? "major" : "minor",
      });
    } else if (durationDelta < -2000) {
      result.improvements.push({
        testId,
        metric: "latency",
        baseline: baselineResult.duration,
        current: currentResult.duration,
        delta: durationDelta,
      });
    }

    if (baselineResult.ttftMs !== undefined && currentResult.ttftMs !== undefined) {
      // All orchestration paths now stream to the user.
      // TTFT should be low even for orchestrated cases — use a uniform threshold.
      const isOrchestrated = baselineResult.ttftMs > 0.85 * baselineResult.duration;
      const ttftMajorThreshold = isOrchestrated ? 8000 : 3000;
      if (ttftDelta > 1500 && !budgetImproved && !qualityImprovedMeaningfully) {
        result.regressions.push({
          testId,
          metric: "ttft",
          baseline: baselineResult.ttftMs,
          current: currentResult.ttftMs,
          delta: ttftDelta,
          severity: ttftDelta > ttftMajorThreshold ? "major" : "minor",
        });
      } else if (ttftDelta < -1000) {
        result.improvements.push({
          testId,
          metric: "ttft",
          baseline: baselineResult.ttftMs,
          current: currentResult.ttftMs,
          delta: ttftDelta,
        });
      }
    }

    // Cost regression (significant increase)
    if (costDelta > 0.005 && !budgetImproved && qualityDelta < 3) {
      result.regressions.push({
        testId,
        metric: "cost",
        baseline: baselineResult.cost || 0,
        current: currentResult.cost || 0,
        delta: costDelta,
        severity: costDelta > 0.02 ? "major" : "minor",
      });
    } else if (costDelta < -0.005) {
      result.improvements.push({
        testId,
        metric: "cost",
        baseline: baselineResult.cost || 0,
        current: currentResult.cost || 0,
        delta: costDelta,
      });
    }

    if (baselineResult.wordBudget && currentResult.wordBudget && budgetDelta < -0.50) {
      result.regressions.push({
        testId,
        metric: "word_budget",
        baseline: baselineResult.wordBudget.pct,
        current: currentResult.wordBudget.pct,
        delta: budgetDelta,
        severity: "minor",
      });
    }
  }

  return result;
}

function printComparison(comparison: ReturnType<typeof compareRuns>, baseline: AuditRun, current: AuditRun): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 AUDIT COMPARISON REPORT");
  console.log("=".repeat(60));

  console.log("\n### Summary ###");
  console.log(`   Total Test Cases: ${comparison.summary.totalRuns}`);
  console.log(`   Baseline Success: ${comparison.summary.baselineSuccessful}/${comparison.summary.totalRuns}`);
  console.log(`   Current Success:  ${comparison.summary.currentSuccessful}/${comparison.summary.totalRuns}`);
  console.log(`   Quality Delta:    ${comparison.summary.qualityDelta >= 0 ? "+" : ""}${comparison.summary.qualityDelta.toFixed(1)} pts`);
  console.log(`   Cost Delta:       ${comparison.summary.costDelta >= 0 ? "+" : ""}$${comparison.summary.costDelta.toFixed(4)} (${comparison.summary.costDeltaPercent >= 0 ? "+" : ""}${comparison.summary.costDeltaPercent.toFixed(1)}%)`);
  console.log(`   Avg Latency:      ${comparison.summary.avgDurationDelta >= 0 ? "+" : ""}${comparison.summary.avgDurationDelta.toFixed(0)}ms (${comparison.summary.avgDurationDeltaPercent >= 0 ? "+" : ""}${comparison.summary.avgDurationDeltaPercent.toFixed(1)}%)`);
  console.log(`   p50/p90 E2E:      ${comparison.summary.p50LatencyDelta >= 0 ? "+" : ""}${comparison.summary.p50LatencyDelta.toFixed(0)}ms / ${comparison.summary.p90LatencyDelta >= 0 ? "+" : ""}${comparison.summary.p90LatencyDelta.toFixed(0)}ms`);
  console.log(`   p50/p90 TTFT:     ${comparison.summary.p50TtftDelta >= 0 ? "+" : ""}${comparison.summary.p50TtftDelta.toFixed(0)}ms / ${comparison.summary.p90TtftDelta >= 0 ? "+" : ""}${comparison.summary.p90TtftDelta.toFixed(0)}ms`);
  console.log(`   Truncation Delta: ${comparison.summary.truncatedDelta >= 0 ? "+" : ""}${comparison.summary.truncatedDelta}`);
  console.log(`   Budget PASS Δ:    ${comparison.summary.wordBudgetPassDelta >= 0 ? "+" : ""}${comparison.summary.wordBudgetPassDelta}`);

  console.log("\n### By Plan ###");
  for (const [plan, stats] of Object.entries(comparison.byPlan)) {
    console.log(`   ${plan}:`);
    console.log(`     Quality: ${stats.baseline.avgQuality.toFixed(1)} → ${stats.current.avgQuality.toFixed(1)} (${stats.qualityDelta >= 0 ? "+" : ""}${stats.qualityDelta.toFixed(1)} pts, ${stats.qualityPercentChange >= 0 ? "+" : ""}${stats.qualityPercentChange.toFixed(1)}%)`);
    console.log(`     Cost:    $${stats.baseline.totalCost.toFixed(4)} → $${stats.current.totalCost.toFixed(4)} (${stats.costDelta >= 0 ? "+" : ""}$${stats.costDelta.toFixed(4)})`);
    console.log(`     Latency: ${stats.baseline.avgDuration.toFixed(0)}ms → ${stats.current.avgDuration.toFixed(0)}ms (${stats.avgDurationDelta >= 0 ? "+" : ""}${stats.avgDurationDelta.toFixed(0)}ms)`);
  }

  console.log("\n### By Tier ###");
  for (const [tier, stats] of Object.entries(comparison.byTier)) {
    console.log(`   ${tier}:`);
    console.log(`     Quality: ${stats.baseline.avgQuality.toFixed(1)} → ${stats.current.avgQuality.toFixed(1)} (${stats.qualityDelta >= 0 ? "+" : ""}${stats.qualityDelta.toFixed(1)} pts, ${stats.qualityPercentChange >= 0 ? "+" : ""}${stats.qualityPercentChange.toFixed(1)}%)`);
    console.log(`     Cost:    $${stats.baseline.totalCost.toFixed(4)} → $${stats.current.totalCost.toFixed(4)} (${stats.costDelta >= 0 ? "+" : ""}$${stats.costDelta.toFixed(4)})`);
    console.log(`     Latency: ${stats.baseline.avgDuration.toFixed(0)}ms → ${stats.current.avgDuration.toFixed(0)}ms (${stats.avgDurationDelta >= 0 ? "+" : ""}${stats.avgDurationDelta.toFixed(0)}ms)`);
  }

  console.log("\n### By Plan × Tier ###");
  console.log("   Plan         Tier       Quality              Cost/query            E2E                 TTFT                Words");
  for (const stats of Object.values(comparison.byPlanTier).sort((a, b) => a.baseline.plan.localeCompare(b.baseline.plan) || a.baseline.tier.localeCompare(b.baseline.tier))) {
    console.log(
      `   ${stats.baseline.plan.padEnd(12)} ${stats.baseline.tier.padEnd(10)} ${`${stats.baseline.avgQuality.toFixed(1)}→${stats.current.avgQuality.toFixed(1)} (${stats.delta.quality >= 0 ? "+" : ""}${stats.delta.quality.toFixed(1)})`.padEnd(20)} ` +
      `${`$${stats.baseline.avgCost.toFixed(5)}→$${stats.current.avgCost.toFixed(5)} (${stats.delta.avgCost >= 0 ? "+" : ""}$${stats.delta.avgCost.toFixed(5)})`.padEnd(22)} ` +
      `${`${stats.baseline.avgDuration.toFixed(0)}→${stats.current.avgDuration.toFixed(0)}ms (${stats.delta.avgDuration >= 0 ? "+" : ""}${stats.delta.avgDuration.toFixed(0)}ms)`.padEnd(20)} ` +
      `${`${stats.baseline.avgTtft.toFixed(0)}→${stats.current.avgTtft.toFixed(0)}ms (${stats.delta.avgTtft >= 0 ? "+" : ""}${stats.delta.avgTtft.toFixed(0)}ms)`.padEnd(20)} ` +
      `${Math.round(stats.baseline.avgWords)}→${Math.round(stats.current.avgWords)} (${stats.delta.avgWords >= 0 ? "+" : ""}${Math.round(stats.delta.avgWords)})`
    );
  }

  if (Object.keys(comparison.monthlyProjectionDelta).length > 0) {
    console.log("\n### Monthly Cost Projections ###");
    for (const [plan, stats] of Object.entries(comparison.monthlyProjectionDelta)) {
      console.log(`   ${plan}:`);
      console.log(`     Cost/query: $${(stats.baseline?.mid.cpq ?? 0).toFixed(5)} → $${(stats.current?.mid.cpq ?? 0).toFixed(5)} (${stats.cpqDelta >= 0 ? "+" : ""}$${stats.cpqDelta.toFixed(5)})`);
      console.log(`     Low volume: $${(stats.baseline?.low.cost ?? 0).toFixed(4)} → $${(stats.current?.low.cost ?? 0).toFixed(4)} (${stats.lowCostDelta >= 0 ? "+" : ""}$${stats.lowCostDelta.toFixed(4)})`);
      console.log(`     Mid volume: $${(stats.baseline?.mid.cost ?? 0).toFixed(4)} → $${(stats.current?.mid.cost ?? 0).toFixed(4)} (${stats.midCostDelta >= 0 ? "+" : ""}$${stats.midCostDelta.toFixed(4)})`);
      console.log(`     High volume:$${(stats.baseline?.high.cost ?? 0).toFixed(4)} → $${(stats.current?.high.cost ?? 0).toFixed(4)} (${stats.highCostDelta >= 0 ? "+" : ""}$${stats.highCostDelta.toFixed(4)})`);
    }
  }

  if (baseline.routingComp || current.routingComp) {
    console.log("\n### Routing Economics  (nano=$0.20/$1.25 · mini=$0.75/$4.50 · full=$2.50/$15.00 per 1M) ###");
    const bAllNano = baseline.routingComp?.allNano ?? baseline.routingComp?.allGemini ?? 0;
    const cAllNano = current.routingComp?.allNano  ?? current.routingComp?.allGemini  ?? 0;
    const bAllFull = baseline.routingComp?.allFull ?? baseline.routingComp?.allGpt    ?? 0;
    const cAllFull = current.routingComp?.allFull  ?? current.routingComp?.allGpt     ?? 0;
    console.log(`   Actual hybrid:    $${(baseline.routingComp?.actual ?? 0).toFixed(5)} → $${(current.routingComp?.actual ?? 0).toFixed(5)} (${comparison.routingDelta.actual >= 0 ? "+" : ""}$${comparison.routingDelta.actual.toFixed(5)})`);
    console.log(`   If all lyra-nano: $${bAllNano.toFixed(5)} → $${cAllNano.toFixed(5)} (${comparison.routingDelta.allNano >= 0 ? "+" : ""}$${comparison.routingDelta.allNano.toFixed(5)})`);
    console.log(`   If all lyra-full: $${bAllFull.toFixed(5)} → $${cAllFull.toFixed(5)} (${comparison.routingDelta.allFull >= 0 ? "+" : ""}$${comparison.routingDelta.allFull.toFixed(5)})`);
    console.log(`   Cache savings:    $${(baseline.routingComp?.cached ?? 0).toFixed(5)} → $${(current.routingComp?.cached ?? 0).toFixed(5)} (${comparison.routingDelta.cached >= 0 ? "+" : ""}$${comparison.routingDelta.cached.toFixed(5)})`);
  }

  if (comparison.regressions.length > 0) {
    console.log("\n### Regressions ###");
    for (const r of comparison.regressions.sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })) {
      const sign = r.delta >= 0 ? "+" : "";
      const precision = r.metric === "cost" ? 5 : 1;
      console.log(`   [${r.severity.toUpperCase()}] ${r.testId}: ${r.metric} ${sign}${r.delta.toFixed(precision)} (${r.baseline.toFixed(precision)} → ${r.current.toFixed(precision)})`);
    }
  }

  if (comparison.improvements.length > 0) {
    console.log("\n### Improvements ###");
    for (const i of comparison.improvements.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))) {
      const sign = i.delta >= 0 ? "+" : "";
      const precision = i.metric === "cost" ? 5 : 1;
      console.log(`   ${i.testId}: ${i.metric} ${sign}${i.delta.toFixed(precision)} (${i.baseline.toFixed(precision)} → ${i.current.toFixed(precision)})`);
    }
  }

  // Verdict
  console.log("\n" + "=".repeat(60));
  const criticalCount = comparison.regressions.filter(r => r.severity === "critical").length;
  const majorCount = comparison.regressions.filter(r => r.severity === "major").length;
  
  const onlyLatencyTradeoffs = comparison.regressions.length > 0 && comparison.regressions.every(
    (r) => r.metric === "latency" || r.metric === "ttft",
  );

  // Surface any infra-flaky regressions separately so they're not confused with real pipeline issues
  const flakyRegressions = comparison.regressions.filter((r) => r.severity === "minor" && r.testId in KNOWN_INFRA_FLAKY);
  if (flakyRegressions.length > 0) {
    console.log(`\n⚠️  INFRA-FLAKY TESTS (downgraded from critical/major — external vendor issue, not pipeline):`);
    for (const r of flakyRegressions) {
      console.log(`   • ${r.testId}: ${r.metric} ${r.delta.toFixed(1)} (${r.baseline.toFixed(1)} → ${r.current.toFixed(1)}) — ${KNOWN_INFRA_FLAKY[r.testId]}`);
    }
  }

  if (criticalCount > 0) {
    console.log("❌ VERDICT: BLOCKED - Critical regressions detected");
  } else if (majorCount > 0) {
    if (
      onlyLatencyTradeoffs &&
      comparison.summary.currentSuccessful >= comparison.summary.baselineSuccessful &&
      comparison.summary.qualityDelta >= 0 &&
      comparison.summary.wordBudgetPassDelta >= 0
    ) {
      console.log("⚠️  VERDICT: PASSED WITH TRADEOFFS - Quality/budget improved, but latency regressed");
    } else {
      console.log("⚠️  VERDICT: REVIEW NEEDED - Major regressions detected");
    }
  } else if (comparison.summary.currentSuccessful < comparison.summary.baselineSuccessful) {
    console.log("⚠️  VERDICT: REVIEW NEEDED - Success rate dropped");
  } else if (comparison.summary.qualityDelta > 5) {
    console.log("✅ VERDICT: PASSED - Quality improvements detected");
  } else {
    console.log("✅ VERDICT: PASSED - No significant regressions");
  }
  console.log("=".repeat(60) + "\n");
}

function generateMarkdownReport(
  comparison: ReturnType<typeof compareRuns>,
  baselinePath: string,
  currentPath: string,
  baseline: AuditRun,
  current: AuditRun
): string {
  const baselineSummary = baseline.summary ?? ({} as Partial<RunSummary>);
  const currentSummary = current.summary ?? ({} as Partial<RunSummary>);
  const bName = baselinePath.split("/").pop();
  const cName = currentPath.split("/").pop();

  let report = `# 📊 Audit Delta Report\n\n`;
  report += `**Baseline:** \`${bName}\`\n`;
  report += `**Current:** \`${cName}\`\n\n`;

  report += `## 📋 Executive Summary\n\n`;
  const qSign = comparison.summary.qualityDelta >= 0 ? "+" : "";
  const cSign = comparison.summary.costDelta >= 0 ? "+" : "";
  const cPctSign = comparison.summary.costDeltaPercent >= 0 ? "+" : "";

  report += `| Metric | Baseline | Current | Delta |\n`;
  report += `| :--- | :--- | :--- | :--- |\n`;
  report += `| Successful | ${comparison.summary.baselineSuccessful}/${comparison.summary.totalRuns} | ${comparison.summary.currentSuccessful}/${comparison.summary.totalRuns} | ${comparison.summary.currentSuccessful - comparison.summary.baselineSuccessful} |\n`;
  report += `| Avg Quality | ${(baselineSummary.avgQualityScore ?? 0).toFixed(1)} | ${(currentSummary.avgQualityScore ?? 0).toFixed(1)} | ${qSign}${comparison.summary.qualityDelta.toFixed(1)} |\n`;
  report += `| Avg Latency | ${(baselineSummary.avgDuration ?? 0).toFixed(0)}ms | ${(currentSummary.avgDuration ?? 0).toFixed(0)}ms | ${comparison.summary.avgDurationDelta >= 0 ? "+" : ""}${comparison.summary.avgDurationDelta.toFixed(0)}ms |\n`;
  report += `| p50 E2E | ${(baseline.latencyPercentiles?.e2e?.p50 ?? 0).toFixed(0)}ms | ${(current.latencyPercentiles?.e2e?.p50 ?? 0).toFixed(0)}ms | ${comparison.summary.p50LatencyDelta >= 0 ? "+" : ""}${comparison.summary.p50LatencyDelta.toFixed(0)}ms |\n`;
  report += `| p90 E2E | ${(baseline.latencyPercentiles?.e2e?.p90 ?? 0).toFixed(0)}ms | ${(current.latencyPercentiles?.e2e?.p90 ?? 0).toFixed(0)}ms | ${comparison.summary.p90LatencyDelta >= 0 ? "+" : ""}${comparison.summary.p90LatencyDelta.toFixed(0)}ms |\n`;
  report += `| p50 TTFT | ${(baseline.latencyPercentiles?.ttft?.p50 ?? 0).toFixed(0)}ms | ${(current.latencyPercentiles?.ttft?.p50 ?? 0).toFixed(0)}ms | ${comparison.summary.p50TtftDelta >= 0 ? "+" : ""}${comparison.summary.p50TtftDelta.toFixed(0)}ms |\n`;
  report += `| p90 TTFT | ${(baseline.latencyPercentiles?.ttft?.p90 ?? 0).toFixed(0)}ms | ${(current.latencyPercentiles?.ttft?.p90 ?? 0).toFixed(0)}ms | ${comparison.summary.p90TtftDelta >= 0 ? "+" : ""}${comparison.summary.p90TtftDelta.toFixed(0)}ms |\n`;
  report += `| Total Cost | $${(baselineSummary.totalCost ?? 0).toFixed(4)} | $${(currentSummary.totalCost ?? 0).toFixed(4)} | ${cSign}$${comparison.summary.costDelta.toFixed(4)} (${cPctSign}${comparison.summary.costDeltaPercent.toFixed(1)}%) |\n`;
  report += `| Truncated Outputs | ${baseline.results.filter((r) => r.likelyTruncated).length} | ${current.results.filter((r) => r.likelyTruncated).length} | ${comparison.summary.truncatedDelta >= 0 ? "+" : ""}${comparison.summary.truncatedDelta} |\n`;
  report += `| Word Budget PASS | ${baseline.results.filter((r) => r.wordBudget?.rating === "PASS").length} | ${current.results.filter((r) => r.wordBudget?.rating === "PASS").length} | ${comparison.summary.wordBudgetPassDelta >= 0 ? "+" : ""}${comparison.summary.wordBudgetPassDelta} |\n\n`;

  report += `## 📈 Breakdown by Plan\n\n`;
  report += `| Plan | Quality Delta | Cost Delta | Latency Delta | % Change |\n`;
  report += `| :--- | :--- | :--- | :--- | :--- |\n`;
  for (const [plan, stats] of Object.entries(comparison.byPlan)) {
    const qs = stats.qualityDelta >= 0 ? "+" : "";
    const cs = stats.costDelta >= 0 ? "+" : "";
    const qp = stats.qualityPercentChange >= 0 ? "+" : "";
    report += `| **${plan}** | ${qs}${stats.qualityDelta.toFixed(1)} | ${cs}$${stats.costDelta.toFixed(4)} | ${stats.avgDurationDelta >= 0 ? "+" : ""}${stats.avgDurationDelta.toFixed(0)}ms | ${qp}${stats.qualityPercentChange.toFixed(1)}% |\n`;
  }

  report += `\n## 📈 Breakdown by Tier\n\n`;
  report += `| Tier | Quality Delta | Cost Delta | Latency Delta | % Change |\n`;
  report += `| :--- | :--- | :--- | :--- | :--- |\n`;
  for (const [tier, stats] of Object.entries(comparison.byTier)) {
    const qs = stats.qualityDelta >= 0 ? "+" : "";
    const cs = stats.costDelta >= 0 ? "+" : "";
    const qp = stats.qualityPercentChange >= 0 ? "+" : "";
    report += `| **${tier}** | ${qs}${stats.qualityDelta.toFixed(1)} | ${cs}$${stats.costDelta.toFixed(4)} | ${stats.avgDurationDelta >= 0 ? "+" : ""}${stats.avgDurationDelta.toFixed(0)}ms | ${qp}${stats.qualityPercentChange.toFixed(1)}% |\n`;
  }

  report += `\n## 📈 Breakdown by Plan × Tier\n\n`;
  report += `| Plan | Tier | Base Q | Curr Q | ΔQ | Base Cost/Q | Curr Cost/Q | ΔCost/Q | Base E2E | Curr E2E | ΔE2E | Base TTFT | Curr TTFT | ΔTTFT | Base Words | Curr Words | ΔWords |\n`;
  report += `| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
  for (const stats of Object.values(comparison.byPlanTier).sort((a, b) => a.baseline.plan.localeCompare(b.baseline.plan) || a.baseline.tier.localeCompare(b.baseline.tier))) {
    report += `| **${stats.baseline.plan}** | **${stats.baseline.tier}** | ${stats.baseline.avgQuality.toFixed(1)} | ${stats.current.avgQuality.toFixed(1)} | ${stats.delta.quality >= 0 ? "+" : ""}${stats.delta.quality.toFixed(1)} | $${stats.baseline.avgCost.toFixed(5)} | $${stats.current.avgCost.toFixed(5)} | ${stats.delta.avgCost >= 0 ? "+" : ""}$${stats.delta.avgCost.toFixed(5)} | ${stats.baseline.avgDuration.toFixed(0)}ms | ${stats.current.avgDuration.toFixed(0)}ms | ${stats.delta.avgDuration >= 0 ? "+" : ""}${stats.delta.avgDuration.toFixed(0)}ms | ${stats.baseline.avgTtft.toFixed(0)}ms | ${stats.current.avgTtft.toFixed(0)}ms | ${stats.delta.avgTtft >= 0 ? "+" : ""}${stats.delta.avgTtft.toFixed(0)}ms | ${Math.round(stats.baseline.avgWords)} | ${Math.round(stats.current.avgWords)} | ${stats.delta.avgWords >= 0 ? "+" : ""}${Math.round(stats.delta.avgWords)} |\n`;
  }

  if (Object.keys(comparison.monthlyProjectionDelta).length > 0) {
    report += `\n## 💰 Monthly Cost Projections\n\n`;
    report += `| Plan | Base CPQ | Curr CPQ | ΔCPQ | Base Low | Curr Low | ΔLow | Base Mid | Curr Mid | ΔMid | Base High | Curr High | ΔHigh |\n`;
    report += `| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
    for (const [plan, stats] of Object.entries(comparison.monthlyProjectionDelta)) {
      report += `| **${plan}** | $${(stats.baseline?.mid.cpq ?? 0).toFixed(5)} | $${(stats.current?.mid.cpq ?? 0).toFixed(5)} | ${stats.cpqDelta >= 0 ? "+" : ""}$${stats.cpqDelta.toFixed(5)} | $${(stats.baseline?.low.cost ?? 0).toFixed(4)} | $${(stats.current?.low.cost ?? 0).toFixed(4)} | ${stats.lowCostDelta >= 0 ? "+" : ""}$${stats.lowCostDelta.toFixed(4)} | $${(stats.baseline?.mid.cost ?? 0).toFixed(4)} | $${(stats.current?.mid.cost ?? 0).toFixed(4)} | ${stats.midCostDelta >= 0 ? "+" : ""}$${stats.midCostDelta.toFixed(4)} | $${(stats.baseline?.high.cost ?? 0).toFixed(4)} | $${(stats.current?.high.cost ?? 0).toFixed(4)} | ${stats.highCostDelta >= 0 ? "+" : ""}$${stats.highCostDelta.toFixed(4)} |\n`;
    }
  }

  if (baseline.routingComp || current.routingComp) {
    const bAllNano = baseline.routingComp?.allNano ?? baseline.routingComp?.allGemini ?? 0;
    const cAllNano = current.routingComp?.allNano  ?? current.routingComp?.allGemini  ?? 0;
    const bAllFull = baseline.routingComp?.allFull ?? baseline.routingComp?.allGpt    ?? 0;
    const cAllFull = current.routingComp?.allFull  ?? current.routingComp?.allGpt     ?? 0;
    report += `\n## 🔀 Routing Economics *(nano=$0.20/$1.25 · mini=$0.75/$4.50 · full=$2.50/$15.00 per 1M)*\n\n`;
    report += `| Scenario | Baseline | Current | Delta |\n`;
    report += `| :--- | ---: | ---: | ---: |\n`;
    report += `| Actual hybrid | $${(baseline.routingComp?.actual ?? 0).toFixed(5)} | $${(current.routingComp?.actual ?? 0).toFixed(5)} | ${comparison.routingDelta.actual >= 0 ? "+" : ""}$${comparison.routingDelta.actual.toFixed(5)} |\n`;
    report += `| If all lyra-nano | $${bAllNano.toFixed(5)} | $${cAllNano.toFixed(5)} | ${comparison.routingDelta.allNano >= 0 ? "+" : ""}$${comparison.routingDelta.allNano.toFixed(5)} |\n`;
    report += `| If all lyra-full | $${bAllFull.toFixed(5)} | $${cAllFull.toFixed(5)} | ${comparison.routingDelta.allFull >= 0 ? "+" : ""}$${comparison.routingDelta.allFull.toFixed(5)} |\n`;
    report += `| Cache savings | $${(baseline.routingComp?.cached ?? 0).toFixed(5)} | $${(current.routingComp?.cached ?? 0).toFixed(5)} | ${comparison.routingDelta.cached >= 0 ? "+" : ""}$${comparison.routingDelta.cached.toFixed(5)} |\n`;
  }

  if (comparison.regressions.length > 0) {
    report += `\n## ⚠️ Regressions\n\n`;
    report += `| Test ID | Metric | Baseline | Current | Delta | Severity |\n`;
    report += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    for (const r of comparison.regressions) {
      const sign = r.delta >= 0 ? "+" : "";
      const precision = r.metric === "cost" ? 5 : 1;
      report += `| \`${r.testId}\` | ${r.metric} | ${r.baseline.toFixed(precision)} | ${r.current.toFixed(precision)} | ${sign}${r.delta.toFixed(precision)} | **${r.severity.toUpperCase()}** |\n`;
    }
  }

  if (comparison.improvements.length > 0) {
    report += `\n## ✅ Improvements\n\n`;
    report += `| Test ID | Metric | Baseline | Current | Delta |\n`;
    report += `| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const i of comparison.improvements) {
      const sign = i.delta >= 0 ? "+" : "";
      const precision = i.metric === "cost" ? 5 : 1;
      report += `| \`${i.testId}\` | ${i.metric} | ${i.baseline.toFixed(precision)} | ${i.current.toFixed(precision)} | ${sign}${i.delta.toFixed(precision)} |\n`;
    }
  }

  report += `\n---\n*Report generated on ${new Date().toLocaleString()}*`;
  return report;
}

async function runComparison(): Promise<void> {
  const args = process.argv.slice(2);
  
  let baselinePath: string | undefined;
  let currentPath: string | undefined;
  let outputDir = "./audit-results";
  let compareToLast = false;

  // Parse args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--baseline" && args[i + 1]) {
      baselinePath = args[i + 1];
      i++;
    } else if (args[i] === "--current" && args[i + 1]) {
      currentPath = args[i + 1];
      i++;
    } else if (args[i] === "--output-dir" && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    } else if (args[i] === "--last") {
      compareToLast = true;
    }
  }

  if (!baselinePath || !currentPath) {
    if (!existsSync(outputDir)) {
      console.error(`❌ Output directory not found: ${outputDir}`);
      console.log("Run audit first: npx tsx scripts/audit-prompt-pipeline.ts");
      process.exit(1);
    }

    const files = collectResultFiles(outputDir);

    if (compareToLast) {
      const currentFiles = files.filter((f) => f.split("/").at(-1)?.startsWith("current-"));
      if (currentFiles.length >= 2) {
        currentPath = currentFiles[0];
        baselinePath = currentFiles[1];
        console.log("ℹ️  Comparing latest current run against the previous current run");
      } else if (files.length >= 2) {
        currentPath = files[0];
        baselinePath = files[1];
        console.log("ℹ️  Comparing latest result against the previous saved result");
      } else {
        console.error("❌ Need at least two result files to compare with --last");
        process.exit(1);
      }
    } else {
      const baselineFiles = files.filter(f => f.split("/").at(-1)?.startsWith("baseline-"));
      const currentFiles = files.filter(f => f.split("/").at(-1)?.startsWith("current-"));
      const genericFiles = files.filter(
        f => !f.split("/").at(-1)?.startsWith("baseline-") && !f.split("/").at(-1)?.startsWith("current-"),
      );

      if (baselineFiles.length > 0 && currentFiles.length > 0) {
        baselinePath = baselineFiles[0];
        currentPath = currentFiles[0];
      } else if (currentFiles.length >= 2) {
        currentPath = currentFiles[0];
        baselinePath = currentFiles[1];
        console.log("ℹ️  Comparing latest current run against the previous current run");
      } else if (files.length >= 2) {
        currentPath = files[0];
        baselinePath = files[1];
        console.log("ℹ️  Falling back to the latest two result files for comparison");
      } else {
        console.error("❌ Need at least two result files to compare:");
        console.log(`   Baseline files: ${baselineFiles.length}`);
        console.log(`   Current files: ${currentFiles.length}`);
        console.log(`   Generic files: ${genericFiles.length}`);
        console.log(`\nRun:`);
        console.log(`   1. npx tsx scripts/audit-prompt-pipeline.ts --baseline --output-dir ${outputDir}`);
        console.log(`   2. npx tsx scripts/audit-prompt-pipeline.ts --output-dir ${outputDir}`);
        process.exit(1);
      }
    }
  }

  console.log(`\n📂 Loading runs:`);
  console.log(`   Baseline: ${baselinePath}`);
  console.log(`   Current:  ${currentPath}`);

  const baseline = loadRun(baselinePath);
  const current = loadRun(currentPath);

  const comparison = compareRuns(baseline, current);
  printComparison(comparison, baseline, current);

  // Save comparison report
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(outputDir, `comparison-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(comparison, null, 2));
  console.log(`📄 Report saved to: ${reportPath}`);

  // Save Markdown report
  const mdReport = generateMarkdownReport(comparison, baselinePath, currentPath, baseline, current);
  const mdReportPath = join(outputDir, `report-latest.md`);
  writeFileSync(mdReportPath, mdReport);
  console.log(`📝 Markdown report saved to: ${mdReportPath}`);
}

runComparison().catch(console.error);
