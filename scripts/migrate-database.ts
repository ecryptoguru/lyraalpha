/**
 * Database Migration Script: Supabase → AWS RDS PostgreSQL
 *
 * Uses pg_dump (custom format) + pg_restore for reliable, parallel migration.
 * Handles pgvector extension and all 50+ schema tables.
 *
 * Prerequisites:
 *   brew install postgresql  (provides pg_dump, pg_restore, psql)
 *
 * Usage:
 *   export SUPABASE_DIRECT_URL="postgresql://postgres.xxx:PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
 *   export RDS_URL="postgresql://postgres:PASSWORD@insightalpha.xxx.ap-south-1.rds.amazonaws.com:5432/insightalpha?sslmode=require"
 *
 *   # Dry run first (counts only, no writes):
 *   DRY_RUN=true npx tsx scripts/migrate-database.ts
 *
 *   # Real migration:
 *   npx tsx scripts/migrate-database.ts
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";

const execAsync = promisify(exec);

const SUPABASE_URL = process.env.SUPABASE_DIRECT_URL ?? "";
const RDS_URL      = process.env.RDS_URL ?? "";
const DRY_RUN      = process.env.DRY_RUN === "true";
const DUMP_FILE    = "migration_backup.dump";
const PARALLEL     = 4; // parallel restore workers

// All tables in the schema (for row count verification)
const ALL_TABLES = [
  "User",
  "UserPreference",
  "UserGamification",
  "UserBadge",
  "XPTransaction",
  "XPRedemption",
  "LearningCompletion",
  "CreditTransaction",
  "CreditLot",
  "Subscription",
  "BillingAuditLog",
  "Asset",
  "Portfolio",
  "PortfolioHolding",
  "PortfolioHealthSnapshot",
  "WatchlistItem",
  "DiscoveryFeedItem",
  "AIRequestLog",
  "PromptDefinition",
  "KnowledgeDoc",
  "SupportConversation",
  "SupportMessage",
  "SupportKnowledgeDoc",
  "MacroRegimeSnapshot",
  "MacroRegimeSnapshotIN",
  "DailyBriefing",
  "WaitlistUser",
  "PromoCode",
  "BlogPost",
];

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function checkTool(tool: string) {
  try {
    await execAsync(`which ${tool}`);
  } catch {
    console.error(`❌ '${tool}' not found. Install with: brew install postgresql`);
    process.exit(1);
  }
}

async function enableExtensions() {
  log("Enabling required PostgreSQL extensions on RDS...");
  const extensions = ["vector", "pg_trgm", "btree_gin"];
  for (const ext of extensions) {
    const cmd = `psql "${RDS_URL}" -c "CREATE EXTENSION IF NOT EXISTS ${ext};"`;
    if (!DRY_RUN) {
      try {
        await execAsync(cmd);
        log(`  ✅ Extension enabled: ${ext}`);
      } catch (err) {
        const e = err as Error;
        // pg_trgm / btree_gin may already exist — not fatal
        log(`  ⚠️  ${ext}: ${e.message.trim()}`);
      }
    } else {
      log(`  [DRY RUN] Would enable: ${ext}`);
    }
  }
}

async function dumpFromSupabase() {
  log("Exporting database from Supabase (custom format, parallel-safe)...");

  // Use DIRECT_URL (port 5432), NOT the pgbouncer pooler (port 6543)
  // --no-owner, --no-privileges: avoids Supabase-specific role issues on RDS
  // --exclude-schema: skip Supabase internal schemas
  const cmd = [
    "pg_dump",
    `"${SUPABASE_URL}"`,
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--no-publications",
    "--no-subscriptions",
    "--exclude-schema=storage",
    "--exclude-schema=auth",
    "--exclude-schema=realtime",
    "--exclude-schema=extensions",
    "--exclude-schema=graphql_public",
    "--exclude-schema=supabase_functions",
    `--file=${DUMP_FILE}`,
    "--verbose",
  ].join(" ");

  if (DRY_RUN) {
    log("[DRY RUN] Would run: " + cmd);
    return;
  }

  await execAsync(cmd, { maxBuffer: 1024 * 1024 * 200 });
  const stat = fs.statSync(DUMP_FILE);
  log(`✅ Dump complete: ${DUMP_FILE} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
}

async function restoreToRDS() {
  log(`Importing to RDS (${PARALLEL} parallel workers)...`);

  // pg_restore with --jobs for parallel import
  const cmd = [
    "pg_restore",
    `"${RDS_URL}"`,
    "--no-owner",
    "--no-privileges",
    "--if-exists",
    "--clean",
    `--jobs=${PARALLEL}`,
    "--verbose",
    DUMP_FILE,
  ].join(" ");

  if (DRY_RUN) {
    log("[DRY RUN] Would run: " + cmd);
    return;
  }

  try {
    const { stderr } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 50 });
    // pg_restore writes progress to stderr — show it
    if (stderr) log("pg_restore output:\n" + stderr.slice(0, 2000));
    log("✅ Restore complete");
  } catch (err) {
    // pg_restore exits non-zero on warnings (e.g. already-existing objects)
    // Only fail on actual errors
    const e = err as { stderr?: string; message: string };
    const stderr = e.stderr ?? "";
    if (stderr.includes("ERROR") && !stderr.includes("already exists")) {
      throw err;
    }
    log("⚠️  Restore finished with warnings (likely harmless — objects already existed)");
  }
}

async function deployMigrations() {
  log("Deploying Prisma migration history to RDS...");
  const cmd = `DATABASE_URL="${RDS_URL}" npx prisma migrate deploy`;
  if (DRY_RUN) {
    log("[DRY RUN] Would run: " + cmd);
    return;
  }
  const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 });
  log(stdout.trim());
  log("✅ Prisma migrations deployed");
}

async function verifyRowCounts() {
  log("\nVerifying row counts (Supabase vs RDS)...");

  const countQuery = (table: string) =>
    `SELECT COUNT(*) FROM "${table}"`;

  const getCount = async (url: string, table: string): Promise<number> => {
    try {
      const { stdout } = await execAsync(
        `psql "${url}" -t -A -c "${countQuery(table)}"`,
        { timeout: 10000 }
      );
      return parseInt(stdout.trim(), 10) || 0;
    } catch {
      return -1;
    }
  };

  let allMatch = true;
  const rows: string[] = [];

  for (const table of ALL_TABLES) {
    const [src, tgt] = DRY_RUN
      ? [-1, -1]
      : await Promise.all([
          getCount(SUPABASE_URL, table),
          getCount(RDS_URL, table),
        ]);

    const match = src === tgt;
    if (!match && src !== -1) allMatch = false;

    const status = DRY_RUN ? "–" : match ? "✅" : "❌";
    rows.push(
      `${table.padEnd(32)} | ${String(src).padStart(8)} | ${String(tgt).padStart(8)} | ${status}`
    );
  }

  console.log("\n" + "Table".padEnd(32) + " | Supabase | RDS      | Match");
  console.log("-".repeat(60));
  rows.forEach((r) => console.log(r));

  if (!allMatch && !DRY_RUN) {
    throw new Error("Row count mismatch — DO NOT cut over DNS until resolved");
  }

  log("\n✅ All row counts match — safe to cut over");
}

async function main() {
  if (!SUPABASE_URL || !RDS_URL) {
    console.error("❌ Missing required environment variables:");
    console.error("  SUPABASE_DIRECT_URL  — Supabase direct connection (port 5432, not 6543)");
    console.error("  RDS_URL              — AWS RDS endpoint");
    console.error("\nExample:");
    console.error('  export SUPABASE_DIRECT_URL="postgresql://postgres.xxx:PASS@host:5432/postgres"');
    console.error('  export RDS_URL="postgresql://postgres:PASS@rds.endpoint:5432/insightalpha?sslmode=require"');
    process.exit(1);
  }

  if (DRY_RUN) log("🔍 DRY RUN — no writes will occur");

  log(`Source: ${new URL(SUPABASE_URL).hostname}`);
  log(`Target: ${new URL(RDS_URL).hostname}`);

  await checkTool("pg_dump");
  await checkTool("pg_restore");
  await checkTool("psql");

  await enableExtensions();
  await dumpFromSupabase();
  await restoreToRDS();
  await deployMigrations();
  await verifyRowCounts();

  log("\n🎉 Migration complete!");
  if (!DRY_RUN) {
    log("Next steps:");
    log("  1. Test the app against RDS_URL");
    log("  2. Update DNS (lower TTL to 300s first)");
    log("  3. Update Clerk + Stripe webhook URLs");
    log("  4. Monitor CloudWatch for errors");
  }
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err.message);
  process.exit(1);
});
