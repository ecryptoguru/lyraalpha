#!/usr/bin/env tsx
/**
 * Master Sync — delegates to daily-sync.ts
 *
 * This file is kept for backward compatibility with existing cron endpoints
 * and npm scripts. All logic now lives in daily-sync.ts.
 *
 * Usage: npx tsx scripts/master-sync.ts [--region=US|IN] [--force]
 */

import { execSync } from "child_process";

const args = process.argv.slice(2);
const passthrough = args.join(" ");

console.log("🔀 master-sync.ts → delegating to daily-sync.ts");
execSync(`npx tsx scripts/daily-sync.ts ${passthrough}`, {
  stdio: "inherit",
  cwd: process.cwd(),
});
