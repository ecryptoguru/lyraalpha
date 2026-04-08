# InsightAlpha AI — Tiered Plans & Feature Matrix

This document describes the currently implemented plan behavior for InsightAlpha AI. Where earlier product concepts differed, this file follows the stable code path and active runtime behavior.

> **Last reviewed:** March 2026. Reflects all updates through the current release cycle including Myra public chat, dashboard UI fixes, and AI stack consolidation to GPT-5.4 exclusively.

---

## 1. Plan Overview

| Feature | STARTER | PRO | ELITE | ENTERPRISE |
|---|---|---|---|---|
| **Target User** | New users learning the framework | Active self-directed investors | Power users needing deeper synthesis | Teams / high-intensity workflows |
| **Price** | Free | $14.99 / ₹1,499 | $39.99 / ₹3,999 | Custom |
| **Monthly Credits** | 50 | 500 | 1,500 | 1,500 (current implementation) |
| **Lyra Model** | GPT-5.4-nano (SIMPLE/MOD) · mini (COMPLEX) | GPT-5.4-mini (SIMPLE/MOD) · full (COMPLEX) | GPT-5.4-mini (SIMPLE/MOD) · full (COMPLEX) | GPT-5.4-mini (SIMPLE/MOD) · full (COMPLEX) |
| **Orchestration** | single | single | single | single |
| **Typical Depth** | Educational and concise | Full retail analysis + lyra-full on COMPLEX | Deeper cross-asset synthesis, premium workflows, web search | Highest operational limits and largest token budgets |
| **Trial Handling** | None | None | Promo-code trial supported | Custom / negotiated |

---

## 2. Lyra Intelligence Routing

The authoritative routing logic lives in `src/lib/ai/config.ts`.

The platform runs entirely on **GPT-5.4** via the Azure OpenAI Responses API. Gemini, OpenRouter, and Groq branches have been fully removed. Plan differentiation is through **model role** (nano / mini / full) and **token budget**. All plans use `single` mode — `router` and `draft_verify` have been fully removed from `TierConfig` and the `OrchestrationMode` type deleted from `config.ts`.

### 2.1 Full Routing Matrix

| Plan | SIMPLE | MODERATE | COMPLEX |
|---|---|---|---|
| **STARTER** | GPT-5.4-nano · single | GPT-5.4-nano · single | GPT-5.4-mini · single |
| **PRO** | GPT-5.4-mini · single | GPT-5.4-mini · single | GPT-5.4-full · single |
| **ELITE** | GPT-5.4-mini · single | GPT-5.4-mini · single | GPT-5.4-full · single |
| **ENTERPRISE** | GPT-5.4-mini · single | GPT-5.4-mini · single | GPT-5.4-full · single |

### 2.2 Orchestration Mode

**single** — one direct `streamText` call to the appropriate model. Lowest latency, most predictable cost. Used across all plans and all complexity tiers.

`router` and `draft_verify` have been **fully removed** from `TierConfig` and the `OrchestrationMode` type deleted from `config.ts`. Quality is achieved through prompt contracts (`<output_contract>`, `<verbosity_controls>`, `<verification_loop>`) rather than multi-step orchestration.

### 2.3 Reasoning Effort

`reasoningEffort: "none"` is used across all tiers. Reasoning tokens on streaming paths add 3–5s TTFT with no quality benefit observed. Quality is achieved through prompt contracts instead.

### 2.4 Output Verbosity

All Lyra generation paths use `text.verbosity: "high"` (via `textVerbosity` AI SDK field). The context compressor uses `text.verbosity: "low"`. Do **not** use a flat `verbosity` field — it is unsupported and silently ignored on Azure.

### 2.5 Notes

