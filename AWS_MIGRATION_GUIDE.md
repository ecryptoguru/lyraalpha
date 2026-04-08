# LyraAlpha — AWS Migration Guide

Migrate from **Vercel + Supabase** to **AWS** using SST (Ion) + OpenNext + RDS PostgreSQL.

**Stack after migration:**
- Hosting: SST (Ion) + OpenNext → Lambda + CloudFront + S3 (ap-south-1)
- Database: Amazon RDS PostgreSQL db.t3.small (ap-south-1)
- Cache: Upstash Redis (unchanged — no ElastiCache needed at current scale)
- Cron: AWS EventBridge Scheduler → HTTP POST to `/api/cron/*` routes
- Auth: Clerk (unchanged)
- Payments: Stripe (unchanged, update webhook URL only)

**Estimated cost post-migration:** ~$33–58/mo (vs ~$45–55/mo now)
**$1,000 AWS credits covers ~17–30 months of AWS costs.**

---

## Prerequisites

```bash
# AWS CLI
brew install awscli
aws configure   # enter access key, secret, region: ap-south-1

# PostgreSQL tools (for migration script)
brew install postgresql@16
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# Node 20+
node --version  # must be 20+

# SST
npm install sst@ion --save-dev
```

---

## Day 1–2: Database Migration (Supabase → RDS)

### Step 1: Create RDS Instance

In AWS Console → RDS → Create database:

| Setting | Value |
|---------|-------|
| Engine | PostgreSQL 16 |
| Template | Production |
| Instance class | db.t3.small |
| Storage type | gp3 (cheaper than gp2) |
| Allocated storage | 20 GB |
| Auto-scaling max | 100 GB |
| Region | ap-south-1 |
| Multi-AZ | No (enable later at scale) |
| Public access | No |
| Backup retention | 7 days |
| Database name | `lyraalpha` |

Or via CLI:
```bash
aws rds create-db-instance \
  --db-instance-identifier lyraalpha-prod \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 16.3 \
  --allocated-storage 20 \
  --max-allocated-storage 100 \
  --storage-type gp3 \
  --master-username postgres \
  --master-user-password "$(openssl rand -base64 24)" \
  --db-name lyraalpha \
  --region ap-south-1 \
  --backup-retention-period 7 \
  --enable-performance-insights \
  --no-publicly-accessible \
  --no-multi-az
```

> Save the master password — you'll need it for DATABASE_URL.

### Step 2: Enable pgvector (Critical — do this BEFORE restoring data)

Your schema uses `vector(1536)` columns. Run this immediately after RDS is available:

```bash
export RDS_URL="postgresql://postgres:PASSWORD@lyraalpha.XXXX.ap-south-1.rds.amazonaws.com:5432/lyraalpha?sslmode=require"

psql "$RDS_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql "$RDS_URL" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
psql "$RDS_URL" -c "CREATE EXTENSION IF NOT EXISTS btree_gin;"
```

### Step 3: Run Migration Script

```bash
export SUPABASE_DIRECT_URL="postgresql://postgres.gcdbpijawqhrcjwrtval:PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
export RDS_URL="postgresql://postgres:PASSWORD@lyraalpha.XXXX.ap-south-1.rds.amazonaws.com:5432/lyraalpha?sslmode=require"

# Dry run first — counts only, no writes
DRY_RUN=true npx tsx scripts/migrate-database.ts

# Real migration (takes 5–15 min depending on data size)
npx tsx scripts/migrate-database.ts
```

The script:
1. Exports Supabase DB in custom format (`pg_dump --format=custom`)
2. Restores to RDS with 4 parallel workers (`pg_restore --jobs=4`)
3. Deploys Prisma migration history (`prisma migrate deploy`)
4. Verifies row counts across all 29+ tables

### Step 4: Test RDS Connection

```bash
DATABASE_URL="$RDS_URL" npx prisma studio
# Browse tables, verify data looks correct
```

---

## Day 3: App Deployment via SST

### Step 1: Initialize SST

```bash
# sst.config.ts is already created in the project root
# Install SST
npm install sst@ion --save-dev

# Bootstrap SST in your AWS account (one-time)
npx sst bootstrap
```

### Step 2: Set All Secrets

Run each line — replace values with your actual credentials:

