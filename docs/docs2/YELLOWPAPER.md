# LyraAlpha AI — Technical Yellow Paper
## Implementation-Aligned Specification Summary

> **Fork note:** This document reflects the current LyraAlpha repository and should be read alongside `CODEBASE.md` and `docs/ENV_SETUP.md`.

**Version 3.0 — Audited Against Current Code (March 2026)**

---

## 1. Purpose

This document is the implementation-aligned technical specification summary for the current LyraAlpha AI codebase.

It does not attempt to preserve every historical design proposal. Instead, it records the stable behaviors and technical contracts that are clearly reflected in the audited implementation.

---

## 2. Core System Rule

> **The engines compute. The AI interprets.**

This rule is the most important architectural invariant in the product.

The AI layer is expected to operate on:

- computed engine outputs
- retrieved platform knowledge
- regime context
- plan-aware routing decisions
- optional memory and live research augmentation

---

## 3. Core Domain Objects

### 3.1 Assets

The platform stores a multi-asset universe spanning:

- equities
- ETFs
- crypto
- mutual funds
- commodities

Assets carry structured metadata such as symbol, name, region, currency, exchange and asset-type-specific intelligence fields.

### 3.2 Scores and Derived Intelligence

The platform computes or stores analytical fields such as:

- Trend
- Momentum
- Volatility
- Liquidity
- Trust
- Sentiment
- Signal Strength
- regime context
- compatibility-style outputs
- lookthrough / intelligence overlays for supported asset classes
- stress-scenario definitions and proxy replay paths for premium shock workflows
- broker-connected portfolio snapshots normalized from India and US sources

### 3.3 Recent Dashboard Intelligence Surfaces

Shipped in the current release cycle:

- score velocity badges on asset cards and watchlist rows
- portfolio regime alignment visualization based on value-weighted compatibility scores
- heuristic portfolio drawdown framing on the portfolio hero surface
- watchlist drift alerting when holdings fall below the compatibility threshold
- discovery-feed signal-cluster detection for high-DRS bursts in a sector or asset class
- same-sector movers widgets on asset pages with compatibility context
- Lyra briefing staleness indicators when cached context ages beyond the freshness threshold
- holdings cost-basis P&L heatmap styling and expandable DSE score chips in the portfolio table

### 3.4 Blog and Content System

The platform ships a public blog system with a hybrid static + DB architecture.

**Data layer:**
- `BlogPost` Prisma model stores agent-published content with fields: slug, title, description, content, category, tags, keywords, metaDescription, heroImageUrl, author, featured, status (`published` / `archived`), sourceAgent, sourceContentId
- `src/lib/blog/posts.ts` merges DB posts with static seed posts; DB posts take priority when slugs collide
- `getAllPosts()`, `getPostBySlugAsync()`, `getAllCategories()`, `getRecentPostsAsync()` are the primary async read helpers

**Public routes:**
- `/blog` — paginated index, featured posts, all categories
- `/blog/[slug]` — full post with OG hero image, reading progress bar, share card, sidebar CTA, related posts
- `/blog/category/[category]` — programmatic category landing pages
- `/blog/feed.xml` — RSS 2.0 feed with ISR revalidation (1 hour)

**AMI 2.0 webhook bridge:**
- `/api/webhooks/ami` — HMAC-SHA256 verified POST endpoint
- Shared secret: `AMI_WEBHOOK_SECRET` (must match value in Convex AMI 2.0 env vars)
- Supported events: `blog_post.published`, `blog_post.updated`, `blog_post.archived`
- On publish: upsert → ISR revalidation of affected routes → async Brevo subscriber notification
- Payload schema validated by Zod before any DB write
- Signing / verification utilities in `src/lib/blog/webhook-verify.ts`

**Blog digest cron:**
- `/api/cron/blog-digest` — weekly digest email to `blogSubscribed: true` users
- Scheduled via QStash: `0 10 * * 1` (every Monday 10:00 UTC)
- Uses `withCronAuthAndLogging` middleware for QStash signature verification
- Batches up to 1,000 subscribers in groups of 50 to respect Brevo rate limits

