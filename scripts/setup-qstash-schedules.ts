/**
 * setup-qstash-schedules.ts
 *
 * One-time script: registers all cron schedules with Upstash QStash.
 * Run after deploy (or whenever schedules change):
 *
 *   QSTASH_TOKEN=xxx DEPLOYMENT_URL=https://your-app.vercel.app npx tsx scripts/setup-qstash-schedules.ts
 *
 * What it does:
 *   1. Fetches existing QStash schedules.
 *   2. Deletes any that are no longer in SCHEDULES (removed crons).
 *   3. Creates / updates schedules that are new or changed.
 *
 * Required env vars:
 *   QSTASH_TOKEN     — from Upstash QStash console (Settings → API Keys)
 *   DEPLOYMENT_URL   — your Vercel production URL, e.g. https://lyraalpha.vercel.app
 */

import { Client } from "@upstash/qstash";

const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
const DEPLOYMENT_URL = process.env.DEPLOYMENT_URL?.replace(/\/$/, "");

if (!QSTASH_TOKEN) {
  console.error("❌  QSTASH_TOKEN env var is required.");
  process.exit(1);
}
if (!DEPLOYMENT_URL) {
  console.error("❌  DEPLOYMENT_URL env var is required.");
  process.exit(1);
}

const client = new Client({ token: QSTASH_TOKEN });

type ScheduleEntry = {
  path: string;
  cron: string;
  retries?: number;
};

// ─── Cron Schedule Strategy ──────────────────────────────────────────────────
//
// Remaining schedules cover crypto sync, crypto/news refresh, daily briefing,
// portfolio/support housekeeping, and user retention jobs.
// All times UTC. retries defaults to 3 (QStash default).
// ─────────────────────────────────────────────────────────────────────────────
const SCHEDULES: ScheduleEntry[] = [
  { path: "/api/cron/us-eod-crypto-sync",      cron: "45 21 * * 1-5", retries: 3 },
  { path: "/api/cron/crypto-sync",        cron: "0 */8 * * *",   retries: 3 },
  { path: "/api/cron/news-sync",          cron: "0 */6 * * *",   retries: 3 },
  { path: "/api/cron/daily-briefing",     cron: "0 7 * * *",     retries: 3 },
  { path: "/api/cron/trending-questions", cron: "0 11 * * *",    retries: 3 },
  { path: "/api/cron/reengagement",       cron: "0 9 * * *",     retries: 2 },
  { path: "/api/cron/support-retention",  cron: "30 3 * * *",    retries: 2 },
  { path: "/api/cron/weekly-report",      cron: "0 10 * * 1",    retries: 2 },
  { path: "/api/cron/portfolio-health",   cron: "0 22 * * 1-5",  retries: 2 },
  { path: "/api/cron/award-daily-login",  cron: "0 0 * * *",     retries: 3 },
  { path: "/api/cron/reset-credits",      cron: "0 0 1 * *",     retries: 3 },
  { path: "/api/cron/expire-trials",      cron: "0 4 * * *",     retries: 3 },
  { path: "/api/cron/cache-stats",        cron: "5 0 * * *",     retries: 1 },
  { path: "/api/cron/embed-memory",       cron: "0 */6 * * *",   retries: 2 },
  { path: "/api/cron/blog-digest",        cron: "0 10 * * 1",    retries: 2 },
];

async function main() {
  console.log(`\n🚀  Setting up QStash schedules → ${DEPLOYMENT_URL}\n`);

  // Fetch existing schedules
  const existing = await client.schedules.list();
  const existingByUrl = new Map(existing.map((s) => [s.destination, s]));

  const desiredUrls = new Set(SCHEDULES.map((s) => `${DEPLOYMENT_URL}${s.path}`));

  // Remove stale schedules (URLs no longer in SCHEDULES)
  for (const [url, schedule] of existingByUrl) {
    if (!desiredUrls.has(url)) {
      await client.schedules.delete(schedule.scheduleId);
      console.log(`🗑   Removed stale schedule: ${url}`);
    }
  }

  // Create or update schedules
  for (const entry of SCHEDULES) {
    const url = `${DEPLOYMENT_URL}${entry.path}`;
    const existing_ = existingByUrl.get(url);

    if (existing_) {
      // QStash doesn't have an update endpoint — delete and recreate if cron changed.
      if (existing_.cron !== entry.cron) {
        await client.schedules.delete(existing_.scheduleId);
        await client.schedules.create({
          destination: url,
          cron: entry.cron,
          retries: entry.retries,
        });
        console.log(`♻️   Updated: ${entry.path}  (${entry.cron})`);
      } else {
        console.log(`✓   Unchanged: ${entry.path}  (${entry.cron})`);
      }
    } else {
      await client.schedules.create({
        destination: url,
        cron: entry.cron,
        retries: entry.retries,
      });
      console.log(`✅  Created: ${entry.path}  (${entry.cron})`);
    }
  }

  console.log("\n✅  QStash schedule setup complete.\n");
}

main().catch((err) => {
  console.error("❌  Setup failed:", err);
  process.exit(1);
});
