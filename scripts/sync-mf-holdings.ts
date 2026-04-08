#!/usr/bin/env tsx
/**
 * Sync MF Holdings & Rich Metadata from Moneycontrol via Playwright.
 * 
 * For each of our 105 Indian Mutual Funds:
 * 1. Search Moneycontrol to discover the fund's MC code & URL
 * 2. Scrape NAV page for rich metadata (AUM, expense ratio, Sharpe, etc.)
 * 3. Scrape Holdings page for portfolio data (top holdings, sectors)
 * 4. Transform & persist to DB (topHoldings + enriched metadata)
 * 
 * Usage:
 *   npx tsx scripts/sync-mf-holdings.ts              # Sync all stale MFs
 *   npx tsx scripts/sync-mf-holdings.ts --force       # Force sync all MFs
 *   npx tsx scripts/sync-mf-holdings.ts --limit 5     # Sync first N MFs only
 *   npx tsx scripts/sync-mf-holdings.ts --symbol MF-119598  # Sync single MF
 */

import { chromium, type Browser, type Page } from "playwright";
import { prisma } from "../src/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  extractHoldingsFromPage,
  extractFundMetadata,
  transformToTopHoldings,
  persistHoldings,
  buildSearchQuery,
  MFHoldingsScraperService,
} from "../src/lib/services/mf-holdings-scraper.service";

// ─── CLI Args ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const force = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;
const symbolIdx = args.indexOf("--symbol");
const targetSymbol = symbolIdx !== -1 ? args[symbolIdx + 1] : undefined;

// ─── Constants ────────────────────────────────────────────────────────

const MC_BASE = "https://www.moneycontrol.com";
const DELAY_BETWEEN_FUNDS = 3000; // 3s between funds to avoid rate limiting

// ─── Stats ────────────────────────────────────────────────────────────

const stats = {
  total: 0,
  scraped: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  metadataEnriched: 0,
};

// ─── MC Code Override Map ─────────────────────────────────────────────
// Hardcoded MC codes for funds that MC's search API can't find correctly.
// These are funds renamed by SEBI recategorization (Bluechip→Large Cap),
// funds with generic names (Top 100, Principal), or AMC name mismatches.

