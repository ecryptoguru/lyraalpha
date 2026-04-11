import "dotenv/config";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CoinGeckoService } from "@/lib/services/coingecko.service";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "crypto-migration" });

// Generate a cuid-like ID (25 chars, base36)
function generateId(): string {
  return randomBytes(18).toString("base64url").slice(0, 25);
}

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

async function migrateToCryptoOnly() {
  logger.info("Starting migration to crypto-only asset base");

  try {
    // Step 1: Get current asset counts using raw SQL
    const totalCountResult = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM "Asset"`;
    const totalCount = Number(totalCountResult[0]?.count || 0);
    
    const cryptoCountResult = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM "Asset" WHERE type = 'CRYPTO'`;
    const cryptoCount = Number(cryptoCountResult[0]?.count || 0);
    
    const nonCryptoCount = totalCount - cryptoCount;

    logger.info({
      total: totalCount,
      crypto: cryptoCount,
      nonCrypto: nonCryptoCount,
    }, "Current asset counts");

    // Step 2: Delete all non-crypto assets using raw SQL
    if (nonCryptoCount > 0) {
      logger.warn({ count: nonCryptoCount }, "Deleting non-crypto assets");
      const deleteResult = await prisma.$executeRaw`DELETE FROM "Asset" WHERE type != 'CRYPTO'`;
      logger.info({ deleted: deleteResult }, "Non-crypto assets deleted");
    }

    // Step 3: Fetch top 100 crypto assets from CoinGecko
    logger.info("Fetching top 100 crypto assets from CoinGecko");
    const topCoins = await CoinGeckoService.getTopCoins(100, "usd");

    if (topCoins.length === 0) {
      throw new Error("Failed to fetch crypto assets from CoinGecko");
    }

    logger.info({ count: topCoins.length }, "Fetched crypto assets from CoinGecko");

    // Step 4: Insert crypto assets into database using raw SQL
    logger.info("Inserting crypto assets into database");
    let inserted = 0;
    let skipped = 0;

    for (const coin of topCoins) {
      const symbol = `${coin.symbol.toUpperCase()}-USD`;
      const id = generateId();
      
      // Check if asset already exists using raw SQL
      const existing = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Asset" WHERE symbol = ${symbol} LIMIT 1
      `;

      if (existing.length > 0) {
        // Update if it exists using raw SQL
        await prisma.$executeRaw`
          UPDATE "Asset"
          SET name = ${coin.name},
              type = 'CRYPTO',
              "coingeckoId" = ${coin.id},
              "marketCap" = ${coin.market_cap ? String(coin.market_cap) : null},
              price = ${coin.current_price},
              "changePercent" = ${coin.price_change_percentage_24h},
              "lastPriceUpdate" = ${new Date()},
              currency = 'USD',
              "updatedAt" = NOW()
          WHERE symbol = ${symbol}
        `;
        skipped++;
      } else {
        // Create new asset using raw SQL with generated ID
        await prisma.$executeRaw`
          INSERT INTO "Asset" (
            id, symbol, name, type, "coingeckoId", "marketCap", price, "changePercent",
            "lastPriceUpdate", currency, "createdAt", "updatedAt"
          )
          VALUES (
            ${id}, ${symbol}, ${coin.name}, 'CRYPTO', ${coin.id},
            ${coin.market_cap ? String(coin.market_cap) : null},
            ${coin.current_price}, ${coin.price_change_percentage_24h},
            ${new Date()}, 'USD', NOW(), NOW()
          )
        `;
        inserted++;
      }

      if ((inserted + skipped) % 20 === 0) {
        logger.info({ inserted, skipped, total: inserted + skipped }, "Progress update");
      }
    }

    // Step 5: Verify final counts using raw SQL
    const finalTotalResult = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM "Asset"`;
    const finalTotal = Number(finalTotalResult[0]?.count || 0);
    
    const finalCryptoResult = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM "Asset" WHERE type = 'CRYPTO'`;
    const finalCrypto = Number(finalCryptoResult[0]?.count || 0);

    logger.info({
      finalTotal,
      finalCrypto,
      inserted,
      skipped,
    }, "Migration completed successfully");

    console.log("\n=== Migration Summary ===");
    console.log(`Deleted non-crypto assets: ${nonCryptoCount}`);
    console.log(`Inserted new crypto assets: ${inserted}`);
    console.log(`Updated existing crypto assets: ${skipped}`);
    console.log(`Total crypto assets in database: ${finalCrypto}`);
    console.log(`Total assets in database: ${finalTotal}`);
    console.log("=========================\n");

  } catch (error) {
    logger.error({ err: error }, "Migration failed");
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateToCryptoOnly().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
