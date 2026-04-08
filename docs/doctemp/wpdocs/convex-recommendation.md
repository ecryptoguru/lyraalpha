# Convex.dev — Deep Research & Implementation Recommendation

**Prepared: March 2026 | Based on deep technical research + current codebase audit**

---

## Executive Summary

Convex is technically sound, genuinely differentiated, and well-suited to a subset of LyraAlpha AI's workloads. However, **implementing it now is not the right decision.** The current product priority — AI quality, latency, and premium workflow depth — does not depend on real-time reactive state. The migration effort would be substantial, the risk is non-trivial, and the user-visible benefit of Phase 1 Convex work is low compared to other roadmap items.

**Recommendation: Keep as a 6–12 month horizon item. Begin a lean Phase 1 probe (Myra chat session state) only after premium workflow maturity and V2 platform hardening are complete.**

---

## 1. What Convex Actually Is

Convex is a **reactive full-cloud backend** — not just a database. It replaces:

| Component | What Convex provides |
|---|---|
| Database | Custom reactive engine (write-ahead log backed by AWS RDS) |
| Server functions | TypeScript functions running inside the DB |
| Real-time sync | Query subscriptions — clients update automatically on data change |
| Background jobs | Built-in scheduling (replaces some QStash/Upstash patterns) |
| File/vector storage | Native storage with bandwidth-based pricing |

### Architecture Model

- **Document-relational** — document store with ID-reference relationships. Not a SQL engine.
- **Queries = live subscriptions** — when any data dependency changes, Convex reruns the query and pushes updates to all subscribed clients automatically
- **ACID mutations** — fully consistent, isolated transactions
- **TypeScript-native** — schema in code, functions compile to V8 isolates running in the DB
- **Actions** — escape hatch for external API calls (OpenAI, Stripe) — not transactional, not reactive

### Hard Platform Limits (March 2026)

| Limit | Value |
|---|---|
| Transaction execution time | **<100ms** (hard) |
| Documents readable per transaction | ~8,000 |
| Document size | 1 MB max |
| No SQL | No joins, no window functions, no aggregations |
| Concurrent queries | S16 (free), S256 (Pro), D1024 (Enterprise) |
| AI/LLM calls | Must use Actions — no real-time guarantees |

### Pricing (March 2026)

| Plan | Price | Function calls | DB storage |
|---|---|---|---|
| Starter | Free | 1M/mo | 0.5 GB |
| Professional | $25/member/mo | 25M/mo | 50 GB |
| Enterprise | Custom | Custom | Custom |
| Overage function calls | $2 per 1M | — | — |
| Overage DB storage | — | — | $0.20/GB |

**Startup program:** Up to 1 year free Professional + 30% off usage-based fees up to $30K. Worth applying when the migration starts.

### Open Source Status

Backend is open source (`get-convex/convex-backend`, Docker + PostgreSQL self-host). However, the reactive sync magic is tightly coupled to the managed cloud platform. Self-hosting is possible but loses most of the developer-experience value.

---

## 2. Genuine Strengths

### 2.1 Real-Time Sync Without Infrastructure
Convex eliminates the need to build WebSocket infrastructure, polling loops, or pub/sub systems. Any subscribed client automatically receives updated data when the underlying data changes. For a product that wants live support chat, live feed freshness, and persistent session state — this is a genuinely large reduction in complexity.

### 2.2 Performance at Scale
Benchmarks show sub-50ms read/write latency at 5,000 concurrent connections vs Supabase's 100–200ms p99. For reactive UI patterns (live updates as data changes), this is a meaningful advantage.

### 2.3 TypeScript-Native, Developer-Ergonomic
The entire backend — schema, queries, mutations, scheduling — is TypeScript. No SQL migrations to manage separately. Schema changes are code-first. This is a strong DX fit for a TypeScript-heavy Next.js team.

### 2.4 Built-In Scheduling
Convex has native cron scheduling and background job patterns that could replace some Upstash/QStash usage for lightweight reactive workflows (e.g., feed staleness notifications, session cleanup).

### 2.5 Built-In RAG + Vector Storage
Convex has native vector storage and built-in RAG components. This is not immediately relevant given the current Pinecone-based knowledge retrieval system, but becomes interesting at V3 if knowledge retrieval moves in-platform.

### 2.6 Open Source + Self-Hosting Path
Unlike Firebase, there is a viable self-hosting exit if vendor costs or lock-in become a concern at scale.

---

## 3. Real Constraints and Risks

### 3.1 Not a SQL Engine — Critical for LyraAlpha
LyraAlpha AI's core data model is deeply relational:
- Assets × scores × regimes × countries × sectors require multi-table joins
- Admin analytics dashboard runs aggregation queries across millions of rows
- `AIRequestLog` requires structured SQL for cost/usage analytics
- Historical time-series price data has high write volume incompatible with Convex's document model

**These workloads cannot move to Convex.** Convex has no SQL, no JOIN keyword, no window functions, no aggregations. The admin dashboard alone would require a complete rewrite or a permanent dual-store architecture (Prisma for analytics, Convex for app state).

