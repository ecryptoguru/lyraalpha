import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "crypto-coverage" });

const sslConfig = { rejectUnauthorized: false };

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: sslConfig,
  max: 3,
});

const prisma = new PrismaClient({
  adapter: adapter,
  log: ["error", "warn"],
});

async function checkCryptoCoverage() {
  logger.info("Checking existing crypto coverage in database");

  try {
    // Check total assets
    const totalCountResult = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM "Asset"`;
    const totalCount = Number(totalCountResult[0]?.count || 0);
    
    // Check crypto assets
    const cryptoCountResult = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM "Asset" WHERE type = 'CRYPTO'`;
    const cryptoCount = Number(cryptoCountResult[0]?.count || 0);
    
    // Check assets with CoinGecko IDs
    const coingeckoCountResult = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM "Asset" WHERE "coingeckoId" IS NOT NULL`;
    const coingeckoCount = Number(coingeckoCountResult[0]?.count || 0);

    logger.info({
      total: totalCount,
      crypto: cryptoCount,
      withCoingeckoId: coingeckoCount,
    }, "Database asset counts");

    // Get all crypto assets with CoinGecko IDs
    const cryptoAssets = await prisma.$queryRaw<
      Array<{ symbol: string; name: string; coingeckoId: string | null }>
    >`
      SELECT symbol, name, "coingeckoId"
      FROM "Asset"
      WHERE type = 'CRYPTO'
      ORDER BY symbol
    `;

    console.log("\n=== Existing Crypto Assets ===");
    console.log(`Total crypto assets: ${cryptoAssets.length}`);
    
    if (cryptoAssets.length > 0) {
      console.log("\nCrypto Assets with CoinGecko IDs:");
      cryptoAssets.forEach((asset) => {
        console.log(`  ${asset.symbol} - ${asset.name} - CoinGecko ID: ${asset.coingeckoId || 'N/A'}`);
      });
    } else {
      console.log("No crypto assets found in database");
    }

    // Get breakdown by asset type
    const byType = await prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
      SELECT type, COUNT(*) as count
      FROM "Asset"
      GROUP BY type
      ORDER BY count DESC
    `;

    console.log("\n=== Asset Type Breakdown ===");
    byType.forEach((row) => {
      console.log(`${row.type}: ${Number(row.count)}`);
    });

  } catch (error) {
    logger.error({ err: error }, "Failed to check crypto coverage");
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkCryptoCoverage().catch((error) => {
  console.error("Check failed:", error);
  process.exit(1);
});