**Email ownership boundary:**
- LyraAlpha app owns: welcome, new-post notifications, weekly digest, re-engagement, win-back, weekly reports, billing receipts (all require Prisma user data)
- AMI 2.0 agent owns: cold/warm outreach, nurture sequences, campaign copy, non-blog newsletters — using its own Brevo API key and contact lists
- AMI never writes directly to LyraAlpha's Brevo lists; it triggers the webhook and LyraAlpha sends

---

### 3.5 Roadmap Features (Planned)

**LYRA Voice Fintech Consultant (Q2 2026)**

Voice-enabled AI consultant interface allowing hands-free interaction with Lyra for portfolio and market analysis. Targeting mobile accessibility and multitasking scenarios. Tier: Elite+.

Key capabilities:
- Speech-to-text for natural language queries
- Text-to-speech for audio consumption of analysis
- Voice-activated portfolio briefings and market updates
- Mobile-optimized audio design for noisy environments

---

### 3.6 Stress Scenario Specification

The audited premium stress workflow currently supports the following scenario identifiers:

- `gfc-2008`
- `covid-2020`
- `rate-shock-2022`
- `recession`
- `interest-rate-shock`
- `tech-bubble-crash`
- `oil-spike`

Important implementation properties:

- scenarios exist for both **US** and **IN** where supported by the workflow registry
- each scenario can define severity, shock type, narrative metadata, factors and proxy paths
- proxy mapping is asset-type-aware and uses symbol/name/sector/category hints
- result payloads expose explanation fields: driver summary, transmission mechanism, pressure points, resilience themes, dominant drivers, and rationale

### 3.6 Users and Access Control

The main user-facing commercial tiers are:

- STARTER
- PRO
- ELITE
- ENTERPRISE

The user model also supports:

- credit balances
- total earned / spent counters
- promo-code trial state via `trialEndsAt`
- subscriptions and related lifecycle data

### 3.7 Onboarding Contract

The current implementation has two distinct onboarding contexts:

- a public prelaunch onboarding path centered on waitlist / access guidance (Myra handles this on the landing page)
- an authenticated dashboard onboarding gate with 3 steps: `Market`, `Experience`, and `Interests`

The authenticated gate completes directly from the final step and no longer uses a separate fourth completion modal.

### 3.8 Broker Portfolio Normalization

The current implementation supports a broker data contract that sits upstream of the intelligence engines.

Canonical broker behavior:

- brokers map into a shared normalized portfolio snapshot before any scoring engine sees the data
- raw broker payloads are retained for audit and reprocessing
- ISIN is the preferred cross-broker merge key, with symbol + exchange as the fallback
- broker-derived holdings and positions carry confidence scores
- validation is enforced through Zod schemas before persistence

The relevant code surfaces are:

- `src/lib/types/broker.ts`
- `src/lib/schemas.ts`
- broker sync orchestration layer
- broker dedup / merge layer

The portfolio dashboard presents this normalized data as a premium analytical workspace. The stable presentation order is: portfolio intelligence, benchmark comparison, health, fragility, allocation, quick insights, holdings, Monte Carlo simulation.

Refresh behavior is intentionally low-noise and user-controlled:

- manual refresh recomputes the active portfolio and refetches the dashboard state on demand
- the application performs at most one autonomous refresh per active portfolio every 24 hours
- the implementation does not rely on a sub-minute polling loop for portfolio UX freshness

---

## 4. Plan and Credit Specification

### 4.1 Implemented Monthly Credits

| Plan | Monthly Credits |
|---|---|
| **STARTER** | 50 |
| **PRO** | 500 |
| **ELITE** | 1,500 |
| **ENTERPRISE** | 1,500 |

### 4.2 Implemented Query Credit Cost

| Query Complexity | Credits |
|---|---|
| **SIMPLE** | 1 |
| **MODERATE** | 3 |
| **COMPLEX** | 5 |

This is the current runtime behavior from `src/lib/services/credit.service.ts`. One shared cost schedule applies across all plan tiers.

