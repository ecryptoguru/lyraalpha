# Convex Migration Direction (Implementation-Aligned Future Memo)

**Last deep-research audit: March 2026**

---

## Purpose
This document reframes the Convex discussion from a historical migration note into a clearer future-state architecture memo, grounded in deep technical research conducted March 2026.

It should be treated as:
- a description of current backend reality
- a technically grounded explanation of why Convex is strategically attractive and where it has real constraints
- a phased narrative for how Convex can become the long-term primary app-state backend
- an honest assessment of whether implementation now is the right move

It should **not** be treated as evidence that the migration is already complete.

---

## Current Backend Reality (March 2026)
The current implementation remains anchored in:
- **Next.js 16 App Router** — API routes and server-side orchestration
- **PostgreSQL + Prisma** — all relational data: users, assets, scores, AI request logs, credits, billing
- **Redis / Upstash** — caching, rate limiting, session state, compression cache, Myra response cache
- **Clerk** — auth
- **GPT-5.4 (nano/mini/full) via Azure OpenAI** — all Lyra paths, single-mode orchestration
- **Stripe + Razorpay** — payments and subscriptions

This stack is real, current, and authoritative. Zero Convex code exists in the production codebase today.

---

## What Convex Actually Is (March 2026 Research)

Convex is a **reactive full-cloud backend** — not just a database. It replaces:
- your database (custom reactive engine backed by write-ahead log on AWS RDS)
- your server functions (TypeScript functions running inside the DB itself)
- real-time sync infrastructure (query subscriptions — clients auto-update when data changes)
- scheduling and background jobs
- file and vector storage

### Architecture model
- **Document-relational** (not SQL) — relationships via ID references, no native multi-table joins
- **Queries are subscriptions** — any client subscribed to a query reruns automatically on dependency change
- **ACID transactions** on mutations — fully consistent, isolated
- **TypeScript-native** — schema defined in code, functions run in the DB environment

### Hard limits (as of March 2026)
- Transactions must complete in **<100ms** — no long-running work inside queries/mutations
- Query/mutation read limit: **~8,000 documents** per transaction
- Document size: **1 MB max**
- Concurrent queries: S16 (free), S256 (Pro), D1024 (Enterprise)
- **No SQL** — no ad-hoc analytical queries, no multi-table joins, no window functions
- AI/LLM calls must use **Actions** (not queries/mutations) — Actions lack real-time guarantees

### Pricing (as of March 2026)
| Plan | Price | Function calls | DB storage |
|---|---|---|---|
| Starter | Free | 1M/mo | 0.5 GB |
| Professional | $25/member/mo | 25M/mo | 50 GB |
| Enterprise | Custom | Custom | Custom |
| Overage | $2/M calls | — | $0.20/GB |

Startup program: up to 1 year free Professional + 30% off usage up to $30K.

### Open source status
Convex backend is open source (GitHub: `get-convex/convex-backend`) and self-hostable via Docker + PostgreSQL. However, the reactive magic lives in the managed cloud platform — self-hosting loses most of the real-time sync guarantee simplicity.

---

## Why Convex Is Still the Intended Long-Term Direction
The future product increasingly depends on reactive, persistent, and collaboration-ready application behavior.

