# LyraAlpha AI — Technical Whitepaper
## Implementation-Aligned Edition

> **Fork note:** This document reflects the current LyraAlpha repository and should be read alongside `CODEBASE.md` and `docs/ENV_SETUP.md`.

**Version 2.3 — Audited Against Current Code (April 2026)**

> **Latest updates:** Beta branding (replacing Elite Edition), new static pages (pricing, methodology, about, careers, legal), crypto-focused blog content, BTC search placeholder, UI copy trimming for clarity.

---

## 1. Executive Summary

LyraAlpha AI is a crypto intelligence platform built to help users understand cryptocurrency markets more clearly, act more consistently, and think more structurally.

The platform is built around one core principle:

> **The engines compute. The AI interprets.**

That principle matters because most crypto market products make one of two mistakes:

- they overwhelm users with disconnected raw on-chain data
- or they ask an AI model to sound smart without grounding it in a stable analytical system

LyraAlpha AI takes a different approach. It computes structured crypto signals first, then uses AI to explain what those signals mean, how they fit together, and why they matter in context.

At a practical level, the product combines:

- deterministic engine outputs for crypto assets
- crypto-market-regime awareness
- region-aware asset intelligence (US + India)
- **Lyra** for crypto market interpretation
- **Myra** for platform support — available both as a public support entry point and inside the authenticated dashboard
- plan-aware AI routing with multi-model single-call orchestration (nano / mini / full)
- premium analytical workflows: Compare Crypto Assets and Shock Simulator
- broker-connected portfolio import and normalization for India and US accounts
- dashboard intelligence surfaces: score velocity badges, regime-alignment bars, drawdown estimates, watchlist drift alerts, signal-cluster banners, same-sector movers, briefing staleness indicators, holdings P&L heatmaps
- a public **blog system** with hybrid static + DB posts, category pages, RSS feed, OG share cards, and reading progress
- **AMI 2.0 marketing agent integration** — HMAC-verified webhook bridge for blog publishing, subscriber notification, and ISR revalidation
- **Myra Voice** (shipped) — hands-free voice support via OpenAI Realtime API (`gpt-realtime-mini`), available to PRO+ users from the dashboard Myra widget. Supports English, Hinglish, and Hindi with client-side injection detection, PII redaction, and silence auto-stop

The result is not just an AI chatbot with crypto vocabulary. It is a structured intelligence product designed to turn quantitative crypto context into usable reasoning.

---

## 2. The Problem LyraAlpha AI Solves

Modern crypto investors already have access to more data than they can reasonably process. Price charts, on-chain metrics, DeFi analytics, protocol data, headlines, factor screens, analyst opinions, and macro commentary are everywhere.

What is usually missing is not information. It is interpretation.

Most crypto users struggle with:

- knowing which on-chain metrics actually matter
- connecting single-asset signals to broader crypto regime conditions
- interpreting conflicting signals without falling back on noise or narrative bias
- applying institutional-style reasoning without institutional infrastructure

LyraAlpha AI is designed to close that gap.

Instead of treating AI as the primary source of truth, the platform treats AI as an interpretation layer sitting on top of structured crypto computation. That design improves reliability, makes outputs easier to govern, and gives the user a more consistent analytical experience.

---

## 3. Product Architecture in Plain Language

LyraAlpha AI can be understood as three layers working together.

### 3.1 The Engine Layer

The engine layer computes the platform's structured crypto market signals before any AI answer is generated.

These signals include:

- Trend
- Momentum
- Volatility
- Liquidity
- Trust
- Sentiment
- crypto-market-regime context
- compatibility-style overlays and derived intelligence
- on-chain metrics
- DeFi analytics
- protocol data
- crypto news intelligence via NewsData.io — trending crypto news, per-asset news feeds, and sentiment extraction (synced every 12 hours via the `news-sync` cron)

This is the foundation of the product. It gives the platform a stable analytical backbone and reduces dependence on free-form model improvisation.

### 3.2 The AI Layer

The AI layer has two clearly separated roles.

- **Lyra** explains crypto market context, asset intelligence, regime fit, and premium analytical workflows.
- **Myra** handles support, onboarding, billing/help flows, plan questions, and platform guidance.

This separation is deliberate. Crypto market interpretation and product support are different tasks with different latency, tone, and governance needs. Splitting them improves safety, maintainability, and user clarity.

Lyra is not intended to invent data or behave like a generic crypto chatbot. She is designed to reason over platform-provided crypto context.

