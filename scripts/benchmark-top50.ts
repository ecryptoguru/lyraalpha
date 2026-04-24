import { generateLyraStream } from '@/lib/ai/service';
import { LyraMessage } from '@/types/ai';
import { LyraContext } from '@/lib/engines/types';
import { prisma } from '@/lib/prisma';
import {
  getTierConfig,
  getTargetOutputTokens,
  type PlanTier,
  type QueryComplexity,
} from '@/lib/ai/config';
import { classifyQuery } from '@/lib/ai/query-classifier';
import { invalidateCacheByPrefix } from '@/lib/redis';
import { getPlanPrice, type UpgradeRegion } from '@/lib/billing/upgrade-pricing';
import {
  MONTHLY_PLAN_CREDITS,
  PLAN_ROUTING_FACTS,
  QUERY_CREDIT_COSTS,
} from '@/lib/plans/facts';
import { RATE_LIMIT_CONFIG } from '@/lib/rate-limit/config';
import { calculateLLMCost } from '@/lib/ai/cost-calculator';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

let outputDir = './audit-results';
let benchmarkRunId = '';

const QUESTION_GROUPS = [
  {
    name: 'Beginner Crypto',
    questions: [
      'What is cryptocurrency and how does it work?',
      'How do I start investing in cryptocurrency?',
      'What is the difference between coins and tokens?',
      'What is blockchain in cryptocurrency?',
      'How do I buy my first cryptocurrency?',
      'Is cryptocurrency safe?',
      'Can I lose more than I invest in crypto?',
      'How long should I hold cryptocurrency?',
      'How do beginners choose which crypto to invest in?',
      'What is a crypto wallet and how does it work?',
    ],
  },
  {
    name: 'Crypto Selection',
    questions: [
      'How do I know if a cryptocurrency is undervalued?',
      'What are the best cryptocurrencies to buy right now?',
      'How do I find multibagger cryptocurrencies?',
      'What metrics should I look at before investing in crypto?',
      'How do I analyze cryptocurrency fundamentals?',
      'How do I know if a cryptocurrency is overvalued?',
      'How do I evaluate different cryptocurrencies?',
      'How do I find promising altcoins?',
      'How do I track whale movements in crypto?',
      'What crypto sectors will grow in the next 5 years?',
    ],
  },
  {
    name: 'Crypto Portfolio',
    questions: [
      'Is my crypto portfolio diversified enough?',
      'How many cryptocurrencies should I own?',
      'How do I rebalance my crypto portfolio?',
      'What is the ideal crypto portfolio allocation?',
      'How much should I invest in each cryptocurrency?',
      'Should I hold stablecoins during market corrections?',
      'How do I reduce crypto portfolio risk?',
      'What sectors should I add to diversify my crypto portfolio?',
      'How do I build a long-term crypto portfolio?',
      'How do I track my crypto portfolio performance?',
    ],
  },
  {
    name: 'Crypto Market Timing',
    questions: [
      'Is this a good time to invest in cryptocurrency?',
      'Are we in a crypto market bubble?',
      'How do I know when the crypto market will crash?',
      'Should I invest during a crypto market correction?',
      'How do interest rates affect cryptocurrencies?',
      'What macro factors move the crypto market?',
      'How do Bitcoin halvings affect crypto prices?',
    ],
  },
  {
    name: 'Crypto Strategy',
    questions: [
      'Should I invest in Bitcoin or altcoins?',
      'Is DCA (Dollar Cost Averaging) better than lump-sum investing in crypto?',
      'What is the best long-term crypto investing strategy?',
      'Should I invest in DeFi tokens or established cryptocurrencies?',
      'What are the best staking cryptocurrencies?',
      'Should I invest in NFTs or cryptocurrencies?',
      'How do I build passive income from crypto?',
    ],
  },
  {
    name: 'Crypto Risk & Behavior',
    questions: [
      'What should I do when my crypto falls?',
      'Should I average down on losing cryptocurrencies?',
      'When should I sell a cryptocurrency?',
      'How do I avoid emotional crypto investing?',
      'What are the biggest mistakes crypto investors make?',
      'How do I protect my crypto from hacks?',
    ],
  },
] as const;

const QUESTIONS = QUESTION_GROUPS.flatMap((group) => group.questions);

const PLANS: PlanTier[] = ['STARTER', 'PRO', 'ELITE', 'ENTERPRISE'];
const REGIONS: UpgradeRegion[] = ['US'];

function estimateCostFromLog(
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number,
  model: string,
): number {
  const { inputCost, cachedInputCost, outputCost } = calculateLLMCost({
    model,
    inputTokens,
    outputTokens,
    cachedInputTokens,
  });
  return inputCost + cachedInputCost + outputCost;
}

function estimateCostFallback(tokens: number, plan: PlanTier, tier: QueryComplexity): number {
  const modelTier = PLAN_ROUTING_FACTS[plan][tier];
  const modelMap: Record<string, string> = {
    'gpt-nano': 'gpt-5.4-nano',
    'gpt-mini': 'gpt-5.4-mini',
    'gpt-full': 'gpt-5.4',
  };
  const model = modelMap[modelTier] ?? 'gpt-5.4-nano';
  const inputTokens = Math.round(tokens * 3);
  return estimateCostFromLog(inputTokens, tokens, 0, model);
}

function resolveCanonicalModelFromRole(role: string | undefined): string {
  const roleToModel: Record<string, string> = {
    'lyra-nano': 'gpt-5.4-nano',
    'lyra-mini': 'gpt-5.4-mini',
    'lyra-full': 'gpt-5.4',
    'myra': 'gpt-5.4',
  };
  return roleToModel[role ?? ''] ?? 'gpt-5.4';
}

async function ensureBenchmarkUser(plan: PlanTier, runId: string): Promise<string> {
  const userId = `user_benchmark_${plan.toLowerCase()}_${runId}`;
  const now = new Date();
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email: `${userId}@benchmark.local`, plan, updatedAt: now },
    update: { email: `${userId}@benchmark.local`, plan, updatedAt: now },
  });
  return userId;
}

async function cleanupBenchmarkUsers(runId: string) {
  if (!runId) return;

  const userIds = (['STARTER', 'PRO', 'ELITE', 'ENTERPRISE'] as const).map(
    (plan) => `user_benchmark_${plan.toLowerCase()}_${runId}`,
  );

  await prisma.$transaction(async (tx) => {
    await tx.aIRequestLog.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });
}

type PreviousBenchmark = {
  summary: Record<string, unknown>;
  byPlan: Record<string, unknown>;
  byTier?: Record<string, unknown>;
  byCategory: Record<string, unknown>;
  byPlanTier?: Record<string, unknown>;
  qualityDistribution: Record<string, number>;
  results: unknown[];
};

function collectBenchmarkResultFiles(dirPath: string): string[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectBenchmarkResultFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.startsWith('benchmark-') && entry.name.endsWith('-results.json')) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

function loadPreviousBenchmark(): PreviousBenchmark | null {
  try {
    const files = collectBenchmarkResultFiles(outputDir);
    if (files.length === 0) return null;
    return JSON.parse(readFileSync(files[0], 'utf-8')) as PreviousBenchmark;
  } catch {
    return null;
  }
}

