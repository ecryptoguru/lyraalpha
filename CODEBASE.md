# CODEBASE.md — LyraAlpha AI (AI/Agent Reference)

This document is written for AI coding agents (Cursor/Windsurf/Copilot/etc.) so they can quickly build an accurate mental model of the LyraAlpha repository and safely continue development.

## 1) What this app is

**LyraAlpha AI** is a Next.js (App Router) web application that provides:

- A **crypto-native discovery + intelligence dashboard** (on-chain data, DeFi metrics, network signals)
- **Asset pages** with computed analytics/scores and AI summaries
- **Lyra**: an AI analyst (crypto market intelligence)
- **Myra**: a support agent (platform help) — available both as a public support entry point and inside the authenticated dashboard
- Plan-gated **Elite tools** (e.g., Compare Assets, Shock Simulator)
- A Prisma/Postgres-backed data layer, Redis/Upstash caching + rate limiting, and Clerk auth
- A **public blog system** with hybrid static + DB posts, AMI 2.0 webhook bridge, and QStash-scheduled email digest

The platform is **crypto-only** — it focuses exclusively on cryptocurrency assets and on-chain intelligence.

Core product constraints:

- **The engines compute; the AI interprets.** Lyra is designed to interpret precomputed numbers and context.
- **Region matters everywhere** (US vs IN) for search, listings, and currency formatting.
- **Plan gating + rate limiting** are enforced server-side in API routes.

## 2) Tech stack

- **Framework**: Next.js 16 (`src/app` App Router)
- **UI**: React 19, TailwindCSS v4, Radix UI, Lucide icons, SWR for client fetching
- **DB**: PostgreSQL (Supabase-style), accessed via **Prisma v7**
- **Caching**:
  - Upstash Redis via `@upstash/redis`
  - Local helper layer in `src/lib/redis.ts`
- **Rate limiting**: `@upstash/ratelimit` (per endpoint + per plan tier)
- **Auth**: Clerk (`@clerk/nextjs`), plus a dev/E2E bypass wrapper in `src/lib/auth.ts`
- **Payments**: Stripe + Razorpay webhooks exist under `src/app/api/webhooks/*`
- **AI**:
  - Vercel AI SDK (`ai`), provider integrations (`@ai-sdk/openai`)
  - All Lyra and Myra generation uses **GPT-5.4** (nano / mini / full) via **Azure OpenAI Responses API**
  - Gemini, OpenRouter, and Groq branches have been fully removed
  - Orchestration mode: `single` on all plans/tiers — `router` and `draft_verify` dead code has been **removed** from `TierConfig`; `OrchestrationMode` type deleted from `config.ts`
  - LLM fallback: primary model failure degrades to `lyra-nano` automatically before surfacing a 500
  - Prompt system in `src/lib/ai/*`
  - Alerting module in `src/lib/ai/alerting.ts` — 5 alert channels with Redis sliding windows and webhook delivery
- **Testing**: Vitest + Testing Library + Playwright E2E

## 3) High-level architecture (request/data flow)

### 3.1 App Router routing

- UI routes live under `src/app/**/page.tsx`
- API routes live under `src/app/api/**/route.ts`

### 3.2 Auth and "dev bypass"

The project wraps Clerk auth in `src/lib/auth.ts`.

- In **non-production**, if `SKIP_AUTH=true` (or E2E flags), `auth()` returns a fake session:
  - `userId: "test-user-id"`
- In production, `auth()` delegates to `@clerk/nextjs/server`.

This is critical for:

- Local development without signing in
- Playwright tests (see `playwright.config.ts` which sets `SKIP_AUTH=true`, `E2E_BYPASS=true`)

### 3.3 Public API routes (no auth required)

The following routes are explicitly included in `isPublicApiRoute` in `src/proxy.ts` and are exempted from Clerk middleware:

- `/api/share(.*)`
- `/api/waitlist(.*)`
- `/api/prelaunch/validate-coupon`
- `/api/support/public-chat` — **Myra public support entry point endpoint**

**Do not remove `/api/support/public-chat` from `isPublicApiRoute`.** Removing it will cause the public support Myra widget to return 401 Unauthorized for all unauthenticated visitors.

### 3.4 Plan gating

Server-side plan logic is centralized in:

- `src/lib/middleware/plan-gate.ts`

Key behaviors:

- `getUserPlan(userId)` resolves tier from DB (optionally cached)
- **Trial expiration** enforcement:
  - If `trialEndsAt < now` and plan is not STARTER, user is downgraded to STARTER
  - Downgrade persistence is attempted async
- Feature limits are encoded in `PLAN_LIMITS` (e.g. Discovery feed caps)
- A non-prod override exists: `LYRA_AUDIT_PLAN=STARTER|PRO|ELITE|ENTERPRISE`

### 3.5 Rate limiting

Central implementation:

- `src/lib/rate-limit/config.ts` (single source of truth)
- `src/lib/rate-limit/index.ts` (helpers for chat/discovery/etc.)

Important:

