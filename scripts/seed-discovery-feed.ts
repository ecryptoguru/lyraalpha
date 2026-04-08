/**
 * Seed Discovery Feed — runs the DRS pipeline once to populate DiscoveryFeedItem table.
 * Usage: npx tsx scripts/seed-discovery-feed.ts
 *
 * Uses the same computeDiscoveryFeed() as market-sync — zero logic duplication.
 * tsx v4.21+ resolves @/ path aliases from tsconfig.json natively.
 */

import "dotenv/config";
import { computeDiscoveryFeed } from "@/lib/services/discovery-intelligence.service";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("🔍 Seeding Discovery Feed...");

  const result = await computeDiscoveryFeed();

  console.log(`✅ Discovery feed seeded: ${result.surfaced} surfaced, ${result.suppressed} suppressed (${result.total} assets evaluated)`);

  // Log top 5 for verification
  const top5 = await prisma.discoveryFeedItem.findMany({
    where: { isSuppressed: false },
    orderBy: { drs: "desc" },
    take: 5,
    select: { symbol: true, drs: true, archetype: true, headline: true },
  });

  console.log("  Top 5 by DRS:");
  top5.forEach((r, i) => {
    console.log(`    ${i + 1}. ${r.symbol} — DRS ${r.drs} [${r.archetype}]`);
    console.log(`       ${r.headline}`);
  });

  await prisma.$disconnect();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