const MC_CODE_OVERRIDES: Record<string, { mcCode: string; slug: string }> = {
  // "Frontline Equity" → "Large Cap" after SEBI recategorization
  "MF-103135": { mcCode: "MAC031", slug: "aditya-birla-sun-life-large-cap-fund-regular-plan-growth" }, // ABSL Frontline Equity → ABSL Large Cap

  // "Bluechip" funds → MC calls them "Large Cap" after SEBI recategorization
  "MF-119551": { mcCode: "MAA181", slug: "axis-large-cap-fund-direct-plan-growth" },           // Axis Bluechip → Axis Large Cap Direct
  "MF-102885": { mcCode: "MSB079", slug: "sbi-large-cap-fund-regular-plan-growth" },            // SBI Bluechip → SBI Large Cap Regular
  "MF-100234": { mcCode: "MKM514", slug: "kotak-large-cap-fund-direct-plan-growth" },           // Kotak Bluechip → Kotak Large Cap Direct
  "MF-120503": { mcCode: "MKM514", slug: "kotak-large-cap-fund-direct-plan-growth" },           // Kotak Bluechip Direct → Kotak Large Cap Direct
  "MF-112000": { mcCode: "MKP001", slug: "franklin-india-large-cap-fund-growth" },              // Franklin India Bluechip → Franklin India Large Cap
  "MF-120468": { mcCode: "MCA212", slug: "canara-robeco-large-cap-fund-direct-plan-growth" },   // Canara Robeco Bluechip → Canara Robeco Large Cap Direct

  // "Top 100" funds → renamed or merged
  "MF-119076": { mcCode: "MDS590", slug: "dsp-flexi-cap-fund-direct-plan-growth" },             // DSP Top 100 Equity → DSP Flexi Cap (merged)
  "MF-102594": { mcCode: "MHD1169", slug: "hdfc-large-cap-fund-direct-plan-growth" },           // HDFC Top 100 → HDFC Large Cap Direct

  // AMC name mismatches
  "MF-115000": { mcCode: "MAG725", slug: "bandhan-large-cap-fund-direct-plan-growth" },         // L&T India Large Cap → Bandhan Large Cap (L&T MF acquired by Bandhan)
  "MF-120000": { mcCode: "MSN1539", slug: "sundaram-large-cap-fund-direct-plan-growth" },       // Principal Large Cap → Sundaram Large Cap (Principal acquired by Sundaram)
  "MF-133000": { mcCode: "MPP002", slug: "parag-parikh-flexi-cap-fund-direct-plan-growth" },    // PPFAS Flexi Cap → Parag Parikh Flexi Cap
  "MF-100523": { mcCode: "MUT101", slug: "uti-master-equity-plan-unit-scheme" },                // UTI Mastershare Unit Scheme

  // ETFs and debt funds (not in regular equity search)
  "MF-146000": { mcCode: "MMO003", slug: "motilal-oswal-nasdaq-100-etf" },                       // Motilal Oswal Nasdaq 100 ETF
  "MF-119277": { mcCode: "MHD1221", slug: "hdfc-short-term-debt-fund-direct-plan" },            // HDFC Short Term Debt Fund Direct
  "MF-120837": { mcCode: "MSB493", slug: "sbi-magnum-medium-duration-fund-direct-plan" },       // SBI Magnum Medium Duration Fund Direct

  // SEBI renamed funds (Bluechip → Large Cap, Emerging Equity → Midcap)
  "MF-101500": { mcCode: "MAA009", slug: "axis-large-cap-fund-regular-plan" },                  // Axis Bluechip → Axis Large Cap
  "MF-101800": { mcCode: "MAA011", slug: "axis-long-term-equity-fund-growth" },                 // Axis Long Term Equity (ELSS)
  "MF-103300": { mcCode: "MKM099", slug: "kotak-emerging-equity-fund-growth" },                 // Kotak Emerging Equity → Kotak Midcap
  "MF-103500": { mcCode: "MKM311", slug: "kotak-flexicap-fund-regular-plan" },                  // Kotak Flexicap Fund
  "MF-122639": { mcCode: "MKM520", slug: "kotak-flexicap-fund-direct-plan" },                   // Kotak Flexicap Fund Direct
  "MF-118834": { mcCode: "MMA088", slug: "mirae-asset-emerging-bluechip-fund" },                // Mirae Asset Emerging Bluechip → Large & Midcap
  "MF-120505": { mcCode: "MKM099", slug: "kotak-emerging-equity-fund-direct-plan" },            // Kotak Emerging Equity Direct

  // Funds with generic names
  "MF-200000": { mcCode: "MDS1531", slug: "dsp-nifty-50-index-fund-direct-growth" },            // Nifty 50 Index Fund → DSP Nifty 50 Index
  "MF-128000": { mcCode: "MCM130", slug: "taurus-large-cap-fund-direct-plan-growth" },          // Taurus Largecap Equity
  "MF-117000": { mcCode: "MUK106", slug: "union-largecap-fund-direct-plan-growth" },            // Union Largecap Fund
};

// ─── Fund House Extraction ────────────────────────────────────────────

const FUND_HOUSE_ALIASES: Record<string, string> = {
  "aditya birla sun life": "aditya birla sun life",
  "absl": "aditya birla sun life",
  "axis": "axis",
  "bank of india": "bank of india",
  "canara robeco": "canara robeco",
  "dsp": "dsp",
  "edelweiss": "edelweiss",
  "franklin india": "franklin india",
  "franklin": "franklin india",
  "hdfc": "hdfc",
  "hsbc": "hsbc",
  "icici prudential": "icici prudential",
  "icici pru": "icici prudential",
  "invesco india": "invesco india",
  "invesco": "invesco india",
  "jm": "jm",
  "kotak": "kotak",
  "l&t": "l t",
  "mirae asset": "mirae asset",
  "motilal oswal": "motilal oswal",
  "nippon india": "nippon india",
  "nippon": "nippon india",
  "parag parikh": "parag parikh",
  "ppfas": "parag parikh",
  "principal": "principal",
  "quant": "quant",
  "sbi": "sbi",
  "sundaram": "sundaram",
  "tata": "tata",
  "taurus": "taurus",
  "union": "union",
  "uti": "uti",
  "nifty": "nifty",
};