Convex is attractive as the long-term primary backend for **application state** because it offers:
- reactive query subscriptions — clients update automatically when data changes, no polling
- sub-50ms read/write latency at 5,000 concurrent connections (benchmark vs Supabase's 100–200ms p99)
- simpler real-time sync — no WebSocket management, no polling logic, no pub/sub infrastructure to maintain
- reduced glue code across stateful product surfaces
- a natural fit for live session state, notifications, support flows, and saved workflow state
- TypeScript-native schema and functions — same language as the whole product
- built-in RAG components and vector storage — relevant for future knowledge base evolution
- background job scheduling built in (replaces some Upstash/QStash patterns)

The strategic argument is not that the current stack is broken. It is that the future product will be stronger if app-state architecture becomes more reactive and less fragmented.

---

## What Convex Should Mean in the Product Story
The preferred future framing is:
- relational systems can continue to anchor canonical financial data and highly structured historical records during migration phases
- Convex becomes the long-term primary home for user-facing application state and reactive workflows
- the migration should be phased and workload-specific rather than all-at-once

This keeps the architecture story ambitious without becoming misleading.

---

## Best First Workload Candidates
The strongest first Convex candidates are the parts of the product that benefit most from live, persistent, reactive state.

### 1. Live support and session state
Good fit because it benefits from:
- reactive updates
- faster support continuity
- cleaner state persistence across screens and sessions

### 2. Notifications and feed freshness
Good fit because it reduces friction around:
- real-time updates
- feed refresh logic
- event-driven product surfaces

### 3. Saved analyses and agent activity state
Good fit because it supports:
- persistent analytical sessions
- activity timelines
- more durable premium workflow continuity

### 4. Collaborative watchlists and shared app-state surfaces
Good fit because it opens the path toward:
- workspace-aware features
- enterprise collaboration
- shared intelligence artifacts

---

## Workloads That Must Stay Relational-First (Hard Technical Constraint)
This is not just preference — it is a hard architectural constraint from Convex's document model and the nature of InsightAlpha's financial data.

### Relational-first permanently or long-term
- **Canonical asset master data** — complex multi-table relationships (assets × scores × regimes × countries × sectors) that require SQL joins
- **Historical time-series price data** — Convex is not a time-series engine; ingesting tick data at scale would exceed document limits and function call quotas rapidly
- **Billing and subscription source-of-truth** — Stripe + Prisma is the authoritative billing system; duplicating this into Convex creates consistency risk
- **Audit-grade AI request logs** — `AIRequestLog` requires structured SQL querying for admin analytics; Convex lacks ad-hoc aggregation
- **Score computation records** — high write volume, relational joins across assets and regimes
- **Admin analytics queries** — the admin dashboard runs analytical SQL across millions of rows; this is specifically what Convex is NOT designed for

This distinction is operationally critical. Convex taking over these workloads is not just hard — it would be architecturally wrong.

---

## Revised Phased Migration Concept

### Phase 1 — Lowest-Risk Reactive Surface (Recommended Start)
Introduce Convex for a **single, isolated surface** with no relational dependencies.

**Best first candidate: Myra support chat session state**
- Currently: Redis-backed Myra response cache + Prisma conversation records
- Convex fit: reactive live-chat UI updates, session continuity, agent handoff state
- Why this is safe: no complex SQL joins, no financial data, isolated from billing/credits
- Risk: low — if Convex fails this surface, fallback to Redis is clean
- Estimated effort: 2–4 weeks (schema, functions, client hooks, Clerk auth integration)

**Second candidate: notifications and feed freshness**
- Push notification state, watchlist alert status, feed timestamp tracking
- Benefit: eliminates polling patterns, reactive updates on market events
- Risk: medium — needs to stay in sync with Prisma asset data

### Phase 2 — Premium Workflow Persistence
Expand Convex-backed state into higher-value product experiences:
- saved premium analyses (Compare Assets, Shock Simulator results)
- cross-surface workflow continuity
- persistent portfolio and session context
- richer collaboration-ready user state

This phase requires more careful dual-write architecture where Prisma remains the canonical store and Convex holds the reactive application-state view.

### Phase 3 — Long-Term Primary App-State Role
Position Convex as the long-term primary backend for application state across most reactive product surfaces.

At this stage:
- relational systems (Postgres/Prisma) remain the canonical store for financial data, billing, audit logs
- Convex anchors the real-time product experience layer
- dual-write complexity is managed by clear domain ownership rules

---

## Product Benefits of the Migration Direction
If executed well, this direction can improve:
- user-perceived speed
- session continuity
- support quality
- premium workflow cohesion
- collaboration readiness
- developer velocity on reactive product features

These are product-level benefits, not merely backend preferences.

---

## Documentation Guardrails
When referencing Convex in future-facing docs:
- do not imply the migration is already complete
- do not erase the current Prisma/Postgres/Redis reality
- do not frame the shift as a total replacement of all data responsibilities on day one
- do frame Convex as the long-term primary backend direction for application state and reactive product behavior

---

## Summary
The most credible Convex story for InsightAlpha AI is:
- the current backend remains authoritative today
- the future product needs more reactive and persistent application behavior
- Convex is the intended long-term primary backend for app-state workloads
- migration should be phased, selective, and aligned to product value rather than ideology

That is the right architectural narrative for a more real-time, premium, and enterprise-ready version of the platform.
