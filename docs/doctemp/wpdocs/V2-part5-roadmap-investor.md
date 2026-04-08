# WHITEPAPER V2 — PART 5
# Roadmap and Investor Thesis (Implementation-Aligned)

**Last updated: March 2026 — reflects current live codebase**

---

## Governance and Product Safety

The product's governance story remains stable across all states:

- engines compute
- AI interprets
- support and market analysis stay separated
- advice-style intent remains constrained
- premium depth does not remove product guardrails

This matters because the strongest product roadmap is one that scales without losing discipline.

---

## Investor Thesis

LyraAlpha AI is strongest when described as:

- a deterministic financial-intelligence platform with structured engine outputs
- with disciplined AI routing across GPT-5.4 nano / mini / full tiers
- with premium workflow monetization (Compare Assets, Shock Simulator, export tooling)
- with a clear commercial ladder from Starter → Pro → Elite → Enterprise
- with a credible path toward more reactive, persistent, and enterprise-ready product behavior

This is a more defensible long-term story than a generic AI-finance assistant because it ties product quality to architecture, workflows, and operating discipline — not to a single model or provider relationship.

---

## Current Monetization Inputs

| Plan | Monthly Credits | Positioning |
|---|---|---|
| **STARTER** | 50 | acquisition tier |
| **PRO** | 500 | regular-use analytical tier |
| **ELITE** | 1,500 | premium workflow tier |
| **ENTERPRISE** | 1,500 (commercially custom) | sales-assisted team plan |

### Query Credit Cost Schedule

| Complexity | Credits |
|---|---|
| **SIMPLE** | 1 |
| **MODERATE** | 3 |
| **COMPLEX** | 5 |

Multi-asset premium workflows (Compare Assets, Shock Simulator) are priced at **5 credits for the first asset + 3 credits per additional asset**, up to 4 assets.

### Live Routing Table (authoritative — March 2026)

| Plan | SIMPLE | MODERATE | COMPLEX |
|---|---|---|---|
| **STARTER** | GPT-5.4-nano · single | GPT-5.4-nano · single | GPT-5.4-mini · single |
| **PRO** | GPT-5.4-mini · single | GPT-5.4-mini · single | GPT-5.4-full · draft\_verify |
| **ELITE** | GPT-5.4-mini · single | GPT-5.4-full · router | GPT-5.4-full · draft\_verify |
| **ENTERPRISE** | GPT-5.4-mini · single | GPT-5.4-full · router | GPT-5.4-full · draft\_verify |

All plans run entirely on GPT-5.4 via Azure OpenAI Responses API. The differentiator is **orchestration mode**, **model role**, and **token budget** — not model family.

---

## What Has Already Shipped (V2 Delivery Record)

These items were roadmap themes in earlier drafts. They are now live in production.

### AI Routing and Orchestration
- ✅ GPT-5.4 across all plans and tiers (nano / mini / full)
- ✅ `draft_verify` orchestration for PRO/ELITE/ENTERPRISE COMPLEX: mini drafts a full response, full model verifies and streams the final answer in real time
- ✅ `router` orchestration for ELITE/ENTERPRISE MODERATE: mini streams first, auto-escalates to full if response shows uncertainty markers
- ✅ Full streaming on every code path — no blocking `generateText` calls remain. Draft step in `draft_verify` now consumes a stream internally, cutting perceived latency 2–4s
- ✅ `textVerbosity: "high"` on all Lyra generation paths via Azure Responses API
- ✅ `reasoningEffort: "none"` across all tiers — prompt contracts (`output_contract`, `verbosity_controls`) replace reasoning overhead
- ✅ Singleton HTTP client for Azure OpenAI (eliminates per-call connection overhead)
- ✅ ESCALATION_MIN_CHARS reduced 300→150 chars (halves blank-screen delay before first token on router paths)

### Context and Retrieval
- ✅ History compression parallelized — runs concurrently with other sync work (cache key, metrics), no longer adds serial latency
- ✅ History compression fires only for COMPLEX tier with >3000 chars (was firing too broadly)
- ✅ RAG timeouts tiered: SIMPLE=2s, MODERATE=3.5s, COMPLEX=5s (was flat 5s everywhere)
- ✅ Myra response cache with normalized query hashing (4h/8h TTL)
- ✅ Compression result cache keyed on context hash (2h TTL)

### Word Budget Enforcement
- ✅ ELITE MODERATE: hard word ceiling injected into format instructions (1000w target / 1100w ceiling)
- ✅ ELITE MODERATE token budget raised (maxTokens 2900→3200, wordBudgetMultiplier 0.383→0.505)
- ✅ Starter MODERATE word budget recalibrated to actual output distribution
- ✅ PRO COMPLEX word target updated to reflect draft_verify output depth (~900w)

### Platform and Safety
- ✅ Auth bypass and rate-limit bypass locked behind `E2E_BYPASS=true` flag in production
- ✅ Stripe routes use lazy initialization with explicit env validation
- ✅ Supabase realtime and push notifications degrade safely when env vars are missing
- ✅ Gemini dead code fully removed — zero Gemini callers remain in production paths
- ✅ ~400 lines of deprecated functions removed (points, score-dynamics, market-data services)
- ✅ Signal chip block (`<!--SIGNALS:...-->`) for ELITE/ENTERPRISE COMPLEX — machine-parseable verdict + confidence + flags rendered as UI chips

