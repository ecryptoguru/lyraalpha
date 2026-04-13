# LyraAlpha AI — Executive Tear Sheet

## Company Snapshot

**LyraAlpha AI** is building the structured financial intelligence layer that retail investors in India and the US have never had — not more data, not another chatbot, but a system that turns fragmented market signals into consistent, institutional-quality reasoning at consumer scale.

- **Category:** Financial intelligence / AI-native investing software
- **Markets:** US + India — crypto assets
- **Model:** Freemium SaaS with credit-governed usage, premium workflow upsell, and Enterprise packaging
- **Status:** Live product. Premium workflows (Compare Assets, Shock Simulator, Portfolio Intelligence workspace) shipped and actively expanding.
- **Core principle:** *The engines compute. The AI interprets.*

---

## The Problem

Retail investors have more information than ever and less clarity than ever.

They already have access to prices, charts, fundamentals, earnings, screeners, news feeds, and an expanding supply of AI-generated summaries. None of that solves the real problem: **there is no stable framework for turning signals into judgment**.

Most AI finance products make this worse, not better. They dress up a general-purpose LLM in financial vocabulary and call it analysis. The outputs are fluent. They are not trustworthy.

The result is a market where:
- data is abundant and cheap
- interpretation is scarce and valuable
- trust in AI-generated financial commentary is low and getting lower
- the gap between raw information and actionable intelligence is widening

That gap is exactly where LyraAlpha AI is positioned.

---

## The Solution

LyraAlpha AI is built around one architectural rule:

> **The engines compute. The AI interprets.**

This is not a slogan. It is the product's structural advantage.

### Three Layers

**1. Deterministic Engine Layer**
Computes structured market context before any model speaks: Trend, Momentum, Volatility, Liquidity, Trust, Sentiment, market-regime framing, compatibility overlays, derived intelligence, and crypto news intelligence via NewsData.io (trending crypto news, per-asset feeds, sentiment extraction). The model never improvises the analytical structure — it interprets structure the engines already computed.

**2. AI Interpretation Layer**
- **Lyra** — market intelligence: score explanation, regime-aware analysis, premium workflow interpretation, cross-asset reasoning
- **Myra** — support intelligence: product guidance, plan/credit help, onboarding, waitlist orientation, **hands-free voice support** (shipped via OpenAI Realtime API for PRO+ users)

**3. Workflow Layer**
Premium workflows turn single interactions into repeatable product experiences: Compare Assets, Shock Simulator, Portfolio Intelligence workspace, discovery, asset intelligence pages.

### Why This Beats Prompt Wrappers

A generic LLM wrapper invents its analytical frame on every call. LyraAlpha AI's model receives a structured context the engines already computed. That means:
- more consistent outputs
- lower hallucination surface
- clearer governance
- more defensible product moat
- better cost control (model only works on interpretation, not inference)

---

## Market Opportunity

### TAM / SAM / SOM

| Layer | Size | Basis |
|---|---|---|
| **TAM** | ~$50B+ | Global retail fintech SaaS + AI investing tools market |
| **SAM** | ~$8–12B | Self-directed retail investors in US + India actively paying for tools |
| **SOM (3-year)** | ~$50–150M ARR | Premium SaaS capture across India and US at current plan economics |

**India alone:** 90M+ registered equity investors (NSE data) with growing crypto adoption, growing 15–20% annually. SIP investor base: 90M+ accounts. Fintech SaaS ARPU expanding rapidly as the demographic matures.

**US:** 160M+ brokerage account holders. Premium investing tool ARPU of $150–600/year is well-established (Seeking Alpha, Koyfin, Danelfin comparables).

### Why Now

- Retail participation in India and US markets at all-time highs
- AI trust is bifurcating: users are increasingly skeptical of generic AI, actively seeking products that feel grounded
- GPT-5.4 economics now make per-query cost discipline achievable at scale
- Premium SaaS willingness-to-pay in both markets is established and rising

---

## Product Proof

### Shipped Premium Workflows

**Shock Simulator**
Not a gimmick stress-test widget. The current implementation includes:
- selectable historical shock regimes across US and India contexts
- hybrid direct + proxy replay when historical windows are incomplete
- asset-type-aware mapping for crypto assets
- structured explanation payloads: transmission mechanisms, pressure points, dominant drivers, resilience themes, rationale
- Lyra follow-up analysis translating replay output into hedge and resilience framing

**Portfolio Intelligence Workspace**
Redesigned from a flat holdings table into a premium analytical workspace surfacing: portfolio intelligence, benchmark comparison, health, fragility, allocation, quick insights, holdings, and Monte Carlo simulation — in a deliberate analytical sequence. Supports manual refresh plus a low-noise 24-hour autonomous refresh gate.

**Compare Assets**
Multi-asset cross-sector synthesis for up to 4 assets simultaneously. Lyra synthesizes cross-signal patterns across the selection, not just side-by-side data display.

### Recent Dashboard Surfaces (Shipped)
Score velocity badges, portfolio regime-alignment visualization, watchlist drift alerting, discovery-feed signal-cluster detection, same-sector movers with compatibility context, briefing staleness indicators, holdings P&L heatmap with DSE score chips.