```bash
npx sst secret set DatabaseUrl      "postgresql://postgres:PASS@rds-endpoint:5432/lyraalpha?sslmode=require"
npx sst secret set DirectUrl        "postgresql://postgres:PASS@rds-endpoint:5432/lyraalpha?sslmode=require"
npx sst secret set ClerkSecretKey   "sk_live_..."
npx sst secret set ClerkWebhookSecret "whsec_..."
npx sst secret set StripeSecretKey  "sk_live_..."
npx sst secret set StripeWebhookSecret "whsec_..."
npx sst secret set StripeProPriceId   "price_..."
npx sst secret set StripeElitePriceId "price_..."
npx sst secret set AzureOpenaiKey   "your-azure-key"
npx sst secret set AzureOpenaiEndpoint "https://lyraalpha-resource.cognitiveservices.azure.com"
npx sst secret set OpenrouterKey    "sk-or-v1-..."
npx sst secret set GeminiApiKey     "AIza..."
npx sst secret set UpstashRedisRestUrl   "https://in-mouse-53951.upstash.io"
npx sst secret set UpstashRedisRestToken "your-upstash-token"
npx sst secret set CronSecret       "your-cron-secret"
npx sst secret set TavilyApiKey     "tvly-..."
npx sst secret set CoingeckoApiKey  "CG-..."
npx sst secret set BrevoApiKey      "xkeysib-..."
npx sst secret set VapidPrivateKey  "your-vapid-private-key"
npx sst secret set DeepgramApiKey   "your-deepgram-key"
npx sst secret set VoiceSessionSecret "your-voice-session-secret"
```

Also set the public env vars in `sst.config.ts` (already done — just update the domain):

```typescript
// In sst.config.ts, uncomment and update:
domain: {
  name: "app.yourdomain.com",
  dns: sst.aws.dns(),
},
```

### Step 3: Update `next.config.ts`

```bash
# Replace VERCEL_ENV check with NODE_ENV
# Already noted in the migration plan — one-line change:
sed -i '' 's/process.env.VERCEL_ENV === "production"/process.env.NODE_ENV === "production"/g' next.config.ts
```

Also remove `https://va.vercel-scripts.com` from the CSP in `next.config.ts` (Vercel Analytics, no longer needed).

### Step 4: Deploy to Staging First

```bash
# Deploy to staging (creates separate CloudFront + Lambda stack)
npx sst deploy --stage staging

# SST outputs your staging URL — test all flows:
# ✅ Sign in / sign up (Clerk)
# ✅ Dashboard loads
# ✅ Lyra AI chat (streaming)
# ✅ Portfolio sync
# ✅ Credit deduction
# ✅ Cron endpoint: curl -X POST https://staging-url/api/cron/cache-stats \
#      -H "Authorization: Bearer $CRON_SECRET"
```

### Step 5: Deploy to Production

```bash
npx sst deploy --stage production
```

Note your CloudFront distribution URL from the output.

---

## Day 4: Cron Jobs — EventBridge Scheduler

### Step 1: Create IAM Role for EventBridge

```bash
# Create the role EventBridge Scheduler will assume
aws iam create-role \
  --role-name EventBridgeSchedulerRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "scheduler.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' \
  --region ap-south-1

# Attach the HTTPS invocation policy
aws iam put-role-policy \
  --role-name EventBridgeSchedulerRole \
  --policy-name AllowHttpsInvoke \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "scheduler:InvokeSchedule",
      "Resource": "*"
    }]
  }'
```

### Step 2: Create All 29 Schedules

```bash
export AWS_REGION="ap-south-1"
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export APP_URL="https://app.yourdomain.com"
export CRON_SECRET="your-cron-secret"

# Create schedules
npx tsx scripts/setup-eventbridge-schedules.ts setup

# Verify
npx tsx scripts/setup-eventbridge-schedules.ts list
```

EventBridge sends `POST https://app.yourdomain.com/api/cron/<name>` with:
```
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json
```

Your existing `cron-auth.ts` middleware already validates this Bearer token — **no code changes needed**.

---

## Day 5: DNS Cutover

### Step 1: Pre-lower TTL (do 24h before cutover)

In your current DNS provider, set TTL to 300 seconds for the main domain record.

### Step 2: Update Webhooks BEFORE switching DNS

- **Clerk Dashboard** → Webhooks → Update URL to `https://app.yourdomain.com/api/webhooks/clerk`
- **Stripe Dashboard** → Developers → Webhooks → Update URL to `https://app.yourdomain.com/api/webhooks/stripe`

### Step 3: Switch DNS

**Option A — Route 53 (if using custom domain in SST):**
SST automatically provisions CloudFront + ACM certificate. Update your registrar's nameservers to Route 53.

**Option B — External DNS (CNAME):**
```
CNAME app.yourdomain.com → dXXXXXXXXXXXX.cloudfront.net
```

Get your CloudFront domain from:
```bash
npx sst show --stage production
```

### Step 4: Verify

