#!/usr/bin/env tsx
/**
 * Enrich Commodity Futures assets with extended Yahoo Finance data.
 * Promotes key fields from metadata to top-level Asset columns:
 *   - openInterest (front-month open interest)
 *   - description (commodity description)
 *   - sector / industry (commodity category)
 *   - expenseRatio (not applicable, set null)
 *
 * Also enriches metadata with:
 *   - expireDate (contract expiry)
 *   - exchangeName
 *   - contractSize, underlyingSymbol
 *   - seasonalityNotes (static, per commodity)
 *   - commodityClass (Energy, Metal, Agricultural, etc.)
 *
 * Usage:
 *   npx tsx scripts/enrich-commodity-futures.ts              # all 12 commodities
 *   npx tsx scripts/enrich-commodity-futures.ts --test       # test with GC=F, CL=F
 *   npx tsx scripts/enrich-commodity-futures.ts --symbol=GC=F  # single asset
 */

import yahooFinance from "yahoo-finance2";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const isTest = args.includes("--test");
const singleSymbol = args.find(a => a.startsWith("--symbol="))?.split("=")[1];

// Static commodity metadata not available from Yahoo Finance
const COMMODITY_STATIC: Record<string, {
  sector: string;
  industry: string;
  commodityClass: string;
  description: string;
  contractUnit: string;
  exchange: string;
}> = {
  "GC=F": {
    sector: "Commodities",
    industry: "Precious Metals",
    commodityClass: "Metal",
    description: "Gold is a precious metal traded as a futures contract on the COMEX exchange. It is widely used as a store of value, inflation hedge, and safe-haven asset. Gold futures represent the obligation to buy or sell 100 troy ounces of gold at a specified price on a future date.",
    contractUnit: "100 troy oz",
    exchange: "COMEX",
  },
  "SI=F": {
    sector: "Commodities",
    industry: "Precious Metals",
    commodityClass: "Metal",
    description: "Silver is a precious and industrial metal traded as a futures contract on the COMEX exchange. It has dual demand from investors as a store of value and from industry for electronics, solar panels, and medical applications. Silver futures represent 5,000 troy ounces.",
    contractUnit: "5,000 troy oz",
    exchange: "COMEX",
  },
  "PL=F": {
    sector: "Commodities",
    industry: "Precious Metals",
    commodityClass: "Metal",
    description: "Platinum is a rare precious metal primarily used in catalytic converters, jewelry, and industrial applications. It trades on the NYMEX exchange. Platinum futures represent 50 troy ounces.",
    contractUnit: "50 troy oz",
    exchange: "NYMEX",
  },
  "HG=F": {
    sector: "Commodities",
    industry: "Industrial Metals",
    commodityClass: "Metal",
    description: "Copper is an industrial metal critical for electrical wiring, construction, and electronics manufacturing. Often called 'Dr. Copper' for its ability to predict economic trends. COMEX copper futures represent 25,000 pounds.",
    contractUnit: "25,000 lbs",
    exchange: "COMEX",
  },
  "CL=F": {
    sector: "Commodities",
    industry: "Energy",
    commodityClass: "Energy",
    description: "West Texas Intermediate (WTI) Crude Oil is the primary US oil benchmark traded on the NYMEX. It is a light, sweet crude oil used as a reference price for oil purchases worldwide. Each contract represents 1,000 barrels.",
    contractUnit: "1,000 barrels",
    exchange: "NYMEX",
  },
  "BZ=F": {
    sector: "Commodities",
    industry: "Energy",
    commodityClass: "Energy",
    description: "Brent Crude Oil is the international oil benchmark, sourced from the North Sea. It is used to price approximately two-thirds of the world's internationally traded crude oil supplies. Each contract represents 1,000 barrels.",
    contractUnit: "1,000 barrels",
    exchange: "ICE",
  },
  "NG=F": {
    sector: "Commodities",
    industry: "Energy",
    commodityClass: "Energy",
    description: "Natural Gas futures track the price of natural gas delivered at the Henry Hub in Louisiana, the primary US pricing point. Natural gas is used for heating, electricity generation, and industrial processes. Each contract represents 10,000 MMBtu.",
    contractUnit: "10,000 MMBtu",
    exchange: "NYMEX",
  },
  "ZC=F": {
    sector: "Commodities",
    industry: "Agricultural",
    commodityClass: "Agricultural",
    description: "Corn futures are traded on the Chicago Board of Trade (CBOT). Corn is the most widely produced grain in the US and is used for food, animal feed, and ethanol production. Each contract represents 5,000 bushels.",
    contractUnit: "5,000 bushels",
    exchange: "CBOT",
  },
  "ZS=F": {
    sector: "Commodities",
    industry: "Agricultural",
    commodityClass: "Agricultural",
    description: "Soybean futures are traded on the Chicago Board of Trade (CBOT). Soybeans are a major source of protein for animal feed and vegetable oil for human consumption. Each contract represents 5,000 bushels.",
    contractUnit: "5,000 bushels",
    exchange: "CBOT",
  },
  "ZW=F": {
    sector: "Commodities",
    industry: "Agricultural",
    commodityClass: "Agricultural",
    description: "Chicago SRW (Soft Red Winter) Wheat futures are traded on the CBOT. Wheat is a staple grain used for bread, pasta, and animal feed. Each contract represents 5,000 bushels.",
    contractUnit: "5,000 bushels",
    exchange: "CBOT",
  },
};