### 4.3 Multi-Asset Premium Workflow Pricing

| Workflow | Pricing | Limit |
|---|---|---|
| **Compare Assets** | 5 credits for first asset + 3 per additional | up to 4 unique assets |
| **Shock Simulator** | 5 credits for first asset + 3 per additional | up to 4 unique assets |

---

## 5. Query Classification Specification

Query classification is heuristic and regex-based.

### 5.1 Output Classes

- `SIMPLE`
- `MODERATE`
- `COMPLEX`

### 5.2 Important Behavioral Traits

The current classifier:

- preserves low-cost handling for educational definitions
- recognizes platform score concepts directly
- escalates multi-asset and portfolio-style prompts
- uses conversation length as a secondary escalation signal
- detects lowercase ticker-like forms
- short-circuits trivial conversational filler in the Lyra service path

### 5.3 Audit Correction

Technical-indicator language such as RSI/MACD is treated as **moderate analytical intent**, not automatically complex. This was one of the audited corrections made to align classification behavior with sensible cost/depth control.

---

## 6. Lyra Routing Specification

The authoritative plan-routing contract is defined in `src/lib/ai/config.ts`.

The platform runs entirely on **GPT-5.4** via the Azure OpenAI Responses API. Plan differentiation is achieved through model role and token budget — not model family switching. Gemini, OpenRouter, and Groq branches have been fully removed.

### 6.1 Model Roles

| Role | Model | Typical Use |
|---|---|---|
| `lyra-nano` | GPT-5.4-nano | STARTER SIMPLE/MODERATE |
| `lyra-mini` | GPT-5.4-mini | SIMPLE/MODERATE across all plans; STARTER COMPLEX |
| `lyra-full` | GPT-5.4 (full) | PRO/ELITE/ENTERPRISE COMPLEX |

### 6.2 Orchestration Modes

| Mode | Behavior | Plans |
|---|---|---|
| `single` | One direct `streamText` call to the appropriate model | All plans, all complexity tiers |

All plans use `single` mode. `router` and `draft_verify` have been **fully removed** — the `OrchestrationMode` type and `orchestrationMode` field no longer exist in `config.ts`. Quality is achieved through prompt contracts (`<output_contract>`, `<verbosity_controls>`, `<verification_loop>`) rather than multi-step orchestration.

### 6.3 Full Routing Matrix

| Plan | SIMPLE | MODERATE | COMPLEX |
|---|---|---|---|
| **STARTER** | lyra-nano · single | lyra-nano · single | lyra-mini · single |
| **PRO** | lyra-mini · single | lyra-mini · single | lyra-full · single |
| **ELITE** | lyra-mini · single | lyra-mini · single | lyra-full · single |
| **ENTERPRISE** | lyra-mini · single | lyra-mini · single | lyra-full · single |

### 6.4 Reasoning Effort

`reasoningEffort: "none"` is set across all tiers. Reasoning tokens on streaming paths add 3–5s TTFT with no quality benefit observed. Quality gains are achieved through prompt contracts:

- `<output_contract>` — enforces institutional-grade output structure
- `<verbosity_controls>` — sets thoroughness expectations at the system prompt level
- `<verification_loop>` — grounding check, signal consistency, completeness, institutional language strengthening

### 6.5 Output Verbosity

All Lyra generation calls use `textVerbosity: "high"` (AI SDK field mapping to `text.verbosity: "high"` in the Azure Responses API). The context compressor uses `textVerbosity: "low"` for dense bullet compression. Do **not** use a flat `verbosity` field — it is unsupported and silently ignored on Azure.

---

## 7. Token / Depth Configuration

### 7.1 Approximate Token Budgets by Plan × Complexity

| Plan | SIMPLE | MODERATE | COMPLEX |
|---|---|---|---|
| **STARTER** | 1,400 | 1,850 | 2,600 |
| **PRO** | 1,700 | 2,200 | 2,900 |
| **ELITE** | 2,000 | 2,600 | 3,200 |
| **ENTERPRISE** | 2,200 | 2,600 | 3,500 |