- `SIMPLE`, `MODERATE`, and `COMPLEX` are assigned by the heuristic classifier in `src/lib/ai/query-classifier.ts`.
- Technical-indicator language (RSI, MACD) is treated as MODERATE intent, not automatically COMPLEX.
- PRO/ELITE/ENTERPRISE COMPLEX all use lyra-full direct single stream for maximum quality.
- STARTER MODERATE has `ragMemoryEnabled: true` — past-context anchoring improves nano answer quality.
- Myra support routing is separate from Lyra routing and runs on GPT-5.4-nano.
- Broker connectivity and normalization are product-wide data-layer capabilities; they are not used as a plan gate for basic portfolio import.
- Public-site visitors are handled in a prelaunch/waitlist context by the public Myra endpoint (`/api/support/public-chat`) and should not be assumed to already be on a paid plan.

---

## 3. Credit Behavior

The authoritative credit logic lives in `src/lib/services/credit.service.ts`.

### 3.1 Monthly Credit Reset

| Plan | Monthly Credits |
|---|---|
| **STARTER** | 50 |
| **PRO** | 500 |
| **ELITE** | 1,500 |
| **ENTERPRISE** | 1,500 |

### 3.2 Query Credit Cost

Current implementation uses a single shared pricing model across plan tiers:

| Query Complexity | Credit Cost |
|---|---|
| **SIMPLE** | 1 |
| **MODERATE** | 3 |
| **COMPLEX** | 5 |

This is intentionally documented as implemented behavior. Earlier planning docs described tier-differentiated query costs — that is **not** the current runtime behavior.

### 3.3 Multi-Asset Premium Workflow Pricing

| Workflow | Pricing | Limit |
|---|---|---|
| **Compare Assets** | 5 credits for first asset + 3 per additional | up to 4 unique assets |
| **Shock Simulator** | 5 credits for first asset + 3 per additional | up to 4 unique assets |

---

## 4. Token Budgets

Approximate `maxTokens` values by plan × complexity (authoritative values in `src/lib/ai/config.ts`):

| Plan | SIMPLE | MODERATE | COMPLEX |
|---|---|---|---|
| **STARTER** | 1,400 | 1,850 | 2,600 |
| **PRO** | 1,700 | 2,200 | 2,900 |
| **ELITE** | 2,000 | 2,600 | 3,200 |
| **ENTERPRISE** | 2,200 | 2,600 | 3,500 |

All tiers use a single model call. Token budgets are right-sized per plan and complexity. ENTERPRISE COMPLEX is the highest ceiling at 3,500 tokens.

---

## 4.1 Daily Token Caps (Secondary Cost Backstop)

In addition to monthly credits, a per-user, per-UTC-day token ceiling acts as a secondary safeguard against runaway API cost.

| Plan | Daily Token Cap |
|---|---|
| **STARTER** | 50,000 |
| **PRO** | 200,000 |
| **ELITE** | 500,000 |
| **ENTERPRISE** | Uncapped (governed by contract) |

Caps are configurable by admins via `/admin/ai-limits` without a code deploy. Caps reset at midnight UTC.

---

## 5. Capability Summary

| Capability | STARTER | PRO | ELITE | ENTERPRISE |
|---|---|---|---|---|
| **Educational definitions / score literacy** | ✓ | ✓ | ✓ | ✓ |
| **RAG-backed platform intelligence** | Limited / lightweight | ✓ | ✓ | ✓ |
| **Conversation memory** | Limited by routing/config | ✓ | ✓ | ✓ |
| **Web-augmented higher-depth analysis** | ✗ | COMPLEX only | ✓ | ✓ |
| **Cross-sector correlation context** | ✗ | COMPLEX only | MOD + COMPLEX | MOD + COMPLEX |
| **lyra-full on COMPLEX** | ✗ | ✓ | ✓ | ✓ |
| **Compare Assets** | ✗ | ✗ | ✓ | ✓ |
| **Shock Simulator** | ✗ | ✗ | ✓ | ✓ |
| **Markdown export / premium workflows** | ✗ | ✗ | ✓ | ✓ |
| **LYRA Voice Fintech Consultant** | ✗ | ✗ | Roadmap Q2 2026 | Roadmap Q2 2026 |
| **Broker-connected portfolio import** | ✓ | ✓ | ✓ | ✓ |
| **Public Myra landing page support** | ✓ (pre-auth) | ✓ | ✓ | ✓ |
| **Dashboard Myra support agent** | ✓ | ✓ | ✓ | ✓ |