---

## Near-Term Product Themes (Next 60–90 Days)

These are directional — they reflect where current architecture and product decisions are pointing.

### Analytical Depth
- **Word budget compliance tuning** — continue calibrating WORD_TARGETS against live audit data across all plan/tier combinations; run `compare-audit-runs.ts` after each routing change
- **Prompt contract tightening for ELITE SIMPLE** — current avg 669w with high variance (edu vs analytical queries); better format branching to tighten spread
- **ENTERPRISE MODERATE calibration** — mirroring ELITE MODERATE router upgrade; validate 1000w target holds in production
- **Audit v4 baseline comparison** — next audit run should diff against the March 2026 baseline to detect regressions early

### Retention and Continuity
- **Session continuity improvements** — richer persistent state for chat history, saved analyses, and premium workflow results
- **Empty states that teach** — Starter and Pro empty states should explain what Lyra can do before credits are spent, not just fill visual space
- **Premium workflow onboarding** — Elite users should understand Compare Assets and Shock Simulator capabilities at first access, not discover them by accident

### Premium Workflow Expansion
- **Richer Compare Assets UX** — deepen the structured explanation payload; add regime-alignment framing between assets
- **Shock Simulator export** — Markdown or PDF export of scenario analysis for Elite users
- **Saved analytical sessions** — persist premium workflow outputs so users can return to prior analyses
- **Portfolio-level intelligence** — from asset-by-asset analysis toward portfolio-wide fragility, concentration, and correlation framing

### Acquisition and Trial
- **Promo-based Elite trials** — continue using server-side `trialEndsAt` as the authoritative trial state; marketing can vary promo codes and durations without code changes
- **Referral loop instrumentation** — track referral funnel from sign-up → activation → reward with tighter analytics
- **Public acquisition surfaces** — educational tool surfaces and answer-engine paths for non-authenticated users (phased, logged-in UX improves first)

---

## Infrastructure Themes (60–180 Days)

### Convex as Long-Term Primary App-State Backend
The current stack (Next.js + Prisma/Postgres + Redis/Upstash) remains authoritative today. The roadmap directs toward **Convex** as the long-term primary backend for application state.

The strategic argument: the next stage of premium product value increasingly depends on reactive updates, persistent session state, live support continuity, and collaboration-ready surfaces. The current stack handles these workloads but with more glue code and less real-time fluidity than a reactive-first backend.

**Best first Convex candidates:**
- live support and session state
- notifications and feed freshness
- saved analyses and activity state
- collaborative watchlists

**Likely relational-first initially:**
- canonical asset master data
- historical price and time-series data
- billing and subscription source-of-truth
- audit-grade analytical records

Migration is phased and workload-specific. The current Prisma/Postgres/Redis stack is not being replaced wholesale — Convex takes over reactive product surfaces first.

### Latency as a Product Feature
- faster TTFT on all tiers through continued prompt contract discipline
- cleaner RAG timeout tiering (already shipped for SIMPLE/MODERATE/COMPLEX)
- reduce cold-cache latency on high-frequency queries through smarter cache warming
- explore streaming compression results rather than blocking on compress before generation

### Cost Architecture
- query classification discipline (already strong) — continue auditing misclassification rate
- prompt caching efficiency — monitor stable-prefix hit rates, avoid prompt structure changes that break cache
- GPT-5.4 verbosity control as the primary output-length lever (not token ceiling alone)
- compression cache hit rate instrumentation

---

## Enterprise Story

Enterprise is not a generic larger self-serve plan.

The implementation-aligned future framing is:
- custom commercial packaging and sales-assisted onboarding
- same orchestration depth as Elite (router for MODERATE, draft_verify for COMPLEX)
- largest token budgets (COMPLEX: 3,500 tokens)
- future expansion into team-aware and workspace-aware product behavior
- stronger administrative visibility and support SLAs
- collaboration-ready analytical workflows as the primary Enterprise differentiator vs Elite

---

## Why the Economics Story Holds

The product's economic logic is strongest when framed through architecture:

- cheaper paths (nano/mini · single) for lighter requests
- premium model spend (full · draft_verify) reserved for high-value analytical work
- caching and retrieval discipline reduces repeat costs
- credits-first monetization creates transparent, auditable usage economics
- better UX and persistence as retention multipliers at Elite tier

This is more defensible than promising unlimited intelligence or relying on model branding alone. The moat is the architecture that keeps cost aligned with user value while making premium workflows feel meaningfully better.

---

## Conclusion

The strongest roadmap story for LyraAlpha AI stays close to implementation truth while clearly signaling the next phase:

- deterministic engines first, AI interpretation second
- GPT-5.4 across all plans with orchestration as the quality differentiator
- draft\_verify and router modes now live — institutional-quality synthesis at Pro and above
- credits-first monetization with promo-based Elite trials
- Convex as the long-term primary app-state backend direction
- premium workflow expansion (Compare, Shock, saved sessions, portfolio intelligence)
- Enterprise as a collaboration-ready, operationally distinct tier

That combination creates a believable path from today's product to a more reactive, more persistent, and more defensible financial-intelligence platform.

---

*Part 5 of 5 — implementation-aligned, updated March 2026*