function extractFundHouse(fundName: string): string {
  const lower = fundName.toLowerCase();
  // Try longest match first (e.g., "aditya birla sun life" before "aditya")
  const sorted = Object.keys(FUND_HOUSE_ALIASES).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (lower.startsWith(prefix)) {
      return FUND_HOUSE_ALIASES[prefix];
    }
  }
  // Fallback: first word(s) before common keywords
  const match = lower.match(/^(.+?)\s+(?:large|mid|small|flexi|multi|balanced|blue|nifty|index|liquid|short|gilt|corporate|tax|value|focus|dynamic|equity|arbitrage|dividend|infrastructure|pharma|fmcg|technology|commodit|banking|us\s|healthcare|natural|top\s)/);
  if (match) return match[1].trim();
  // Last resort: first two words
  return lower.split(/\s+/).slice(0, 2).join(" ");
}

// ─── Search Moneycontrol for Fund URL ─────────────────────────────────

interface MCFundInfo {
  navUrl: string;
  holdingsUrl: string;
  mcCode: string;
  slug: string;
}

async function discoverFundUrl(page: Page, fundName: string, symbol: string): Promise<MCFundInfo | null> {
  try {
    // Check hardcoded overrides first (for funds MC search can't find)
    const override = MC_CODE_OVERRIDES[symbol];
    if (override) {
      console.log(`  📌 Using override: ${override.mcCode} (${override.slug})`);
      return {
        navUrl: `${MC_BASE}/mutual-funds/nav/${override.slug}/${override.mcCode}`,
        holdingsUrl: `${MC_BASE}/mutual-funds/${override.slug}/portfolio-holdings/${override.mcCode}`,
        mcCode: override.mcCode,
        slug: override.slug,
      };
    }

    const searchQuery = buildSearchQuery(fundName);
    const fundHouse = extractFundHouse(fundName);

    // Small delay before API call to avoid rate limiting
    await page.waitForTimeout(500);

    // NOTE: No TypeScript annotations inside page.evaluate — code runs in browser context
    // where tsx-compiled __name helpers don't exist
    const result = await page.evaluate(async (args) => {
      const query = args.query;
      const house = args.house;
      const originalName = args.originalName;
      const apiUrl = "https://www.moneycontrol.com/mccode/common/autosuggestion_solr.php/?classic=true&query=" + encodeURIComponent(query) + "&type=2&format=json&main=true";
      try {
        const resp = await fetch(apiUrl);
        const data = await resp.json();
        if (!Array.isArray(data) || data.length === 0) return null;

        const scored = [];
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          const name = item.pdt_dis_nm || item.sc_name || "";
          const link = item.link_src || "";
          if (link.indexOf("/mutual-funds/nav/") === -1) continue;

          const nameL = name.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/  +/g, " ").trim();
          const houseL = house.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/  +/g, " ").trim();
          const origL = originalName.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/  +/g, " ").trim();

          // Must match fund house
          if (nameL.indexOf(houseL) !== 0) continue;
          let score = 50;

          if (nameL.indexOf("direct") !== -1 && nameL.indexOf("growth") !== -1) score += 20;
          else if (nameL.indexOf("growth") !== -1) score += 10;

          // Word matching — exclude fund house words (already validated by startsWith)
          const houseWords = houseL.split(" ");
          const words = origL.split(" ").filter(function(w) { return w.length > 2 && ["fund","direct","growth","plan","regular"].indexOf(w) === -1 && houseWords.indexOf(w) === -1; });
          let matched = 0;
          for (let j = 0; j < words.length; j++) {
            if (nameL.indexOf(words[j]) !== -1) matched++;
          }
          if (words.length > 0) score += (matched / words.length) * 30;

          const fullLink = link.indexOf("http") === 0 ? link : "https://www.moneycontrol.com" + link;
          scored.push({ link: fullLink, name: name, score: score });
        }

        scored.sort(function(a, b) { return b.score - a.score; });
        if (scored.length > 0 && scored[0].score >= 60) {
          return { link: scored[0].link, matchedName: scored[0].name, score: scored[0].score };
        }
        return null;
      } catch {
        return null;
      }
    }, { query: searchQuery, house: fundHouse, originalName: fundName });

    if (!result) {
      console.log(`  ⚠️  No MC URL found for: ${fundName} (house: "${fundHouse}")`);
      return null;
    }

    console.log(`  🎯 Matched: "${result.matchedName}" (score: ${result.score.toFixed(0)})`);

    // Parse the URL to extract MC code and slug
    // URL format: https://www.moneycontrol.com/mutual-funds/nav/{slug}/{MC_CODE}
    const urlMatch = result.link.match(/\/mutual-funds\/nav\/([^/]+)\/([A-Z0-9]+)$/);
    if (!urlMatch) {
      console.log(`  ⚠️  Could not parse MC URL: ${result.link}`);
      return null;
    }

    const slug = urlMatch[1];
    const mcCode = urlMatch[2];

    return {
      navUrl: `${MC_BASE}/mutual-funds/nav/${slug}/${mcCode}`,
      holdingsUrl: `${MC_BASE}/mutual-funds/${slug}/portfolio-holdings/${mcCode}`,
      mcCode,
      slug,
    };
  } catch (error) {
    console.log(`  ❌ Search failed for: ${fundName} — ${(error as Error).message}`);
    return null;
  }
}

