/**
 * VACUUM ANALYZE Database
 * 
 * Reclaims disk space and updates statistics after cleanup operations.
 */

import { prisma } from "../src/lib/prisma";

async function vacuumDatabase() {
  console.log("🔧 Running VACUUM ANALYZE on database...\n");

  try {
    // Get database size before
    const sizeBefore = await prisma.$queryRaw<Array<{ size: string }>>`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;
    console.log(`📊 Database size before: ${sizeBefore[0].size}`);

    // Run VACUUM ANALYZE
    console.log("\n🔄 Running VACUUM ANALYZE (this may take a few minutes)...");
    await prisma.$executeRawUnsafe("VACUUM ANALYZE");
    console.log("✅ VACUUM ANALYZE completed\n");

    // Get database size after
    const sizeAfter = await prisma.$queryRaw<Array<{ size: string }>>`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;
    console.log(`📊 Database size after: ${sizeAfter[0].size}`);

    // Get table sizes
    console.log("\n📋 Top 10 tables by size:");
    const tableSizes = await prisma.$queryRaw<Array<{ table: string; size: string }>>`
      SELECT 
        tablename as table,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `;

    tableSizes.forEach((row, index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${row.table.padEnd(30)} ${row.size}`);
    });

    console.log("\n✅ Database optimization complete!");

    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Error during VACUUM:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run
vacuumDatabase();