#### Myra as the Public Support Entry Point

Myra is available before a user signs in. The public chat endpoint (`/api/support/public-chat`) is explicitly exempted from auth middleware so unauthenticated visitors receive full AI-driven answers about the product, waitlist, early access, and how the platform works. The public Myra experience runs on GPT-5.4-nano via the same Azure OpenAI provider as Lyra. This is fully operational.

#### Myra Voice (Shipped)

Myra now supports hands-free voice interaction via the OpenAI Realtime API. The voice session endpoint (`GET /api/support/voice-session`) returns an ephemeral token, WSS URL, model config, and per-user instructions. The voice model is `gpt-realtime-mini` with voice `marin`, using PCM 24kHz audio and semantic VAD turn detection. Plan-gated to PRO+ users. The voice prompt uses a static prefix (cache-eligible at 10× cheaper text-input rate) plus a small dynamic per-user suffix with KB docs sanitized against injection patterns. Client-side defenses include virtual audio device filtering, PII redaction in transcripts, and client-side injection pattern detection.

### 3.3 The Product Layer

The product layer is where users experience that intelligence through application surfaces such as:

- dashboard home
- asset pages
- discovery workflows
- Compare Assets
- Shock Simulator
- watchlist and portfolio-adjacent surfaces
- upgrade and trial flows
- support interfaces
- a public prelaunch waitlist path plus an authenticated 3-step onboarding gate (`Market`, `Experience`, `Interests`) inside the dashboard shell

This is where computation, interpretation, and UX meet.

### 3.4 Premium Workflow Depth

LyraAlpha AI's premium layer is not just "longer answers." It is a deeper crypto workflow system.

The **Shock Simulator** is the clearest example:

- selectable historical crypto shock regimes across the US and India
- a hybrid replay engine that uses direct scenario windows when available and proxy replay when direct history is incomplete
- asset-type-aware proxy mapping across crypto assets
- structured explanation payloads covering transmission mechanisms, pressure points, dominant drivers, resilience themes, and rationale
- Lyra follow-up interpretation that turns replay output into hedge and resilience guidance for crypto portfolios

**Compare Crypto Assets** (Elite and above): multi-asset cross-sector synthesis across up to 4 crypto assets, pricing 5 credits for the first asset + 3 per additional.

Premium product value comes from workflow design and structured crypto intelligence, not from a more expensive model call alone.

### 3.5 Recent Dashboard Intelligence Surfaces

The last round of shipped product work added lightweight but high-signal surface area:

- score velocity badges on asset cards and watchlist rows
- portfolio regime alignment visualization based on value-weighted compatibility scores
- heuristic portfolio drawdown framing on the portfolio hero surface
- watchlist drift alerting when holdings fall below the compatibility threshold
- discovery-feed signal-cluster detection for high-DRS bursts in a sector or asset class
- same-sector movers widgets on asset pages with compatibility context
- Lyra briefing staleness indicators when cached context ages beyond the freshness threshold
- holdings cost-basis P&L heatmap styling and expandable DSE score chips in the portfolio table

### 3.6 Public Blog and AMI 2.0 Integration

#### Blog System

The blog layer uses a hybrid static + DB architecture:

- **Static posts** are seeded at build time in `src/lib/blog/posts.ts` and serve as the zero-dependency baseline
- **DB posts** are written by AMI 2.0 via the `/api/webhooks/ami` endpoint and stored in the `BlogPost` Prisma model
- DB posts take priority over static fallbacks when slugs collide
- Category pages, RSS feed at `/blog/feed.xml`, OG hero images with logo overlay, reading progress bar, share cards, and contextual CTAs

#### AMI 2.0 Webhook Bridge

The `/api/webhooks/ami` route is the integration point between LyraAlpha and the external AMI 2.0 marketing agent:

- Payloads verified with HMAC-SHA256 using `AMI_WEBHOOK_SECRET`
- Supported events: `blog_post.published`, `blog_post.updated`, `blog_post.archived`
- On publish: Prisma upsert → ISR revalidation of `/blog`, `/blog/[slug]`, category page, and `/` → async subscriber notification via Brevo
- Zod schema validation enforced before any DB write

#### Email Ownership Split

All email delivery uses Brevo. Ownership is split clearly:

