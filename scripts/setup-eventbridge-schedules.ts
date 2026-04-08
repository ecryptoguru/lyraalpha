/**
 * EventBridge Scheduler Setup
 *
 * Migrates QStash cron jobs to AWS EventBridge Scheduler.
 *
 * KEY DESIGN: EventBridge POSTs directly to your existing Next.js /api/cron/* routes
 * via an HTTP target — NO Lambda rewrites needed. Your cron-auth middleware already
 * validates the CRON_SECRET Bearer token.
 *
 * Prerequisites:
 *   npm install @aws-sdk/client-scheduler @aws-sdk/client-iam
 *
 * Setup:
 *   export AWS_REGION="ap-south-1"
 *   export AWS_ACCOUNT_ID="123456789012"
 *   export APP_URL="https://app.yourdomain.com"
 *   export CRON_SECRET="your-cron-secret-from-env"
 *
 * Commands:
 *   npx tsx scripts/setup-eventbridge-schedules.ts setup   — create all schedules
 *   npx tsx scripts/setup-eventbridge-schedules.ts list    — list existing
 *   npx tsx scripts/setup-eventbridge-schedules.ts delete  — remove all
 */

import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
  ListSchedulesCommand,
  FlexibleTimeWindowMode,
  ActionAfterCompletion,
  UpdateScheduleCommand,
} from "@aws-sdk/client-scheduler";

const REGION       = process.env.AWS_REGION      ?? "ap-south-1";
const ACCOUNT_ID   = process.env.AWS_ACCOUNT_ID  ?? "";
const APP_URL      = (process.env.APP_URL ?? "").replace(/\/$/, "");
const CRON_SECRET  = process.env.CRON_SECRET     ?? "";
const ROLE_ARN     = `arn:aws:iam::${ACCOUNT_ID}:role/EventBridgeSchedulerRole`;

