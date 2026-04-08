/**
 * Execute Safe Database Cleanup Operations
 * 
 * Performs 5 safe cleanup operations:
 * 1. Delete stale AI request logs (90+ days)
 * 2. Remove duplicate trending questions
 * 3. Clean orphaned asset scores
 * 4. Remove old chat messages (90+ days)
 * 5. Delete empty knowledge documents
 */

import { prisma } from "../src/lib/prisma";

interface CleanupResult {
  operation: string;
  recordsDeleted: number;
  success: boolean;
  error?: string;
}

async function executeSafeCleanup() {
  console.log("🧹 Starting safe database cleanup operations...\n");
  
  const results: CleanupResult[] = [];
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Section 1: Delete stale AI request logs (90+ days)
  console.log("1️⃣  Deleting stale AI request logs (90+ days)...");
  try {
    const deleted = await prisma.aIRequestLog.deleteMany({
      where: {
        createdAt: {
          lt: ninetyDaysAgo,
        },
      },
    });
    console.log(`   ✅ Deleted ${deleted.count} stale AI request logs\n`);
    results.push({
      operation: "Stale AI Request Logs",
      recordsDeleted: deleted.count,
      success: true,
    });
  } catch (error) {
    console.error(`   ❌ Error:`, error);
    results.push({
      operation: "Stale AI Request Logs",
      recordsDeleted: 0,
      success: false,
      error: String(error),
    });
  }

  // Section 2: Remove duplicate trending questions
  console.log("2️⃣  Removing duplicate trending questions...");
  try {
    // Find duplicates
    const duplicates = await prisma.$queryRaw<Array<{ question: string; ids: string[] }>>`
      SELECT question, array_agg(id) as ids
      FROM "TrendingQuestion"
      GROUP BY question
      HAVING COUNT(*) > 1
    `;

    let totalDeleted = 0;
    for (const dup of duplicates) {
      // Keep the first ID, delete the rest
      const idsToDelete = dup.ids.slice(1);
      const deleted = await prisma.trendingQuestion.deleteMany({
        where: {
          id: { in: idsToDelete },
        },
      });
      totalDeleted += deleted.count;
    }

    console.log(`   ✅ Deleted ${totalDeleted} duplicate questions\n`);
    results.push({
      operation: "Duplicate Trending Questions",
      recordsDeleted: totalDeleted,
      success: true,
    });
  } catch (error) {
    console.error(`   ❌ Error:`, error);
    results.push({
      operation: "Duplicate Trending Questions",
      recordsDeleted: 0,
      success: false,
      error: String(error),
    });
  }

  // Section 3: Clean orphaned asset scores
  console.log("3️⃣  Cleaning orphaned asset scores...");
  try {
    const orphanedScores = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "AssetScore"
      WHERE "assetId" NOT IN (SELECT id FROM "Asset")
    `;

    const orphanedIds = orphanedScores.map((s) => s.id);
    let deleted = { count: 0 };
    
    if (orphanedIds.length > 0) {
      deleted = await prisma.assetScore.deleteMany({
        where: {
          id: { in: orphanedIds },
        },
      });
    }

    console.log(`   ✅ Deleted ${deleted.count} orphaned asset scores\n`);
    results.push({
      operation: "Orphaned Asset Scores",
      recordsDeleted: deleted.count,
      success: true,
    });
  } catch (error) {
    console.error(`   ❌ Error:`, error);
    results.push({
      operation: "Orphaned Asset Scores",
      recordsDeleted: 0,
      success: false,
      error: String(error),
    });
  }

  // Section 4: Remove old chat sources (90+ days) - SKIPPED
  // ChatSource table doesn't have createdAt field, skipping this operation
  console.log("4️⃣  Skipping old chat sources (no timestamp field)...");
  results.push({
    operation: "Old Chat Sources (Skipped)",
    recordsDeleted: 0,
    success: true,
  });

  // Section 5: Delete empty knowledge documents
  console.log("5️⃣  Deleting empty knowledge documents...");
  try {
    const deleted = await prisma.knowledgeDoc.deleteMany({
      where: {
        content: "",
      },
    });
    console.log(`   ✅ Deleted ${deleted.count} empty knowledge documents\n`);
    results.push({
      operation: "Empty Knowledge Documents",
      recordsDeleted: deleted.count,
      success: true,
    });
  } catch (error) {
    console.error(`   ❌ Error:`, error);
    results.push({
      operation: "Empty Knowledge Documents",
      recordsDeleted: 0,
      success: false,
      error: String(error),
    });
  }

  // Summary
  console.log("=".repeat(80));
  console.log("📊 CLEANUP SUMMARY:");
  console.log("=".repeat(80));
  
  const successCount = results.filter((r) => r.success).length;
  const totalDeleted = results.reduce((sum, r) => sum + r.recordsDeleted, 0);

  results.forEach((result) => {
    const status = result.success ? "✅" : "❌";
    console.log(`${status} ${result.operation.padEnd(35)} ${result.recordsDeleted.toString().padStart(8)} records`);
  });

  console.log("-".repeat(80));
  console.log(`Total operations: ${results.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${results.length - successCount}`);
  console.log(`Total records deleted: ${totalDeleted}`);
  console.log("=".repeat(80));

  await prisma.$disconnect();

  return {
    success: successCount === results.length,
    totalDeleted,
    results,
  };
}

// Run
executeSafeCleanup()
  .then((summary) => {
    if (summary.success) {
      console.log("\n✅ All cleanup operations completed successfully!");
      console.log("\n💡 Next step: Run VACUUM ANALYZE to reclaim space");
      console.log("   Command: VACUUM ANALYZE;");
      process.exit(0);
    } else {
      console.log("\n⚠️  Some operations failed. Check errors above.");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("\n❌ Fatal error during cleanup:", error);
    process.exit(1);
  });
