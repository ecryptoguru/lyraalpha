# AGENTS.md — LyraAlpha

> High-signal, repo-specific guidance for AI coding agents. Items agents would likely miss without help.

## Dev Commands

```bash
npm run dev         # start local dev server
npm run build       # production build
npm run start       # production server
npm run lint        # ESLint
npm run typecheck   # tsc -p tsconfig.json --noEmit
npm test            # Vitest (vitest run, 30s timeout, 4-fork pool)
npx playwright test # E2E (builds + starts on port 3001)
```

**Verification order:** `lint → typecheck → test`

## Prisma

- Generated client at `src/generated/prisma` (custom output, not `node_modules`)
- `npm run postinstall` → `prisma generate` automatically
- Use npm scripts: `npm run db:generate`, `db:push`, `db:seed`, `db:status`
- Two clients in `src/lib/prisma.ts`: `prisma` (pooled/Supavisor) + `directPrisma` (migrations/scripts)
- TLS: `rejectUnauthorized: false` intentionally for Supabase/Supavisor

## Tests

- Vitest pool: 4 forks max, 30s timeout; `/** @vitest-environment jsdom */` for browser API tests
- Prisma and ioredis are mocked via alias in `vitest.config.ts` — **do not remove these** or workers will OOM
- E2E on **port 3001**: `SKIP_AUTH=true SKIP_RATE_LIMIT=true E2E_BYPASS=true LYRA_E2E_USER_PLAN=ELITE`

## Redis / Cache

- `src/lib/redis.ts` trims `UPSTASH_REDIS_REST_URL/TOKEN` and falls back to noop client if malformed
- `redisSetNX` (fail-open) returns `true` on Redis failure — used for webhook idempotency so events aren't silently dropped
- `redisSetNXStrict` (fail-closed) returns `false` on Redis failure — used for LLM in-flight locks and memory distillation to prevent thundering herd
- Plan cache invalidation uses `invalidateCacheByPrefix("plan")` (scan-based, NOT single-key delete)
- Myra response cache: normalized SHA-256 hash of stop-words-removed query; 4h TTL (logged-in), 8h TTL (public)
- Compression cache: `compress:{sha256(rawContext)}`, 2h TTL

## Auth Bypass (CRITICAL — do not break)

- `E2E_BYPASS=true` gated by `VERCEL_ENV !== 'production'` in `src/lib/runtime-env.ts` — only works locally
- `SKIP_AUTH=true` bypasses Clerk in non-production
- E2E env: `SKIP_AUTH=true SKIP_RATE_LIMIT=true E2E_BYPASS=true LYRA_E2E_USER_PLAN=ELITE`
- `LYRA_AUDIT_PLAN=STARTER|PRO|ELITE|ENTERPRISE` overrides plan in non-production

## Plan Gating

- Server-side only: `src/lib/middleware/plan-gate.ts` — UI gating alone is insufficient
- Trial downgrade: `trialEndsAt < now` + plan !== STARTER → downgrade to STARTER (do not remove)
- Multi-asset mode gated behind PRO+ — STARTER/PRO cannot silently upgrade
- Compare + Shock Simulator: max 4 assets, pricing = 5 credits first + 3 per additional

## Blog System

- **~100 posts with full content** across `blogs-week1.ts` – `blogs-week25.ts` (4 posts each) + `posts.data.ts` (2 featured posts)
- **60 posts planned** in `seo-blogs-data.ts` (metadata only — slug, title, keywords, priority; body content not yet written)
- Hybrid static + DB: `getAllPosts()` falls back to static if DB returns empty
- Blog posts use `escHtml()` for DB-sourced title/description in email templates
- AMI webhook bridge at `src/app/api/webhooks/ami/route.ts` (HMAC-SHA256 verified)
- RSS feed: `src/app/blog/feed.xml/route.ts` (ISR revalidate=3600)

## AI / Lyra System

- GPT-5.4 via Azure OpenAI Responses API (`@ai-sdk/openai`) — Gemini/OpenRouter/Groq fully removed
- Model routing: `lyra-nano` (STARTER), `lyra-mini` (all SIMPLE/MODERATE), `lyra-full` (PRO+/COMPLEX)
- Fallback: primary fails → `lyra-nano` at 1200-token budget → if nano fails, re-throw (no recursive retry)
- `textVerbosity: "high"` for Lyra calls, `textVerbosity: "low"` for compression — use nested `providerOptions.openai.textVerbosity`, NOT flat `verbosity` field (silently ignored on Azure)
- `INJECTION_PATTERNS` from `guardrails.ts` scans: all conversation messages, RAG chunks, user memory chunks
- Singleton HTTP clients in `orchestration.ts` and `compress.ts` — do not remove
- Output validation active for all tiers (SIMPLE included)

