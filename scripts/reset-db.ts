
import { prisma } from "../src/lib/prisma";
import { createLogger } from "../src/lib/logger";

// const prisma = new PrismaClient(); // Don't use new instance
const logger = createLogger({ service: "reset-db" });

// Baseline Asset List (Crypto only)
const BASELINE_ASSETS = [
  // --- CRYPTO (Top 30 by market cap) ---
  { symbol: "BTC-USD", name: "Bitcoin", type: "CRYPTO" },
  { symbol: "ETH-USD", name: "Ethereum", type: "CRYPTO" },
  { symbol: "SOL-USD", name: "Solana", type: "CRYPTO" },
  { symbol: "XRP-USD", name: "XRP", type: "CRYPTO" },
  { symbol: "ADA-USD", name: "Cardano", type: "CRYPTO" },
  { symbol: "DOGE-USD", name: "Dogecoin", type: "CRYPTO" },
  { symbol: "AVAX-USD", name: "Avalanche", type: "CRYPTO" },
  { symbol: "LINK-USD", name: "Chainlink", type: "CRYPTO" },
  { symbol: "DOT-USD", name: "Polkadot", type: "CRYPTO" },
  { symbol: "LTC-USD", name: "Litecoin", type: "CRYPTO" },
  { symbol: "ATOM-USD", name: "Cosmos", type: "CRYPTO" },
];

async function main() {
  logger.info("⚠️  Starting Database Reset & Seed...");

  // 1. Truncate Tables
  // Note: Truncate is faster than deleteMany, but Prisma supports deleteMany easily.
  // We delete dependent tables first.
  logger.info("🗑️  Cleaning existing data...");
  await prisma.assetScore.deleteMany({});
  await prisma.marketRegime.deleteMany({});
  await prisma.institutionalEvent.deleteMany({});
  await prisma.evidenceReference.deleteMany({});
  await prisma.stockSector.deleteMany({});
  await prisma.evidence.deleteMany({});
  await prisma.sectorRegime.deleteMany({});
  await prisma.sector.deleteMany({});
  await prisma.multiHorizonRegime.deleteMany({});
  await prisma.asset.deleteMany({}); // Delete assets last due to relations (though they were cascaded above largely)

  logger.info("✅ Database cleared.");

  // 2. Seed Baseline Assets
  logger.info(`🌱 Seeding ${BASELINE_ASSETS.length} baseline assets...`);

  for (const asset of BASELINE_ASSETS) {
    await prisma.asset.create({
      data: {
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type as "CRYPTO",
        // We initialize with null data, the Sync Engine will populate this.
      },
    });
  }

  logger.info("✅ Reset & Seed Complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