### Blog and AMI 2.0 Content Pipeline (Shipped)
LyraAlpha AI now ships a public blog with a hybrid static + DB architecture, fed by an external AMI 2.0 marketing agent system:

- **Blog system:** public-facing at `/blog` with category pages, RSS feed, OG hero images, and reading progress. Built for SEO/GEO discovery from day one.
- **AMI 2.0 webhook bridge:** the external AMI 2.0 agent publishes posts to LyraAlpha via an HMAC-verified webhook. Posts are upserted, ISR-revalidated, and subscriber notifications are fired automatically.
- **Weekly blog digest:** every Monday at 10:00 UTC, opted-in users receive a curated digest of recent posts via Brevo — a zero-marginal-cost retention touchpoint.
- **Email ownership split:** LyraAlpha owns transactional and lifecycle emails (notifications, digest, re-engagement, reports); AMI 2.0 owns outbound marketing (cold/warm outreach, nurture sequences) using its own Brevo API key. The boundary is enforced at the system level, not just by convention.

---

## Commercial Model

### Plan Ladder

| Plan | Price | Monthly Credits | Model Routing | Target User |
|---|---|---|---|---|
| **Starter** | Free | 50 | GPT-5.4-nano/mini · single | Acquisition + exploration |
| **Pro** | $14.99 / ₹1,499 | 500 | GPT-5.4-mini/full · single | Daily self-directed investors |
| **Elite** | $39.99 / ₹3,999 | 1,500 | GPT-5.4-mini/full · single + premium workflows | Power users, premium workflow buyers |
| **Enterprise** | Custom | Custom | Largest token budgets, custom packaging | Teams, advisors, high-intensity use |

### Credit Economics

All plans share one query-cost schedule:

| Query Type | Credits |
|---|---|
| Simple | 1 |
| Moderate | 3 |
| Complex | 5 |
| Compare Assets / Shock Simulator | 5 + 3 per additional asset (up to 4) |

This creates a predictable unit-economics envelope: heavier analytical work costs more, lighter exploration stays cheap. Usage scales with value delivered.

### Model Routing (Current — All Plans)

All plans use `single` mode — one direct streaming call to the appropriate model. `router` and `draft_verify` have been fully removed from the codebase; plan differentiation is through model role (nano / mini / full) and token budget alone.

| Plan | SIMPLE | MODERATE | COMPLEX |
|---|---|---|---|
| **Starter** | nano · single | nano · single | mini · single |
| **Pro** | mini · single | mini · single | full · single |
| **Elite** | mini · single | mini · single | full · single |
| **Enterprise** | mini · single | mini · single | full · single |

This architecture keeps inference costs structurally disciplined: lightweight queries never pay full-model prices, premium synthesis on COMPLEX uses lyra-full only when the analytical task genuinely requires it.

### AI Runtime Hardening (Shipped March 2026)

Before Q1 2026 feature work, the AI runtime was hardened with production-safety additions that strengthen the product moat:

- **Full conversation injection scan** — all messages in a session are checked for injection patterns, not just the last; defends against multi-turn injection attacks
- **User memory injection scan** — stored memory chunks are filtered before context assembly; defends against stored-memory poisoning
- **Multi-asset mode plan gating** — multi-asset inference gated behind plan checks; no silent cost escalation on lower-tier plans
- **Post-retrieval injection scan** — every RAG chunk filtered for prompt-injection patterns before reaching the LLM; defends against poisoned knowledge-base attacks
- **Low-grounding confidence logging** — avg retrieval similarity < 0.45 on MODERATE/COMPLEX emits a structured warning; flags confabulation risk before it reaches users
- **LLM nano fallback** — primary model failure automatically degrades to nano before surfacing any error; eliminates a class of 500s from infrastructure variability
- **Proactive alerting** — 5-channel observability system (daily cost, fallback rate, RAG zero-result rate, output validation failures, web search outage) with Slack/Discord webhook delivery; web search alert fires at 2 failures before circuit opens at 3
- **Admin AI Limits UI** — daily token caps and alert thresholds hot-patchable from the admin panel without a code deploy
- **Conversation log idempotency** — 10-second Redis dedup window prevents duplicate entries from retries or concurrent requests

---

## Growth and Funnel Model

### Funnel Shape

```
Starter (free) → Pro (recurring) → Elite (premium workflows) → Enterprise (custom)
```

**Acquisition:** Organic SEO/GEO, public blog (AMI 2.0 content pipeline), content, social (X, LinkedIn), community, partnerships, creator distribution, paid retargeting
**Activation:** First Lyra analysis session, first score interpretation, first comparison or stress test
**Retention:** Daily briefings, watchlist drift alerts, score velocity signals, portfolio workspace
**Referral:** Referral program live — referee gets 50 credits on signup, referrer gets 75 credits after activation (10-credit threshold). Tier ladder: Bronze → Silver → Gold → Platinum based on referral count.
**Monetization:** Starter → Pro conversion on credit exhaustion; Pro → Elite on premium workflow access triggers; Elite → Enterprise on team/volume signals