## Known Issues — Already Fixed (Do Not Revert)

These were bugs found and fixed. Check before changing related code:

| Issue | File | Fix |
|-------|------|-----|
| Stripe subscription period unsafe casts | `src/app/api/webhooks/stripe/route.ts` | Safe property access on `items.data[0].price` |
| Clerk webhook silent error swallow | `src/app/api/webhooks/clerk/route.ts` | Errors re-thrown for Clerk retry |
| Clerk webhook no idempotency | `src/app/api/webhooks/clerk/route.ts` | `redisSetNX` dedup on `svix-id`, 24h TTL |
| `redisSetNX` fallback returned `true` | `src/lib/redis.ts` | Split into `redisSetNX` (fail-open, webhooks) + `redisSetNXStrict` (fail-closed, LLM locks) |
| E2E_BYPASS active on Vercel production | `src/lib/runtime-env.ts` | Guarded by `VERCEL_ENV !== 'production'` |
| Admin email cache never refreshes | `src/lib/auth.ts` | 5-min TTL via `_adminEmailCacheRefreshedAt` |
| `_clearPlanCacheForTest` used single-key delete | `src/lib/middleware/plan-gate.ts` | Uses `invalidateCacheByPrefix("plan")` |
| Dead `consumeCredits` export | `src/lib/middleware/credit-gate.ts` | Removed |
| Clerk user.deleted used array-form transaction | `src/app/api/webhooks/clerk/route.ts` | Callback form for proper rollback |
| Clerk webhook idempotency lock leaked on failure | `src/app/api/webhooks/clerk/route.ts` | `delCache` on svix-id in catch block so retries succeed |
| Cron LLM failures not recorded in alerting | `src/lib/services/daily-briefing.service.ts` et al. | try/catch with `recordCronLlmCall({ success: false })` |
| GDPR user.deleted transaction could timeout | `src/app/api/webhooks/clerk/route.ts` | Added `{ timeout: 30_000, maxWait: 5_000 }` |
| Base64 guardrail false-positived on single data URLs | `src/lib/ai/guardrails.ts` | Raised threshold to 5.8, requires ≥2 suspicious runs |
| Stripe charge.refunded didn't claw back credits | `src/app/api/webhooks/stripe/route.ts` | Looks up original PURCHASE CreditTransaction by referenceId, deducts via negative `addCredits` |
| Mid-stream LLM errors bypassed credit refund | `src/lib/ai/service.ts` | `refundOnStreamError` wraps textStream async iterable; iteration errors trigger refund |
| Welcome email re-sent on Clerk webhook retry | `src/app/api/webhooks/clerk/route.ts` | Checks `userPreference.welcomeEmailSentAt` before calling `sendBrevoEmail` |
| `expireTrialIfNeeded` delCache before DB update | `src/lib/middleware/plan-gate.ts` | Reversed to DB update first, then `delCache` — prevents stale cache repopulation |
| Cron LLM alerts spammed on every failure | `src/lib/ai/alerting.ts` | Per-job dedup key (`ai:cron:alerted:*`) with 1h TTL; webhook is fire-and-forget |
| `user.created` threw P2002 on concurrent webhooks | `src/app/api/webhooks/clerk/route.ts` | P2002 swallowed like `user.updated` — upsert is idempotent |
| `incrementDailyTokens` accepted negative values | `src/lib/ai/service.ts` | `Math.max(0, Math.floor(tokens))` clamp before `hincrby` |
| GDPR purge ran ~20 sequential deletes | `src/app/api/webhooks/clerk/route.ts` | Parallelized via `Promise.all` inside transaction |
| SKIP_CREDITS=true only logged in production | `src/lib/ai/service.ts` | Hard `throw` at module init — server won't start with this misconfiguration |
| Credit refund referenceId was static `'lyra-refund'` | `src/lib/ai/service.ts` | Per-request id: `lyra-refund:${timestampMs}-${userId.slice(-6)}` |
| `invoice.payment_succeeded` used pre-2026 period fields | `src/app/api/webhooks/stripe/route.ts` | Safe extraction from `lines.data[0].period` with root-level fallback |
| E2E bypass `findFirst` non-deterministic under concurrency | `src/lib/auth.ts` | 5-min TTL cache `_bypassUserIdCache` for plan-seeded userId resolution |
| New portfolio auto-refresh showed "Portfolio refreshed" toast | `src/app/dashboard/portfolio/page.tsx` | Seed `localStorage` refresh timestamp on create before `setSelectedPortfolioId` |
| Footer legal links were `<button>` opening modal | `src/components/layout/footer-legal-links.tsx` | Converted to `<Link href="/privacy">` and `<Link href="/terms">` |
| Deprecated `NEXT_PUBLIC_CLERK_AFTER_SIGN_*_URL` env vars | `src/lib/env/schema.ts`, `.env` | Migrated to `NEXT_PUBLIC_CLERK_SIGN_*_FALLBACK_REDIRECT_URL` |