### 3.2 100ms Transaction Hard Limit
Convex queries and mutations must complete in under 100ms. This is fine for session state and notifications. It is incompatible with any computation-heavy backend logic currently in Prisma service layers (score computation, market sync, regime detection). These stay in Next.js API routes regardless.

### 3.3 Dual-Store Complexity
Using Convex alongside Postgres creates a permanent dual-source-of-truth problem for any data that touches both systems:
- User profile exists in Clerk + Prisma + Convex?
- Credits live in Prisma (billing source of truth) — how does Convex get a live credit count?
- Asset scores live in Prisma — how does Convex show live asset data?

Every sync boundary is an eventual consistency risk. Phase 2+ of the migration will require explicit dual-write patterns and clear domain ownership rules. This is not free complexity.

### 3.4 Vendor Lock-In
Convex functions are proprietary (V8 isolates running inside Convex's platform). Migrating off Convex requires rewriting all `convex/functions/*.ts` files as standard API routes or service layer code, plus exporting and transforming all data. This is lower risk than Firebase migration, but it is non-trivial.

### 3.5 No Transactions Across External Services
Convex Actions (which call external services like OpenAI, Stripe, Clerk) do not have the same ACID guarantees as queries/mutations. A failed Action that partially modified Convex state requires manual compensation logic. This matters for credit deduction + AI call sequences.

### 3.6 Function Call Quota at Scale
At current usage levels, the Professional plan's 25M function calls/month is generous. But reactive UIs generate many more function calls than REST API patterns — every subscription update is a function call. High-frequency market data updates could burn through quotas faster than expected.

### 3.7 Compliance Maturity
Convex is working on an Enterprise plan with SOC 2, SSO, and auditing. These are not fully available yet. For a financial product with Indian + US users, GDPR and data residency requirements may be a concern — Convex runs on AWS and data residency control is limited on lower-tier plans.

---

## 4. LyraAlpha-Specific Workload Analysis

### ✅ Strong Convex Fit

| Workload | Why |
|---|---|
| **Myra support chat session state** | No financial data, reactive UI, isolated from billing, clean fallback |
| **Notification + alert state** | Reactive updates, event-driven, no complex SQL joins |
| **Watchlist alert status** | Document-friendly, low relational complexity |
| **Saved premium analyses** (Compare, Shock) | Session-scoped, user-owned, no aggregation needed |
| **Online presence / activity stream** | Classic Convex use case, no relational risk |
| **Onboarding state machine** | Simple document state, reactive UI updates |

### ❌ Convex Is Wrong for These

| Workload | Why Convex is wrong |
|---|---|
| **Asset master data** | Multi-table joins: assets × scores × regimes × sectors |
| **Historical price time-series** | High write volume, time-series queries, not a document problem |
| **AI request logs** | Analytical SQL aggregations, admin dashboard queries |
| **Credit system** | Billing source-of-truth must remain in Prisma + Stripe |
| **Score computation** | Complex computation, relational joins, long-running |
| **Market sync** | Batch writes, high volume, time-series patterns |
| **Admin analytics** | The admin dashboard is specifically an analytical SQL workload |

### ⚠️ Possible With Care (Dual-Write Required)

| Workload | Risk |
|---|---|
| **User profile reactive state** | Clerk + Prisma remain canonical; Convex holds derived app-state view |
| **Plan-tier display state** | Credits in Prisma, display cache in Convex — sync boundary needed |
| **Feed freshness indicators** | Asset data in Prisma; freshness timestamps in Convex |

---

## 5. Competitive Comparison

| Dimension | Current Stack (Prisma+Redis) | Convex | Supabase |
|---|---|---|---|
| **Real-time sync** | Manual (polling/Redis pub-sub) | Native reactive subscriptions | Optional via subscriptions |
| **SQL support** | Full PostgreSQL | None | Full PostgreSQL |
| **TypeScript DX** | Good (Prisma) | Excellent (native) | Good |
| **Latency (reactive)** | Depends on polling interval | <50ms | 100–200ms p99 |
| **Analytical queries** | Excellent | Poor | Excellent |
| **Compliance** | Full control | SOC 2 in progress | SOC 2, GDPR ready |
| **Vendor lock-in** | Low (standard Postgres) | Medium (proprietary functions) | Low (standard Postgres) |
| **Migration cost** | — | High (schema + functions rewrite) | Lower (SQL-compatible) |
| **Pricing at scale** | Predictable (Upstash) | Function-call based (can spike) | Predictable |

---

## 6. Detailed Recommendation

### Should we implement Convex now?

**No. Not as an immediate priority.**

#### Why not now

1. **No active product pain that Convex solves today.** The current product's biggest gaps are in AI quality, latency, premium workflow depth, and UX polish — none of which require reactive state infrastructure.

2. **Migration effort is substantial.** Phase 1 alone (Myra chat session state) requires: Convex project setup, schema design, `convex/functions/` for chat queries/mutations, Clerk auth integration with Convex, client-side `useQuery`/`useMutation` hooks, and migration of existing Redis/Prisma session data. That's 2–4 weeks of focused engineering for a feature users won't visibly notice.

3. **Dual-store complexity starts immediately.** The moment Convex is live, you have two data systems that must stay in sync. Phase 2+ makes this harder, not easier.

4. **The 100ms limit and no-SQL constraint are permanent.** The core financial data model (assets, scores, regimes, price history, admin analytics) can never move to Convex. This means Postgres + Prisma is a permanent part of the architecture regardless of how far the Convex migration goes.

5. **Compliance gaps.** LyraAlpha serves Indian and US users. Convex's SOC 2 and GDPR controls are still maturing. The Professional plan gives limited data residency control.

#### When to start

**After these conditions are met:**
- Premium workflow UX (saved analyses, richer Compare/Shock UX) is stable
- V2 platform hardening is complete (onboarding, empty states, retention improvements)
- The team has capacity for a 2–4 week focused Convex proof-of-concept
- Convex's Enterprise compliance story is clearer

**Earliest realistic start: Q3 2026**

### The Right Phase 1 (When Ready)

**Scope: Myra support chat session state only**

Why this is the right first target:
- No financial data — no compliance risk, no audit implications
- No complex relational joins — pure document state
- Clean fallback if something goes wrong (Redis still works)
- High user-visible quality improvement (live typing indicators, session continuity, faster support UX)
- Isolated from billing and credits system
- Demonstrates the reactive pattern before committing to broader Phase 2

**What Phase 1 does NOT include:**
- Asset data, scores, or market data (stays Prisma forever)
- Credits or billing (stays Prisma + Stripe forever)
- Admin analytics (stays Prisma forever)
- AI request logging (stays Prisma forever)

### Investment Framing

For the startup program application (when ready), the pitch is:
- LyraAlpha AI is a TypeScript-native fintech platform on Next.js
- Current backend: Postgres + Prisma + Redis
- Convex adoption path: reactive app-state layer (chat, notifications, saved workflow state)
- Not replacing financial data systems — adding a reactive UX layer on top

This is a credible, honest startup program application that avoids overstating scope.

---

## 7. Updated Architecture Vision (When Convex Is Active)

```
┌─────────────────────────────────────────────────────────┐
│  Next.js App Router                                      │
│  ┌─────────────────────────┐  ┌───────────────────────┐ │
│  │  Financial Data Layer    │  │  Reactive App State   │ │
│  │  PostgreSQL + Prisma     │  │  Convex               │ │
│  │  ─────────────────────  │  │  ─────────────────    │ │
│  │  Assets, scores, regimes │  │  Chat sessions        │ │
│  │  Price history           │  │  Notifications        │ │
│  │  Credits, billing        │  │  Saved analyses       │ │
│  │  AI request logs         │  │  Activity streams     │ │
│  │  Admin analytics         │  │  Watchlist alerts     │ │
│  │  Market sync data        │  │  Presence/state       │ │
│  └─────────────────────────┘  └───────────────────────┘ │
│                                                          │
│  Redis / Upstash                                         │
│  Rate limiting, response caches, compression cache      │
│                                                          │
│  Azure OpenAI (GPT-5.4)     Clerk (Auth)                │
│  Stripe + Razorpay          Pinecone (RAG)              │
└─────────────────────────────────────────────────────────┘
```

**Key principle:** Postgres/Prisma is canonical for financial data. Convex is the reactive layer for application state. Redis remains for caching and rate limiting. These are separate domains — not competing systems.

---

## 8. Decision Matrix

| Question | Answer |
|---|---|
| Is Convex technically sound? | **Yes** — sub-50ms latency, ACID transactions, reactive sync is genuine |
| Is Convex the right long-term direction for app-state? | **Yes** — the product roadmap genuinely benefits from reactive state |
| Can Convex replace Postgres/Prisma? | **No** — document model + no SQL makes it wrong for financial data |
| Should we implement it now? | **No** — effort vs user-visible benefit ratio is poor right now |
| What's the right first workload? | **Myra chat session state** — isolated, no financial data, clean fallback |
| When should we start? | **Q3 2026** — after premium workflow + V2 platform stabilization |
| Should we apply for the startup program? | **Yes, when starting** — up to 1 year free Professional is material |

---

## 9. Documentation Guardrails (Unchanged)

When referencing Convex in docs:
- Do not imply the migration is already complete
- Do not erase the current Prisma/Postgres/Redis reality
- Do not frame Convex as a total replacement for all data responsibilities
- Do frame Convex as the long-term primary backend direction for **application state and reactive surfaces**
- Do be explicit that financial data, billing, admin analytics, and market data stay relational-first permanently

---

*Document prepared from deep research: Convex.dev FAQ, official limits documentation, architecture deep-dives, competitive analysis (Convex vs Supabase 2025), production use case analysis, and LyraAlpha codebase audit.*
