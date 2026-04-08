#!/usr/bin/env tsx
/**
 * Enrich Indian Mutual Funds with computed returns from NAV history.
 * Computes 1Y, 3Y, 5Y CAGR returns from existing priceHistory in DB.
 * Also fetches latest metadata from MFAPI if missing.
 * 
 * Usage:
 *   npx tsx scripts/enrich-mutual-funds.ts              # all mutual funds
 *   npx tsx scripts/enrich-mutual-funds.ts --test        # test with 3 funds
 */

import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const isTest = args.includes("--test");

function computeCAGR(startNav: number, endNav: number, years: number): number | null {
  if (startNav <= 0 || endNav <= 0 || years <= 0) return null;
  return (Math.pow(endNav / startNav, 1 / years) - 1) * 100;
}

async function main() {
  console.log("🔍 Fetching mutual funds to enrich...");

  const funds = await prisma.asset.findMany({
    where: { type: "MUTUAL_FUND" },
    select: {
      id: true,
      symbol: true,
      nav: true,
      fundPerformanceHistory: true,
      category: true,
      fundHouse: true,
    },
    ...(isTest ? { take: 3 } : {}),
  });

  console.log(`📊 Found ${funds.length} mutual funds`);

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  const now = new Date();

  for (const fund of funds) {
    try {
      const latestNav = fund.nav;
      if (!latestNav || latestNav <= 0) {
        console.log(`  ⏭️ ${fund.symbol}: No NAV data`);
        skipped++;
        continue;
      }

      // Fetch historical NAV points from priceHistory
      const dates = {
        oneYear: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
        threeYear: new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()),
        fiveYear: new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()),
      };

      // Get closest NAV to each target date (within 7 day window)
      const [nav1Y, nav3Y, nav5Y] = await Promise.all([
        prisma.priceHistory.findFirst({
          where: {
            assetId: fund.id,
            date: { gte: new Date(dates.oneYear.getTime() - 7 * 86400000), lte: new Date(dates.oneYear.getTime() + 7 * 86400000) },
          },
          orderBy: { date: "desc" },
          select: { close: true, date: true },
        }),
        prisma.priceHistory.findFirst({
          where: {
            assetId: fund.id,
            date: { gte: new Date(dates.threeYear.getTime() - 7 * 86400000), lte: new Date(dates.threeYear.getTime() + 7 * 86400000) },
          },
          orderBy: { date: "desc" },
          select: { close: true, date: true },
        }),
        prisma.priceHistory.findFirst({
          where: {
            assetId: fund.id,
            date: { gte: new Date(dates.fiveYear.getTime() - 7 * 86400000), lte: new Date(dates.fiveYear.getTime() + 7 * 86400000) },
          },
          orderBy: { date: "desc" },
          select: { close: true, date: true },
        }),
      ]);

      const returns: Record<string, number | null> = {};
      if (nav1Y?.close) returns.oneYear = computeCAGR(nav1Y.close, latestNav, 1);
      if (nav3Y?.close) returns.threeYear = computeCAGR(nav3Y.close, latestNav, 3);
      if (nav5Y?.close) returns.fiveYear = computeCAGR(nav5Y.close, latestNav, 5);

      // Also compute YTD
      const ytdStart = new Date(now.getFullYear(), 0, 1);
      const navYTD = await prisma.priceHistory.findFirst({
        where: {
          assetId: fund.id,
          date: { gte: new Date(ytdStart.getTime() - 7 * 86400000), lte: new Date(ytdStart.getTime() + 7 * 86400000) },
        },
        orderBy: { date: "desc" },
        select: { close: true },
      });
      if (navYTD?.close) {
        returns.ytd = ((latestNav - navYTD.close) / navYTD.close) * 100;
      }

      const hasReturns = Object.values(returns).some(v => v !== null && v !== undefined);
      if (!hasReturns) {
        console.log(`  ⏭️ ${fund.symbol}: No historical NAV for return computation`);
        skipped++;
        continue;
      }

      await prisma.asset.update({
        where: { id: fund.id },
        data: {
          fundPerformanceHistory: returns,
        },
      });

      const parts: string[] = [];
      if (returns.ytd != null) parts.push(`YTD:${returns.ytd.toFixed(1)}%`);
      if (returns.oneYear != null) parts.push(`1Y:${returns.oneYear.toFixed(1)}%`);
      if (returns.threeYear != null) parts.push(`3Y:${returns.threeYear.toFixed(1)}%`);
      if (returns.fiveYear != null) parts.push(`5Y:${returns.fiveYear.toFixed(1)}%`);
      console.log(`  ✅ ${fund.symbol}: ${parts.join(" | ")}`);
      enriched++;
    } catch (err) {
      console.error(`  ❌ ${fund.symbol}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n📊 Enrichment complete: ${enriched} enriched, ${skipped} skipped, ${failed} failed`);
}

main().catch(e => {
  console.error("Fatal error:", e);
}).finally(async () => {
  await prisma.$disconnect();
  process.exit(0);
});
