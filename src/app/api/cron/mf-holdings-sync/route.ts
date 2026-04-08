import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { AssetType } from "@/generated/prisma/client";
import { withCronAuthAndLogging } from "@/lib/middleware/cron-auth";

const logger = createLogger({ service: "cron-mf-holdings-sync" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = "bom1";

/**
 * POST /api/cron/mf-holdings-sync
 * Monthly trigger for MF holdings + metadata refresh via Moneycontrol scraper.
 * 
 * This route does NOT run the Playwright scraper directly (it requires a headed browser).
 * Instead, it checks staleness and logs which funds need updating.
 * The actual scraping is done via: `npx tsx scripts/sync-mf-holdings.ts`
 * 
 * For automated monthly runs, use a server-side cron (e.g., Railway, EC2, or local crontab)
 * that executes the script directly. This route serves as a health check + staleness reporter.
 * 
 * Schedule: 1st of every month at 06:00 UTC (11:30 AM IST)
 */
export async function POST(request: NextRequest) {
  return withCronAuthAndLogging(
    request,
    { logger, job: "mf-holdings-sync" },
    async () => {
      logger.info("🔍 MF Holdings Staleness Check");

      // Check all MF assets for staleness (holdings older than 25 days)
      const STALE_THRESHOLD_DAYS = 25;
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - STALE_THRESHOLD_DAYS);

      const allMFs = await prisma.asset.findMany({
        where: { type: AssetType.MUTUAL_FUND, region: "IN" },
        select: {
          symbol: true,
          name: true,
          topHoldings: true,
          metadata: true,
        },
      });

      let staleCount = 0;
      let freshCount = 0;
      let noDataCount = 0;
      const staleFunds: string[] = [];

      for (const mf of allMFs) {
        const th = mf.topHoldings as Record<string, unknown> | null;
        const scrapedAt = th?._scrapedAt as string | undefined;

        if (!scrapedAt) {
          noDataCount++;
          staleFunds.push(mf.symbol);
          continue;
        }

        const scrapedDate = new Date(scrapedAt);
        if (scrapedDate < staleDate) {
          staleCount++;
          staleFunds.push(mf.symbol);
        } else {
          freshCount++;
        }
      }

      const needsSync = staleCount + noDataCount > 0;

      const report = {
        totalMFs: allMFs.length,
        fresh: freshCount,
        stale: staleCount,
        noData: noDataCount,
        needsSync,
        staleFunds: staleFunds.slice(0, 20),
        staleThresholdDays: STALE_THRESHOLD_DAYS,
        message: needsSync
          ? `${staleCount + noDataCount} MFs need holdings refresh. Run: npx tsx scripts/sync-mf-holdings.ts`
          : "All MF holdings are fresh. No sync needed.",
      };

      if (needsSync) {
        logger.warn(report, "MF holdings are stale — manual scraper run needed");
      } else {
        logger.info(report, "MF holdings are fresh");
      }

      return NextResponse.json({
        success: true,
        ...report,
        timestamp: new Date().toISOString(),
      });
    },
  );
}

export async function GET(request: NextRequest) {
  return POST(request);
}