- `SKIP_RATE_LIMIT=true` bypasses rate limiting (used in E2E)
- Discovery/search uses a **fixed window**, chat uses a **sliding window**
- Some endpoints "fail open" for UX (discovery) while chat returns 503 on timeout

### 3.6 Caching

- Generic cache helpers in `src/lib/redis.ts`
- `withCache`/`withStaleWhileRevalidate` patterns are used across services
- Lyra-specific educational cache helpers and key builders live in `src/lib/ai/lyra-cache.ts`

Notes:

- Cache stats sampling is built-in (`cache:stats` hash key)
- JSON reviver restores ISO date strings into `Date` instances
- Educational-cache fast paths are intentionally aligned between early reads and writes
- Redis env initialization is hardened: `src/lib/redis.ts` trims `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, and falls back to a noop cache client if hosted credentials are malformed at startup

## 4) Project structure (how to navigate)

### 4.1 Repository root

- `src/` — main application code
- `prisma/` — Prisma schema + migrations + seed
- `docs/` — product + roadmap docs
- `docs/ENV_SETUP.md` — service-by-service environment setup guide for the LyraAlpha fork
- `e2e/` — Playwright tests
- `scripts/` — data sync, init, ops utilities
- `.env.example` — sanitized environment template for local and deployment setup

### 4.2 `src/app` map (authoritative feature locations)

Key UI pages:

- `src/app/dashboard/page.tsx` — dashboard home
- `src/app/dashboard/assets/[symbol]/page.tsx` — asset intelligence page
- `src/app/dashboard/discovery/page.tsx` — discovery feed
- `src/app/dashboard/discovery/[id]/page.tsx` — sector detail
- `src/app/dashboard/portfolio/page.tsx` — premium portfolio intelligence surface (health, fragility, benchmarks, holdings, Monte Carlo, manual refresh + 24h autonomous refresh gate)
- `src/app/dashboard/compare/page.tsx` — Compare Assets premium workflow (Elite)
- `src/app/dashboard/stress-test/page.tsx` — Shock Simulator premium workflow (Elite)
- `src/app/dashboard/watchlist/page.tsx` — watchlist
- `src/app/dashboard/upgrade/page.tsx` — pricing/upgrade
- `src/app/sign-up/[[...sign-up]]/page.tsx` — sign-up + coupon entry

Recent dashboard intelligence surfaces:

- `ScoreVelocityBadge` on asset cards and watchlist rows for rising/falling score momentum
- `PortfolioRegimeAlignmentBar` for value-weighted aligned / neutral / misaligned holdings breakdowns
- `PortfolioDrawdownEstimate` for heuristic 30-day downside framing on the portfolio surface
- Watchlist drift alert badge driven by `/api/user/watchlist/drift-alert`
- Discovery signal cluster banner for high-DRS sector momentum bursts
- Same-sector movers widget on asset pages, including compatibility-score context
- Briefing staleness indicator on Lyra when the cached briefing is older than the freshness threshold
- Holdings cost-basis P&L heatmap styling in the portfolio table, plus expandable DSE chips

Key layouts:

- `src/app/layout.tsx` — global providers + metadata + offline banner
- `src/app/dashboard/layout.tsx` — loads initial region + plan + trialEndsAt and injects into client layout
- `src/app/dashboard/DashboardLayoutClient.tsx` — renders the authenticated dashboard shell and mounts `OnboardingGate`

**Dashboard layout important note:** `LiveChatBubble` and `EliteCommandPalette` are rendered **outside** `SidebarInset` in `DashboardLayoutClient.tsx`. This is required because `SidebarInset` has `overflow-x-clip overflow-y-auto`, which clips `fixed`-positioned children to the scroll container rather than the true viewport. Do not move them back inside `SidebarInset`.

Key public blog routes:

- `src/app/blog/page.tsx` — async blog index, hybrid static+DB posts
- `src/app/blog/[slug]/page.tsx` — full post with OG hero, reading progress, share card, sidebar CTA
- `src/app/blog/category/[category]/page.tsx` — programmatic category landing pages
- `src/app/blog/feed.xml/route.ts` — RSS 2.0 feed (ISR revalidate=3600)

Key landing page components:

- `src/components/landing/public-myra-widget.tsx` — entry point for public Myra chat (dynamically imports `PublicMyraPanel`)
- `src/components/landing/public-myra-panel.tsx` — public Myra chat UI and message send logic
- `src/components/layout/Navbar.tsx` — landing page navbar (Pre-launch badge, no theme toggle)

Key API surfaces:

- `src/app/api/chat/route.ts` — Lyra chat endpoint
- `src/app/api/discovery/search/route.ts` — global search (sectors + assets), region-aware
- `src/app/api/discovery/sectors/[id]/route.ts` — sector detail data, region-aware
- `src/app/api/portfolio/**` — portfolio CRUD, holdings, health, imports, broker sync, and simulation routes
- `src/app/api/stocks/compare/route.ts` — Compare Assets backend with server-side symbol normalization, validation, and credit charging (legacy route name, handles crypto assets)
- `src/app/api/stocks/stress-test/route.ts` — Shock Simulator backend with server-side symbol normalization, validation, and credit charging (legacy route name, handles crypto assets)
- `src/app/api/support/public-chat/route.ts` — **public Myra endpoint** (no auth required, rate-limited by IP)
- `src/app/api/support/stream/route.ts` — authenticated Myra support streaming surface
- `src/app/api/user/**` — user preferences, watchlist, credits
- `src/app/api/cron/**` — cron endpoints (sync, expire trials, etc.)
- `src/app/api/cron/blog-digest/route.ts` — weekly blog digest email, QStash-scheduled every Monday 10:00 UTC
- `src/app/api/webhooks/ami/route.ts` — HMAC-verified AMI 2.0 webhook bridge (publish/update/archive blog posts)
- `src/app/api/webhooks/**` — Clerk/Stripe/Razorpay webhooks
- `src/app/api/admin/support/conversations/route.ts` — admin support inbox listing, cursor-paginated
- `src/app/api/admin/ai-limits/route.ts` — GET/POST endpoint for reading and overriding daily token caps and alert thresholds (admin-guarded)

### 4.3 `src/lib` map (core logic)

- `src/lib/auth.ts` — Clerk auth wrapper + dev/E2E bypass
- `src/lib/prisma.ts` — Prisma clients (pooled + direct)
- `src/lib/redis.ts` — Upstash redis + cache helpers; `RedisLike` type includes `hset` and `hdel`
- `src/lib/rate-limit/*` — Upstash ratelimit
- `src/lib/middleware/plan-gate.ts` — plan tier + feature gating
- `src/lib/services/*` — service layer (discovery, admin, etc.)
- `src/lib/engines/*` — deterministic scoring engines + regime logic
- Broker-connected portfolio intelligence is normalized through `src/lib/types/broker.ts` and validated through `src/lib/schemas.ts` before it reaches the health/fragility/intelligence engines
- `src/lib/services/portfolio.service.ts` — portfolio recompute, health storage, and cache invalidation orchestration
- `src/lib/engines/portfolio-health.ts` / `portfolio-fragility.ts` / `portfolio-monte-carlo.ts` / `portfolio-intelligence.ts` — portfolio analysis engines consumed by the dashboard
- `src/lib/ai/*` — Lyra/Myra prompt + routing + guardrails
- `src/lib/ai/alerting.ts` — AI-specific observability alerting (daily cost, RAG zero-result rate, web search outage, output validation failure rate, nano fallback rate). Redis sliding-window counters, 15-min cooldown, webhook delivery via `AI_ALERT_WEBHOOK_URL`
- `src/lib/ai/lyra-cache.ts` — Lyra educational cache constants and key helpers
- `src/lib/ai/guardrails.ts` — exports `INJECTION_PATTERNS` used by post-retrieval scan
- `src/lib/support/ai-responder.ts` — Myra's core AI responder logic; builds support prompts and generates replies using `getGpt54Model("myra")`
- `src/lib/context/RegionContext.tsx` — region context + cookie persistence
- `src/lib/utils.ts` — UI utilities including currency formatting helpers
- `src/lib/format-utils.ts` — human-friendly asset name/symbol formatting
- `src/lib/schemas.ts` — Zod request validation schemas
- `src/lib/types/broker.ts` — broker connector contract, normalized portfolio snapshot types
- `src/lib/engines/portfolio-utils.ts` — shared portfolio-engine utilities
- `src/lib/blog/posts.ts` — hybrid static + DB post source
- `src/lib/blog/webhook-verify.ts` — HMAC-SHA256 signing and verification for AMI webhook payloads
- `src/components/onboarding/onboarding-gate.tsx` — client-side onboarding overlay with the current 3-step gate (`Market`, `Experience`, `Interests`)

### 4.4 Dashboard shell critical components

- `src/components/dashboard/live-chat-widget.tsx` — Myra chat panel (authenticated dashboard)
- `src/components/dashboard/live-chat-bubble.tsx` — wrapper that manages open/close state; renders `LiveChatWidget` in a `fixed bottom-6 right-4 z-50` container when open
- `src/components/ui/sidebar.tsx` — defines `SidebarInset` which has `overflow-x-clip overflow-y-auto`

**Important:** `LiveChatBubble` must remain outside `SidebarInset`. The `overflow-x-clip` on `SidebarInset` creates a new stacking context that clips `fixed` children to the scroll container rather than the viewport.

## 4.5) AI Security & Observability (Recent Additions)

### Post-retrieval injection scan (SEC-1)
`src/lib/ai/rag.ts` — after `searchKnowledge` returns chunks, every chunk is filtered against `INJECTION_PATTERNS` (imported from `guardrails.ts`). Chunks matching injection patterns are silently dropped with a `warn` log (`event: "rag_injection_filtered"`). Defends against poisoned knowledge-base entries.

### Full conversation injection scan (SEC-2)
`src/lib/ai/service.ts` — **all messages** in the conversation history are scanned for injection patterns, not just the last user message. Each message content (string or array parts) is checked via `checkPromptInjection` before the pipeline proceeds.

### User memory injection scan (SEC-3)
`src/lib/ai/rag.ts` — `retrieveUserMemory()` filters each returned memory chunk against `INJECTION_PATTERNS` before adding it to the context. Memory chunks matching injection patterns are dropped with a `warn` log. Defends against stored-memory poisoning attacks.

### Multi-asset mode plan gating (SEC-4)
`src/lib/ai/service.ts` — multi-asset mode upgrades (triggered when a query references multiple symbols) are gated behind plan checks. STARTER and PRO users cannot be silently upgraded to multi-asset mode; the gate prevents cost leaks from unintended multi-asset inference on lower-tier plans.

### RAG low-grounding confidence log (RAG-1)
`src/lib/ai/rag.ts` — after injection scan, if `tier !== "SIMPLE"` and avg similarity < 0.45, a `warn` log is emitted (`event: "rag_low_grounding"`). Flags potential confabulation risk when retrieved chunks are marginally above threshold.

### LLM nano fallback (COST-1)
`src/lib/ai/service.ts` — when the primary `streamText` call throws, the error is caught and a fallback attempt is made with `lyra-nano` at 1200-token budget. If nano was already the primary model, the error is re-thrown immediately (no recursive retry). Fallback path logs `wasFallback: true` and feeds the fallback-rate alert window.

### Alerting module (OBS-1)
`src/lib/ai/alerting.ts` — module-level alert emitters:
- `alertIfDailyCostExceeded(totalCostUsd)` — called from `service.ts` primary `onFinish`
- `alertIfWebSearchOutage(consecutiveFailures)` — called from `search.ts` circuit breaker; alert threshold is **2 consecutive failures** (fires before the circuit breaker opens at 3)
- `recordRagResult(hadResults)` — called from `rag.ts` `retrieveInstitutionalKnowledge`
- `recordValidationResult(passed)` — called from `output-validation.ts` `logValidationResult`
- `recordFallbackResult(wasFallback)` — called from `service.ts` both primary and fallback `onFinish`

All sliding-window counters use a 15-min Redis hash key. Webhook delivery requires `AI_ALERT_WEBHOOK_URL` env var. All alert paths are fire-and-forget (`.catch(() => {})`), never blocking.

### Admin AI Limits UI (COST-3)
Daily token caps and alert thresholds are now hot-patchable via `/admin/ai-limits`. Redis keys: `lyra:admin:daily_token_caps` (hmap) and `lyra:admin:alert_thresholds` (hmap). `getEffectiveDailyTokenCaps()` in `service.ts` merges defaults with Redis overrides on every cap-check.

**ENTERPRISE daily token cap:** ENTERPRISE now has a finite hard ceiling of **2,000,000 tokens/day** (~$500/day), configurable via the `ENTERPRISE_DAILY_TOKEN_CAP` env var. The cap check applies to **all plans** including ENTERPRISE — the previous `userPlan !== "ENTERPRISE"` guard has been removed. Token usage is also incremented for ENTERPRISE users on every request path.

### Dead orchestration code removed (COST-4)
`OrchestrationMode` type and `orchestrationMode` field removed from `config.ts`. `TierConfig` no longer carries an orchestration mode field — all routing is implicitly `single`.

### Myra response cache
`src/lib/support/ai-responder.ts` — `getMyraResponseCache()` / `setMyraResponseCache()` with normalized query hashing (stop-word removal + sorted + SHA-256). 4h TTL logged-in, 8h TTL public. Cache check before LLM call, cache write after successful stream. Applied to both `/api/support/stream` and `/api/support/public-chat`.

### Compression result cache
`src/lib/ai/compress.ts` — Redis cache keyed on `compress:{sha256(rawContext)}` with 2h TTL. Skips Nano LLM call when identical context was already compressed.

---

## 5) Data model essentials (Prisma)

Prisma schema lives in `prisma/schema.prisma`.

Important models / fields (not exhaustive):

- `Asset`
  - `symbol` (unique), `name`, `type` (CRYPTO), `region` (US/IN), `currency` (USD/INR)
  - many JSON fields for computed analytics and on-chain metrics
- `PriceHistory` — OHLCV time series
- `AssetScore` / score history (varies by implementation)
- `User`
  - `plan` (STARTER/PRO/ELITE/ENTERPRISE)
  - `trialEndsAt` controls trial expiry downgrade
- `PromoCode`
  - `code` (unique), `durationDays`, usage limits
- `BlogPost`
  - `slug`, `title`, `description`, `content`, `category`, `tags`, `keywords`, `metaDescription`, `heroImageUrl`, `author`, `featured`, `status` (`published` / `archived`), `sourceAgent`, `sourceContentId`
- `WatchlistItem`, `UserPreference`, `AIRequestLog`, etc.

### 5.1 Two Prisma clients

`src/lib/prisma.ts` exports:

- `prisma`: **pooling** adapter (Supavisor) for runtime requests
- `directPrisma`: **direct** adapter for scripts/migrations/bulk operations

Pool sizes:

- `PRISMA_POOL_MAX` defaults to `2`
- `PRISMA_DIRECT_POOL_MAX` defaults to `3`

TLS:

- Uses `rejectUnauthorized: false` intentionally for Supabase/Supavisor.

## 6) Region, search, and currency invariants

### 6.1 Region context

- `RegionProvider` in `src/lib/context/RegionContext.tsx` manages `region: "US" | "IN"`
- Persists region choice in cookie: `user_region_preference`
- `src/app/dashboard/layout.tsx` reads the cookie server-side to set initial region

### 6.2 Discovery search (global search)

- UI search is implemented in `src/components/dashboard/discovery-search.tsx`
- API: `GET /api/discovery/search?q=...&region=US|IN`
- Backend: `DiscoveryService.search(query, region)`
  - minimum query length: **2 characters**
  - Prisma query filters by region when provided
  - dedupes assets by symbol

### 6.3 Compare + Shock Simulator asset selection

- Compare page: `src/app/dashboard/compare/page.tsx`
- Shock Simulator page: `src/app/dashboard/stress-test/page.tsx`
- Both use the shared asset search surface:
  - `src/components/dashboard/asset-search-input.tsx`
  - this calls `/api/discovery/search` and returns human-readable results
- Both premium workflows currently enforce:
  - a maximum of **4 unique assets**
  - multi-asset pricing of **5 credits for the first asset + 3 credits per additional asset**
- Compare is intentionally **explicit-action only** in the UI; selecting assets does not auto-run a paid comparison
- Both backends normalize and dedupe symbols server-side before validation and credit charging

### 6.4 Currency display

Shared helpers:

- `getCurrencyConfig(currency)` in `src/lib/utils.ts`
  - INR -> `₹` and `IN` formatting
  - default -> `$` and `US`
- `formatPrice(value, {symbol, region})` in `src/lib/utils.ts`

Invariant:

- **US assets must display in USD** and **IN assets in INR formatting**.
  - Prefer `formatPrice(..., getCurrencyConfig(asset.currency))`.

## 7) Trials / Promo codes (ELITE15 / ELITE30)

Trial ingestion is performed by the **Clerk webhook**:

- `src/app/api/webhooks/clerk/route.ts`

Flow:

1. User signs up with Clerk.
2. Coupon code is stored in Clerk `unsafe_metadata.coupon_code`.
3. Webhook `user.created` validates `PromoCode` (DB) and sets:
   - `plan = ELITE`
   - `trialEndsAt = now + durationDays`
4. Plan gate enforces expiry and downgrades.

Doc-level expectation:

- Promo codes can represent different durations:
  - `ELITE15` => 15 days
  - `ELITE30` => 30 days

Security note:

- `unsafe_metadata` is user-writable and must be treated as untrusted input.
- The webhook only grants promo access after validating the promo record server-side.
- Promo usage count changes are performed inside the same transaction as user creation to avoid TOCTOU-style limited-use coupon abuse.

## 8) Cron jobs / background sync

Cron endpoints live in `src/app/api/cron/*`.

Scheduling is managed by **Upstash QStash**, not Vercel Cron.
The source of truth for live schedules is:

- `scripts/setup-qstash-schedules.ts`

### 8.1 Current EOD sync architecture

The old monolithic daily cron flow has been replaced with **region-specific EOD pipelines**.

#### India EOD flow

- `POST /api/cron/in-eod-sync`
  - runs India market data sync after NSE/BSE close
- `POST /api/cron/in-eod-postprocess`
  - runs India post-processing for:
    - analytics refresh
    - daily briefing generation
    - market narratives warming

#### US EOD flow

US is intentionally split into smaller jobs to stay below serverless time limits.

- `POST /api/cron/us-eod-crypto-sync`
- `POST /api/cron/us-eod-postprocess`
  - runs after the US crypto sync job
  - recomputes US analytics once
  - generates the US briefing
  - warms US market narratives

### 8.2 Live schedule shape

All times are UTC.

- `in-eod-sync` → `10:30` Mon-Fri
- `in-eod-postprocess` → `10:45` Mon-Fri
- `us-eod-crypto-sync` → `21:45` Mon-Fri
- `us-eod-postprocess` → `22:00` Mon-Fri
- `crypto-sync` → every `8h`
- `news-sync` → every `12h` (NewsData.io crypto endpoint)

### 8.3 Service-layer ownership

Blog data layer:

- `src/lib/blog/posts.ts` — hybrid static + DB post source; `getAllPosts()`, `getPostBySlugAsync()`, `getAllCategories()`, `getRecentPostsAsync()`
- `src/lib/blog/webhook-verify.ts` — HMAC-SHA256 signing and verification for AMI webhook payloads
- `prisma/schema.prisma` — `BlogPost` model (slug, title, description, content, category, tags, keywords, metaDescription, heroImageUrl, author, featured, status, sourceAgent, sourceContentId)

Primary service logic lives in:

- `src/lib/services/market-sync.service.ts`
- `src/lib/services/daily-briefing.service.ts`
- `src/lib/services/market-narratives.service.ts`
- `src/lib/services/newsdata.service.ts` (crypto news via NewsData.io; `cryptopanic.service.ts` is a compatibility re-export)

Important invariants:

- **IN and US post-process routes should stay separate** so each region only regenerates its own briefing and narratives.
- **US sync work is split by asset type** to avoid timeout regressions.
- **US analytics should run once in post-process**, not once per asset-type sync job.
- **Crypto has two paths**:
  - regular `crypto-sync` for recurring 8h refresh
  - `us-eod-crypto-sync` as part of the US EOD data freshness pipeline

## 9) AI system (Lyra/Myra)

### 9.1 Model and Orchestration Architecture

Lyra runs entirely on **GPT-5.4** via the **Azure OpenAI Responses API**. Myra also runs on **GPT-5.4-nano** via the same provider. Gemini, OpenRouter, and Groq branches are fully removed. The authoritative routing config is `src/lib/ai/config.ts`.

#### Model roles

| Role | Model | Typical use |
|---|---|---|
| `lyra-nano` | GPT-5.4-nano | STARTER SIMPLE/MODERATE |
| `lyra-mini` | GPT-5.4-mini | SIMPLE/MODERATE across all plans; STARTER COMPLEX |
| `lyra-full` | GPT-5.4 (full) | PRO/ELITE/ENTERPRISE COMPLEX |
| `myra` | GPT-5.4-nano | All Myra support responses (public + dashboard) |

#### Full routing matrix

| Plan | SIMPLE | MODERATE | COMPLEX |
|---|---|---|---|
| **STARTER** | lyra-nano · single | lyra-nano · single | lyra-mini · single |
| **PRO** | lyra-mini · single | lyra-mini · single | lyra-full · single |
| **ELITE** | lyra-mini · single | lyra-mini · single | lyra-full · single |
| **ENTERPRISE** | lyra-mini · single | lyra-mini · single | lyra-full · single |

#### Orchestration modes

- **single** — one direct `streamText` call to the appropriate model. Used across all plans and all complexity tiers.
- **router** — legacy code in `orchestration.ts`; **not active in any plan configuration**.
- **draft\_verify** — legacy code in `orchestration.ts`; **not active in any plan configuration**.

Quality is achieved through prompt contracts rather than multi-step orchestration.

#### Reasoning effort

`reasoningEffort: "none"` on all tiers and plans. Quality is achieved through prompt contracts:

- `<output_contract>` — institutional-grade output structure
- `<verbosity_controls>` — thoroughness expectations
- `<verification_loop>` — grounding check, signal consistency, completeness, no meta-commentary

#### Output verbosity

- All Lyra generation calls: `textVerbosity: "high"` in `providerOptions.openai` (AI SDK field → `text.verbosity: "high"` in Azure Responses API)
- Context compressor: `textVerbosity: "low"` (dense bullet output, not prose)
- Do **not** use a flat `verbosity` field — it is unsupported and silently ignored on Azure

#### Singleton HTTP clients

`orchestration.ts` and `compress.ts` both use a module-level `_client` singleton for `createOpenAI`. Do not remove this — re-creating the HTTP client per call wastes memory and prevents connection reuse.

### 9.2 Prompt system

- Core prompt assembly:
  - `src/lib/ai/prompts/system.ts`
  - module selection:
    - `src/lib/ai/prompts/modules.ts`

Key properties:

- Static prompt is memoized (prefix caching).
- Module selection depends on:
  - asset type
  - plan tier
  - query tier (SIMPLE/MODERATE/COMPLEX)
  - model family (always `gpt` now)
- Portfolio-format prompting is only activated when real portfolio context is present.
- Elite moderate crypto prompting explicitly asks for a regime verdict, dominant macro pillar, macro-justified vs sentiment-driven framing, and one cross-asset confirmation signal.
- `buildHumanizerGuidance(purpose)` helper in `src/lib/ai/prompts/humanizer.ts` standardizes human-readable prompt instructions across non-Lyra/Myra LLM generators (daily briefing, portfolio memo, trending question generation).

Persona injection note:

- Expert persona lead-ins are injected for **ELITE/ENTERPRISE + MODERATE/COMPLEX + GPT**.

### 9.3 Intelligence Efficiency: Cache & Trivial Triage

- **Educational cache path**: known educational queries can be routed through the lightweight educational cache path when enabled.
- **Trivial query short-circuiting**: greetings/gratitude and similar filler are intercepted inside `src/lib/ai/service.ts` and answered without invoking the full Lyra pipeline.
- **Heuristic query classification**: `src/lib/ai/query-classifier.ts` uses regex heuristics plus conversation-length escalation to distinguish SIMPLE, MODERATE, and COMPLEX requests. RSI/MACD → MODERATE (not COMPLEX).
- **Selective live research augmentation**: GPT live research is not a blanket moderate/complex default. Skipped for chatMode and queries without recency intent.
- **Pre-flight context compression**: `src/lib/ai/compress.ts` uses GPT-5.4-nano (`textVerbosity: "low"`, 700-token ceiling) to compress oversized contexts. Trigger: COMPLEX tier only, history text > 3000 chars.
- **Compression result caching**: Redis cache on `compress:{sha256(rawContext)}`, 2h TTL — skips Nano call when context was already compressed.
- **Word budget floor**: When `knowledgeContext.length === 0 AND webSearchContext.length === 0`, wordBudget is raised to `Math.round(contentTokens * 0.60 * 0.72)` to prevent hollow short responses during web search outages.
- **Myra response caching**: Normalized query hash (stop-word removal + sorted tokens + SHA-256), 4h TTL (authenticated), 8h TTL (public).

### 9.4 Support / Myra surfaces

- Public support entry-point Myra widget: `src/components/landing/public-myra-widget.tsx` → `PublicMyraPanel`
- Public API endpoint: `src/app/api/support/public-chat/route.ts` (in `isPublicApiRoute` — no auth required)
- Dashboard Myra widget: `src/components/dashboard/live-chat-widget.tsx`
- Dashboard Myra bubble wrapper: `src/components/dashboard/live-chat-bubble.tsx` (renders `LiveChatWidget` in `fixed bottom-6 right-4 z-50` when open)
- Dashboard Myra API: `src/app/api/support/stream/route.ts`
- The widget supports lightweight markdown-style rendering for headings, lists, links, inline code, and fenced code blocks.
- **Myra Voice** (shipped): hands-free voice support via OpenAI Realtime API
  - Voice session endpoint: `GET /api/support/voice-session` — returns ephemeral token, WSS URL, model, voice, and instructions
  - Voice model: `gpt-realtime-mini` with voice `marin`
  - Plan-gated: PRO+ only (PRO, ELITE, ENTERPRISE)
  - Client hook: `src/hooks/use-myra-voice.ts` — manages RealtimeSession lifecycle, mic input with virtual device filtering, silence auto-stop, PII redaction, client-side injection detection
  - Voice button: `src/components/dashboard/myra-voice-button.tsx`
  - Voice prompt: `src/lib/support/voice-prompt.ts` — static prefix (cache-eligible) + dynamic per-user suffix; KB docs sanitized against injection patterns
  - Voice cost calculator: `src/lib/ai/cost-calculator.ts` — `calculateVoiceCost()`, `estimateVoiceSessionCost()`, `estimateVoiceSessionCostCached()` for admin cost dashboards
  - Audio format: PCM 24kHz input/output, semantic VAD turn detection
  - Supports English, Hinglish, and Hindi; Urdu script is explicitly blocked in transcription
- Admin support inbox listing is cursor-paginated:
  - `GET /api/admin/support/conversations?limit=50`
  - optional `cursor=<conversationId>&cursorUpdatedAt=<ISO date>`
  - response shape: `{ items, nextCursor }`

### 9.5 Safety / governance

- Prompt includes governance rules (no trade advice, hygiene rules, tag hiding, etc.)
- **Full conversation injection scan**: `INJECTION_PATTERNS` from `guardrails.ts` is checked against **all messages** in the conversation history, not just the last message
- **User memory injection scan**: every memory chunk returned by `retrieveUserMemory()` is filtered against `INJECTION_PATTERNS` before being added to context (defends against stored-memory poisoning)
- **Multi-asset mode plan gating**: multi-asset mode is gated behind plan checks — STARTER and PRO users cannot be silently upgraded to multi-asset inference
- Per-tier tool allowlist via `getAllowedTools()` — replaces raw `aiTools`

### 9.6 AI request logging

- `AIRequestLog` stores requests, token usage, costs, embeddings state.
- `storeConversationLog` in `src/lib/ai/rag.ts` uses an **idempotency key** (keyed on `userId + query + timestamp` with a 10-second dedup window in Redis) to prevent duplicate conversation log entries from retries or concurrent requests.
- Output validation (follow-up count check, required section presence) is active for **all tiers** including SIMPLE.

## 10) Testing & verification

### 10.1 Unit/integration tests (Vitest)

- `npm test` runs Vitest (`vitest.config.ts`)
- Includes API route tests and engine tests

### 10.2 E2E tests (Playwright)

- `playwright.config.ts`:
  - `testDir: ./e2e`
  - `webServer.command` does: `npm run build` then `npm run start -p 3001` with test env flags
- `e2e/full-e2e-audit.spec.ts` includes coverage for:
  - Compare Assets initial-load UX and pricing copy
  - Shock Simulator initial-load UX and pricing copy
  - Rewards credit table copy
  - region toggle behavior using scoped selectors

Important:

- E2E uses port **3001** in the current config.
- `e2e/onboarding.spec.ts` is aligned to the current 3-step onboarding flow (no fourth completion modal).

## 11) Developer workflows (common tasks)

### Run locally

- `npm run dev`

### Lint / typecheck / test

- `npm run lint`
- `npm run typecheck`
- `npm test`

### E2E

- `npx playwright test`

### Prisma

Use the npm scripts (avoids Prisma CLI version drift):

- `npm run db:status`
- `npm run db:push`
- `npm run db:generate`
- `npm run db:seed`

## 12) Environment variables (non-exhaustive)

This repo reads many environment variables. The most important ones to know when debugging are listed here, and the full service-by-service checklist lives in `docs/ENV_SETUP.md`. Use `.env.example` as the sanitized starting point for new environments.

- **App**: `NEXT_PUBLIC_APP_URL`, `VERCEL_ENV`, `NODE_ENV`
- **Email**: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `BREVO_ONBOARDING_LIST_ID`, `BREVO_BLOG_LIST_ID`
- **AMI 2.0 bridge**: `AMI_WEBHOOK_SECRET` (shared HMAC secret with Convex AMI env vars)
- **Clerk**: `CLERK_WEBHOOK_SECRET` (+ standard Clerk publishable/secret keys)
- **Upstash Redis**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **News data**: `NEWSDATA_API_KEY` (NewsData.io crypto news endpoint; replaces legacy CryptoPanic)
- **Rate limit / bypass flags**: `SKIP_AUTH`, `SKIP_RATE_LIMIT`, `E2E_BYPASS`
- **Plan cache**: `PLAN_CACHE_ENABLED`, `LYRA_AUDIT_PLAN`
- **AI alerting**: `AI_ALERT_WEBHOOK_URL` (Slack/Discord webhook for 5-channel AI observability alerts)
- **ENTERPRISE token cap**: `ENTERPRISE_DAILY_TOKEN_CAP` (daily token ceiling for ENTERPRISE users; defaults to 2,000,000 tokens ≈ $500/day)
- **Myra**: `AZURE_OPENAI_DEPLOYMENT_MYRA`
- **Vercel env sync helper**: `.vercel-env-push.sh` now defaults to `production`, accepts an explicit scope, skips hosted-unsafe local-only variables, and uses newline-safe piping when pushing secrets.

Do not commit secrets. Prefer Vercel env vars or `.env` locally.

## 13) Email Ownership Boundary

All email delivery uses Brevo. Ownership is split at the system boundary:

- **LyraAlpha app sends**: welcome, blog-post notifications, weekly digest (QStash Monday), re-engagement, win-back, weekly intelligence reports, billing receipts — anything that requires Prisma user data
- **AMI 2.0 agent sends**: cold/warm outreach, waitlist nurture, campaign copy, non-blog newsletters — using its own Brevo API key and contact lists, never LyraAlpha's
- If AMI needs to reach LyraAlpha's opted-in subscribers, it triggers `/api/webhooks/ami` and LyraAlpha sends the email

See `docs/marketing-agent/AGENT_INTEGRATION_GUIDE.md` §9 for the full ownership table.

## 15) "Danger zones" (things AI agents should not break)

- **Auth bypass**: keep `src/lib/auth.ts` bypass gated to non-production.
- **Trial expiry**: do not remove downgrade logic in `plan-gate.ts`.
- **Redis JSON**: cache layer expects JSON; corrupted values are auto-deleted.
- **Hosted Redis envs**: do not reintroduce raw `Redis.fromEnv()` initialization without trimming/safe fallback behavior, or malformed hosted env whitespace can break route-module evaluation during build.
- **Region filtering**: if adding endpoints, propagate `region` when relevant.
- **Currency formatting**: never hardcode `$`/`₹` directly in UI when `asset.currency` exists.
- **Plan gating**: keep server-side checks in API routes; UI gating is not sufficient.
- **AMI webhook secret**: `AMI_WEBHOOK_SECRET` must be set in both Vercel and Convex env vars with identical values. Never hardcode it.
- **Blog post HTML**: always use `escHtml()` when interpolating DB-sourced `title`/`description` into email templates.
- **Public Myra route**: do not remove `/api/support/public-chat` from `isPublicApiRoute` in `src/proxy.ts`. Removing it will break landing page Myra for all unauthenticated visitors.
- **LiveChatBubble placement**: keep `LiveChatBubble` and `EliteCommandPalette` outside `SidebarInset` in `DashboardLayoutClient.tsx`. Moving them inside will clip their fixed positioning to the overflow container instead of the viewport.
- **textVerbosity field**: use `textVerbosity` (AI SDK field) inside `providerOptions.openai`, not a flat `verbosity` field. Flat `verbosity` is silently ignored on Azure.
- **Voice session plan gating**: `/api/support/voice-session` requires PRO+ plan. Do not lower this gate without updating the voice cost envelope and admin cost dashboard.
- **NewsData compatibility re-export**: `cryptopanic.service.ts` re-exports `newsdata.service.ts`. Do not reintroduce CryptoPanic-specific logic — the re-export exists only for backward-compatible imports.

## 16) Where to start when implementing a feature

For most new features:

1. Identify the UI route in `src/app/dashboard/*`.
2. Identify the backing API route in `src/app/api/*`.
3. Check for plan/rate-limit gating in the API route.
4. Put business logic in `src/lib/services/*` or `src/lib/engines/*` (avoid bloating route handlers).
5. Add/update schemas in `src/lib/schemas.ts` for request validation.
6. Add Vitest tests near the route/service (`*.test.ts`).
7. If UI-critical, add Playwright coverage under `e2e/`.

---

If you want this doc to include a **module-by-module deep dive** of every engine + every API route, say so and I'll expand it (it will be long).