- **LyraAlpha app owns** transactional and lifecycle emails: welcome, blog notifications, weekly digest (every Monday via QStash), re-engagement, win-back, weekly intelligence report, billing receipts
- **AMI 2.0 agent owns** outbound marketing emails: cold/warm outreach, waitlist nurture sequences, campaign copy, newsletter broadcasts — using its own Brevo API key and contact lists
- AMI never calls LyraAlpha's Brevo API directly; if it needs to reach opted-in LyraAlpha subscribers, it triggers the webhook and LyraAlpha does the send

### 3.7 Broker-Connected Crypto Portfolio Intelligence

LyraAlpha AI treats broker connectivity as part of the structured crypto data layer.

The portfolio layer ingests normalized snapshots from Indian and US brokers, then feeds the same intelligence engines used elsewhere in the product:

- ranked India broker coverage plus a US aggregation/direct-broker path
- one normalized broker payload contract for crypto holdings, positions, transactions, cash balances, and accounts
- ISIN-first deduplication when multiple sources report the same instrument
- raw payload retention for audit and reprocessing
- confidence-scored mappings for derived crypto holdings and positions
- Zod validation before normalized data reaches the intelligence layer

The portfolio dashboard surfaces signals in a deliberate order: portfolio intelligence, benchmark comparison, health, fragility, allocation, quick insights, crypto holdings, and Monte Carlo simulation.

Refresh behavior is intentionally low-noise:

- a manual **Refresh Portfolio** action recomputes the active crypto portfolio on demand
- a 24-hour autonomous refresh gate keeps connected crypto portfolios fresh without continuous polling

---

## 4. Plan-Aware Intelligence Design

LyraAlpha AI does not treat every question the same. It scales analytical depth, runtime cost, and model choice by plan and by query complexity.

### 4.1 Current Lyra Routing

The platform runs entirely on **GPT-5.4** across all plans and complexity tiers via the Azure OpenAI Responses API. The differentiator between plans is the **model role** (nano / mini / full) and **token budget**. All plans use a single `streamText` call — `router` and `draft_verify` have been fully removed from `TierConfig`.

| Plan | SIMPLE | MODERATE | COMPLEX |
|---|---|---|---|
| **STARTER** | GPT-5.4-nano · single | GPT-5.4-nano · single | GPT-5.4-mini · single |
| **PRO** | GPT-5.4-mini · single | GPT-5.4-mini · single | GPT-5.4-full · single |
| **ELITE** | GPT-5.4-mini · single | GPT-5.4-mini · single | GPT-5.4-full · single |
| **ENTERPRISE** | GPT-5.4-mini · single | GPT-5.4-mini · single | GPT-5.4-full · single |

### 4.2 Orchestration Mode

**single** — one direct `streamText` call to the appropriate model. Lowest latency, most predictable cost, no two-phase overhead. Used across all plans and all complexity tiers.

`router` and `draft_verify` have been fully removed from `TierConfig`. The `OrchestrationMode` type and `orchestrationMode` field no longer exist in `config.ts`. Quality is achieved through prompt contracts (`<output_contract>`, `<verbosity_controls>`, `<verification_loop>`) rather than multi-step orchestration.

### 4.3 Output Verbosity