async function main() {
  console.log("🛢️  Commodity Futures Enrichment Script");
  console.log("========================================\n");

  let assets;
  if (singleSymbol) {
    assets = await prisma.asset.findMany({
      where: { symbol: singleSymbol, type: "COMMODITY" },
      select: { id: true, symbol: true, name: true, metadata: true, openInterest: true },
    });
  } else if (isTest) {
    assets = await prisma.asset.findMany({
      where: { symbol: { in: ["GC=F", "CL=F"] }, type: "COMMODITY" },
      select: { id: true, symbol: true, name: true, metadata: true, openInterest: true },
    });
  } else {
    assets = await prisma.asset.findMany({
      where: { type: "COMMODITY" },
      select: { id: true, symbol: true, name: true, metadata: true, openInterest: true },
    });
  }

  console.log(`📊 Found ${assets.length} commodity assets to enrich\n`);

  let enriched = 0;
  const skipped = 0;
  let failed = 0;

  for (const asset of assets) {
    try {
      const staticData = COMMODITY_STATIC[asset.symbol];
      const existingMeta = (asset.metadata as Record<string, unknown>) || {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatePayload: Record<string, any> = {};

      // Apply static enrichment
      if (staticData) {
        updatePayload.sector = staticData.sector;
        updatePayload.industry = staticData.industry;
        updatePayload.description = staticData.description;
      }

      // Fetch live Yahoo Finance quote summary for extended fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let quoteSummary: any;
      try {
        quoteSummary = await yahooFinance.quoteSummary(asset.symbol, {
          modules: ["price", "summaryDetail", "defaultKeyStatistics"],
        });
      } catch {
        console.log(`  ⚠️  ${asset.symbol}: Yahoo quoteSummary failed, using static data only`);
      }

      // Promote openInterest from metadata.commodity.fields if not already set
      const commodityMeta = existingMeta.commodity as Record<string, unknown> | undefined;
      const oiValue = (commodityMeta?.fields as Record<string, unknown>)?.openInterest as Record<string, unknown>;
      if (oiValue?.value && !asset.openInterest) {
        updatePayload.openInterest = oiValue.value as number;
      }

      // Build enriched metadata patch
      const metaPatch: Record<string, unknown> = {
        commodityClass: staticData?.commodityClass,
        contractUnit: staticData?.contractUnit,
        exchangeName: staticData?.exchange,
      };

      if (quoteSummary?.price) {
        const p = quoteSummary.price;
        if (p.regularMarketOpen) metaPatch.dayOpen = p.regularMarketOpen;
        if (p.regularMarketDayHigh) metaPatch.dayHigh = p.regularMarketDayHigh;
        if (p.regularMarketDayLow) metaPatch.dayLow = p.regularMarketDayLow;
        if (p.regularMarketPreviousClose) metaPatch.previousClose = p.regularMarketPreviousClose;
        if (p.exchangeName) metaPatch.exchangeName = p.exchangeName;
        if (p.currency) updatePayload.currency = p.currency;
      }

      if (quoteSummary?.summaryDetail) {
        const sd = quoteSummary.summaryDetail;
        if (sd.expireDate) metaPatch.expireDate = sd.expireDate;
        if (sd.openInterest) {
          updatePayload.openInterest = sd.openInterest;
          metaPatch.openInterestLive = sd.openInterest;
        }
        if (sd.volume) metaPatch.frontMonthVolume = sd.volume;
        if (sd.averageVolume) updatePayload.avgVolume = sd.averageVolume;
        if (sd.fiftyTwoWeekHigh) updatePayload.fiftyTwoWeekHigh = sd.fiftyTwoWeekHigh;
        if (sd.fiftyTwoWeekLow) updatePayload.fiftyTwoWeekLow = sd.fiftyTwoWeekLow;
      }

      if (quoteSummary?.defaultKeyStatistics) {
        const ks = quoteSummary.defaultKeyStatistics;
        if (ks.beta) metaPatch.beta = ks.beta;
      }

      updatePayload.metadata = {
        ...existingMeta,
        ...metaPatch,
      };

      await prisma.asset.update({
        where: { id: asset.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: updatePayload as any,
      });

      const promoted = Object.keys(updatePayload).filter(k => k !== "metadata").join(", ");
      console.log(`  ✅ ${asset.symbol} (${staticData?.commodityClass || "?"}): ${promoted || "metadata only"}`);
      enriched++;

      // Rate limit: 300ms between Yahoo requests
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`  ❌ ${asset.symbol}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n📊 Done: ${enriched} enriched, ${skipped} skipped, ${failed} failed`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