## Danger Zones (Do Not Break)

- **Auth bypass**: keep `VERCEL_ENV` guard in `src/lib/runtime-env.ts` (blocks on any Vercel env, not just production)
- **Trial expiry**: keep downgrade logic in `src/lib/middleware/plan-gate.ts`; DB update must come before `delCache`
- **Public Myra route**: `/api/support/public-chat` must stay in `isPublicApiRoute` in `src/proxy.ts`
- **LiveChatBubble placement**: must stay outside `SidebarInset` in `DashboardLayoutClient.tsx` (overflow clipping issue)
- **textVerbosity**: nested in `providerOptions.openai`, not flat `verbosity` field
- **Voice session gating**: `/api/support/voice-session` is PRO+ only — do not lower without updating cost envelope
- **AMI webhook secret**: `AMI_WEBHOOK_SECRET` must be identical in both Vercel and Convex env vars
- **NewsData re-export**: `cryptopanic.service.ts` re-exports `newsdata.service.ts` — do not reintroduce CryptoPanic logic
- **Clerk webhook lock-release**: catch block in `clerk/route.ts` must `delCache` the svix-id lock before returning 500
- **redisSetNX vs redisSetNXStrict**: webhooks use fail-open (`redisSetNX`), LLM/memory locks use fail-closed (`redisSetNXStrict`) — do not swap these
- **SKIP_CREDITS hard-fail**: module-init `throw` in `service.ts` — never change to soft log for production
- **Stripe refund clawback**: `charge.refunded` must look up original PURCHASE tx and deduct credits — do not remove
- **Mid-stream refund wrapper**: `refundOnStreamError` must wrap both primary and fallback textStreams — removing it reopens the credit leak
- **Welcome email dedup**: must check `welcomeEmailSentAt` before `sendBrevoEmail` — removing the check re-enables double-sends on retry
- **E2E bypass userId cache**: `_bypassUserIdCache` in `auth.ts` must be checked before DB lookup — removing it re-enables portfolio vanishing under concurrent session upserts
- **Portfolio create localStorage seed**: must set `portfolio:auto-refresh:${id}` timestamp before `setSelectedPortfolioId` — removing it shows "Portfolio refreshed" toast on new portfolios
- **Footer legal links**: must use `<Link href="/privacy">` and `<Link href="/terms">` — do not revert to `<button>` + modal pattern

## Key Directories

| Path | Purpose |
|------|---------|
| `src/app/api/` | API route handlers |
| `src/lib/services/` | Business logic (discovery, portfolio, market-sync, daily-briefing) |
| `src/lib/engines/` | Deterministic scoring (portfolio-health, portfolio-fragility, monte-carlo, intelligence) |
| `src/lib/ai/` | Lyra/Myra prompts, routing, RAG, alerting, guardrails |
| `src/lib/middleware/` | Auth bypass, plan gating, credit gate |
| `src/lib/blog/` | Post data layer, webhook verification |
| `src/lib/rate-limit/` | Upstash ratelimit config + helpers |
| `prisma/` | Schema, migrations, seed |
| `e2e/` | Playwright E2E tests |
| `scripts/` | QStash schedule setup, daily sync, demo capture |

## Architecture Notes

- Next.js 16 App Router; Server Components by default; UI routes `src/app/**/page.tsx`, API routes `src/app/api/**/route.ts`
- Region: `US` or `IN`, persisted in `user_region_preference` cookie; US → USD (`$`), IN → INR (`₹`); use `formatPrice(..., getCurrencyConfig(asset.currency))`
- Rate limiting: discovery (fixed window), chat (sliding window); `SKIP_RATE_LIMIT=true` bypasses
- QStash (not Vercel Cron) schedules: in-eod-sync `10:30`, in-eod-postprocess `10:45`, us-eod-crypto-sync `21:45`, us-eod-postprocess `22:00`, crypto-sync `8h`, news-sync `12h` (all UTC)
- Email ownership: LyraAlpha sends transactional (welcome, blog, billing); AMI sends marketing — AMI triggers `/api/webhooks/ami` for blog emails