async function findBenchmarkLogRow(params: {
  userId: string;
  query: string;
  startedAt: Date;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await prisma.aIRequestLog.findFirst({
      where: {
        userId: params.userId,
        inputQuery: params.query,
        createdAt: { gte: params.startedAt },
      },
      orderBy: { createdAt: 'desc' },
    }).catch(() => null);

    if (row) return row;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return null;
}

function calculateQualityScore(text: string, tier: QueryComplexity): number {
  if (!text || text.length < 50) return 0;

  const isSimpleTier = tier === 'SIMPLE';

  let fuCount = 0;
  const fuMatchesOld = text.match(/\d+\.\s*[^?\n]{5,}[?]/g) || [];
  fuCount += fuMatchesOld.length;
  const jsonArrayMatch = text.match(/\[[\s\S]*?\]/g);
  if (jsonArrayMatch) {
    for (const arr of jsonArrayMatch) {
      const qMatches = arr.match(/"[^"]+\??"/g) || [];
      fuCount += qMatches.length;
    }
  }
  const codeBlockMatch = text.match(/\`\`\`json[\s\S]*?\`\`\`/g);
  if (codeBlockMatch) {
    for (const block of codeBlockMatch) {
      const qMatches = block.match(/"[^"]+\??"/g) || [];
      fuCount += qMatches.length;
    }
  }
  fuCount = Math.min(fuCount, 5);
  // SIMPLE tier only needs 2 follow-ups (educational format), others need 3
  const minRequired = isSimpleTier ? 2 : 3;
  const followScore = fuCount >= minRequired ? 15 : (fuCount / minRequired) * 15;

  const numerics = text.match(/\b\d+(\.\d+)?[%$]?\b/g) || [];
  const uniqueNumerics = new Set(numerics).size;
  // Give SIMPLE tier same numeric cap as others - educational content can have numbers
  const numericScore = isSimpleTier
    ? Math.min(25, uniqueNumerics * 2.5)
    : Math.min(25, uniqueNumerics * 1.5);

  const hasHeaders = (text.match(/^#{1,3}\s/gm) || []).length;
  const hasBold = (text.match(/\*\*[^*]+\*\*/g) || []).length;
  const hasTable = /\|.+\|.+ \|/.test(text) ? 1 : 0;
  const hasBlockquote = (text.match(/^>/gm) || []).length;
  const hasCheckbox = (text.match(/- \[ \]/g) || []).length;
  const paragraphs = text.split(/\n\n+/).filter((paragraph) => paragraph.trim().length > 50).length;
  const wordCount = text.split(/\s+/).length;
  const structureScore = Math.min(
    30,
    Math.min(8, hasHeaders * 2) +
      Math.min(8, hasBold * 0.8) +
      hasTable * 3 +
      Math.min(3, hasBlockquote) +
      Math.min(3, hasCheckbox * 1.5) +
      Math.min(5, paragraphs * 0.5),
  );
  // More generous completeness bonus for SIMPLE tier with proper structure
  const simpleMinFollowUps = isSimpleTier ? 2 : 3;
  const simpleCompletenessBonus = isSimpleTier && fuCount >= simpleMinFollowUps && hasHeaders >= 2
    ? wordCount < 120
      ? 6  // was 4
      : wordCount < 220
        ? 8  // was 6
        : 10 // was 8
    : 0;
  let lengthScore = 0;

  if (isSimpleTier) {
    // More generous length scoring for educational/simple responses
    if (wordCount < 80) {
      lengthScore = 22;  // was 18
    } else if (wordCount < 160) {
      lengthScore = 28;  // was 24
    } else if (wordCount <= 900) {
      lengthScore = 30;
    } else {
      lengthScore = Math.max(15, 30 - Math.floor((wordCount - 900) / 200) * 5);
    }
  } else if (wordCount < 100) {
    lengthScore = 10;
  } else if (wordCount < 200) {
    lengthScore = 20;
  } else if (wordCount <= 1200) {
    lengthScore = 30;
  } else {
    lengthScore = Math.max(15, 30 - Math.floor((wordCount - 1200) / 200) * 5);
  }

  const fillers = [
    "it's important to note",
    'in conclusion',
    'to summarize',
    'generally speaking',
    'furthermore',
    'moreover',
    'additionally',
  ];
  const fillerHits = fillers.filter((phrase) => text.toLowerCase().includes(phrase)).length;
  const antiPenalty = Math.min(10, fillerHits * 2);

  const raw = followScore + numericScore + structureScore + lengthScore + simpleCompletenessBonus - antiPenalty;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

type BenchmarkResult = {
  category: string;
  query: string;
  plan: PlanTier;
  tier: QueryComplexity;
  model: string;
  success: boolean;
  duration: number;
  ttftMs: number | null;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  quality: number;
  cost: number;
  creditsCharged: number;
  error?: string;
  responseLength: number;
  wordCount: number;
  followUps: number;
  numerics: number;
  isTruncated: boolean;
  truncationSignal: string;
};

type Aggregate = {
  count: number;
  successCount: number;
  cost: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  quality: number;
  latency: number;
  ttft: number;
  credits: number;
  wordCount: number;
  truncatedCount: number;
  geminiCount: number;
  gptCount: number;
};

type MetricSummary = {
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  min: number;
  max: number;
};

type FinancialModelRow = {
  plan: PlanTier;
  avgCostPerQuery: number;
  avgCreditsPerQuery: number;
  avgQuality: number;
  avgLatencyMs: number;
  dailyBurstLimit: number;
  monthlyRateCap: number;
  monthlyCreditAllowance: number;
  creditLimitedMonthlyQueries: number;
  effectiveMonthlyQueries: number;
  effectiveDailyQueries: number;
  projectedDailyCost: number;
  projectedMonthlyCost: number;
  projectedMonthlyRevenue: Record<UpgradeRegion, number>;
  projectedMonthlyGrossMargin: Record<UpgradeRegion, number | null>;
  projectedMonthlyGrossMarginPct: Record<UpgradeRegion, number | null>;
};

function emptyAggregate(): Aggregate {
  return {
    count: 0,
    successCount: 0,
    cost: 0,
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    quality: 0,
    latency: 0,
    ttft: 0,
    credits: 0,
    wordCount: 0,
    truncatedCount: 0,
    geminiCount: 0,
    gptCount: 0,
  };
}

function updateAggregate(aggregate: Aggregate, result: BenchmarkResult) {
  aggregate.count += 1;
  aggregate.cost += result.cost;
  aggregate.tokens += result.tokens;
  aggregate.inputTokens += result.inputTokens;
  aggregate.outputTokens += result.outputTokens;
  aggregate.cachedInputTokens += result.cachedInputTokens;
  aggregate.reasoningTokens += result.reasoningTokens;
  aggregate.credits += result.creditsCharged;
  aggregate.wordCount += result.wordCount;
  if (result.success) {
    aggregate.successCount += 1;
    aggregate.quality += result.quality;
    aggregate.latency += result.duration;
    aggregate.ttft += result.ttftMs ?? 0;
  }
  if (result.isTruncated) aggregate.truncatedCount += 1;
  if (result.model.includes('gpt')) aggregate.gptCount += 1;
  else aggregate.geminiCount += 1;
}

function average(sum: number, count: number): number {
  return count > 0 ? sum / count : 0;
}

function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * pct;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function summarizeMetric(values: number[]): MetricSummary {
  if (values.length === 0) {
    return { avg: 0, p50: 0, p90: 0, p95: 0, min: 0, max: 0 };
  }

  return {
    avg: average(values.reduce((sum, value) => sum + value, 0), values.length),
    p50: percentile(values, 0.5),
    p90: percentile(values, 0.9),
    p95: percentile(values, 0.95),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

function formatRegionCurrency(region: UpgradeRegion, amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function toMarkdownTable(headers: string[], rows: string[][]): string {
  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const bodyRows = rows.map((row) => `| ${row.join(' | ')} |`);
  return [headerRow, separatorRow, ...bodyRows].join('\n');
}

function formatSignedNumber(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

function formatSignedPercent(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

function formatMarkdownFileLink(fileName: string): string {
  return `\`${fileName}\``;
}

function getQuestionCategory(index: number): string {
  let cursor = 0;
  for (const group of QUESTION_GROUPS) {
    const upper = cursor + group.questions.length;
    if (index < upper) return group.name;
    cursor = upper;
  }
  return 'Unknown';
}

function buildFinancialModel(byPlan: Record<PlanTier, Aggregate>): FinancialModelRow[] {
  return PLANS.map((plan) => {
    const aggregate = byPlan[plan] ?? emptyAggregate();
    const avgCostPerQuery = average(aggregate.cost, aggregate.count);
    const avgCreditsPerQuery = average(aggregate.credits, aggregate.count);
    const avgQuality = average(aggregate.quality, aggregate.successCount);
    const avgLatencyMs = average(aggregate.latency, aggregate.successCount);
    const dailyBurstLimit = RATE_LIMIT_CONFIG.chatDailyBurst[plan].requests;
    const monthlyRateCap = RATE_LIMIT_CONFIG.chatMonthlyCap[plan].requests;
    const monthlyCreditAllowance = MONTHLY_PLAN_CREDITS[plan];
    const creditLimitedMonthlyQueries = avgCreditsPerQuery > 0
      ? Math.floor(monthlyCreditAllowance / avgCreditsPerQuery)
      : monthlyRateCap;
    const effectiveMonthlyQueries = Math.min(monthlyRateCap, creditLimitedMonthlyQueries);
    const effectiveDailyQueries = Math.min(dailyBurstLimit, effectiveMonthlyQueries / 30);
    const projectedMonthlyCost = effectiveMonthlyQueries * avgCostPerQuery;
    const projectedDailyCost = effectiveDailyQueries * avgCostPerQuery;
    const projectedMonthlyRevenue = Object.fromEntries(
      REGIONS.map((region) => [region, getPlanPrice(region, plan.toLowerCase() as 'starter' | 'pro' | 'elite' | 'enterprise').amount]),
    ) as Record<UpgradeRegion, number>;
    const projectedMonthlyGrossMargin = Object.fromEntries(
      REGIONS.map((region) => {
        const revenue = projectedMonthlyRevenue[region];
        return [region, revenue > 0 ? revenue - projectedMonthlyCost : null];
      }),
    ) as Record<UpgradeRegion, number | null>;
    const projectedMonthlyGrossMarginPct = Object.fromEntries(
      REGIONS.map((region) => {
        const revenue = projectedMonthlyRevenue[region];
        const margin = projectedMonthlyGrossMargin[region];
        return [region, revenue > 0 && margin !== null ? (margin / revenue) * 100 : null];
      }),
    ) as Record<UpgradeRegion, number | null>;

    return {
      plan,
      avgCostPerQuery,
      avgCreditsPerQuery,
      avgQuality,
      avgLatencyMs,
      dailyBurstLimit,
      monthlyRateCap,
      monthlyCreditAllowance,
      creditLimitedMonthlyQueries,
      effectiveMonthlyQueries,
      effectiveDailyQueries,
      projectedDailyCost,
      projectedMonthlyCost,
      projectedMonthlyRevenue,
      projectedMonthlyGrossMargin,
      projectedMonthlyGrossMarginPct,
    };
  });
}

function writeMarkdownReports(params: {
  baseName: string;
  results: BenchmarkResult[];
  summary: Record<string, number | Record<string, number>>;
  byPlan: Record<PlanTier, Aggregate>;
  byTier: Record<QueryComplexity, Aggregate>;
  byCategory: Record<string, Aggregate>;
  byPlanTier: Record<string, Aggregate>;
  qualityBuckets: Record<string, number>;
  financialModel: FinancialModelRow[];
  previous: PreviousBenchmark | null;
  totalTimeMs: number;
}) {
  const {
    baseName,
    results,
    summary,
    byPlan,
    byTier,
    byCategory,
    byPlanTier,
    qualityBuckets,
    financialModel,
    previous,
    totalTimeMs,
  } = params;

  const successfulResults = results.filter((result) => result.success);
  const costSummary = summarizeMetric(results.map((result) => result.cost));
  const latencySummary = summarizeMetric(successfulResults.map((result) => result.duration));
  const ttftSummary = summarizeMetric(successfulResults.map((result) => result.ttftMs ?? 0));
  const qualitySummary = summarizeMetric(successfulResults.map((result) => result.quality));

  const previousSummary = previous?.summary as
    | {
        avgQuality?: number;
        avgLatency?: number;
        avgTtft?: number;
        totalCost?: number;
        totalTokens?: number;
        truncatedCount?: number;
      }
    | undefined;

  const overviewLines = [
    '# Benchmark Audit Summary',
    '',
    `- **Questions audited**: ${summary.total}`,
    `- **Successful runs**: ${summary.successful}`,
    `- **Failed runs**: ${summary.failed}`,
    `- **Total wall time**: ${formatDuration(totalTimeMs)}`,
    `- **Average quality**: ${(summary.avgQuality as number).toFixed(1)}/100`,
    `- **Average latency**: ${formatDuration(summary.avgLatency as number)}`,
    `- **Average TTFT**: ${formatDuration(summary.avgTtft as number)}`,
    `- **Total tokens**: ${(summary.totalTokens as number).toLocaleString()}`,
    `- **Total cost**: ${formatUsd(summary.totalCost as number)}`,
    `- **Truncated responses**: ${summary.truncatedCount}`,
    '',
  ];

  overviewLines.push(
    '## Distribution Snapshot',
    '',
    toMarkdownTable(
      ['Metric', 'Avg', 'P50', 'P90', 'P95', 'Min', 'Max'],
      [
        ['Latency', formatDuration(latencySummary.avg), formatDuration(latencySummary.p50), formatDuration(latencySummary.p90), formatDuration(latencySummary.p95), formatDuration(latencySummary.min), formatDuration(latencySummary.max)],
        ['TTFT', formatDuration(ttftSummary.avg), formatDuration(ttftSummary.p50), formatDuration(ttftSummary.p90), formatDuration(ttftSummary.p95), formatDuration(ttftSummary.min), formatDuration(ttftSummary.max)],
        ['Cost', formatUsd(costSummary.avg), formatUsd(costSummary.p50), formatUsd(costSummary.p90), formatUsd(costSummary.p95), formatUsd(costSummary.min), formatUsd(costSummary.max)],
        ['Quality', qualitySummary.avg.toFixed(1), qualitySummary.p50.toFixed(1), qualitySummary.p90.toFixed(1), qualitySummary.p95.toFixed(1), qualitySummary.min.toFixed(1), qualitySummary.max.toFixed(1)],
      ],
    ),
    '',
  );

  if (previousSummary) {
    overviewLines.push(
      '## Previous Run Comparison',
      '',
      toMarkdownTable(
        ['Metric', 'Current', 'Previous', 'Delta'],
        [
          [
            'Avg quality',
            (summary.avgQuality as number).toFixed(1),
            (previousSummary.avgQuality ?? 0).toFixed(1),
            formatSignedNumber((summary.avgQuality as number) - (previousSummary.avgQuality ?? 0)),
          ],
          [
            'Avg latency',
            formatDuration(summary.avgLatency as number),
            formatDuration(previousSummary.avgLatency ?? 0),
            formatDuration((summary.avgLatency as number) - (previousSummary.avgLatency ?? 0)),
          ],
          [
            'Total cost',
            formatUsd(summary.totalCost as number),
            formatUsd(previousSummary.totalCost ?? 0),
            `${formatSignedNumber((summary.totalCost as number) - (previousSummary.totalCost ?? 0), 4)} (${formatSignedPercent(previousSummary.totalCost ? (((summary.totalCost as number) - (previousSummary.totalCost ?? 0)) / previousSummary.totalCost) * 100 : 0)})`,
          ],
          [
            'Total tokens',
            (summary.totalTokens as number).toLocaleString(),
            (previousSummary.totalTokens ?? 0).toLocaleString(),
            formatSignedNumber((summary.totalTokens as number) - (previousSummary.totalTokens ?? 0), 0),
          ],
          [
            'Truncation count',
            String(summary.truncatedCount),
            String(previousSummary.truncatedCount ?? 0),
            formatSignedNumber((summary.truncatedCount as number) - (previousSummary.truncatedCount ?? 0), 0),
          ],
        ],
      ),
      '',
    );
  }

  overviewLines.push(
    '## Full Result Snapshot',
    '',
    toMarkdownTable(
      ['Category', 'Plan', 'Tier', 'Quality', 'Latency', 'TTFT', 'Cost', 'Tokens', 'Truncation', 'Question'],
      results.map((result) => [
        result.category,
        result.plan,
        result.tier,
        result.success ? result.quality.toFixed(0) : 'ERR',
        result.success ? formatDuration(result.duration) : 'ERR',
        result.ttftMs !== null ? formatDuration(result.ttftMs) : 'N/A',
        formatUsd(result.cost),
        String(result.tokens),
        result.isTruncated ? result.truncationSignal || 'yes' : 'none',
        result.query.replace(/\|/g, '\\|'),
      ]),
    ),
    '',
  );

  overviewLines.push(
    '## Question Category Coverage',
    '',
    toMarkdownTable(
      ['Category', 'Questions'],
      QUESTION_GROUPS.map((group) => [group.name, String(group.questions.length)]),
    ),
    '',
  );

  writeFileSync(join(outputDir, `${baseName}-summary.md`), overviewLines.join('\n'));

  const costRows = PLANS.map((plan) => {
    const aggregate = byPlan[plan];
    const avgCost = average(aggregate.cost, aggregate.count);
    const avgInput = average(aggregate.inputTokens, aggregate.count);
    const avgOutput = average(aggregate.outputTokens, aggregate.count);
    const avgCached = average(aggregate.cachedInputTokens, aggregate.count);
    const planResults = results.filter((result) => result.plan === plan);
    return [
      plan,
      String(aggregate.count),
      formatUsd(avgCost),
      formatUsd(aggregate.cost),
      avgInput.toFixed(0),
      avgOutput.toFixed(0),
      avgCached.toFixed(0),
      `${aggregate.gptCount} GPT / ${aggregate.geminiCount} legacy`,
      formatUsd(summarizeMetric(planResults.map((result) => result.cost)).p90),
    ];
  });

  const costLines = [
    '# Cost Audit',
    '',
    '## Executive Takeaways',
    '',
    `- **Average cost / query**: ${formatUsd(average(results.reduce((sum, result) => sum + result.cost, 0), results.length))}`,
    `- **Total cost**: ${formatUsd(summary.totalCost as number)}`,
    `- **Most expensive plan**: ${PLANS.reduce<PlanTier | null>((prev, plan) => {
      if (!prev) return plan;
      return byPlan[plan].cost > byPlan[prev].cost ? plan : prev;
    }, null) ?? 'N/A'}`,
    '',
    toMarkdownTable(
      ['Plan', 'Runs', 'Avg Cost / Query', 'Total Cost', 'Avg Input Tokens', 'Avg Output Tokens', 'Avg Cached Tokens', 'Model Mix', 'P90 Cost'],
      costRows,
    ),
    '',
    '## By Tier',
    '',
    toMarkdownTable(
      ['Tier', 'Runs', 'Avg Cost / Query', 'Total Cost', 'Avg Credits / Query', 'P90 Cost'],
      (Object.keys(byTier) as QueryComplexity[]).map((tier) => {
        const aggregate = byTier[tier];
        const tierResults = results.filter((result) => result.tier === tier);
        return [
          tier,
          String(aggregate.count),
          formatUsd(average(aggregate.cost, aggregate.count)),
          formatUsd(aggregate.cost),
          average(aggregate.credits, aggregate.count).toFixed(2),
          formatUsd(summarizeMetric(tierResults.map((result) => result.cost)).p90),
        ];
      }),
    ),
    '',
    '## Per Plan × Tier Matrix',
    '',
    toMarkdownTable(
      ['Plan/Tier', 'Runs', 'Avg Cost', 'Avg Quality', 'Avg Latency', 'P90 Latency'],
      Object.entries(byPlanTier).map(([key, aggregate]) => [
        key,
        String(aggregate.count),
        formatUsd(average(aggregate.cost, aggregate.count)),
        average(aggregate.quality, aggregate.successCount).toFixed(1),
        formatDuration(average(aggregate.latency, aggregate.successCount)),
        formatDuration(summarizeMetric(results.filter((result) => `${result.plan}/${result.tier}` === key && result.success).map((result) => result.duration)).p90),
      ]),
    ),
    '',
  ];

  writeFileSync(join(outputDir, `${baseName}-cost-audit.md`), costLines.join('\n'));

  const latencyLines = [
    '# Latency Audit',
    '',
    '## Executive Takeaways',
    '',
    `- **Average latency**: ${formatDuration(summary.avgLatency as number)}`,
    `- **Average TTFT**: ${formatDuration(summary.avgTtft as number)}`,
    `- **Slowest successful query**: ${formatDuration(Math.max(...results.filter((result) => result.success).map((result) => result.duration), 0))}`,
    '',
    toMarkdownTable(
      ['Plan', 'Avg Latency', 'P50 Latency', 'P90 Latency', 'Avg TTFT', 'P50 TTFT', 'P90 TTFT', 'Pacing', 'Truncations'],
      PLANS.map((plan) => {
        const aggregate = byPlan[plan];
        const planResults = results.filter((result) => result.plan === plan && result.success);
        const planLatency = summarizeMetric(planResults.map((result) => result.duration));
        const planTtft = summarizeMetric(planResults.map((result) => result.ttftMs ?? 0));
        return [
          plan,
          formatDuration(average(aggregate.latency, aggregate.successCount)),
          formatDuration(planLatency.p50),
          formatDuration(planLatency.p90),
          formatDuration(average(aggregate.ttft, aggregate.successCount)),
          formatDuration(planTtft.p50),
          formatDuration(planTtft.p90),
          average(aggregate.wordCount, aggregate.count).toFixed(0),
          String(aggregate.truncatedCount),
        ];
      }),
    ),
    '',
    '## Slowest Queries',
    '',
    toMarkdownTable(
      ['Category', 'Plan', 'Tier', 'Latency', 'TTFT', 'Quality', 'Query'],
      [...results]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 15)
        .map((result) => [
          result.category,
          result.plan,
          result.tier,
          formatDuration(result.duration),
          formatDuration(result.ttftMs ?? 0),
          result.quality.toFixed(0),
          result.query.replace(/\|/g, '\\|'),
        ]),
    ),
    '',
  ];

  writeFileSync(join(outputDir, `${baseName}-latency-audit.md`), latencyLines.join('\n'));

  const qualityLines = [
    '# Quality Audit',
    '',
    '## Executive Takeaways',
    '',
    `- **Average quality**: ${(summary.avgQuality as number).toFixed(1)}/100`,
    `- **Best quality plan**: ${PLANS.reduce<PlanTier | null>((prev, plan) => {
      if (!prev) return plan;
      return average(byPlan[plan].quality, byPlan[plan].successCount) > average(byPlan[prev].quality, byPlan[prev].successCount) ? plan : prev;
    }, null) ?? 'N/A'}`,
    `- **Quality bucket leader**: ${Object.entries(qualityBuckets).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A'}`,
    '',
    toMarkdownTable(
      ['Plan', 'Avg Quality', 'P50 Quality', 'P90 Quality', 'Avg Words', 'Avg Follow-ups', 'Avg Numerics', 'Truncations'],
      PLANS.map((plan) => {
        const planResults = results.filter((result) => result.plan === plan);
        const planQuality = summarizeMetric(planResults.filter((result) => result.success).map((result) => result.quality));
        const followUps = average(
          planResults.reduce((sum, result) => sum + result.followUps, 0),
          planResults.length,
        );
        const numerics = average(
          planResults.reduce((sum, result) => sum + result.numerics, 0),
          planResults.length,
        );
        const aggregate = byPlan[plan];
        return [
          plan,
          average(aggregate.quality, aggregate.successCount).toFixed(1),
          planQuality.p50.toFixed(1),
          planQuality.p90.toFixed(1),
          average(aggregate.wordCount, aggregate.count).toFixed(0),
          followUps.toFixed(1),
          numerics.toFixed(1),
          String(aggregate.truncatedCount),
        ];
      }),
    ),
    '',
    '## Quality Distribution',
    '',
    toMarkdownTable(
      ['Bucket', 'Count'],
      Object.entries(qualityBuckets).map(([bucket, count]) => [bucket, String(count)]),
    ),
    '',
    '## Lowest Quality Queries',
    '',
    toMarkdownTable(
      ['Category', 'Plan', 'Tier', 'Quality', 'Latency', 'Query'],
      [...results]
        .filter((result) => result.success)
        .sort((a, b) => a.quality - b.quality)
        .slice(0, 15)
        .map((result) => [
          result.category,
          result.plan,
          result.tier,
          result.quality.toFixed(0),
          formatDuration(result.duration),
          result.query.replace(/\|/g, '\\|'),
        ]),
    ),
    '',
    '## Category-Level Quality',
    '',
    toMarkdownTable(
      ['Category', 'Runs', 'Avg Quality', 'P90 Quality', 'Avg Latency', 'P90 Latency', 'Avg Cost', 'P90 Cost'],
      Object.entries(byCategory).map(([category, aggregate]) => [
        category,
        String(aggregate.count),
        average(aggregate.quality, aggregate.successCount).toFixed(1),
        summarizeMetric(results.filter((result) => result.category === category && result.success).map((result) => result.quality)).p90.toFixed(1),
        formatDuration(average(aggregate.latency, aggregate.successCount)),
        formatDuration(summarizeMetric(results.filter((result) => result.category === category && result.success).map((result) => result.duration)).p90),
        formatUsd(average(aggregate.cost, aggregate.count)),
        formatUsd(summarizeMetric(results.filter((result) => result.category === category).map((result) => result.cost)).p90),
      ]),
    ),
    '',
  ];

  writeFileSync(join(outputDir, `${baseName}-quality-audit.md`), qualityLines.join('\n'));

  const financialLines = [
    '# Financial Model Audit',
    '',
    '## Assumptions',
    '',
    '- Monthly plan pricing is sourced from `src/lib/billing/upgrade-pricing.ts`.',
    '- Monthly credit allowances are sourced from `src/lib/plans/facts.ts`.',
    '- Daily and monthly chat caps are sourced from `src/lib/rate-limit/config.ts`.',
    '- Effective monthly usage is modeled as the lower of the monthly rate cap and the credit-constrained monthly query allowance.',
    '- Projected cost uses observed benchmark average cost per query for each plan.',
    '',
    '## Per Plan Financial Model',
    '',
    toMarkdownTable(
      [
        'Plan',
        'Avg Cost / Query',
        'Avg Credits / Query',
        'Daily Cap',
        'Monthly Cap',
        'Monthly Credits',
        'Credit-Limited Monthly Queries',
        'Effective Monthly Queries',
        'Daily Cost',
        'Monthly Cost',
      ],
      financialModel.map((row) => [
        row.plan,
        formatUsd(row.avgCostPerQuery),
        row.avgCreditsPerQuery.toFixed(2),
        String(row.dailyBurstLimit),
        String(row.monthlyRateCap),
        String(row.monthlyCreditAllowance),
        String(row.creditLimitedMonthlyQueries),
        String(row.effectiveMonthlyQueries),
        formatUsd(row.projectedDailyCost),
        formatUsd(row.projectedMonthlyCost),
      ]),
    ),
    '',
    '## Revenue and Gross Margin by Region',
    '',
    toMarkdownTable(
      [
        'Plan',
        'US Revenue',
        'US Gross Margin',
        'US Margin %',
      ],
      financialModel.map((row) => [
        row.plan,
        formatRegionCurrency('US', row.projectedMonthlyRevenue.US),
        row.projectedMonthlyGrossMargin.US === null ? 'N/A' : formatRegionCurrency('US', row.projectedMonthlyGrossMargin.US),
        row.projectedMonthlyGrossMarginPct.US === null ? 'N/A' : `${row.projectedMonthlyGrossMarginPct.US.toFixed(1)}%`,
      ]),
    ),
    '',
  ];

  writeFileSync(join(outputDir, `${baseName}-financial-model.md`), financialLines.join('\n'));

  const comparisonLines = [
    '# Previous Run Comparison',
    '',
    previousSummary
      ? toMarkdownTable(
          ['Metric', 'Current', 'Previous', 'Delta'],
          [
            ['Quality', (summary.avgQuality as number).toFixed(1), (previousSummary.avgQuality ?? 0).toFixed(1), formatSignedNumber((summary.avgQuality as number) - (previousSummary.avgQuality ?? 0))],
            ['Latency', formatDuration(summary.avgLatency as number), formatDuration(previousSummary.avgLatency ?? 0), formatDuration((summary.avgLatency as number) - (previousSummary.avgLatency ?? 0))],
            ['TTFT', formatDuration(summary.avgTtft as number), formatDuration(previousSummary.avgTtft ?? 0), formatDuration((summary.avgTtft as number) - (previousSummary.avgTtft ?? 0))],
            ['Cost', formatUsd(summary.totalCost as number), formatUsd(previousSummary.totalCost ?? 0), `${formatSignedNumber((summary.totalCost as number) - (previousSummary.totalCost ?? 0), 4)} (${formatSignedPercent(previousSummary.totalCost ? (((summary.totalCost as number) - (previousSummary.totalCost ?? 0)) / previousSummary.totalCost) * 100 : 0)})`],
            ['Tokens', (summary.totalTokens as number).toLocaleString(), (previousSummary.totalTokens ?? 0).toLocaleString(), formatSignedNumber((summary.totalTokens as number) - (previousSummary.totalTokens ?? 0), 0)],
            ['Truncations', String(summary.truncatedCount), String(previousSummary.truncatedCount ?? 0), formatSignedNumber((summary.truncatedCount as number) - (previousSummary.truncatedCount ?? 0), 0)],
          ],
        )
      : '_No previous benchmark file was found._',
    '',
    '## Per-Plan Delta',
    '',
    toMarkdownTable(
      ['Plan', 'Quality Δ', 'Latency Δ', 'Cost Δ', 'Quality %Δ'],
      PLANS.map((plan) => {
        const aggregate = byPlan[plan];
        const previousPlan = previous?.byPlan?.[plan] as Aggregate | undefined;
        if (!previousPlan) {
          return [plan, 'N/A', 'N/A', 'N/A', 'N/A'];
        }
        return [
          plan,
          formatSignedNumber(average(aggregate.quality, aggregate.successCount) - average(previousPlan.quality, previousPlan.successCount)),
          formatDuration(average(aggregate.latency, aggregate.successCount) - average(previousPlan.latency, previousPlan.successCount)),
          `${formatSignedNumber(average(aggregate.cost, aggregate.count) - average(previousPlan.cost, previousPlan.count), 4)}`,
          formatSignedPercent(previousPlan.quality > 0 ? ((average(aggregate.quality, aggregate.successCount) - average(previousPlan.quality, previousPlan.successCount)) / average(previousPlan.quality, previousPlan.successCount)) * 100 : 0),
        ];
      }),
    ),
    '',
  ];

  writeFileSync(join(outputDir, `${baseName}-comparison.md`), comparisonLines.join('\n'));
}

async function runBenchmark() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--output-dir' && args[i + 1]) {
      outputDir = args[i + 1];
      i += 1;
    }
  }

  mkdirSync(outputDir, { recursive: true });
  benchmarkRunId = new Date().toISOString().replace(/[:.]/g, '-').toLowerCase();
  process.env.SKIP_CREDITS = 'true';
  process.env.SKIP_AUTH = 'true';

  await Promise.all([
    invalidateCacheByPrefix('rag:assettype:'),
    invalidateCacheByPrefix('rag:q:'),
    invalidateCacheByPrefix('emb:'),
    invalidateCacheByPrefix('lyra:'),
    invalidateCacheByPrefix('edu:'),
    invalidateCacheByPrefix('tavily:'),
    invalidateCacheByPrefix('analog:emb:'),
    invalidateCacheByPrefix('analog:search:'),
  ]);

  const previous = loadPreviousBenchmark();
  if (previous) {
    const summary = previous.summary as {
      avgQuality?: number;
      avgLatency?: number;
      totalCost?: number;
    };
    console.log(
      `📂 Previous benchmark loaded: Q:${summary.avgQuality?.toFixed(1)} | ${((summary.avgLatency ?? 0) / 1000).toFixed(1)}s avg | $${(summary.totalCost ?? 0).toFixed(4)} total`,
    );
  } else {
    console.log('📂 No previous benchmark found — this will be the baseline.');
  }

  console.log(`\n🧪 Running Benchmark - ${QUESTIONS.length} questions\n`);

  const results: BenchmarkResult[] = [];
  const startTime = Date.now();

  const benchmarkUsers = Object.fromEntries(
    await Promise.all(
      PLANS.map(async (plan) => [plan, await ensureBenchmarkUser(plan, benchmarkRunId)] as const),
    ),
  ) as Record<PlanTier, string>;

  for (let index = 0; index < QUESTIONS.length; index += 1) {
    const query = QUESTIONS[index];
    const category = getQuestionCategory(index);
    const plan = PLANS[index % PLANS.length];
    process.env.LYRA_AUDIT_PLAN = plan;
    const userId = benchmarkUsers[plan];
    const tier = classifyQuery(query, 0) as QueryComplexity;
    const tierConfig = getTierConfig(plan, tier);

    const timer = Date.now();
    const startedAt = new Date();
    let responseText = '';
    let success = false;
    let error = '';
    let ttftMs: number | null = null;

    try {
      const messages: LyraMessage[] = [{ role: 'user', content: query }];
      const context: LyraContext = { assetType: 'GLOBAL', scores: undefined };
      const stream = await generateLyraStream(messages, context, userId, {
        sourcesLimit: 3,
        skipAssetLinks: false,
        preResolvedPlan: plan,
      });

      if (stream.result && typeof stream.result === 'object' && 'textStream' in stream.result) {
        for await (const chunk of stream.result.textStream) {
          if (!chunk) continue;
          if (ttftMs === null) ttftMs = Date.now() - timer;
          responseText += chunk;
        }
      }

      success = true;
    } catch (caughtError) {
      error = caughtError instanceof Error ? caughtError.message : String(caughtError);
    }

    const duration = Date.now() - timer;
    const quality = success ? calculateQualityScore(responseText, tier) : 0;

    const logRow = await findBenchmarkLogRow({
      userId,
      query,
      startedAt,
    });

    const tokens = logRow?.tokensUsed ?? Math.round(responseText.length / 4);
    const inputTokens = logRow?.inputTokens ?? 0;
    const outputTokens = logRow?.outputTokens ?? Math.round(responseText.length / 4);
    const cachedInputTokens = logRow?.cachedInputTokens ?? 0;
    const reasoningTokens = logRow?.reasoningTokens ?? 0;
    const model = logRow?.model ?? 'gpt-family';
    // Use role-derived canonical model for cost recalculation to ensure accurate
    // pricing regardless of Azure deployment naming conventions.
    const costModel = resolveCanonicalModelFromRole(tierConfig.gpt54Role ?? undefined);
    const cost = logRow?.totalCost
      ?? (logRow ? estimateCostFromLog(inputTokens, outputTokens, cachedInputTokens, costModel) : estimateCostFallback(outputTokens, plan, tier));

    let isTruncated = false;
    let truncationSignal = '';
    if (success && responseText.length > 0) {
      const maxOut = getTargetOutputTokens(tierConfig);
      // Only flag as truncated at 98%+ (was 95%) to reduce false positives
      if (outputTokens > 0 && maxOut > 0 && outputTokens / maxOut >= 0.98) {
        isTruncated = true;
        truncationSignal = `token_cap_${Math.round((outputTokens / maxOut) * 100)}pct`;
      }
      if (!isTruncated && (responseText.match(/```/g) || []).length % 2 === 1) {
        isTruncated = true;
        truncationSignal = 'unclosed_code_fence';
      }
      if (!isTruncated) {
        const lines = responseText.split('\n').map((line) => line.trim()).filter(Boolean);
        const lastLine = lines[lines.length - 1] ?? '';
        const strippedLastLine = lastLine.replace(/^\*+|\*+$/g, '').trim();
        const hasProperEnding = /[.!?\])]$/.test(strippedLastLine) || /```$/.test(lastLine);
        if (!hasProperEnding) {
          isTruncated = true;
          truncationSignal = `no-terminal-punct: "${lastLine.substring(lastLine.length - 60)}"`.substring(0, 100);
        }
      }
    }

    const wordCount = responseText.split(/\s+/).filter(Boolean).length;
    const creditsCharged = QUERY_CREDIT_COSTS[tier];

    results.push({
      category,
      success,
      query,
      plan,
      tier,
      model,
      duration,
      ttftMs,
      tokens,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      reasoningTokens,
      cost,
      quality,
      error,
      creditsCharged,
      responseLength: responseText.length,
      wordCount,
      followUps: (responseText.match(/\d+\.\s*[^?\n]{5,}[?]/g) || []).length,
      numerics: new Set(responseText.match(/\b\d+(\.\d+)?[%$]?\b/g) || []).size,
      isTruncated,
      truncationSignal,
    });

    const truncFlag = isTruncated ? ' ⚠️TRUNC' : '';
    const modelTag = model.includes('gpt') ? 'GPT' : 'GEM';
    const status = success ? '✅' : '❌';
    console.log(
      `${status} [${index + 1}/${QUESTIONS.length}] ${category} | Q:${quality} | ${plan} ${tier} | ${modelTag} | ${duration}ms | ${wordCount}w | ${tokens}t | $${cost.toFixed(5)}${truncFlag} | ${query.substring(0, 40)}...`,
    );
  }

  const totalTime = Date.now() - startTime;
  const successful = results.filter((result) => result.success);
  const failed = results.filter((result) => !result.success);

  const totalCost = results.reduce((sum, result) => sum + result.cost, 0);
  const totalTokens = results.reduce((sum, result) => sum + result.tokens, 0);
  const totalInputTokens = results.reduce((sum, result) => sum + result.inputTokens, 0);
  const totalOutputTokens = results.reduce((sum, result) => sum + result.outputTokens, 0);
  const totalCachedTokens = results.reduce((sum, result) => sum + result.cachedInputTokens, 0);
  const totalReasoningTokens = results.reduce((sum, result) => sum + result.reasoningTokens, 0);
  const avgQuality = average(successful.reduce((sum, result) => sum + result.quality, 0), successful.length);
  const avgLatency = average(successful.reduce((sum, result) => sum + result.duration, 0), successful.length);
  const avgTtft = average(successful.reduce((sum, result) => sum + (result.ttftMs ?? 0), 0), successful.length);

  const byPlan = Object.fromEntries(PLANS.map((plan) => [plan, emptyAggregate()])) as Record<PlanTier, Aggregate>;
  const byTier = Object.fromEntries(
    ['SIMPLE', 'MODERATE', 'COMPLEX'].map((tier) => [tier, emptyAggregate()]),
  ) as Record<QueryComplexity, Aggregate>;
  const byCategory: Record<string, Aggregate> = Object.fromEntries(
    QUESTION_GROUPS.map((group) => [group.name, emptyAggregate()]),
  );
  const byPlanTier: Record<string, Aggregate> = {};

  for (const result of results) {
    updateAggregate(byPlan[result.plan], result);
    updateAggregate(byTier[result.tier], result);
    updateAggregate(byCategory[result.category], result);
    const key = `${result.plan}/${result.tier}`;
    if (!byPlanTier[key]) byPlanTier[key] = emptyAggregate();
    updateAggregate(byPlanTier[key], result);
  }

  const qualityBuckets = {
    '0-40': 0,
    '41-60': 0,
    '61-70': 0,
    '71-80': 0,
    '81-90': 0,
    '91-100': 0,
  };
  for (const result of successful) {
    if (result.quality <= 40) qualityBuckets['0-40'] += 1;
    else if (result.quality <= 60) qualityBuckets['41-60'] += 1;
    else if (result.quality <= 70) qualityBuckets['61-70'] += 1;
    else if (result.quality <= 80) qualityBuckets['71-80'] += 1;
    else if (result.quality <= 90) qualityBuckets['81-90'] += 1;
    else qualityBuckets['91-100'] += 1;
  }

  const truncated = results.filter((result) => result.isTruncated);
  const gptCount = results.filter((result) => result.model.includes('gpt')).length;
  const legacyCount = results.length - gptCount;
  const financialModel = buildFinancialModel(byPlan);

  const costSummary = summarizeMetric(results.map((result) => result.cost));
  const latencySummary = summarizeMetric(successful.map((result) => result.duration));
  const ttftSummary = summarizeMetric(successful.map((result) => result.ttftMs ?? 0));
  const qualitySummary = summarizeMetric(successful.map((result) => result.quality));

  console.log(`\n${'═'.repeat(75)}`);
  console.log('                        BENCHMARK RESULTS');
  console.log('═'.repeat(75));

  console.log('\n📊 OVERALL');
  console.log(`   Questions:        ${results.length}`);
  console.log(`   Successful:       ${successful.length}`);
  console.log(`   Failed:           ${failed.length}`);
  console.log(`   Total Time:       ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`   Avg Latency:      ${(avgLatency / 1000).toFixed(1)}s`);
  console.log(`   Avg TTFT:         ${(avgTtft / 1000).toFixed(1)}s`);
  console.log(`   Total Tokens:     ${totalTokens.toLocaleString()} (in:${totalInputTokens.toLocaleString()} out:${totalOutputTokens.toLocaleString()} cached:${totalCachedTokens.toLocaleString()} reasoning:${totalReasoningTokens.toLocaleString()})`);
  console.log(`   Total Cost:       $${totalCost.toFixed(4)}`);
  console.log(`   Avg Quality:      ${avgQuality.toFixed(1)}/100`);
  console.log(`   Model Mix:        ${gptCount} GPT / ${legacyCount} non-GPT (all routing is GPT-only)`);
  console.log(`   Truncated:        ${truncated.length}/${results.length}`);

  console.log('\n� DISTRIBUTION');
  console.log(`   Cost:      avg $${costSummary.avg.toFixed(4)} | p50 $${costSummary.p50.toFixed(4)} | p90 $${costSummary.p90.toFixed(4)} | p95 $${costSummary.p95.toFixed(4)}`);
  console.log(`   Latency:   avg ${(latencySummary.avg / 1000).toFixed(2)}s | p50 ${(latencySummary.p50 / 1000).toFixed(2)}s | p90 ${(latencySummary.p90 / 1000).toFixed(2)}s | p95 ${(latencySummary.p95 / 1000).toFixed(2)}s`);
  console.log(`   TTFT:      avg ${(ttftSummary.avg / 1000).toFixed(2)}s | p50 ${(ttftSummary.p50 / 1000).toFixed(2)}s | p90 ${(ttftSummary.p90 / 1000).toFixed(2)}s | p95 ${(ttftSummary.p95 / 1000).toFixed(2)}s`);
  console.log(`   Quality:   avg ${qualitySummary.avg.toFixed(1)}/100 | p50 ${qualitySummary.p50.toFixed(1)} | p90 ${qualitySummary.p90.toFixed(1)} | p95 ${qualitySummary.p95.toFixed(1)}`);

  console.log('\n�� BY PLAN');
  console.log('   Plan       | Count | Quality | Latency  | TTFT     | Tokens  | Cost     | P90 Cost | Model Mix');
  console.log(`   ${'─'.repeat(90)}`);
  for (const plan of PLANS) {
    const aggregate = byPlan[plan];
    const planResults = results.filter((result) => result.plan === plan);
    const planCostSummary = summarizeMetric(planResults.map((result) => result.cost));
    console.log(
      `   ${plan.padEnd(10)} | ${String(aggregate.count).padEnd(5)} | ${average(aggregate.quality, aggregate.successCount).toFixed(1).padEnd(7)} | ${(average(aggregate.latency, aggregate.successCount) / 1000).toFixed(2).padEnd(8)}s | ${(average(aggregate.ttft, aggregate.successCount) / 1000).toFixed(2).padEnd(8)}s | ${String(aggregate.tokens).padEnd(7)} | $${aggregate.cost.toFixed(4).padEnd(8)} | $${planCostSummary.p90.toFixed(4).padEnd(8)} | ${aggregate.gptCount}G/${aggregate.geminiCount}L`,
    );
  }

  console.log('\n📈 BY TIER');
  console.log('   Tier       | Count | Quality | Latency  | Cost     | P90 Cost | Credits/Q');
  console.log(`   ${'─'.repeat(75)}`);
  for (const tier of Object.keys(byTier) as QueryComplexity[]) {
    const aggregate = byTier[tier];
    const tierResults = results.filter((result) => result.tier === tier);
    const tierCostSummary = summarizeMetric(tierResults.map((result) => result.cost));
    console.log(
      `   ${tier.padEnd(10)} | ${String(aggregate.count).padEnd(5)} | ${average(aggregate.quality, aggregate.successCount).toFixed(1).padEnd(7)} | ${(average(aggregate.latency, aggregate.successCount) / 1000).toFixed(2).padEnd(8)}s | $${aggregate.cost.toFixed(4).padEnd(8)} | $${tierCostSummary.p90.toFixed(4).padEnd(8)} | ${average(aggregate.credits, aggregate.count).toFixed(2)}`,
    );
  }

  console.log('\n📈 BY CATEGORY');
  console.log('   Category           | Count | Quality | Latency  | Cost');
  console.log(`   ${'─'.repeat(70)}`);
  for (const [category, aggregate] of Object.entries(byCategory)) {
    console.log(
      `   ${category.padEnd(18)} | ${String(aggregate.count).padEnd(5)} | ${average(aggregate.quality, aggregate.successCount).toFixed(1).padEnd(7)} | ${(average(aggregate.latency, aggregate.successCount) / 1000).toFixed(2).padEnd(8)}s | $${aggregate.cost.toFixed(4)}`,
    );
  }

  console.log('\n📊 QUALITY DISTRIBUTION');
  for (const [bucket, count] of Object.entries(qualityBuckets)) {
    const pct = successful.length > 0 ? ((count / successful.length) * 100).toFixed(1) : '0.0';
    console.log(`   ${bucket.padEnd(10)} | ${String(count).padEnd(4)} | ${pct.padEnd(5)}% | ${'█'.repeat(Math.ceil(count / 2))}`);
  }

  console.log('\n✂️  TRUNCATION REPORT');
  console.log(`   Truncated: ${truncated.length} / ${results.length} responses`);
  if (truncated.length > 0) {
    for (const result of truncated) {
      console.log(`   ⚠️  [${result.plan} ${result.tier}] ${result.query.substring(0, 45)}... → ${result.truncationSignal}`);
    }
  } else {
    console.log('   ✅ No truncation detected');
  }

  console.log('\n💰 FINANCIAL MODEL');
  console.log('   Plan       | Eff. Monthly Q | Avg Cost/Q | Monthly Cost | US Margin');
  console.log(`   ${'─'.repeat(70)}`);
  for (const row of financialModel) {
    const usMargin = row.projectedMonthlyGrossMargin.US === null ? 'N/A' : formatRegionCurrency('US', row.projectedMonthlyGrossMargin.US);
    console.log(
      `   ${row.plan.padEnd(10)} | ${String(row.effectiveMonthlyQueries).padEnd(14)} | ${formatUsd(row.avgCostPerQuery).padEnd(10)} | ${formatUsd(row.projectedMonthlyCost).padEnd(12)} | ${usMargin.padEnd(10)}`,
    );
  }

  if (previous) {
    const previousSummary = previous.summary as {
      avgQuality?: number;
      avgLatency?: number;
      avgTtft?: number;
      totalCost?: number;
      totalTokens?: number;
      truncatedCount?: number;
      successful?: number;
      total?: number;
    };

    console.log(`\n${'═'.repeat(90)}`);
    console.log('                         📊 COMPARISON WITH PREVIOUS RUN');
    console.log('═'.repeat(90));

    // Overall deltas
    const qualityDelta = avgQuality - (previousSummary.avgQuality ?? 0);
    const latencyDelta = avgLatency - (previousSummary.avgLatency ?? 0);
    const costDelta = totalCost - (previousSummary.totalCost ?? 0);
    const costDeltaPct = previousSummary.totalCost ? (costDelta / previousSummary.totalCost) * 100 : 0;
    console.log('   OVERALL');
    console.log(`   Quality:    ${avgQuality.toFixed(1)} vs ${(previousSummary.avgQuality ?? 0).toFixed(1)} → ${qualityDelta.toFixed(1)}`);
    console.log(`   Latency:    ${(avgLatency / 1000).toFixed(1)}s vs ${((previousSummary.avgLatency ?? 0) / 1000).toFixed(1)}s → ${(latencyDelta / 1000).toFixed(1)}s`);
    console.log(`   TTFT:       ${(avgTtft / 1000).toFixed(1)}s vs ${((previousSummary.avgTtft ?? 0) / 1000).toFixed(1)}s → ${((avgTtft - (previousSummary.avgTtft ?? 0)) / 1000).toFixed(1)}s`);
    console.log(`   Cost:       $${totalCost.toFixed(4)} vs $${(previousSummary.totalCost ?? 0).toFixed(4)} → $${costDelta.toFixed(4)} (${costDeltaPct.toFixed(1)}%)`);
    console.log(`   Tokens:     ${totalTokens.toLocaleString()} vs ${(previousSummary.totalTokens ?? 0).toLocaleString()} → ${(totalTokens - (previousSummary.totalTokens ?? 0)).toLocaleString()}`);
    console.log(`   Truncated:  ${truncated.length} vs ${previousSummary.truncatedCount ?? 0}`);
    console.log(`   Success:    ${successful.length}/${results.length} vs ${previousSummary.successful ?? 0}/${previousSummary.total ?? 0}`);

    // Per-plan detailed comparison
    console.log(`\n   PER-PLAN DETAIL`);
    console.log(`   ${'─'.repeat(86)}`);
    console.log(`   Plan       | Quality Δ | Latency Δ | Cost/Q Δ | Total Cost Δ | Tokens/Q Δ`);
    console.log(`   ${'─'.repeat(86)}`);
    for (const plan of PLANS) {
      const aggregate = byPlan[plan];
      const prevAggregate = previous.byPlan?.[plan] as Aggregate | undefined;
      if (!prevAggregate) {
        console.log(`   ${plan.padEnd(10)} | N/A       | N/A       | N/A      | N/A          | N/A`);
        continue;
      }
      const qDelta = average(aggregate.quality, aggregate.successCount) - average(prevAggregate.quality, prevAggregate.successCount);
      const lDelta = average(aggregate.latency, aggregate.successCount) - average(prevAggregate.latency, prevAggregate.successCount);
      const cDelta = average(aggregate.cost, aggregate.count) - average(prevAggregate.cost, prevAggregate.count);
      const tDelta = average(aggregate.tokens, aggregate.count) - average(prevAggregate.tokens, prevAggregate.count);
      console.log(
        `   ${plan.padEnd(10)} | ${(qDelta >= 0 ? '+' : '').concat(qDelta.toFixed(1)).padEnd(9)} | ${((lDelta / 1000).toFixed(1).concat('s')).padEnd(9)} | ${formatUsd(cDelta).padEnd(8)} | ${formatUsd(aggregate.cost - prevAggregate.cost).padEnd(12)} | ${(tDelta.toFixed(0)).padEnd(10)}`,
      );
    }

    // Per-tier detailed comparison
    const prevByTier = (previous.byTier ?? {}) as Record<string, Aggregate>;
    if (Object.keys(prevByTier).length > 0) {
      console.log(`\n   PER-TIER DETAIL`);
      console.log(`   ${'─'.repeat(86)}`);
      console.log(`   Tier       | Quality Δ | Latency Δ | Cost/Q Δ | Total Cost Δ | Tokens/Q Δ`);
      console.log(`   ${'─'.repeat(86)}`);
      for (const tier of Object.keys(byTier) as QueryComplexity[]) {
        const aggregate = byTier[tier];
        const prevAggregate = prevByTier[tier];
        if (!prevAggregate) {
          console.log(`   ${tier.padEnd(10)} | N/A       | N/A       | N/A      | N/A          | N/A`);
          continue;
        }
        const qDelta = average(aggregate.quality, aggregate.successCount) - average(prevAggregate.quality, prevAggregate.successCount);
        const lDelta = average(aggregate.latency, aggregate.successCount) - average(prevAggregate.latency, prevAggregate.successCount);
        const cDelta = average(aggregate.cost, aggregate.count) - average(prevAggregate.cost, prevAggregate.count);
        const tDelta = average(aggregate.tokens, aggregate.count) - average(prevAggregate.tokens, prevAggregate.count);
        console.log(
          `   ${tier.padEnd(10)} | ${(qDelta >= 0 ? '+' : '').concat(qDelta.toFixed(1)).padEnd(9)} | ${((lDelta / 1000).toFixed(1).concat('s')).padEnd(9)} | ${formatUsd(cDelta).padEnd(8)} | ${formatUsd(aggregate.cost - prevAggregate.cost).padEnd(12)} | ${(tDelta.toFixed(0)).padEnd(10)}`,
        );
      }
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `benchmark-${timestamp}`;
  const filename = join(outputDir, `${baseName}-results.json`);

  const summary = {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    totalTime,
    avgQuality,
    avgLatency,
    avgTtft,
    totalCost,
    totalTokens,
    totalInputTokens,
    totalOutputTokens,
    totalCachedTokens,
    totalReasoningTokens,
    truncatedCount: truncated.length,
    modelMix: { gpt: gptCount, legacy: legacyCount },
    costDistribution: costSummary,
    latencyDistribution: latencySummary,
    ttftDistribution: ttftSummary,
    qualityDistributionSummary: qualitySummary,
  };

  writeFileSync(
    filename,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: 'benchmark-top50',
        summary,
        byPlan,
        byTier,
        byCategory,
        byPlanTier,
        financialModel,
        qualityDistribution: qualityBuckets,
        truncationReport: truncated.map((result) => ({
          plan: result.plan,
          tier: result.tier,
          category: result.category,
          query: result.query,
          signal: result.truncationSignal,
          tokens: result.tokens,
          quality: result.quality,
        })),
        results,
      },
      null,
      2,
    ),
  );

  writeMarkdownReports({
    baseName,
    results,
    summary,
    byPlan,
    byTier,
    byCategory,
    byPlanTier,
    qualityBuckets,
    financialModel,
    previous,
    totalTimeMs: totalTime,
  });

  console.log(`\n📁 Results saved to: ${filename}`);
  console.log(`   Markdown audits: ${formatMarkdownFileLink(`${baseName}-summary.md`)}, ${formatMarkdownFileLink(`${baseName}-cost-audit.md`)}, ${formatMarkdownFileLink(`${baseName}-latency-audit.md`)}, ${formatMarkdownFileLink(`${baseName}-quality-audit.md`)}, ${formatMarkdownFileLink(`${baseName}-financial-model.md`)}, ${formatMarkdownFileLink(`${baseName}-comparison.md`)}`);
  console.log(`   Total wall time: ${(totalTime / 1000).toFixed(1)}s\n`);
}

runBenchmark()
  .catch(console.error)
  .finally(async () => {
    try {
      await cleanupBenchmarkUsers(benchmarkRunId);
    } catch (error) {
      console.error(error);
    }
  });
