#!/usr/bin/env tsx
/**
 * init-database.ts — Full Database Restoration Script
 * =====================================================
 * Restores the complete database from scratch using the asset manifest in
 * totalassets.md. Run this on a fresh DB or after a full reset.
 *
 * What it does (in order):
 *   Step 1  — Parse totalassets.md to get all 669 asset definitions
 *   Step 2  — Upsert all assets into DB (idempotent — safe to re-run)
 *   Step 3  — Seed sectors, themes, benchmarks (npm run db:seed)
 *   Step 4  — Harvest US stocks + ETFs + commodities (Yahoo Finance)
 *   Step 5  — Harvest crypto (CoinGecko)
 *   Step 6  — Harvest Indian stocks + ETFs (NSE India + Yahoo)
 *   Step 7  — Harvest Indian Mutual Funds NAV (MFAPI)
 *   Step 8  — Finnhub intelligence (news, insider, analyst, financials)
 *   Step 9  — Enrich US assets (descriptions, financials, ETF holdings)
 *   Step 10 — Enrich Indian stocks (NSE industry classification)
 *   Step 11 — Enrich Crypto (CoinGecko full metadata)
 *   Step 12 — Enrich Commodities (static metadata + Yahoo futures)
 *   Step 13 — Compute analytics: US (scores, regimes, dynamics)
 *   Step 14 — Compute analytics: IN (scores, regimes, dynamics)
 *   Step 15 — MF return calculations from NAV history
 *   Step 16 — Seed knowledge base (RAG embeddings)
 *   Step 17 — Seed discovery feed
 *   Step 18 — Generate Lyra trending questions + daily brief
 *   Step 19 — MF holdings via Moneycontrol (Playwright scraping)
 *
 * Usage:
 *   npx tsx scripts/init-database.ts                   # full init
 *   npx tsx scripts/init-database.ts --skip-seed       # skip db:seed (assets exist)
 *   npx tsx scripts/init-database.ts --skip-mc         # skip Moneycontrol scraping
 *   npx tsx scripts/init-database.ts --from-step 8     # resume from a specific step
 *   npx tsx scripts/init-database.ts --only-assets     # only upsert asset definitions
 *   npx tsx scripts/init-database.ts --dry-run         # show plan without executing
 *
 * Duration: ~25-40 minutes for full init (MC scraping adds ~30-60 min extra)
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { MarketSyncService } from "../src/lib/services/market-sync.service";
import { TrendingQuestionService } from "../src/lib/services/trending-question.service";
import { FinnhubSyncService } from "../src/lib/services/finnhub-sync.service";
import { DailyBriefingService } from "../src/lib/services/daily-briefing.service";
import { IntelligenceEventsService } from "../src/lib/services/intelligence-events.service";
import { syncCommodityPrices } from "../src/lib/services/metals-dev.service";
import { generateLyraIntel } from "./generate-lyra-intel";
import { directPrisma as prisma } from "../src/lib/prisma";
import { createLogger } from "../src/lib/logger";
import { sanitizeError } from "../src/lib/logger/utils";

const logger = createLogger({ service: "init-database" });

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const skipSeed = args.includes("--skip-seed");
const skipMC = args.includes("--skip-mc");
const dryRun = args.includes("--dry-run");
const onlyAssets = args.includes("--only-assets");
const fromStepArg = args.find(a => a.startsWith("--from-step="))?.split("=")[1]
  ?? (args[args.indexOf("--from-step") + 1]);
const fromStep = fromStepArg ? parseInt(fromStepArg, 10) : 1;

// ─── Asset Manifest Types ────────────────────────────────────────────────────

interface AssetDefinition {
  symbol: string;
  name: string;
  type: "STOCK" | "ETF" | "CRYPTO" | "COMMODITY" | "MUTUAL_FUND";
  region: string;
  sector?: string;
  coingeckoId?: string;
  currency?: string;
  schemeCode?: string; // MF AMFI code (extracted from symbol MF-XXXXXX)
}

// ─── Parse totalassets.md ────────────────────────────────────────────────────

function parseTotalAssets(filePath: string): AssetDefinition[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const assets: AssetDefinition[] = [];

  // ── India Stocks ──
  const inStocksMatch = content.match(/## 🇮🇳 India Stocks.*?\n([\s\S]*?)(?=\n---|\n## )/);
  if (inStocksMatch) {
    const rows = inStocksMatch[1].match(/\| ([A-Z0-9\-\.]+\.NS) \| (.+?) \| (.+?) \|/g) || [];
    for (const row of rows) {
      const m = row.match(/\| ([A-Z0-9\-\.]+\.NS) \| (.+?) \| (.+?) \|/);
      if (m) {
        assets.push({
          symbol: m[1].trim(),
          name: m[2].trim(),
          type: "STOCK",
          region: "IN",
          sector: m[3].trim(),
          currency: "INR",
        });
      }
    }
  }

  // ── US Stocks ──
  const usStocksMatch = content.match(/## 🇺🇸 US Stocks.*?\n([\s\S]*?)(?=\n---|\n## )/);
  if (usStocksMatch) {
    const rows = usStocksMatch[1].match(/\| ([A-Z0-9\-\.]+) \| (.+?) \| (.+?) \|/g) || [];
    for (const row of rows) {
      const m = row.match(/\| ([A-Z0-9\-\.]+) \| (.+?) \| (.+?) \|/);
      if (m && !m[1].includes(".NS")) {
        assets.push({
          symbol: m[1].trim(),
          name: m[2].trim(),
          type: "STOCK",
          region: "US",
          sector: m[3].trim(),
          currency: "USD",
        });
      }
    }
  }

  // ── ETFs ──
  const etfsMatch = content.match(/## ETFs.*?\n([\s\S]*?)(?=\n---|\n## )/);
  if (etfsMatch) {
    const rows = etfsMatch[1].match(/\| ([A-Z0-9\-\.]+(?:\.NS)?) \| (.+?) \| (US|IN) \|/g) || [];
    for (const row of rows) {
      const m = row.match(/\| ([A-Z0-9\-\.]+(?:\.NS)?) \| (.+?) \| (US|IN) \|/);
      if (m) {
        assets.push({
          symbol: m[1].trim(),
          name: m[2].trim(),
          type: "ETF",
          region: m[3].trim(),
          currency: m[3].trim() === "IN" ? "INR" : "USD",
        });
      }
    }
  }

  // ── Mutual Funds ──
  const mfMatch = content.match(/## 🇮🇳 Mutual Funds.*?\n([\s\S]*?)(?=\n---|\n## )/);
  if (mfMatch) {
    const rows = mfMatch[1].match(/\| (MF-\d+) \| (.+?) \|/g) || [];
    for (const row of rows) {
      const m = row.match(/\| (MF-\d+) \| (.+?) \|/);
      if (m) {
        const symbol = m[1].trim();
        const schemeCode = symbol.replace("MF-", "");
        assets.push({
          symbol,
          name: m[2].trim(),
          type: "MUTUAL_FUND",
          region: "IN",
          currency: "INR",
          schemeCode,
        });
      }
    }
  }

  // ── Crypto ──
  const cryptoMatch = content.match(/## Crypto.*?\n([\s\S]*?)(?=\n---|\n## )/);
  if (cryptoMatch) {
    const rows = cryptoMatch[1].match(/\| ([A-Z0-9\-]+\-USD) \| (.+?) \|/g) || [];
    for (const row of rows) {
      const m = row.match(/\| ([A-Z0-9\-]+\-USD) \| (.+?) \|/);
      if (m) {
        // Derive coingeckoId from symbol (BTC-USD → bitcoin, ETH-USD → ethereum, etc.)
        const cgId = COINGECKO_ID_MAP[m[1].trim()] ?? m[1].trim().replace("-USD", "").toLowerCase();
        assets.push({
          symbol: m[1].trim(),
          name: m[2].trim(),
          type: "CRYPTO",
          region: "US",
          currency: "USD",
          coingeckoId: cgId,
        });
      }
    }
  }

  // ── Commodities ──
  const commMatch = content.match(/## Commodities.*?\n([\s\S]*?)(?=\n---|\n## |$)/);
  if (commMatch) {
    const rows = commMatch[1].match(/\| ([A-Z]+=F) \| (.+?) \|/g) || [];
    for (const row of rows) {
      const m = row.match(/\| ([A-Z]+=F) \| (.+?) \|/);
      if (m) {
        assets.push({
          symbol: m[1].trim(),
          name: m[2].trim(),
          type: "COMMODITY",
          region: "US",
          currency: "USD",
        });
      }
    }
  }

  return assets;
}

// CoinGecko ID map for all 49 crypto assets
const COINGECKO_ID_MAP: Record<string, string> = {
  "AAVE-USD": "aave",
  "ADA-USD": "cardano",
  "ALGO-USD": "algorand",
  "APT-USD": "aptos",
  "ARB-USD": "arbitrum",
  "ATOM-USD": "cosmos",
  "AVAX-USD": "avalanche-2",
  "AXS-USD": "axie-infinity",
  "BCH-USD": "bitcoin-cash",
  "BNB-USD": "binancecoin",
  "BTC-USD": "bitcoin",
  "CRV-USD": "curve-dao-token",
  "DOGE-USD": "dogecoin",
  "DOT-USD": "polkadot",
  "ETC-USD": "ethereum-classic",
  "ETH-USD": "ethereum",
  "FET-USD": "fetch-ai",
  "FIL-USD": "filecoin",
  "FTM-USD": "fantom",
  "GRT-USD": "the-graph",
  "HBAR-USD": "hedera-hashgraph",
  "ICP-USD": "internet-computer",
  "IMX-USD": "immutable-x",
  "INJ-USD": "injective-protocol",
  "LDO-USD": "lido-dao",
  "LINK-USD": "chainlink",
  "LTC-USD": "litecoin",
  "MANA-USD": "decentraland",
  "MKR-USD": "maker",
  "NEAR-USD": "near",
  "OP-USD": "optimism",
  "PEPE-USD": "pepe",
  "RENDER-USD": "render-token",
  "RUNE-USD": "thorchain",
  "SAND-USD": "the-sandbox",
  "SEI-USD": "sei-network",
  "SHIB-USD": "shiba-inu",
  "SOL-USD": "solana",
  "STX-USD": "blockstack",
  "SUI-USD": "sui",
  "THETA-USD": "theta-token",
  "TIA-USD": "celestia",
  "TON-USD": "the-open-network",
  "TRX-USD": "tron",
  "UNI-USD": "uniswap",
  "VET-USD": "vechain",
  "WIF-USD": "dogwifcoin",
  "XLM-USD": "stellar",
  "XRP-USD": "ripple",
};

// ─── Step Runner ─────────────────────────────────────────────────────────────

interface StepResult {
  step: number;
  name: string;
  status: "done" | "skipped" | "failed";
  duration: number;
  detail?: string;
}

async function runStep(
  step: number,
  name: string,
  fn: () => Promise<string | void>,
): Promise<StepResult> {
  if (step < fromStep) {
    logger.info({ step, name }, `⏭️  Step ${step} skipped (--from-step ${fromStep})`);
    return { step, name, status: "skipped", duration: 0, detail: `Skipped (before --from-step ${fromStep})` };
  }

  if (onlyAssets && step > 2) {
    logger.info({ step }, `⏭️  Step ${step} skipped (--only-assets)`);
    return { step, name, status: "skipped", duration: 0 };
  }

  logger.info({ step, name }, `▶️  Step ${step}: ${name}`);
  const start = Date.now();

  if (dryRun) {
    console.log(`   [DRY RUN] Would execute: ${name}`);
    return { step, name, status: "skipped", duration: 0, detail: "dry-run" };
  }

  try {
    const detail = await fn();
    const duration = Date.now() - start;
    logger.info({ step, name, duration: `${(duration / 1000).toFixed(1)}s`, detail }, `✅ Step ${step} complete`);
    return { step, name, status: "done", duration, detail: detail ?? undefined };
  } catch (err) {
    const duration = Date.now() - start;
    const error = String(sanitizeError(err));
    logger.error({ step, name, err: error }, `❌ Step ${step} failed`);
    return { step, name, status: "failed", duration, detail: error };
  }
}

function runCmd(cmd: string, label?: string): void {
  logger.info({ cmd: label ?? cmd }, "Running command");
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const globalStart = Date.now();
  const totalAssetsPath = path.join(process.cwd(), "totalassets.md");

  logger.info({
    fromStep,
    skipSeed,
    skipMC,
    dryRun,
    onlyAssets,
  }, "🚀 Database Initialization starting");

  if (!fs.existsSync(totalAssetsPath)) {
    logger.error({ path: totalAssetsPath }, "totalassets.md not found — cannot proceed");
    process.exit(1);
  }

  const results: StepResult[] = [];

  // ── Step 1: Parse + Upsert Asset Definitions ─────────────────────────────
  results.push(await runStep(1, "Parse totalassets.md + Upsert all 669 asset definitions", async () => {
    const assets = parseTotalAssets(totalAssetsPath);
    logger.info({ count: assets.length }, "Parsed asset definitions from totalassets.md");

    if (assets.length < 600) {
      throw new Error(`Only parsed ${assets.length} assets — expected ~669. Check totalassets.md format.`);
    }

    // Batch upsert in chunks of 50
    const CHUNK = 50;
    let upserted = 0;
    let created = 0;

    for (let i = 0; i < assets.length; i += CHUNK) {
      const chunk = assets.slice(i, i + CHUNK);
      await Promise.all(chunk.map(async (a) => {
        const existing = await prisma.asset.findUnique({ where: { symbol: a.symbol }, select: { id: true } });
        const baseData = {
          name: a.name,
          type: a.type as never,
          region: a.region,
          currency: a.currency ?? "USD",
          ...(a.sector ? { sector: a.sector } : {}),
          ...(a.coingeckoId ? { coingeckoId: a.coingeckoId } : {}),
        };

        if (existing) {
          // Only update identity fields — never overwrite prices/scores
          await prisma.asset.update({
            where: { symbol: a.symbol },
            data: {
              name: a.name,
              region: a.region,
              ...(a.sector ? { sector: a.sector } : {}),
              ...(a.coingeckoId ? { coingeckoId: a.coingeckoId } : {}),
            },
          });
        } else {
          await prisma.asset.create({ data: { symbol: a.symbol, ...baseData } });
          created++;
        }
        upserted++;
      }));
    }

    return `${upserted} upserted (${created} new, ${upserted - created} updated)`;
  }));

  // ── Step 2: Seed DB (sectors, themes, benchmarks) ────────────────────────
  if (!skipSeed) {
    results.push(await runStep(2, "Seed DB (sectors, themes, index benchmarks)", async () => {
      runCmd("npm run db:seed", "db:seed");
      runCmd("npx tsx scripts/seed-index-benchmarks.ts", "seed-index-benchmarks");
      return "Seed complete";
    }));
  } else {
    results.push({ step: 2, name: "Seed DB", status: "skipped", duration: 0, detail: "--skip-seed" });
  }

  // ── Step 3: Verify asset count ────────────────────────────────────────────
  results.push(await runStep(3, "Verify asset universe", async () => {
    const count = await prisma.asset.count();
    if (count < 600) {
      throw new Error(`Only ${count} assets in DB — expected ≥600. Check seed + upsert.`);
    }
    return `${count} assets verified`;
  }));

  // ── Step 4: US Market Data (Yahoo Finance) ────────────────────────────────
  results.push(await runStep(4, "Harvest US stocks + ETFs + commodities (Yahoo Finance)", async () => {
    await MarketSyncService.harvestUniverse(true, undefined, "US", {
      excludeCrypto: true,
      skipLegacyNews: true,
    });
    return "US harvest complete";
  }));

  // ── Step 5: Crypto (CoinGecko) ────────────────────────────────────────────
  results.push(await runStep(5, "Harvest Crypto (CoinGecko)", async () => {
    await MarketSyncService.runCryptoMarketSync();
    return "Crypto harvest complete";
  }));

  // ── Step 6: Indian Stocks + ETFs (NSE India + Yahoo) ─────────────────────
  results.push(await runStep(6, "Harvest Indian stocks + ETFs (NSE India + Yahoo)", async () => {
    await MarketSyncService.harvestUniverse(true, undefined, "IN", {
      excludeCrypto: true,
      skipLegacyNews: true,
      skipIndianMutualFunds: true,
    });
    await MarketSyncService.harvestIndianStocks();
    return "IN stocks harvest complete";
  }));

  // ── Step 7: Indian Mutual Funds NAV (MFAPI) ───────────────────────────────
  results.push(await runStep(7, "Harvest Indian Mutual Funds NAV (MFAPI)", async () => {
    await MarketSyncService.harvestUniverse(true, undefined, "IN", {
      excludeCrypto: true,
      skipLegacyNews: true,
    });
    return "MF NAV harvest complete";
  }));

  // ── Step 8: Finnhub Intelligence ─────────────────────────────────────────
  results.push(await runStep(8, "Finnhub: news, insider, analyst, financials, ETF data", async () => {
    await FinnhubSyncService.syncAll(true);
    return "Finnhub sync complete";
  }));

  // ── Step 9: Enrich US Assets (Yahoo extended data) ───────────────────────
  results.push(await runStep(9, "Enrich US stocks + ETFs (descriptions, financials, holdings)", async () => {
    runCmd("npx tsx scripts/enrich-us-assets.ts", "enrich-us-assets");
    return "US enrichment complete";
  }));

  // ── Step 10: Enrich Indian Stocks (NSE industry classification) ───────────
  results.push(await runStep(10, "Enrich Indian stocks (NSE industry classification)", async () => {
    runCmd("npx tsx scripts/enrich-in-stocks.ts", "enrich-in-stocks");
    return "IN stocks enrichment complete";
  }));

  // ── Step 11: Enrich Crypto (CoinGecko full metadata) ─────────────────────
  results.push(await runStep(11, "Enrich Crypto (CoinGecko full metadata)", async () => {
    runCmd("npx tsx scripts/enrich-crypto-coingecko.ts", "enrich-crypto-coingecko");
    return "Crypto enrichment complete";
  }));

  // ── Step 12: Enrich Commodities (static metadata + Yahoo futures) ───────────
  results.push(await runStep(12, "Enrich Commodities (static metadata + Yahoo futures)", async () => {
    runCmd("npx tsx scripts/enrich-commodity-futures.ts", "enrich-commodity-futures");
    return "Commodity enrichment complete";
  }));

  // ── Step 13: Commodity Prices (Metals.Dev — LBMA/MCX/IBJA for GC=F, SI=F) ─
  results.push(await runStep(13, "Commodity Prices (Metals.Dev — LBMA/MCX/IBJA)", async () => {
    const result = await syncCommodityPrices();
    return result.success ? `${result.updated} commodities updated` : "Metals.Dev unavailable — skipped";
  }));

  // ── Step 14: Compute US Analytics ────────────────────────────────────────
  results.push(await runStep(14, "Compute US analytics (scores, regimes, dynamics)", async () => {
    await MarketSyncService.computeFullAnalytics(true, "US");
    return "US analytics complete";
  }));

  // ── Step 15: Compute IN Analytics ────────────────────────────────────────
  results.push(await runStep(15, "Compute IN analytics (scores, regimes, dynamics)", async () => {
    await MarketSyncService.computeFullAnalytics(true, "IN");
    return "IN analytics complete";
  }));

  // ── Step 16: MF Return Calculations ──────────────────────────────────────
  results.push(await runStep(16, "Compute MF returns from NAV history (1Y, 3Y, 5Y, YTD)", async () => {
    runCmd("npx tsx scripts/enrich-mutual-funds.ts", "enrich-mutual-funds");
    return "MF returns computed";
  }));

  // ── Step 17: Knowledge Base (RAG embeddings) ──────────────────────────────
  results.push(await runStep(17, "Seed knowledge base (RAG embeddings for Lyra)", async () => {
    runCmd("npx tsx scripts/reingest-knowledge.ts --force", "reingest-knowledge");
    return "Knowledge base seeded";
  }));

  // ── Step 18: Discovery Feed ───────────────────────────────────────────────
  results.push(await runStep(18, "Seed discovery feed (DRS computation)", async () => {
    const { computeDiscoveryFeed } = await import("../src/lib/services/discovery-intelligence.service");
    const result = await computeDiscoveryFeed();
    return `${result.surfaced} items surfaced`;
  }));

  // ── Step 19: Daily Market Briefing (US + IN) ──────────────────────────────
  results.push(await runStep(19, "Generate daily market briefings (US + IN)", async () => {
    await DailyBriefingService.generateBriefings();
    return "Daily briefings generated";
  }));

  // ── Step 20: Lyra AI Content ──────────────────────────────────────────────
  results.push(await runStep(20, "Generate Lyra trending questions + daily brief", async () => {
    await TrendingQuestionService.refreshTrendingQuestions();
    await generateLyraIntel();
    return "Lyra content generated";
  }));

  // ── Step 21: MF Holdings via Moneycontrol (optional, slow) ───────────────
  if (!skipMC) {
    results.push(await runStep(21, "MF holdings via Moneycontrol scraping (Playwright)", async () => {
      runCmd("npx tsx scripts/sync-mf-holdings.ts --force", "sync-mf-holdings");
      return "MF holdings scraped";
    }));
  } else {
    results.push({ step: 21, name: "MF Holdings (Moneycontrol)", status: "skipped", duration: 0, detail: "--skip-mc" });
    logger.info("⏭️  Step 21: MF Holdings skipped (--skip-mc). Run manually: npx tsx scripts/sync-mf-holdings.ts --force");
  }

  // ── Step 22: Housekeeping — prune stale intelligence events ──────────────
  results.push(await runStep(22, "Prune stale intelligence events", async () => {
    await IntelligenceEventsService.pruneStaleData();
    return "Stale events pruned";
  }));

  // ─── Final Verification ───────────────────────────────────────────────────

  const [
    totalAssets,
    withPrices,
    withScores,
    withPerformance,
    withDynamics,
    withDescriptions,
    freshScoresToday,
  ] = await Promise.all([
    prisma.asset.count(),
    prisma.asset.count({ where: { price: { not: null } } }),
    prisma.asset.count({ where: { avgTrustScore: { not: null } } }),
    prisma.asset.count({ where: { performanceData: { not: { equals: null } } } }),
    prisma.asset.count({ where: { scoreDynamics: { not: { equals: null } } } }),
    prisma.asset.count({ where: { description: { not: null } } }),
    prisma.assetScore.count({ where: { date: { gte: new Date(new Date().toISOString().split("T")[0]) } } }),
  ]);

  const totalDuration = ((Date.now() - globalStart) / 1000 / 60).toFixed(1);
  const failed = results.filter(r => r.status === "failed");
  const done = results.filter(r => r.status === "done");
  const skipped = results.filter(r => r.status === "skipped");

  console.log(`
╔══════════════════════════════════════════════════╗
║          DATABASE INITIALIZATION COMPLETE        ║
╠══════════════════════════════════════════════════╣
║  Total Assets:        ${String(totalAssets).padEnd(26)}║
║  With Prices:         ${String(withPrices).padEnd(26)}║
║  With Scores:         ${String(withScores).padEnd(26)}║
║  With Performance:    ${String(withPerformance).padEnd(26)}║
║  With Dynamics:       ${String(withDynamics).padEnd(26)}║
║  With Descriptions:   ${String(withDescriptions).padEnd(26)}║
║  Fresh Scores Today:  ${String(freshScoresToday).padEnd(26)}║
╠══════════════════════════════════════════════════╣
║  Steps Done:    ${String(done.length).padEnd(32)}║
║  Steps Skipped: ${String(skipped.length).padEnd(32)}║
║  Steps Failed:  ${String(failed.length).padEnd(32)}║
║  Duration:      ${String(totalDuration + " min").padEnd(32)}║
╚══════════════════════════════════════════════════╝`);

  if (failed.length > 0) {
    console.error("\n❌ Failed steps:");
    for (const f of failed) {
      console.error(`   Step ${f.step} (${f.name}): ${f.detail}`);
    }
    console.error("\nTo resume from a failed step, run:");
    console.error(`   npx tsx scripts/init-database.ts --from-step ${failed[0].step} --skip-seed`);
  } else {
    console.log("\n✅ Database fully initialized. Run daily sync with:");
    console.log("   npx tsx scripts/daily-sync.ts");
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  logger.error({ err: sanitizeError(err) }, "❌ Init Database fatal error");
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect().catch(() => {});
});