### North Star Metric
**Weekly active analytical sessions per paying user** — a signal of both product value delivered and retention health.

### Key Unit Economics Targets

| Metric | Target Range |
|---|---|
| Blended CAC (organic-weighted) | $8–25 |
| Pro LTV (24-month) | $360 |
| Elite LTV (24-month) | $960 |
| Pro payback period | <4 months |
| Elite payback period | <3 months |
| Free → Pro conversion | 4–8% at scale |
| Pro → Elite upgrade | 15–25% of active Pro users |

---

## Competitive Positioning

### Why LyraAlpha AI Wins

| Dimension | Generic AI Finance Chat | Traditional Screeners | LyraAlpha AI |
|---|---|---|---|
| **Data grounding** | Model-improvised | Strong data, no AI | Engine-computed + AI interpreted |
| **Trust** | Low (hallucination risk) | High (data only) | High (structured context first) |
| **Analytical depth** | Fluent but shallow | Deep data, no synthesis | Structured + synthesized |
| **Workflow UX** | Single-turn chat | Static tables | Premium repeatable workflows |
| **Cost discipline** | Unpredictable | Flat subscription | Plan-gated, query-cost controlled |
| **Region coverage** | US-centric | Fragmented | US + India dual-native |

### Moat Layers
1. **Deterministic context** — proprietary engine outputs that ground every AI response
2. **Dual-agent architecture** — separation of analysis (Lyra) and support (Myra) improves governance and cost
3. **Premium workflow depth** — Shock Simulator, Compare Assets, Portfolio Intelligence are workflow products, not just longer answers
4. **Plan-aware routing** — cost discipline built into architecture, not bolted on; all routing is `single` with dead code removed
5. **Region-native design** — India and US treated as first-class, not adapted from a US-only product
6. **Credit semantics** — a monetization envelope that scales with value delivered
7. **Production AI safety** — post-retrieval injection scanning, LLM fallback, proactive observability alerting, and hot-patchable cost controls are production-hardened, not planned features
8. **AMI 2.0 content pipeline** — an agent-driven blog and email distribution engine that compounds organic SEO, subscriber engagement, and brand authority with near-zero marginal editorial cost
9. **Myra Voice (shipped)** — hands-free voice support via OpenAI Realtime API (`gpt-realtime-mini`), available to PRO+ users. Extends the support layer to spoken interaction with client-side injection detection, PII redaction, and multi-language audio design (English, Hinglish, Hindi). A product moat because it requires Realtime API integration, prompt architecture for spoken output, and multi-language audio design that cannot be replicated by wrapping a chatbot.

---

## Why Investors Should Care

1. **The market is real and growing.** India's retail investor base is doubling every 3–5 years. US premium investing tool spend is established and expanding.
2. **The AI trust problem is an opportunity.** Skepticism toward generic AI wrappers is rising. Products with grounded, structured intelligence will capture the users who churn from shallow products.
3. **The economics are defensible.** Single-call streaming architecture, query-cost controls, and structured context mean margin improves as volume scales — not the reverse.
4. **The product is live.** This is not a demo or a roadmap. Premium workflows are shipped and in use.
5. **The conversion ladder is clear.** Free → Pro → Elite → Enterprise maps directly to product value delivered at each stage.

---

## Enterprise Positioning

Enterprise is **sales-led workflow packaging**, not a bigger self-serve plan.

That creates room for:
- higher-value accounts ($5K–50K+ ACV range)
- workflow-specific and team-oriented packaging
- advisor and RIA-adjacent use cases
- custom support and SLA expectations
- commercial flexibility without flattening all power users into one consumer tier

---

## Use of Capital

Capital accelerates distribution and execution — not product reinvention.

| Category | Allocation | Purpose |
|---|---|---|
| **User Acquisition** | ~40% | Paid acquisition experiments, creator/expert partnerships, SEO/GEO content engine (blog via AMI 2.0), referral program amplification |
| **Infrastructure & Data** | ~25% | Premium data access, concurrency scaling, production hosting, EOD pipeline reliability |
| **Product & Engineering** | ~25% | Premium workflow expansion, portfolio intelligence depth, Enterprise-readiness, runtime hardening |
| **Operations & Team** | ~10% | Core team expansion, operating capacity |

---

## Vision

Near-term priority: deepen the premium analytical surface, drive Starter → Pro → Elite conversion, and build the distribution engine required to reach 10,000+ paying users.

Medium-term: position LyraAlpha AI as the default structured intelligence layer for self-directed investors in India and the US — the product that sits between raw market data and real investment reasoning.

Long-term: the winning product in this category will not be the one with the most data feeds. It will be the one that makes analytical judgment consistently accessible. That is what LyraAlpha AI is building.

---

## Bottom Line

LyraAlpha AI is not another investing chatbot.

It is a structured financial intelligence product with a defensible architecture, live premium workflows, a clear monetization ladder, and a growing market that is actively moving away from generic AI noise toward grounded, trustworthy analytical tools.

In a category full of fluent but shallow products, that is exactly the kind of differentiation that compounds.

---

**Contact:** [Founder Name] | [Email] | [Phone / LinkedIn]
