/**
 * Data migration script: Backfill AssetMetrics from existing Asset JSON fields
 * 
 * Run: npx tsx scripts/migrate-asset-metrics.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateAssetMetrics() {
  console.log("Starting AssetMetrics migration...");

  // Find all assets with at least one JSON field populated using raw query
  const assets = await prisma.$queryRaw<Array<{
    id: string;
    symbol: string;
    factorData: Prisma.JsonValue;
    correlationData: Prisma.JsonValue;
    scoreDynamics: Prisma.JsonValue;
    performanceData: Prisma.JsonValue;
    signalStrength: Prisma.JsonValue;
    correlationRegime: Prisma.JsonValue;
    factorAlignment: Prisma.JsonValue;
    eventAdjustedScores: Prisma.JsonValue;
    cryptoIntelligence: Prisma.JsonValue;
    scenarioData: Prisma.JsonValue;
    updatedAt: Date;
  }>>`
    SELECT 
      id, 
      symbol,
      "factorData",
      "correlationData", 
      "scoreDynamics",
      "performanceData",
      "signalStrength",
      "correlationRegime",
      "factorAlignment",
      "eventAdjustedScores",
      "cryptoIntelligence",
      "scenarioData",
      "updatedAt"
    FROM "Asset"
    WHERE "factorData" IS NOT NULL
       OR "correlationData" IS NOT NULL
       OR "scoreDynamics" IS NOT NULL
       OR "performanceData" IS NOT NULL
       OR "signalStrength" IS NOT NULL
       OR "correlationRegime" IS NOT NULL
       OR "factorAlignment" IS NOT NULL
       OR "eventAdjustedScores" IS NOT NULL
       OR "cryptoIntelligence" IS NOT NULL
       OR "scenarioData" IS NOT NULL
    LIMIT 1000
  `;

  console.log(`Found ${assets.length} assets with metrics to migrate`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const asset of assets) {
    try {
      // Check if metrics already exist using raw query
      const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "AssetMetrics" WHERE "assetId" = ${asset.id}
      `;

      if (existing.length > 0) {
        console.log(`Skipping ${asset.symbol} - metrics already exist`);
        skipped++;
        continue;
      }

      // Create AssetMetrics record using raw query to avoid type issues
      await prisma.$executeRaw`
        INSERT INTO "AssetMetrics" (
          id, "assetId", "factorData", "correlationData", "scoreDynamics",
          "performanceData", "signalStrength", "correlationRegime", "factorAlignment",
          "eventAdjustedScores", "cryptoIntelligence", "scenarioData", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${asset.id}, ${asset.factorData}, ${asset.correlationData},
          ${asset.scoreDynamics}, ${asset.performanceData}, ${asset.signalStrength},
          ${asset.correlationRegime}, ${asset.factorAlignment}, ${asset.eventAdjustedScores},
          ${asset.cryptoIntelligence}, ${asset.scenarioData}, ${asset.updatedAt}
        )
      `;

      migrated++;
      console.log(`Migrated ${asset.symbol} (${asset.id})`);
    } catch (error) {
      failed++;
      console.error(`Failed to migrate ${asset.symbol}:`, error);
    }
  }

  console.log(`\nMigration complete:`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${assets.length}`);
}

// Run migration
migrateAssetMetrics()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Migration failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