// ── All 29 cron schedules ──────────────────────────────────────────────────
// Times are UTC. India market: 03:45–10:00 UTC. US market: 13:30–20:00 UTC.
const SCHEDULES: Array<{
  name: string;
  route: string;
  expression: string;
  description: string;
}> = [
  {
    name: "award-daily-login",
    route: "/api/cron/award-daily-login",
    expression: "cron(0 6 * * ? *)",
    description: "Award daily login XP/credits to active users — daily 6 AM UTC",
  },
  {
    name: "blog-digest",
    route: "/api/cron/blog-digest",
    expression: "cron(0 9 ? * MON *)",
    description: "Weekly blog digest email — Mondays 9 AM UTC",
  },
  {
    name: "cache-stats",
    route: "/api/cron/cache-stats",
    expression: "rate(5 minutes)",
    description: "Record Redis cache statistics every 5 minutes",
  },
  {
    name: "crypto-sync",
    route: "/api/cron/crypto-sync",
    expression: "cron(0 */4 * * ? *)",
    description: "Sync crypto prices from CoinGecko — every 4 hours",
  },
  {
    name: "daily-briefing",
    route: "/api/cron/daily-briefing",
    expression: "cron(0 7 * * ? *)",
    description: "Generate and send daily market briefing — daily 7 AM UTC",
  },
  {
    name: "embed-memory",
    route: "/api/cron/embed-memory",
    expression: "cron(0 2 * * ? *)",
    description: "Process and embed AI memory logs — daily 2 AM UTC",
  },
  {
    name: "expire-trials",
    route: "/api/cron/expire-trials",
    expression: "cron(0 0 * * ? *)",
    description: "Expire ended trial subscriptions — daily midnight UTC",
  },
  {
    name: "full-sync",
    route: "/api/cron/full-sync",
    expression: "cron(0 3 ? * SUN *)",
    description: "Full data re-sync — Sundays 3 AM UTC",
  },
  {
    name: "in-eod-pipeline",
    route: "/api/cron/in-eod-pipeline",
    expression: "cron(30 10 * * ? *)",
    description: "India EOD pipeline — daily 10:30 AM UTC (after NSE close 10 AM UTC)",
  },
  {
    name: "in-eod-postprocess",
    route: "/api/cron/in-eod-postprocess",
    expression: "cron(0 11 * * ? *)",
    description: "India EOD post-processing — daily 11 AM UTC",
  },
  {
    name: "in-eod-sync",
    route: "/api/cron/in-eod-sync",
    expression: "cron(0 10 * * ? *)",
    description: "India EOD price sync — daily 10 AM UTC",
  },
  {
    name: "in-market-sync",
    route: "/api/cron/in-market-sync",
    expression: "cron(0/15 3-10 ? * MON-FRI *)",
    description: "India intraday sync — every 15 min, Mon-Fri 3:45-10 AM UTC",
  },
  {
    name: "india-sync",
    route: "/api/cron/india-sync",
    expression: "cron(0 4 * * ? *)",
    description: "India daily master sync — daily 4 AM UTC",
  },
  {
    name: "mf-holdings-sync",
    route: "/api/cron/mf-holdings-sync",
    expression: "cron(0 5 * * ? *)",
    description: "Mutual fund holdings sync — daily 5 AM UTC",
  },
  {
    name: "news-sync",
    route: "/api/cron/news-sync",
    expression: "cron(0 */2 * * ? *)",
    description: "Sync news from sources — every 2 hours",
  },
  {
    name: "portfolio-health",
    route: "/api/cron/portfolio-health",
    expression: "cron(0 8 * * ? *)",
    description: "Portfolio health snapshots — daily 8 AM UTC",
  },
  {
    name: "reengagement",
    route: "/api/cron/reengagement",
    expression: "cron(0 10 ? * MON *)",
    description: "Re-engagement emails to inactive users — Mondays 10 AM UTC",
  },
  {
    name: "reset-credits",
    route: "/api/cron/reset-credits",
    expression: "cron(0 0 1 * ? *)",
    description: "Reset monthly plan credits — 1st of each month, midnight UTC",
  },
  {
    name: "support-retention",
    route: "/api/cron/support-retention",
    expression: "cron(0 12 ? * WED *)",
    description: "Support retention analysis — Wednesdays noon UTC",
  },
  {
    name: "trending-questions",
    route: "/api/cron/trending-questions",
    expression: "cron(0 */6 * * ? *)",
    description: "Update trending Lyra questions — every 6 hours",
  },
  {
    name: "us-eod-commodities-sync",
    route: "/api/cron/us-eod-commodities-sync",
    expression: "cron(30 21 * * ? *)",
    description: "US commodities EOD sync — daily 9:30 PM UTC (after NY close)",
  },
  {
    name: "us-eod-crypto-sync",
    route: "/api/cron/us-eod-crypto-sync",
    expression: "cron(0 22 * * ? *)",
    description: "US crypto EOD sync — daily 10 PM UTC",
  },
  {
    name: "us-eod-etfs-sync",
    route: "/api/cron/us-eod-etfs-sync",
    expression: "cron(0 21 * * ? *)",
    description: "US ETFs EOD sync — daily 9 PM UTC",
  },
  {
    name: "us-eod-pipeline",
    route: "/api/cron/us-eod-pipeline",
    expression: "cron(0 22 * * ? *)",
    description: "US EOD data pipeline — daily 10 PM UTC",
  },
  {
    name: "us-eod-postprocess",
    route: "/api/cron/us-eod-postprocess",
    expression: "cron(30 22 * * ? *)",
    description: "US EOD post-processing — daily 10:30 PM UTC",
  },
  {
    name: "us-eod-stocks-sync",
    route: "/api/cron/us-eod-stocks-sync",
    expression: "cron(30 20 * * ? *)",
    description: "US stocks EOD sync — daily 8:30 PM UTC",
  },
  {
    name: "us-eod-sync",
    route: "/api/cron/us-eod-sync",
    expression: "cron(0 20 * * ? *)",
    description: "US EOD master sync — daily 8 PM UTC",
  },
  {
    name: "us-market-sync",
    route: "/api/cron/us-market-sync",
    expression: "cron(0/15 13-20 ? * MON-FRI *)",
    description: "US intraday sync — every 15 min, Mon-Fri 1:30-8 PM UTC",
  },
  {
    name: "weekly-report",
    route: "/api/cron/weekly-report",
    expression: "cron(0 9 ? * MON *)",
    description: "Generate weekly reports — Mondays 9 AM UTC",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function validate() {
  const missing: string[] = [];
  if (!ACCOUNT_ID) missing.push("AWS_ACCOUNT_ID");
  if (!APP_URL)    missing.push("APP_URL");
  if (!CRON_SECRET) missing.push("CRON_SECRET");
  if (missing.length) {
    console.error("❌ Missing environment variables:", missing.join(", "));
    console.error("\nExample:");
    console.error('  export AWS_ACCOUNT_ID="123456789012"');
    console.error('  export APP_URL="https://app.yourdomain.com"');
    console.error('  export CRON_SECRET="your-cron-secret"');
    process.exit(1);
  }
}

// ── Commands ───────────────────────────────────────────────────────────────

async function setupSchedules() {
  validate();
  const client = new SchedulerClient({ region: REGION });
  console.log(`\n🚀 Creating ${SCHEDULES.length} EventBridge schedules in ${REGION}...\n`);

  let created = 0;
  let skipped = 0;
  let failed  = 0;

  for (const s of SCHEDULES) {
    const fullUrl = `${APP_URL}${s.route}`;
    try {
      await client.send(new CreateScheduleCommand({
        Name: `insightalpha-${s.name}`,
        Description: s.description,
        ScheduleExpression: s.expression,
        ScheduleExpressionTimezone: "UTC",
        FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
        State: "ENABLED",
        ActionAfterCompletion: ActionAfterCompletion.NONE,
        Target: {
          // HTTP target — calls your existing Next.js API route directly
          Arn: "arn:aws:scheduler:::aws-sdk:https",
          RoleArn: ROLE_ARN,
          Input: JSON.stringify({
            method: "POST",
            uri: fullUrl,
            headers: [
              { name: "Authorization", value: `Bearer ${CRON_SECRET}` },
              { name: "Content-Type",  value: "application/json" },
            ],
            body: "{}",
          }),
        },
      }));
      console.log(`  ✅ ${s.name.padEnd(30)} ${s.expression}`);
      created++;
    } catch (err) {
      const e = err as Error;
      if (e.name === "ConflictException") {
        console.log(`  ⚠️  ${s.name.padEnd(30)} already exists — skipping`);
        skipped++;
      } else {
        console.error(`  ❌ ${s.name.padEnd(30)} ${e.message}`);
        failed++;
      }
    }
  }

  console.log(`\n📊 Result: ${created} created, ${skipped} skipped, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

async function updateSchedules() {
  validate();
  const client = new SchedulerClient({ region: REGION });
  console.log(`\n🔄 Updating ${SCHEDULES.length} EventBridge schedules...\n`);

  for (const s of SCHEDULES) {
    const fullUrl = `${APP_URL}${s.route}`;
    try {
      await client.send(new UpdateScheduleCommand({
        Name: `insightalpha-${s.name}`,
        Description: s.description,
        ScheduleExpression: s.expression,
        ScheduleExpressionTimezone: "UTC",
        FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
        State: "ENABLED",
        ActionAfterCompletion: ActionAfterCompletion.NONE,
        Target: {
          Arn: "arn:aws:scheduler:::aws-sdk:https",
          RoleArn: ROLE_ARN,
          Input: JSON.stringify({
            method: "POST",
            uri: fullUrl,
            headers: [
              { name: "Authorization", value: `Bearer ${CRON_SECRET}` },
              { name: "Content-Type",  value: "application/json" },
            ],
            body: "{}",
          }),
        },
      }));
      console.log(`  ✅ Updated: ${s.name}`);
    } catch (err) {
      const e = err as Error;
      console.error(`  ❌ ${s.name}: ${e.message}`);
    }
  }
}

async function listSchedules() {
  const client = new SchedulerClient({ region: REGION });
  try {
    const resp = await client.send(new ListSchedulesCommand({ NamePrefix: "insightalpha-" }));
    const items = resp.Schedules ?? [];
    if (items.length === 0) {
      console.log("No InsightAlpha schedules found.");
      return;
    }
    console.log(`\n📋 ${items.length} InsightAlpha schedules:\n`);
    items.forEach((s) => {
      console.log(`  ${(s.Name ?? "").padEnd(45)} ${s.State}`);
    });
  } catch (err) {
    const e = err as Error;
    console.error("❌ Failed to list schedules:", e.message);
  }
}

async function deleteSchedules() {
  const client = new SchedulerClient({ region: REGION });
  console.log("⚠️  Deleting all InsightAlpha schedules in 5 seconds — Ctrl+C to cancel...\n");
  await new Promise((r) => setTimeout(r, 5000));

  let deleted = 0;
  for (const s of SCHEDULES) {
    try {
      await client.send(new DeleteScheduleCommand({ Name: `insightalpha-${s.name}` }));
      console.log(`  🗑️  Deleted: ${s.name}`);
      deleted++;
    } catch (err) {
      const e = err as Error;
      if (e.name === "ResourceNotFoundException") {
        console.log(`  –  Not found: ${s.name}`);
      } else {
        console.error(`  ❌ ${s.name}: ${e.message}`);
      }
    }
  }
  console.log(`\n✅ Deleted ${deleted} schedules`);
}

// ── Main ───────────────────────────────────────────────────────────────────

const cmd = process.argv[2];

const HELP = `
Usage: npx tsx scripts/setup-eventbridge-schedules.ts <command>

Commands:
  setup    Create all 29 EventBridge schedules (HTTP → Next.js /api/cron/* routes)
  update   Update existing schedules (e.g. after APP_URL change)
  list     List existing InsightAlpha schedules
  delete   Delete all InsightAlpha schedules

Required environment variables:
  AWS_REGION        AWS region (default: ap-south-1)
  AWS_ACCOUNT_ID    Your 12-digit AWS account ID
  APP_URL           Production app URL (e.g. https://app.yourdomain.com)
  CRON_SECRET       Value of CRON_SECRET env var (for Bearer auth)

How it works:
  EventBridge sends POST requests to your existing /api/cron/* routes.
  Your cron-auth middleware validates the Bearer token against CRON_SECRET.
  No Lambda functions required — same Next.js code runs on SST.
`;

switch (cmd) {
  case "setup":   setupSchedules(); break;
  case "update":  updateSchedules(); break;
  case "list":    listSchedules(); break;
  case "delete":  deleteSchedules(); break;
  default:
    console.log(HELP);
    process.exit(cmd ? 1 : 0);
}
