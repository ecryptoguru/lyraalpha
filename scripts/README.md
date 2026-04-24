# Scripts

Operational scripts for LyraAlpha. Run with `npx tsx scripts/<name>.ts`
(or `node scripts/<name>.mjs` for bundled JS). Anything that mutates
production state requires explicit confirmation — no silent writes.

## Categories

### Recurring / daily
- **`daily-sync.ts`** — orchestrates daily market + knowledge syncs. Exposed
  as `npm run sync` / `sync:force` / `sync:dry`.
- **`prewarm-routes.ts`** — pre-warms key Next.js routes. `npm run perf:prewarm`.
- **`setup-qstash-schedules.ts`** — registers QStash cron schedules. `npm run qstash:setup`.

### Seeds
- **`seed-crypto-rag.ts`** — seeds the crypto RAG knowledge base.
- **`seed-discovery-feed.ts`** — seeds the discovery feed cache.
- **`seed-historical-analogs.ts`** — seeds historical market analogs.
- **`seed-index-benchmarks.ts`** — seeds benchmark index metadata.
- **`seed-stripe-credit-prices.ts`** — syncs Stripe credit-pack prices.
- **`seed-support-kb.ts`** — seeds the support knowledge base.

### One-off migrations
- **`migrate-blogpost-status-enum.mts`**
- **`migrate-database.ts`**
- **`migrate-embeddings.ts`**
- **`migrate-marketcap-float.mts`**
- **`migrate-to-crypto-only.ts`**

### Data / coverage audits
- **`audit-prompt-pipeline.ts`** — audits the AI prompt pipeline for regressions.
- **`benchmark-top50.ts`** — runs Lyra output benchmark against top-50 queries.
- **`check-blog-images.ts`** — finds blog posts missing hero images.
- **`check-crypto-coverage.ts`** — reports crypto asset coverage gaps.
- **`compare-audit-runs.ts`** — diffs two audit JSON artefacts.
- **`count-crypto-assets.ts`** — quick stat dump.
- **`eval-lyra.ts`** — evaluation harness for Lyra responses.
- **`generate-lyra-intel.ts`** — produces intel artefacts.
- **`backdate-market-regime.ts`** — backfills regime rows.
- **`enrich-crypto-coingecko.ts`** — enriches asset rows from CoinGecko.
- **`reingest-knowledge.ts`** — rebuilds the knowledge index.

### DB maintenance
- **`db-cleanup.ts`** + **`db-cleanup-safe.sql`**
- **`reset-db.ts`** — ⚠️ destructive; dev databases only.
- **`vacuum-database.ts`**

### Credit restoration (manual ops)
- **`restore-credits.ts`** — restores credits for users affected by billing issues.

### User/plan management
- **`sync-clerk-users.ts`** — reconciles Clerk → DB user rows.
- **`update-user-plan.ts`** — changes a user's plan tier.

### Cache & infra
- **`bootstrap.ts`** — project bootstrap helper.

### Assets & design
- **`generate-brand-assets.mjs`** — regenerates brand assets.
- **`generate-pwa-icons.ts`** — regenerates PWA icon set.

### Demo recording
- **`demo-capture.mjs`** — `npm run demo:capture`.
- **`demo-login.mjs`** — `npm run demo:login`.

### Ops (one-offs, low-churn)
Inside `scripts/ops/`:
- **`list-users.ts`** — lists users with plan + credits.
- **`verify-elite-users.ts`** — checks ELITE-tier user records.

## Conventions

- **Safe defaults**: any script that mutates data should accept `--dry-run`
  and default to read-only. Verify with `--dry-run` before re-running for real.
- **Imports**: most scripts import from `../src/lib/*` via relative paths,
  so they rely on `tsx` for TS execution and on the project's `tsconfig.json`
  for path resolution.
- **New scripts**: drop them at the appropriate section here when adding
  new ones; stale scripts that are tied to a specific incident should move
  into `scripts/ops/` once the incident closes.