Implementation intent:

- shorter and cheaper educational output for low tiers
- larger analytical envelopes for higher tiers
- word-budget multipliers give the model an explicit target word count derived from the token ceiling
- no-context floor: when `knowledgeContext.length === 0 AND webSearchContext.length === 0`, wordBudget is raised to `Math.round(contentTokens * 0.60 * 0.72)` to prevent hollow short responses during web search outages

### 7.2 Daily Token Caps

A per-user, per-UTC-day token ceiling protects against runaway API spend.

| Plan | Daily Token Cap |
|---|---|
| **STARTER** | 50,000 |
| **PRO** | 200,000 |
| **ELITE** | 500,000 |
| **ENTERPRISE** | Uncapped (governed by contract) |

Caps are hot-patchable by admins via `/admin/ai-limits` (Redis key: `lyra:admin:daily_token_caps`) without a code deploy. Reset at midnight UTC.

---

## 8. RAG and Knowledge Retrieval

### 8.1 Lyra Retrieval

Lyra uses a dedicated knowledge layer built around:

- PostgreSQL full-text search (BM25-style retrieval)
- vector similarity retrieval
- merged / deduplicated result assembly
- selective live research augmentation when freshness is worth the latency

Lyra memory retrieval is staged so that very short conversations do not pay the full memory overhead too early.

Implementation-aligned behavior:

- GPT live research augmentation is not a blanket default for all moderate/complex requests
- compare / stress-test chatMode premium workflows avoid avoidable live-research overhead
- oversized GPT contexts can be pre-compressed via GPT-5.4-nano before generation
- history compression only fires for COMPLEX tier queries with histories exceeding 3000 chars
- the compressor uses `textVerbosity: "low"` and a 700-token output ceiling
- compression results are cached in Redis (keyed on context SHA-256, 2h TTL) to avoid redundant nano calls on identical context

### 8.2 Post-Retrieval Security

**Injection scan:** Every chunk returned by `searchKnowledge` is filtered against `INJECTION_PATTERNS` before being passed to the model. Chunks matching role-hijacking or instruction-override patterns are dropped with a structured `warn` log (`event: "rag_injection_filtered"`). `INJECTION_PATTERNS` is exported from `src/lib/ai/guardrails.ts`.

**Low-grounding warning:** After the injection scan, if tier is MODERATE or COMPLEX and average chunk similarity < 0.45, a `warn` log is emitted (`event: "rag_low_grounding"`). This flags potential confabulation risk.

**RAG result recording:** `recordRagResult(hadResults)` is called from `retrieveInstitutionalKnowledge` and feeds the zero-result rate alert window in `alerting.ts`.

### 8.3 Myra Retrieval

Myra uses a separate support knowledge surface rather than sharing Lyra's analytical knowledge path directly. This keeps support answers fast and product-specific.

Myra responses are cached using normalized query hashing (stop-word removal + sorted tokens + SHA-256):
- 4h TTL for authenticated sessions
- 8h TTL for public landing page sessions

---

## 9. Premium Workflow Contract

### 9.1 Shock Simulator Workflow

The Shock Simulator follows a hybrid design:

- direct replay is used when the asset has enough scenario-window history
- proxy replay is used when direct history is insufficient
- proxy replay is scaled using recent realized volatility / beta estimation
- scenario and asset-type adjustment rules can modify replay sensitivity and confidence
- UI and Lyra consume the resulting structured explanation payload

### 9.2 Optimization Notes

- recent price history is fetched in batch and grouped in memory
- scenario identifiers are exported without duplicate regional entries
- proxy selection candidates are aligned with available scenario datasets
- compare / stress-test chatMode preserves premium-workflow synthesis depth while avoiding avoidable overhead
- singleton HTTP client (`_client` module-level singleton) is used for all Azure OpenAI connections in both `orchestration.ts` and `compress.ts`

---

## 10. Myra Support Specification

Myra is the platform-support agent.

### 10.1 Responsibilities

- product guidance
- support / billing / settings help
- feature explanation
- navigation help
- redirecting analysis questions to Lyra

