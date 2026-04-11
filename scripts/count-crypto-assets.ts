import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const sslConfig = { rejectUnauthorized: false };

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: sslConfig,
  max: 2,
});

const prisma = new PrismaClient({
  adapter: adapter,
  log: ["error", "warn"],
});

async function countCryptoAssets() {
  try {
    const count = await prisma.asset.count({
      where: {
        type: "CRYPTO",
      },
    });
    console.log(`Total crypto assets in database: ${count}`);
    
    // Also get total assets for context
    const totalCount = await prisma.asset.count();
    console.log(`Total assets in database: ${totalCount}`);
    
    // Get breakdown by type
    const byType = await prisma.asset.groupBy({
      by: ["type"],
      _count: {
        type: true,
      },
    });
    console.log("\nBreakdown by type:");
    byType.forEach((item) => {
      console.log(`${item.type}: ${item._count.type}`);
    });
  } catch (error) {
    console.error("Error counting crypto assets:", error);
  } finally {
    await prisma.$disconnect();
  }
}

countCryptoAssets();