---

## 6. Plan Positioning

### STARTER

**Taste the framework.**

Starter is designed to let users understand how InsightAlpha AI thinks: score interpretation, regime-aware analysis, and concise educational guidance. Uses GPT-5.4-nano for SIMPLE/MODERATE and GPT-5.4-mini for COMPLEX in single-call streaming mode. It is intentionally narrower in monthly capacity and premium workflow access, but it still reflects the same engine-first analytical philosophy.

### PRO

**Daily analytical workhorse.**

Pro is for users who want materially more monthly usage and stronger continuity. Uses GPT-5.4-mini for SIMPLE and MODERATE, and GPT-5.4-full direct single stream for COMPLEX — giving PRO users full model quality on complex multi-asset queries.

### ELITE

**Premium synthesis and premium tools.**

Elite activates the platform's premium workflows (Compare Assets, Shock Simulator, export-oriented tooling). Uses GPT-5.4-mini for SIMPLE and MODERATE, and GPT-5.4-full direct single stream for COMPLEX. Web search and cross-sector context are enabled for MODERATE and COMPLEX. This is the main plan for users who want the richest single-user experience.

### ENTERPRISE

**Operational scale.**

Enterprise mirrors Elite's routing pattern with the largest token budgets (COMPLEX: 3,500 tokens), custom commercial packaging, and organization-specific operational ceilings.

---

## 7. Trial and Promo-Code Behavior

Elite promo-code trials are enforced server-side.

- Promo codes such as `ELITE15` and `ELITE30` can grant timed Elite access.
- Trial state is stored via `trialEndsAt`.
- Expiry is enforced by the plan gate during normal request handling.
- A cron sweep provides a secondary expiry-enforcement pass.

Security/implementation notes:

- Promo input arrives from Clerk `unsafe_metadata.coupon_code`, which is treated as untrusted input.
- Server-side promo validation is authoritative; client-provided coupon presence alone never grants access.
- Limited-use promo accounting is updated transactionally with user creation.
- Inside the authenticated product, onboarding currently uses a 3-step dashboard gate (`Market`, `Experience`, `Interests`) and completes directly from the final step.

---

## 8. AI Security & Observability Notes

The following runtime behaviors are active across all plans:

- **Post-retrieval injection scan** — RAG chunks matching prompt-injection patterns are filtered before reaching the LLM
- **Low-grounding confidence warning** — avg similarity < 0.45 on MODERATE/COMPLEX emits a `warn` log
- **LLM nano fallback** — primary model failure gracefully degrades to `lyra-nano` at 1200-token budget
- **Proactive alerting** — `src/lib/ai/alerting.ts` monitors daily cost, fallback rate, RAG zero-result rate, output validation failures, and web search outages
- **Admin AI Limits UI** — admins can override daily token caps and alert thresholds live from `/admin/ai-limits`
- **Myra response caching** — normalized query hash, 4h TTL (logged-in) / 8h TTL (public)
- **Compression result caching** — context SHA-256 keyed, 2h TTL

---

## 9. QStash Cron Schedule Note

The following cron jobs relevant to plan users are registered in `scripts/setup-qstash-schedules.ts`:

| Cron | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/weekly-report` | `0 10 * * 1` | Weekly intelligence report for all users |
| `/api/cron/blog-digest` | `0 10 * * 1` | Weekly blog digest to `blogSubscribed` users |
| `/api/cron/reengagement` | `0 9 * * *` | Daily re-engagement and win-back emails |
| `/api/cron/reset-credits` | `0 0 1 * *` | Monthly credit reset by plan tier |
| `/api/cron/expire-trials` | `0 4 * * *` | Daily Elite trial expiry sweep |

All cron routes use `withCronAuthAndLogging` middleware for QStash signature verification.

---

## 10. Documentation Rule

This file is implementation-aligned. If pricing, model routing, orchestration modes, credit policy, or premium workflow naming changes in code, this document should be updated to match the runtime behavior rather than older strategy drafts.

*Version 2.0 · March 2026*
