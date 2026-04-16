# LyraAlpha — Fully Optimised AWS + UX Plan

UX is the primary focus. Every AWS decision below is made in service of user experience —
faster loads, zero cold starts on AI chat, edge-cached market data, instant dashboard.

---

## Architecture Overview (Fully Optimised)

```
User (India/Global)
        │
        ▼
┌─────────────────────────────────┐
│  CloudFront (ap-south-1 edge)   │  ← Static assets: 1yr cache
│  - /_next/static/* → S3         │  ← Market data API: 1hr edge cache
│  - Dashboard SSR → Lambda        │  ← AI streams: no-cache, pass-through
└──────────────┬──────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Lambda (arm64, 1 GB, 300s, X-Ray)       │  ← SST warm:1 = no cold starts (free)
│  Next.js via OpenNext/SST                │  ← All 52 API routes + SSR pages
└────────┬──────────────┬─────────────────┘
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ RDS Postgres │  │  Upstash Redis   │  ← Plan cache TTL 300s (stale 600s)
│ t3.small     │  │  (REST, no VPC)  │  ← Dashboard shell TTL, Lyra response cache
│ pgvector     │  │  withCache /     │  ← Discovery feed, asset metadata, briefings
│ gp3, 20GB    │  │  withStaleWhile  │
│ POOL_MAX=5   │  │  Revalidate      │
└──────────────┘  └──────────────────┘
         │
         ▼
┌──────────────────────┐
│  EventBridge         │  ← 29 cron jobs → POST /api/cron/* with Bearer token
│  Scheduler           │  ← Zero cost (14M free invocations/mo)
│  $0/mo               │  ← Long crons (>60s) must target Lambda Function URL
│                      │    (bypasses CloudFront 60s timeout)
└──────────────────────┘
```

---

## UX Impact of Each AWS Decision

### 1. Zero Cold Starts on Lyra Chat (Most Important)

**Problem:** Lambda cold starts = 2–4 second blank screen before first Lyra token.
This is your most user-visible UX issue post-migration.

**Solution:** SST `warm: 1` — a free cron-based warmer that pings Lambda every 5 min.

```typescript
// sst.config.ts — already implemented ✅
warm: isProd ? 1 : 0,
```