All generation paths use `text.verbosity: "high"` (via AI SDK's `textVerbosity` field) to maximize analytical depth and thoroughness. The context compressor uses `text.verbosity: "low"` to produce dense bullets. The `<verbosity_controls>` prompt contract in the system prompt reinforces this at the instruction level.

### 4.4 Query Classification

Before Lyra responds, the platform classifies requests into **SIMPLE**, **MODERATE**, or **COMPLEX**.

This allows the system to:

- keep lightweight requests fast and affordable
- reserve deeper synthesis for real analytical work
- avoid overspending on repetitive educational questions
- scale the experience naturally for more advanced users

### 4.5 AI Security & Observability Hardening

**Full conversation injection scan (SEC-0)**
All messages in the conversation history are scanned for injection patterns via `checkPromptInjection` before the Lyra pipeline proceeds — not just the last user message.

**User memory injection scan (SEC-0b)**
Every memory chunk returned by `retrieveUserMemory()` is filtered against `INJECTION_PATTERNS` before being added to context. Chunks matching patterns are dropped with a structured `warn` log. Defends against stored-memory poisoning.

**Multi-asset mode plan gating (SEC-0c)**
Multi-asset mode is gated behind plan checks. STARTER and PRO users cannot be silently upgraded to multi-asset inference, preventing cost leaks.

**Post-retrieval injection scan (SEC-1)**
Every RAG chunk returned by `searchKnowledge` is scanned against `INJECTION_PATTERNS` before being passed to the LLM. Chunks matching injection patterns are silently dropped with a structured `warn` log (`event: "rag_injection_filtered"`).

**Low-grounding confidence warning (RAG-1)**
After the injection scan, if tier is MODERATE or COMPLEX and average chunk similarity falls below 0.45, a `warn` log is emitted (`event: "rag_low_grounding"`).

**LLM nano fallback (COST-1)**
If the primary `streamText` call fails, the error is caught and a fallback attempt is made with `lyra-nano` at 1200-token budget. Fallback completions are logged with `wasFallback: true`.

**Proactive AI alerting (OBS-1)**
`src/lib/ai/alerting.ts` provides five alert channels using 15-minute sliding Redis windows:
- Daily cost ceiling breach
- Web search consecutive failure (circuit breaker)
- RAG zero-result rate elevation
- Output validation failure rate elevation
- Nano fallback rate elevation

Alerts fire via webhook to `AI_ALERT_WEBHOOK_URL` with a 15-minute per-alert cooldown. All emitters are fire-and-forget.

**Admin AI Limits UI (COST-3)**
Daily token caps and alert thresholds are hot-patchable from `/admin/ai-limits` without a code deploy. Overrides stored in Redis and merged with hardcoded defaults on every cap-check.

### 4.6 Fast Paths and Runtime Efficiency

- trivial-query short-circuiting for filler messages (no model call)
- educational cache paths for lightweight explanatory questions
- prompt memoization and stable-prefix reuse
- singleton HTTP client pattern for Azure OpenAI connections
- plan-aware context depth gating
- staged memory retrieval
- selective live research augmentation (skipped for chatMode and non-recency queries)
- history compression only for COMPLEX tier queries with histories exceeding 3000 chars using GPT-5.4-nano with `textVerbosity: "low"` and 700-token ceiling
- Myra response caching — normalized query hashing with 4h TTL (logged-in) and 8h TTL (public)
- compression result caching — Redis-keyed on context hash, 2h TTL
- conversation log idempotency — `storeConversationLog` uses a 10-second Redis dedup window to prevent duplicate entries from retries or concurrent requests

---

## 5. Technical Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 App Router |
| **UI** | React 19 + Tailwind CSS v4 |
| **Database** | PostgreSQL + Prisma |
| **Caching / Rate Limiting** | Redis / Upstash |
| **Auth** | Clerk |
| **AI Runtime** | Vercel AI SDK |
| **Lyra Model** | GPT-5.4 family (nano / mini / full) via Azure OpenAI Responses API |
| **Myra Model** | GPT-5.4-nano via Azure OpenAI (same provider as Lyra) |
| **Myra Voice Model** | `gpt-realtime-mini` via OpenAI Realtime API (voice `marin`) |
| **Orchestration** | Single mode (all plans) |
| **Web / Live Research** | Selective live augmentation for freshness-sensitive paths |
| **Payments** | Stripe + Razorpay |
| **Email** | Brevo (transactional + lifecycle: LyraAlpha; outbound marketing: AMI 2.0) |
| **Cron Scheduling** | Upstash QStash |
| **Testing** | Vitest + Playwright |

Implementation notes:

- All generation calls use `textVerbosity: "high"` (AI SDK field → `text.verbosity` in Azure Responses API)
- `reasoningEffort: "none"` is used across all tiers — reasoning tokens on streaming paths add 3–5s TTFT with no quality benefit; quality is achieved through prompt contracts instead
- Redis initialization is hardened so malformed env whitespace is trimmed before client creation; cache initialization fails open to a noop client instead of crashing route-module evaluation during build
- Gemini / OpenRouter / Groq branches have been fully removed — the platform runs exclusively on GPT-5.4 via Azure OpenAI

---

## 6. Region-Aware Product Design

LyraAlpha AI is explicitly region-aware across the US and India. That affects:

- asset search and discovery
- listing and filtering behavior
- currency formatting
- market knowledge
- region-specific analytical context
- premium workflow relevance (shock regimes, sector coverage)

Region is not cosmetic metadata. It changes what the system shows, how it explains it, and which market context is relevant.

---

## 7. Why the Dual-Agent Model Matters

The separation between Lyra and Myra is one of the platform's most important product decisions.

It separates:

- **analysis** from **support**
- **market reasoning** from **account and product help**
- **premium intelligence workflows** from **lightweight navigation or billing requests**

That separation improves user clarity, governance and safety, response speed, maintainability, and long-term product scalability.

Myra covers public prelaunch waitlist/access questions at the public support entry point (unauthenticated). Lyra remains the authenticated market-intelligence surface. This is now fully operational — the public Myra endpoint is exempted from auth middleware so visitors receive real AI-driven answers.

---

## 8. Safety and Governance

LyraAlpha AI is designed as a crypto analytical product, not a recommendation engine.

Key safeguards include:

- financial-advice intent boundaries in both Lyra and Myra
- support/analysis routing separation
- post-retrieval prompt-injection scanning
- voice prompt injection scanning (KB docs sanitized before injection into voice instructions; page param validated against injection patterns)
- client-side voice injection detection (lightweight pattern matching on voice transcripts)
- client-side PII redaction for voice transcripts (email, phone, user ID)
- server-side plan gating
- deterministic-context-first design
- `<verification_loop>` prompt contract — enforces grounding check, signal consistency, completeness, and institutional language strengthening
- Redis env hardening so malformed values do not crash the application build path

---

## 9. Credit and Access Model

### Monthly Credits

| Plan | Monthly Credits |
|---|---|
| **STARTER** | 50 |
| **PRO** | 500 |
| **ELITE** | 1,500 |
| **ENTERPRISE** | 1,500 |

### Query Credit Cost

| Query Complexity | Credits |
|---|---|
| **SIMPLE** | 1 |
| **MODERATE** | 3 |
| **COMPLEX** | 5 |
| **Compare Assets / Shock Simulator** | 5 + 3 per additional asset (up to 4) |

### Daily Token Caps (Secondary Backstop)

| Plan | Daily Token Cap |
|---|---|
| **STARTER** | 50,000 |
| **PRO** | 200,000 |
| **ELITE** | 500,000 |
| **ENTERPRISE** | 2,000,000 tokens/day (~$500/day; env-configurable via `ENTERPRISE_DAILY_TOKEN_CAP`) |

The cap check applies to **all plans including ENTERPRISE**. Daily caps are hot-patchable from `/admin/ai-limits` without a code deploy.

---

## 10. Premium Product Positioning

### STARTER
A lower-friction entry point into the framework, product surfaces, and basic interpretation model. Uses GPT-5.4-nano for SIMPLE/MODERATE and GPT-5.4-mini for COMPLEX.

### PRO
A stronger daily-use analytical plan with a meaningfully larger usage envelope and full-model quality on COMPLEX queries. Uses GPT-5.4-full direct single stream on COMPLEX.

### ELITE
The flagship premium intelligence tier. Activates Compare Assets, Shock Simulator, web search augmentation, and cross-sector context. Uses GPT-5.4-full direct single stream for COMPLEX.

### ENTERPRISE
Custom packaging for the highest-intensity use cases. Mirrors Elite routing with the largest token budgets (COMPLEX: 3,500 tokens), highest operational ceilings, and a finite daily token cap of 2,000,000 tokens (~$500/day, env-configurable).

---

## 11. Why This Architecture Matters

LyraAlpha AI's advantage is not just that it uses AI.

Its advantage is the combination of:

- deterministic analytical computation
- region-aware context
- plan-aware routing with single-call multi-model orchestration
- dual-agent specialization (Lyra for markets, Myra for support)
- premium workflow design (structured payloads, not just longer prompts)
- performance-conscious runtime discipline
- prompt contracts (`<output_contract>`, `<verbosity_controls>`, `<verification_loop>`) that enforce quality at the instruction level
- full public accessibility of Myra so acquisition surfaces are AI-assisted from first touch

That combination turns raw market data into a system that can explain, compare, stress, and contextualize market behavior in a way that feels structured rather than improvised.

The product's edge comes from architecture, not just model choice.

---

## 12. Conclusion

LyraAlpha AI is best understood as a structured crypto intelligence system.

It is built to help users move from scattered crypto information to disciplined interpretation.

By computing analytical structure first and using AI as an explanation layer on top — with plan-aware orchestration that matches the right model role and generation strategy to each query — the platform creates a more stable, more governable, and more user-friendly experience than a generic crypto chatbot approach can offer.

---

## 13. Documentation Rule

This whitepaper follows audited implementation behavior while remaining readable at a product and technical-strategy level.

If routing, orchestration modes, credits, premium tooling, workflow naming, or core runtime assumptions change in code, this document should be updated to match the implemented system.

*LyraAlpha AI — Crypto Intelligence, Not Crypto Noise*
*Version 2.3 · April 2026*
