#!/usr/bin/env tsx
/**
 * Compute and persist scoreDynamics for IN assets.
 * calculateAllScoreDynamics only writes to AssetScore.dynamics.
 * This script also writes the aggregated map to Asset.scoreDynamics.
 * Usage: npx tsx scripts/compute-in-dynamics.ts
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { ScoreType } from "@/generated/prisma/client";
import { calculateScoreDynamics } from "@/lib/engines/score-dynamics";

const SCORE_TYPES: ScoreType[] = ["TREND", "MOMENTUM", "VOLATILITY", "SENTIMENT", "LIQUIDITY", "TRUST"];

async function main() {
  const region = process.argv[2] || 'IN';
  console.log(`⚙️  Computing scoreDynamics for ${region} assets...`);

  const assets = await prisma.$queryRaw<{ id: string; symbol: string }[]>`
    SELECT id, symbol FROM "Asset"
    WHERE region = ${region} AND "scoreDynamics" IS NULL
  `;

  console.log(`Found ${assets.length} IN assets needing dynamics`);

  let computed = 0;
  let failed = 0;

  const BATCH = 5;
  for (let i = 0; i < assets.length; i += BATCH) {
    const batch = assets.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (asset) => {
        try {
          // Fetch historical scores for this asset
          const historicalScores = await prisma.assetScore.findMany({
            where: { assetId: asset.id, type: { in: SCORE_TYPES } },
            orderBy: { date: "desc" },
            take: 180,
            select: { value: true, date: true, type: true },
          });

          if (historicalScores.length < 2) return; // Not enough data

          // Compute dynamics per score type
          const dynamicsMap: Record<string, object> = {};
          for (const scoreType of SCORE_TYPES) {
            const typeHistory = historicalScores
              .filter(s => s.type === scoreType)
              .map(s => ({ value: s.value, date: s.date }));

            if (typeHistory.length < 2) continue;

            const dynamics = await calculateScoreDynamics(
              asset.id,
              scoreType,
              undefined,
              undefined,
              undefined,
              typeHistory,
            );
            if (dynamics) {
              dynamicsMap[scoreType] = dynamics;
            }
          }

          if (Object.keys(dynamicsMap).length === 0) return;

          // Write to Asset.scoreDynamics
          await prisma.asset.update({
            where: { id: asset.id },
            data: { scoreDynamics: dynamicsMap },
          });

          computed++;
        } catch (e) {
          console.warn(`  ⚠️  ${asset.symbol}: ${e instanceof Error ? e.message : String(e)}`);
          failed++;
        }
      })
    );
    if ((i + BATCH) % 15 === 0) {
      console.log(`  Progress: ${Math.min(i + BATCH, assets.length)}/${assets.length}`);
    }
  }

  const withDynamicsResult = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Asset" WHERE region = 'IN' AND "scoreDynamics" IS NOT NULL
  `;
  const withDynamics = Number(withDynamicsResult[0]?.count ?? 0);

  console.log(`\n✅ Done: ${computed} computed, ${failed} failed`);
  console.log(`   IN assets with scoreDynamics: ${withDynamics}/${assets.length}`);

  await prisma.$disconnect();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