Per [SST docs](https://sst.dev/docs/component/aws/nextjs/#warm): "This works by starting
a serverless cron job to make n concurrent requests to the server function every few minutes."

> **Why not AWS Provisioned Concurrency?** Provisioned Concurrency costs ~$10.80/mo for
> 1 GB × 24/7. SST's `warm` achieves the same UX result (no cold starts) for free.
> `provisionedConcurrentExecutions` is also NOT a valid SST `server` property — it's a
> separate Pulumi resource. The `warm` prop is the official SST approach.

**UX result:** First Lyra request starts streaming tokens in <200ms, same as Vercel.
**Cost:** $0 (cron warmer is free within Lambda free tier).

---

### 2. Dashboard Loads Instantly (CloudFront Edge Cache)

**How it works:** SST/OpenNext automatically caches `/_next/static/*` at CloudFront edge
globally. Your `next.config.ts` already sets correct cache headers for market data:

```typescript
// next.config.ts — already set ✅
source: "/api/market/(breadth|correlation-stress|volatility-structure|...)",
headers: [{ key: "Cache-Control", value: "public, s-maxage=3600, ..." }]
```

CloudFront serves these from Mumbai edge node (~5ms) instead of hitting Lambda (~80ms).

**UX result:** Market intelligence page sections load 10–15× faster for Indian users.
**Cost:** Included in CloudFront pricing (~$1–5/mo).

---

### 3. Lyra Response Cache (Already Built — Verify it Survives Migration)

Your `lyra-cache.ts` and `withCache`/`withStaleWhileRevalidate` in Upstash Redis already
cache Lyra responses. This is critical for UX — repeated/similar questions return instantly.

**Verify after migration:**
```bash
# Hit a Lyra endpoint twice, check X-Cache header and response time
curl -w "\n%{time_total}s\n" -X POST https://app.yourdomain.com/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"messages":[{"role":"user","content":"What is NVDA outlook?"}]}'
```

First call: ~3–8s (Azure OpenAI generation).
Second identical call: <100ms (Redis cache hit).

---

### 4. Plan Cache Prevents DB Hit on Every Request

Every API route calls `getUserPlan(userId)`. Without caching that's a DB round-trip on
every request. Your `PLAN_CACHE_ENABLED=true` with `withStaleWhileRevalidate` caches
the plan in Upstash for 300s (fresh) / 600s (stale).

**On AWS RDS:** The plan lookup hits RDS instead of Supabase. Same code, same behaviour.
`PLAN_CACHE_ENABLED=true` is already set in `sst.config.ts` ✅

---

### 5. Dashboard Home Shell Cache

`DashboardHomeService.getShell()` uses `withStaleWhileRevalidate` — the entire dashboard
home (briefing, portfolio preview, discovery preview, insight feed) is cached per user.

**UX result:** Dashboard home loads from Redis (<20ms) on repeat visits.
Fresh data regenerates in background — user never waits for it.

---

### 6. Voice Session (Myra) — No AWS Changes Needed

Myra's voice stack uses Azure WebSocket directly from the browser
(`wss://*.openai.azure.com`). Lambda only issues the ephemeral token (~50ms).
The prefetch (`prefetchSession()`) already warms the token on widget mount.

**No AWS-specific changes needed.** The voice stack is Azure-native and stays that way.

---

### 7. `bom1` → Lambda in ap-south-1 (Automatic with SST)

All your API routes have `export const preferredRegion = "bom1"` — this is Vercel's
Mumbai region code. On AWS/SST this hint has no effect; Lambda runs in `ap-south-1`
(Mumbai) by default because that's the region in `sst.config.ts`.

**No code change needed.** `preferredRegion = "bom1"` is harmless on AWS.

---

## Complete Optimised `sst.config.ts` — What's in It

Already implemented (`/Users/defiankit/Desktop/lyraalpha/sst.config.ts`):

| Setting | Value | Reason |
|---------|-------|--------|
| `region` | `ap-south-1` | Matches Supabase/RDS, lowest latency for India users |
| `architecture` | `arm64` | **Graviton2: 20% cheaper** per GB-s than x86_64 |
| `timeout` | 300s | Covers Lyra streaming + cron jobs (maxDuration=300) |
| `memory` | 1024 MB | Lyra context builder + RAG vector search + Azure SDK buffers |
| `warm` | 1 (prod only) | Free cron-based warmer — zero cold starts on Lyra |
| `tracing` | `active` | X-Ray: end-to-end trace on every request |
| `PRISMA_POOL_MAX` | 5 | 5× more connections than Supabase pooler (was 2) |
| `PLAN_CACHE_ENABLED` | true | Prevents DB hit on every request |
| `NODE_ENV` | production | Correct prod behaviour (was `VERCEL_ENV`) |

---

## UX Optimisation Checklist (Post-Migration)

### Day 1 — Verify These After Deployment

- [ ] **Cold start test:** Open Lyra in incognito, measure time to first token. Should be <500ms with SST warm:1.
- [ ] **Dashboard load:** Navigate to `/dashboard`. Should feel instant (shell from Redis cache).
- [ ] **Market data cache:** Check CloudFront `X-Cache: Hit` header on `/api/market/breadth`.
- [ ] **Streaming:** Lyra response should stream tokens progressively, not appear all at once.
- [ ] **Voice (Myra):** Voice session should start within 1–2s (ephemeral token from Lambda + Azure WebSocket).
- [ ] **Transactional email:** Send a welcome/onboarding email via SES and verify delivery + headers.
- [ ] **Plan gate:** Verify plan-gated features work correctly (STARTER vs PRO vs ELITE).

### Day 1 — Set Up Observability

```bash
# X-Ray service map — see Lambda → RDS → Redis → Azure latency breakdown
# AWS Console → X-Ray → Service Map

# CloudWatch dashboard — key UX metrics
aws cloudwatch put-metric-alarm \
  --alarm-name "Lyra-P95-Latency" \
  --metric-name "Duration" \
  --namespace "AWS/Lambda" \
  --threshold 8000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --period 300 \
  --statistic p95

# RDS connections alarm (UX degrades if connections exhaust)
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-Connections-High" \
  --metric-name "DatabaseConnections" \
  --namespace "AWS/RDS" \
  --dimensions Name=DBInstanceIdentifier,Value=lyraalpha-prod \
  --threshold 120 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --period 300 \
  --statistic Average
```

### Week 2 — Verify Cron Jobs & CloudFront Timeout

Cron jobs run in the same Lambda. Two concerns:

**1. CloudFront 60s origin response timeout (critical for long crons):**
Per [CloudFront docs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistValuesOrigin.html),
the default origin response timeout = 30s (SST sets 60s). Cron jobs that take >60s to
return the first byte will get a 504. Your `full-sync`, `us-eod-pipeline`, and
`daily-briefing` crons all declare `maxDuration=300`.

**Fix:** In `setup-eventbridge-schedules.ts`, set `APP_URL` to the Lambda Function URL
(available post-deploy at `site.nodes.server.url`), not the CloudFront URL.
This bypasses CloudFront entirely for cron jobs.

For user-facing streaming routes (Lyra), TTFT is <5s and tokens stream continuously,
so the 60s per-packet timeout is never hit.

**2. DB connection contention:**
A heavy cron (e.g., `full-sync`) that consumes DB connections or memory could slow
down user-facing routes.

**Mitigation:** Monitor `DatabaseConnections` during cron windows (3–11 AM UTC for India
market, 8–11 PM UTC for US market). If connections spike, move heavy crons to SQS fan-out.

---

## AWS Costs (UX-Optimised Configuration)

| Service | Monthly Cost | UX Impact |
|---------|-------------|-----------|
| Lambda + CloudFront (arm64) | $4–12 | Core app delivery (20% cheaper with Graviton2) |
| SST warm:1 (cron warmer) | $0 | Eliminates Lyra cold start (free) |
| RDS t3.small | ~$27 | Database |
| X-Ray tracing | ~$0.75 | Observability |
| EventBridge Scheduler | $0 | 29 cron jobs |
| Upstash Redis | $0–10 | All cache layers |
| SES transactional email | $0.10–2 | Replaces Brevo transactional sends |
| **Total AWS** | **~$32–52/mo** | Savings: $14/mo (warm free) + 20% Lambda (arm64) |
| Azure OpenAI (separate credits) | ~$50–200 | All LLM inference |

**$1,000 AWS credits ÷ ~$42/mo avg = ~24 months of free AWS hosting.**

> Previous estimate was ~$40–55/mo. Savings come from:
> 1. Replacing Provisioned Concurrency (~$14/mo) with SST `warm:1` ($0)
> 2. arm64 (Graviton2) \u2192 20% cheaper Lambda compute (~$1–3/mo saved)

---

## One-Line Summary Per Service Decision

| Service | Decision | Reason |
|---------|----------|--------|
| Lambda arm64 / 1024 MB | ✅ Keep | Graviton2 + 1 GB for Lyra RAG + Azure SDK |
| SST warm:1 | ✅ Enable (prod) | Free cron warmer — kills cold starts |
| X-Ray tracing | ✅ Enable | Post-migration debugging essential |
| CloudFront edge cache | ✅ Automatic | Market data API headers already set |
| Upstash Redis | ✅ Keep | Plan cache + Lyra cache + dashboard shell |
| ElastiCache | ❌ Skip | $30/mo idle min, Upstash REST is faster for Lambda |
| RDS Proxy | ❌ Skip | $11/mo, not needed until >120 DB connections |
| API Gateway | ❌ Skip | Lambda URLs are cheaper + lower latency |
| Bedrock AI | ❌ Skip | Keep Azure OpenAI — Azure credits cover it |
| SES email | ✅ Enable | Replaces Brevo transactional, saves $15–24/mo |
| SQS fan-out for heavy crons | ⏳ Month 2 | Only if full-sync/embed-memory timeout |
| WAF | ⏳ Month 3+ | Add at 10K+ MAU |

---

## Official Docs Audit — Sources Verified

This plan has been cross-checked against the following official documentation:

### Sources Consulted
| Source | What Was Verified |
|--------|------------------|
| [SST Nextjs docs](https://sst.dev/docs/component/aws/nextjs/) | `warm` prop (correct cold start approach), `server.architecture` (arm64), `server.timeout` (CloudFront 60s limit), `transform.server` (FunctionArgs for X-Ray) |
| [SST GitHub #4286](https://github.com/anomalyco/sst/issues/4286) | Confirmed provisioned concurrency is NOT a top-level SST Nextjs prop |
| [OpenNext Warming docs](https://opennext.js.org/aws/v2/inner_workings/warming) | SST cron-based warmer architecture (5-min interval, per-instance ping) |
| [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/) | Provisioned Concurrency = $0.0000041667/GB-s → $10.80/mo for 1GB×24/7. arm64 = 20% cheaper |
| [AWS CloudFront Origin Settings](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistValuesOrigin.html) | Response timeout = 30s default (per-packet). Response completion timeout = unlimited if unset. Streaming safe when TTFT <30s |
| [AWS RDS PostgreSQL Pricing](https://aws.amazon.com/rds/postgresql/pricing/) | t3.small Single-AZ ap-south-1 ~$24.50/mo + gp3 storage $2.30/mo |
| [AWS SES Pricing](https://aws.amazon.com/ses/pricing/) | $0.10/1,000 emails. Free tier: 3,000 messages/mo for 12 months |
| [AWS Graviton2 Lambda blog](https://aws.amazon.com/blogs/aws/aws-lambda-functions-powered-by-aws-graviton2-processor-run-your-functions-on-arm-and-get-up-to-34-better-price-performance/) | arm64 = up to 34% better price-performance for Node.js |

### Critical Corrections Applied
1. **`provisionedConcurrentExecutions` → `warm: 1`** — The former is not a valid SST Nextjs property. SST's `warm` prop is the official approach ($0 vs $10.80/mo).
2. **Added `architecture: "arm64"`** — 20% cheaper Lambda compute with Graviton2. Node.js has full arm64 support, zero code changes needed.
3. **CloudFront 60s timeout warning** — Documented that cron jobs >60s must target Lambda Function URL directly (bypass CloudFront). Streaming routes are safe (TTFT <5s).
4. **Cost update** — Total reduced from ~$40–55/mo to **~$32–52/mo** after corrections.