```bash
# Check DNS propagated
dig app.yourdomain.com

# Hit the health endpoint
curl https://app.yourdomain.com/api/health

# Check a cron route works
curl -X POST https://app.yourdomain.com/api/cron/cache-stats \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Day 6–7: Monitoring + Cleanup

### CloudWatch Alarms

```bash
# RDS CPU > 80%
aws cloudwatch put-metric-alarm \
  --alarm-name "LyraAlpha-RDS-CPU" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --dimensions Name=DBInstanceIdentifier,Value=lyraalpha-prod \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --period 300 \
  --statistic Average \
  --alarm-actions arn:aws:sns:ap-south-1:ACCOUNT_ID:alerts

# Lambda error rate
aws cloudwatch put-metric-alarm \
  --alarm-name "LyraAlpha-Lambda-Errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --period 60 \
  --statistic Sum

# RDS connections > 80 (t3.small max_connections ~170)
aws cloudwatch put-metric-alarm \
  --alarm-name "LyraAlpha-RDS-Connections" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --dimensions Name=DBInstanceIdentifier,Value=lyraalpha-prod \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --period 300 \
  --statistic Average
```

### After 48h Stable — Cleanup

```bash
# Remove QStash schedules (stop paying for them)
# In Upstash console → QStash → delete all LyraAlpha schedules

# Downgrade Supabase to free plan (keep 1 week as backup)
# Supabase Console → Project Settings → Billing

# Remove Vercel project (keep 2 weeks for rollback confidence)
# Vercel Console → Project → Settings → Delete

# Enable RDS deletion protection
aws rds modify-db-instance \
  --db-instance-identifier lyraalpha-prod \
  --deletion-protection \
  --apply-immediately
```

---

## Rollback Plan

If anything goes wrong after DNS cutover:

```bash
# 1. Point DNS back to Vercel (CNAME to cname.vercel-dns.com)
# TTL is 300s so takes <5 min to propagate

# 2. Vercel still has your last deployment live — it never went down
# No code changes needed

# 3. Keep RDS running for debugging (don't delete it)
```

---

## Cost Breakdown (ap-south-1, 2025)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| RDS db.t3.small | ~$27 | On-demand; ~$19 with 1yr Reserved |
| Lambda (SST) | ~$5–20 | Scales with traffic |
| CloudFront | ~$1–10 | First 1 TB/mo is cheap |
| S3 (static assets) | <$1 | |
| EventBridge Scheduler | $0 | 14M free invocations/mo; you use ~20K |
| Secrets Manager | ~$1 | |
| Upstash Redis | $0–10 | Unchanged |
| **Total** | **~$34–69/mo** | vs $45–55/mo now |

**$1,000 AWS credits → covers ~15–30 months at current scale.**

---

## Files Changed by This Migration

| File | Change |
|------|--------|
| `sst.config.ts` | **NEW** — SST deployment config (replaces Amplify) |
| `scripts/migrate-database.ts` | **UPDATED** — pg_restore + pgvector support |
| `scripts/setup-eventbridge-schedules.ts` | **UPDATED** — HTTP targets, not Lambda ARNs |
| `src/lib/prisma-aws.ts` | **UPDATED** — RDS SSL config, no debug logs |
| `.env.aws.template` | **UPDATED** — Removed ElastiCache, no real secrets |
| `next.config.ts` | **1 line change** — `VERCEL_ENV` → `NODE_ENV` |
| `src/lib/redis-aws.ts` | **DELETED** — Upstash stays, no ElastiCache needed |
| `amplify.yml` | **DELETED** — Not using Amplify |
| `amplify-backend.json` | **DELETED** — Not using Amplify |
| `infrastructure/cdk/` | **KEPT** — CDK not needed for SST but harmless |




# 1. Install SST
npm install sst@ion --save-dev
 
# 2. Create RDS in AWS Console (ap-south-1, db.t3.small, gp3, db name: lyraalpha)
 
# 3. Enable pgvector on RDS
psql "$RDS_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
 
# 4. Migrate database
SUPABASE_DIRECT_URL="..." RDS_URL="..." npx tsx scripts/migrate-database.ts
 
# 5. Set SST secrets + deploy
npx sst secret set DatabaseUrl "..."   # (repeat for all 21 secrets)
npx sst deploy --stage staging         # test first
npx sst deploy --stage production
 
# 6. Create EventBridge schedules
AWS_ACCOUNT_ID="..." APP_URL="https://yourdomain.com" CRON_SECRET="..." \
  npx tsx scripts/setup-eventbridge-schedules.ts setup
 
# 7. Switch DNS → done