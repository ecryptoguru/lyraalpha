#!/usr/bin/env tsx
/**
 * Enrich US Stocks & ETFs with extended Yahoo Finance data.
 * - Stocks & ETFs: financials via fundamentalsTimeSeries API
 * - Stocks & ETFs: description, industry, website via quoteSummary assetProfile
 * - ETFs: topHoldings, sectorWeights, fundPerformance via quoteSummary
 * 
 * Usage:
 *   npx tsx scripts/enrich-us-assets.ts              # all US stocks + ETFs
 *   npx tsx scripts/enrich-us-assets.ts --test        # test with 4 symbols only
 *   npx tsx scripts/enrich-us-assets.ts --symbol=AAPL # single symbol
 */

import { prisma } from "../src/lib/prisma";
import { fetchInstitutionalSummary, fetchFundamentals, getRawValue } from "../src/lib/market-data";

const args = process.argv.slice(2);
const isTest = args.includes("--test");
const singleSymbol = args.find(a => a.startsWith("--symbol="))?.split("=")[1];

async function main() {
  console.log("🔍 Fetching US stocks & ETFs to enrich...");

  let assets;
  if (singleSymbol) {
    assets = await prisma.asset.findMany({
      where: { symbol: singleSymbol },
      select: { id: true, symbol: true, type: true, description: true, topHoldings: true },
    });
  } else if (isTest) {
    assets = await prisma.asset.findMany({
      where: { symbol: { in: ["AAPL", "MSFT", "SPY", "QQQ"] } },
      select: { id: true, symbol: true, type: true, description: true, topHoldings: true },
    });
  } else {
    assets = await prisma.asset.findMany({
      where: {
        type: { in: ["STOCK", "ETF"] },
        symbol: { not: { contains: ".NS" } },
      },
      select: { id: true, symbol: true, type: true, description: true, topHoldings: true },
    });
  }

  console.log(`📊 Found ${assets.length} assets to enrich`);

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (const asset of assets) {
    try {
      const summary = await fetchInstitutionalSummary(asset.symbol, true);
      if (!summary) {
        console.log(`  ⚠️ ${asset.symbol}: No summary data`);
        failed++;
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatePayload: Record<string, any> = {};

      // Description + Industry (stocks & ETFs)
      if (summary.assetProfile?.longBusinessSummary) {
        updatePayload.description = summary.assetProfile.longBusinessSummary;
      }
      if (summary.assetProfile?.industry) {
        updatePayload.industry = summary.assetProfile.industry;
      }
      if (summary.assetProfile?.sector) {
        updatePayload.sector = summary.assetProfile.sector;
      }

      // Metadata enrichment (website, employees, country)
      const existingMeta = (await prisma.asset.findUnique({
        where: { id: asset.id },
        select: { metadata: true },
      }))?.metadata as Record<string, unknown> || {};

      const metaPatch: Record<string, unknown> = {};
      if (summary.assetProfile?.website) metaPatch.website = summary.assetProfile.website;
      if (summary.assetProfile?.fullTimeEmployees) metaPatch.fullTimeEmployees = summary.assetProfile.fullTimeEmployees;
      if (summary.assetProfile?.country) metaPatch.country = summary.assetProfile.country;
      if (Object.keys(metaPatch).length > 0) {
        updatePayload.metadata = { ...existingMeta, ...metaPatch };
      }

      // Financial statements (US stocks & ETFs — via fundamentalsTimeSeries API)
      if (asset.type === "STOCK" || asset.type === "ETF") {
        try {
          const fundamentals = await fetchFundamentals(asset.symbol);
          if (fundamentals) {
            updatePayload.financials = fundamentals;
          }
        } catch {
          console.log(`  ⚠️ ${asset.symbol}: Fundamentals fetch failed, skipping`);
        }
      }

      // ETF: Top Holdings + Fund Performance
      if (asset.type === "ETF") {
        if (summary.topHoldings) {
          const th = summary.topHoldings;
          const holdingsData: Record<string, unknown> = {};

          if (th.holdings?.length) {
            holdingsData.holdings = th.holdings.map((h: Record<string, unknown>) => ({
              symbol: h.symbol || null,
              name: h.holdingName || null,
              weight: getRawValue(h.holdingPercent),
            }));
          }

          if (th.sectorWeightings?.length) {
            const sectorWeights: Array<{ sector: string; weight: number | null }> = [];
            for (const sw of th.sectorWeightings) {
              const swObj = sw as Record<string, unknown>;
              for (const [key, val] of Object.entries(swObj)) {
                if (key !== "type" && key !== "maxAge") {
                  sectorWeights.push({ sector: key, weight: getRawValue(val) as number | null });
                }
              }
            }
            holdingsData.sectorWeights = sectorWeights;
          }

          if (th.equityHoldings) {
            holdingsData.equityHoldings = {
              priceToEarnings: getRawValue(th.equityHoldings.priceToEarnings),
              priceToBook: getRawValue(th.equityHoldings.priceToBook),
              priceToSales: getRawValue(th.equityHoldings.priceToSales),
              medianMarketCap: getRawValue(th.equityHoldings.medianMarketCap),
              threeYearEarningsGrowth: getRawValue(th.equityHoldings.threeYearEarningsGrowth),
            };
          }

          updatePayload.topHoldings = holdingsData;
        }

        if (summary.fundPerformance?.performanceOverview) {
          const po = summary.fundPerformance.performanceOverview;
          updatePayload.fundPerformanceHistory = {
            ytd: getRawValue(po.ytdReturnPct),
            oneYear: getRawValue(po.oneYearTotalReturn),
            threeYear: getRawValue(po.threeYearTotalReturn),
            fiveYear: getRawValue(po.fiveYearTotalReturn),
            tenYear: getRawValue(po.tenYearTotalReturn),
          };
        }
      }

      // Only update if we have something new
      if (Object.keys(updatePayload).length > 0) {
        await prisma.asset.update({
          where: { id: asset.id },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: updatePayload as any,
        });
        const fields = Object.keys(updatePayload).filter(k => k !== "metadata").join(", ");
        console.log(`  ✅ ${asset.symbol} (${asset.type}): ${fields}`);
        enriched++;
      } else {
        console.log(`  ⏭️ ${asset.symbol}: No new data`);
        skipped++;
      }

      // Rate limit: 200ms between requests to avoid Yahoo throttling
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`  ❌ ${asset.symbol}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n📊 Enrichment complete: ${enriched} enriched, ${skipped} skipped, ${failed} failed`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