### 10.2 Public Landing Page Context

Myra is fully operational for unauthenticated visitors on the landing page. The `/api/support/public-chat` endpoint is exempted from Clerk middleware in `src/proxy.ts` via the `isPublicApiRoute` matcher. This is the authoritative public Myra endpoint and should not be removed from that matcher.

### 10.3 Dashboard Context

The Myra dashboard widget (`src/components/dashboard/live-chat-widget.tsx`) is rendered by `LiveChatBubble` (`src/components/dashboard/live-chat-bubble.tsx`). `LiveChatBubble` is mounted **outside** `SidebarInset` in `DashboardLayoutClient.tsx` so that its `fixed` positioning anchors to the true viewport rather than the `overflow-x-clip` scroll container. Do not move it back inside `SidebarInset`.

### 10.4 Governance

- Myra must not provide personalized financial advice
- Intent-sensitive patterns distinguish support questions from investment-decision questions
- Runtime copy hardened to avoid brittle hardcoded asset-count and plan-claim drift

---

## 11. Trial and Plan-Gate Specification

Elite promo-code trial behavior is enforced through:

- sign-up-time promo processing
- persisted `trialEndsAt`
- runtime plan-gate checks
- cron-based expiry sweep as secondary enforcement

This means trial expiration is enforced both inline and asynchronously.

---

## 12. Rate-Limit Summary

Rate limiting is plan-aware and endpoint-specific.

The exact request ceilings live in `src/lib/rate-limit/config.ts`. High-level rules:

- higher plans get larger ceilings
- chat and discovery are treated differently
- some windows are sliding and some are fixed depending on endpoint class
- `/api/support/public-chat` is public (no auth) — rate limited by IP at a permissive ceiling appropriate for public visitors

Related runtime hardening:

- hosted Redis credentials are trimmed before client initialization
- malformed hosted Redis env input falls back to a noop cache client instead of crashing route evaluation
- Vercel env sync helper uses newline-safe piping

---

## 13. Technology Summary

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 |
| **Language** | TypeScript |
| **Database** | PostgreSQL + Prisma |
| **Caching / Rate Limits** | Redis / Upstash |
| **Auth** | Clerk |
| **Lyra Model** | GPT-5.4 family (nano / mini / full) via Azure OpenAI Responses API |
| **Myra Model** | GPT-5.4-nano via Azure OpenAI |
| **Orchestration** | Single (all plans) — `router` and `draft_verify` removed from `TierConfig` |
| **Embeddings** | pgvector-backed retrieval stack |
| **Payments** | Stripe + Razorpay |
| **Email** | Brevo (LyraAlpha: transactional + lifecycle; AMI 2.0: outbound marketing) |
| **Cron** | Upstash QStash |

---

## 13.1 AI Observability & Runtime Safety

| Component | Implementation |
|---|---|
| **Alerting module** | `src/lib/ai/alerting.ts` — 5 channels, 15-min sliding Redis windows, webhook delivery |
| **LLM fallback** | Primary failure → `lyra-nano` fallback at 1200-token budget before surfacing error |
| **Post-retrieval scan** | Every RAG chunk filtered against `INJECTION_PATTERNS` pre-LLM |
| **Low-grounding log** | Avg similarity < 0.45 on MODERATE/COMPLEX → `warn` emitted |
| **Admin limits UI** | `/admin/ai-limits` — hot-patch daily token caps and alert thresholds via Redis |
| **Validation recording** | Output validation failures fed to alerting sliding window |
| **Web search alerting** | Circuit breaker failure count wired to `alertIfWebSearchOutage` |
| **Myra response cache** | Normalized hash, 4h TTL logged-in / 8h TTL public |
| **Compression cache** | Context SHA-256 keyed, 2h TTL — avoids redundant nano preflight calls |

---

## 14. Documentation Rule

This yellow paper is intentionally implementation-aligned. When a conflict exists between an older spec and the current audited code, the code is treated as authoritative unless the code is clearly incorrect or unsafe.

*Version 3.0 · March 2026*
