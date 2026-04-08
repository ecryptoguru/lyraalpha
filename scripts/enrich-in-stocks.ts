#!/usr/bin/env tsx
/**
 * Enrich Indian stocks with industry/sector data from NSE India.
 * Uses stock-nse-india package to fetch getEquityDetails for each .NS symbol.
 * 
 * Usage:
 *   npx tsx scripts/enrich-in-stocks.ts              # all IN stocks
 *   npx tsx scripts/enrich-in-stocks.ts --test        # test with 3 symbols
 *   npx tsx scripts/enrich-in-stocks.ts --symbol=TCS  # single symbol (without .NS)
 */

import { prisma } from "../src/lib/prisma";
import { NseIndia } from "stock-nse-india";

const args = process.argv.slice(2);
const isTest = args.includes("--test");
const singleSymbol = args.find(a => a.startsWith("--symbol="))?.split("=")[1];

const nse = new NseIndia();

async function main() {
  console.log("🔍 Fetching Indian stocks to enrich...");

  let assets;
  const selectFields = { id: true, symbol: true, type: true, industry: true, metadata: true } as const;
  if (singleSymbol) {
    // Accept both TCS and TCS.NS
    const sym = singleSymbol.endsWith(".NS") ? singleSymbol : `${singleSymbol}.NS`;
    assets = await prisma.asset.findMany({
      where: { symbol: sym },
      select: selectFields,
    });
  } else if (isTest) {
    assets = await prisma.asset.findMany({
      where: { symbol: { in: ["TCS.NS", "RELIANCE.NS", "HDFCBANK.NS"] } },
      select: selectFields,
    });
  } else {
    assets = await prisma.asset.findMany({
      where: {
        type: "STOCK",
        symbol: { endsWith: ".NS" },
      },
      select: selectFields,
    });
  }

  console.log(`📊 Found ${assets.length} Indian stocks to enrich`);

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (const asset of assets) {
    try {
      // NSE uses symbol without .NS suffix
      const nseSymbol = asset.symbol.replace(".NS", "");
      const details = await nse.getEquityDetails(nseSymbol);

      if (!details?.info && !details?.industryInfo) {
        console.log(`  ⚠️ ${asset.symbol}: No NSE data`);
        failed++;
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatePayload: Record<string, any> = {};

      // Industry classification from NSE
      const industryInfo = details.industryInfo as {
        macro?: string;
        sector?: string;
        industry?: string;
        basicIndustry?: string;
      } | undefined;

      if (industryInfo?.basicIndustry || industryInfo?.industry) {
        updatePayload.industry = industryInfo.basicIndustry || industryInfo.industry;
      }
      if (industryInfo?.sector) {
        updatePayload.sector = industryInfo.sector;
      }

      // Store full industry hierarchy in metadata
      const info = details.info as {
        companyName?: string;
        isin?: string;
        listingDate?: string;
      } | undefined;

      if (industryInfo || info) {
        const existingMeta = (asset.metadata as Record<string, unknown>) || {};

        const metaPatch: Record<string, unknown> = {};
        if (industryInfo?.macro) metaPatch.nseIndustryMacro = industryInfo.macro;
        if (industryInfo?.sector) metaPatch.nseIndustrySector = industryInfo.sector;
        if (industryInfo?.industry) metaPatch.nseIndustry = industryInfo.industry;
        if (industryInfo?.basicIndustry) metaPatch.nseBasicIndustry = industryInfo.basicIndustry;
        if (info?.isin) metaPatch.isin = info.isin;
        if (info?.listingDate) metaPatch.listingDate = info.listingDate;

        if (Object.keys(metaPatch).length > 0) {
          updatePayload.metadata = { ...existingMeta, ...metaPatch };
        }
      }

      if (Object.keys(updatePayload).length > 0) {
        await prisma.asset.update({
          where: { id: asset.id },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: updatePayload as any,
        });
        const fields = Object.keys(updatePayload).filter(k => k !== "metadata").join(", ");
        console.log(`  ✅ ${asset.symbol}: ${fields || "metadata only"}`);
        enriched++;
      } else {
        console.log(`  ⏭️ ${asset.symbol}: No new data`);
        skipped++;
      }

      // Rate limit: 300ms between requests (NSE is stricter than Yahoo)
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`  ❌ ${asset.symbol}: ${(err as Error).message}`);
      failed++;
      // Longer backoff on error (NSE may be rate limiting)
      await new Promise(r => setTimeout(r, 1000));
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