// ─── Scrape Single Fund ───────────────────────────────────────────────

async function scrapeFund(
  page: Page,
  asset: { id: string; symbol: string; name: string; metadata: unknown; topHoldings: unknown; category: string | null },
  fundInfo: MCFundInfo
): Promise<{ holdings: boolean; metadata: boolean }> {
  const result = { holdings: false, metadata: false };

  // Step 1: Scrape NAV page for rich metadata
  try {
    await page.goto(fundInfo.navUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000); // Let dynamic content load

    const richMeta = await extractFundMetadata(page);
    
    if (richMeta.aumCr || richMeta.expenseRatioPct || richMeta.fundManagers) {
      // Persist rich metadata
      const existingMeta = (asset.metadata as Record<string, unknown>) || {};
      const updatedMeta: Record<string, unknown> = {
        ...existingMeta,
        mcCode: fundInfo.mcCode,
        mcSlug: fundInfo.slug,
        ...(richMeta.aumCr && { aumCr: richMeta.aumCr }),
        ...(richMeta.expenseRatioPct && { expenseRatioPct: richMeta.expenseRatioPct }),
        ...(richMeta.sharpeRatio && { sharpeRatio: richMeta.sharpeRatio }),
        ...(richMeta.standardDeviation && { standardDeviation: richMeta.standardDeviation }),
        ...(richMeta.beta && { beta: richMeta.beta }),
        ...(richMeta.portfolioTurnover && { portfolioTurnover: richMeta.portfolioTurnover }),
        ...(richMeta.fundManagers && { fundManagers: richMeta.fundManagers }),
        ...(richMeta.benchmark && { benchmark: richMeta.benchmark }),
        ...(richMeta.launchDate && { launchDate: richMeta.launchDate }),
        _metaScrapedAt: new Date().toISOString(),
      };

      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          metadata: updatedMeta as Prisma.InputJsonValue,
          // Set marketCap from AUM (AUM in Cr → absolute value as string)
          ...(richMeta.aumCr && { marketCap: String(richMeta.aumCr * 10_000_000) }),
        },
      });

      result.metadata = true;
      stats.metadataEnriched++;
      console.log(`  📊 Metadata: AUM ₹${richMeta.aumCr?.toLocaleString()}Cr | ER ${richMeta.expenseRatioPct}% | Sharpe ${richMeta.sharpeRatio}`);
    }
  } catch (error) {
    console.log(`  ⚠️  Metadata scrape failed: ${(error as Error).message}`);
  }

  // Step 2: Scrape Holdings page
  try {
    await page.goto(fundInfo.holdingsUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000); // Holdings table needs more time

    const rawHoldings = await extractHoldingsFromPage(page);
    
    if (rawHoldings && rawHoldings.holdings.length > 0) {
      const topHoldings = transformToTopHoldings(rawHoldings);
      
      // Add scrape timestamp
      const withTimestamp = {
        ...topHoldings,
        _scrapedAt: new Date().toISOString(),
        _source: "moneycontrol",
        _meta: rawHoldings.meta,
      };

      const updated = await persistHoldings(
        asset.id,
        asset.symbol,
        withTimestamp,
        asset.topHoldings
      );

      if (updated) {
        result.holdings = true;
        stats.updated++;
        console.log(`  📦 Holdings: ${rawHoldings.holdings.length} stocks | Top: ${rawHoldings.holdings[0]?.name} (${rawHoldings.holdings[0]?.weightPct}%)`);
      } else {
        stats.skipped++;
        console.log(`  ⏭️  Holdings unchanged`);
      }
    } else {
      console.log(`  ⚠️  No holdings data found on page`);
    }
  } catch (error) {
    console.log(`  ⚠️  Holdings scrape failed: ${(error as Error).message}`);
  }

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔍 MF Holdings & Metadata Sync via Moneycontrol");
  console.log(`   Force: ${force} | Limit: ${limit || "ALL"} | Symbol: ${targetSymbol || "ALL"}\n`);

  const startTime = Date.now();

  // Get all MF assets
  let assets = await MFHoldingsScraperService.getMFAssets();
  stats.total = assets.length;

  // Filter by symbol if specified
  if (targetSymbol) {
    assets = assets.filter((a) => a.symbol === targetSymbol);
    if (assets.length === 0) {
      console.log(`❌ No MF found with symbol: ${targetSymbol}`);
      process.exit(1);
    }
  }

  // Filter stale only (unless --force)
  if (!force) {
    assets = assets.filter((a) => MFHoldingsScraperService.isStale(a.topHoldings));
    console.log(`   ${assets.length} MFs need updating (${stats.total - assets.length} are fresh)\n`);
  }

  // Apply limit
  if (limit) {
    assets = assets.slice(0, limit);
  }

  if (assets.length === 0) {
    console.log("✅ All MFs are up to date. Use --force to re-scrape.");
    await prisma.$disconnect();
    return;
  }

  // Launch browser
  console.log("🌐 Launching headless browser...\n");
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: false, // Headed mode required — MC blocks headless browsers
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-position=-2400,-2400"],
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Block unnecessary resources for speed
    await page.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,ico}", (route) => route.abort());
    await page.route("**/ads/**", (route) => route.abort());
    await page.route("**/analytics/**", (route) => route.abort());
    await page.route("**/googletag*", (route) => route.abort());
    await page.route("**/doubleclick*", (route) => route.abort());

    // Navigate to a known MC NAV page to establish session (has the working search bar)
    await page.goto(`${MC_BASE}/mutual-funds/nav/sbi-nifty-index-fund/MSB052`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(3000);

    // Process each fund
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const progress = `[${i + 1}/${assets.length}]`;
      console.log(`${progress} ${asset.symbol} — ${asset.name}`);

      // Step 1: Discover MC URL via search
      const fundInfo = await discoverFundUrl(page, asset.name || asset.symbol, asset.symbol);
      if (!fundInfo) {
        stats.failed++;
        console.log(`  ❌ Could not find on Moneycontrol\n`);
        continue;
      }
      console.log(`  🔗 MC Code: ${fundInfo.mcCode}`);

      // Step 2: Scrape fund data
      const result = await scrapeFund(page, asset, fundInfo);
      
      if (!result.holdings && !result.metadata) {
        stats.failed++;
      } else {
        stats.scraped++;
      }

      console.log("");

      // Rate limiting delay
      if (i < assets.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_FUNDS));
      }
    }

    await context.close();
  } catch (error) {
    console.error("❌ Fatal error:", (error as Error).message);
  } finally {
    if (browser) await browser.close();
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n" + "═".repeat(60));
  console.log("📊 MF Holdings Sync Summary");
  console.log("═".repeat(60));
  console.log(`   Total MFs:         ${stats.total}`);
  console.log(`   Processed:         ${assets.length}`);
  console.log(`   Scraped OK:        ${stats.scraped}`);
  console.log(`   Holdings Updated:  ${stats.updated}`);
  console.log(`   Holdings Skipped:  ${stats.skipped} (unchanged)`);
  console.log(`   Metadata Enriched: ${stats.metadataEnriched}`);
  console.log(`   Failed:            ${stats.failed}`);
  console.log(`   Duration:          ${duration}s`);
  console.log("═".repeat(60) + "\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
