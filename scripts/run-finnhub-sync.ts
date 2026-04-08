#!/usr/bin/env tsx
import "dotenv/config";
import { FinnhubSyncService } from "@/lib/services/finnhub-sync.service";
import { prisma } from "@/lib/prisma";

async function main() {
  await FinnhubSyncService.syncAll(true);
}

main()
  .catch((err) => {
    console.error("Force Finnhub sync failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
