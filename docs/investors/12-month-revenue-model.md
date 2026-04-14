# LyraAlpha AI — 12-Month Revenue Model

## Purpose

This document provides a directional 12-month revenue framework for LyraAlpha AI based on the current product ladder, live runtime behavior, and the company's premium-workflow strategy.

It is designed to communicate how the business can scale **credibly**, not to manufacture false precision. Every assumption is grounded in live product behavior, not hopeful projections.

---

## 1. North Star Metric

**Weekly active analytical sessions per paying user.**

This metric captures both product value delivered (are users getting repeated use from the product?) and retention health (are users staying because the product earns it?). Revenue grows when this metric grows, because engaged users upgrade and refer others.

Secondary metrics:
- Free → Pro conversion rate
- Pro → Elite upgrade rate
- Elite 90-day retention rate
- Referral activation rate (referee uses 10+ credits)

---

## 2. Product Ladder and Pricing Assumptions

### Commercial Ladder

| Plan | Price (USD / INR) | Monthly Credits | Model Routing | Revenue Type |
|---|---|---|---|---|
| **Starter** | Free | 50 | GPT-5.4-nano/mini · single | Acquisition |
| **Pro** | $14.99 / ₹1,499 | 500 | GPT-5.4-mini/full · single | Core recurring |
| **Elite** | $39.99 / ₹3,999 | 1,500 + premium workflows | GPT-5.4-mini/full · single | Premium recurring |
| **Enterprise** | Custom | Custom | Largest budgets, custom packaging | Sales-led upside |

### Current Query Credit Costs

| Query Type | Credits |
|---|---|
| Simple | 1 |
| Moderate | 3 |
| Complex | 5 |
| Compare Assets / Shock Simulator | 5 + 3 per additional asset (up to 4) |

**Why this matters for the model:** Credit consumption is tied to value intensity. Heavy analytical use (COMPLEX queries, premium workflows) costs proportionally more — creating natural upgrade pressure and a more defensible margin structure than flat unlimited subscriptions.

### Model Routing (Current — All Plans)

All plans use `single` mode — one direct streaming call. `router` and `draft_verify` have been fully removed from the codebase; plan differentiation is through model role and token budget alone.

| Plan | SIMPLE | MODERATE | COMPLEX |
|---|---|---|---|
| **Starter** | nano · single | nano · single | mini · single |
| **Pro** | mini · single | mini · single | full · single |
| **Elite** | mini · single | mini · single | full · single |
| **Enterprise** | mini · single | mini · single | full · single |

**Cost protection (shipped March–April 2026):** A secondary per-user daily token cap acts as a backstop against runaway spend from compromised tokens or loop clients. The cap applies to **all plans including ENTERPRISE** (2,000,000 tokens/day ~$500/day ceiling, env-configurable). Caps are hot-patchable by admins without a deploy. Combined with query classification and credit gating, the AI cost envelope is structurally controlled at three independent layers. Comprehensive test coverage (1,750+ passing tests) ensures production reliability.

---

## 3. Revenue Scenarios

### Scenario Assumptions

| Input | Conservative | Base | Upside |
|---|---|---|---|
| Monthly new signups (Starter) | 300 | 700 | 1,500 |
| Free → Pro conversion | 3% | 5% | 8% |
| Pro → Elite upgrade (of active Pro) | 10% | 18% | 28% |
| Monthly churn (Pro) | 8% | 5% | 3% |
| Monthly churn (Elite) | 6% | 4% | 2% |
| Enterprise contracts by M12 | 1 | 3 | 6 |
| Enterprise ACV | $10K | $18K | $30K |

### 12-Month ARR Projections

| Scenario | Paying Users (M12) | ARR (M12) | Key Driver |
|---|---|---|---|
| **Conservative** | 800–1,200 | $180K–$240K | Organic-led, slow paid ramp |
| **Base** | 2,000–3,500 | $420K–$600K | Paid acquisition kicking in M4+ |
| **Upside** | 5,000–8,000 | $900K–$1.2M | Creator + SEO + referral flywheel compounding |

### Monthly Revenue Build (Base Scenario — Illustrative)

| Month | New Starters | Cumulative Pro | Cumulative Elite | MRR (est.) |
|---|---|---|---|---|
| M1 | 700 | 35 | 4 | ~$700 |
| M2 | 700 | 65 | 10 | ~$1,400 |
| M3 | 700 | 95 | 18 | ~$2,200 |
| M4 | 900 | 140 | 28 | ~$3,300 |
| M5 | 900 | 190 | 42 | ~$4,500 |
| M6 | 1,100 | 255 | 58 | ~$6,100 |
| M7 | 1,100 | 320 | 78 | ~$7,800 |
| M8 | 1,200 | 395 | 100 | ~$9,700 |
| M9 | 1,200 | 470 | 125 | ~$11,600 |
| M10 | 1,400 | 560 | 155 | ~$14,000 |
| M11 | 1,400 | 655 | 188 | ~$16,600 |
| M12 | 1,500 | 760 | 225 | ~$19,500 |

*MRR formula: (Pro count × $14.99) + (Elite count × $39.99) + Enterprise MRR equivalent*
*Numbers are illustrative for the Base scenario. Insert actuals when available.*

---

## 4. Cohort Economics

### Unit Economics Targets

| Metric | Pro | Elite |
|---|---|---|
| Monthly price | $14.99 / ₹1,499 | $39.99 / ₹3,999 |
| Blended CAC (organic-weighted) | $8–20 | $15–35 |
| Gross margin target | 70–80% | 75–85% |
| LTV (24-month at target churn) | ~$270–$360 | ~$720–$960 |
| Payback period | 2–4 months | 1–3 months |
| LTV:CAC ratio | 10–25x | 15–35x |

**Why margin is defensible:**
- Lightweight queries (SIMPLE/MODERATE) use nano or mini — lowest cost tier
- COMPLEX uses lyra-full only when analytical depth is warranted
- No reasoning token overhead — `reasoningEffort: "none"` across all tiers
- Premium workflows run on structured computation first, model interprets second — not unbounded inference
- Myra handles support on a faster, shorter-answer architecture — low marginal cost
- Myra Voice extends support to spoken interaction (PRO+); voice prompt prefix is cache-eligible at 10× cheaper text-input rate
- History compression fires only for COMPLEX queries with large contexts (>3000 chars)
- Prefix-cached static system prompt reduces per-request token cost

### Referral Program Contribution

Active referral mechanics amplify organic growth with near-zero marginal CAC:
- **Referee gets:** 50 credits on signup (activation incentive)
- **Referrer gets:** 75 credits after referee uses 10 credits (quality-gated reward)
- **Tier ladder:** Bronze (1–3 referrals) → Silver (4–10) → Gold (11–25) → Platinum (26+)
- **Bonus scale:** 75 → 100 → 150 → 200 credits per referral

At scale, a 15–20% referral contribution to new signups meaningfully lowers blended CAC.

---

## 5. Revenue Drivers and Conversion Mechanics

### Driver 1: Starter → Pro Conversion

**Trigger:** Credit exhaustion on a meaningful session (MODERATE or COMPLEX query, premium workflow attempt)
**Unlock:** 500 credits/month, lyra-full on COMPLEX, stronger continuity

**Optimization levers:**
- Show remaining credit count prominently when < 10 credits
- Upgrade prompt at the premium workflow gate for Starter users
- Email sequence triggered at 80% credit usage
- Trial ELITE15 / ELITE30 promo codes for qualified leads

### Driver 2: Pro → Elite Upgrade

**Trigger:** Premium workflow access gate (Compare Assets, Shock Simulator are Elite-only)
**Unlock:** 1,500 credits/month, Compare Assets, Shock Simulator, Markdown export, web search + cross-sector context on MODERATE/COMPLEX

**Optimization levers:**
- In-product teaser states on premium workflow surfaces for Pro users
- Feature comparison shown at upgrade gate
- Shareable Lyra outputs create social proof that pulls peers toward Elite

### Driver 3: Referral Flywheel

Each activated referral reduces net CAC. The tier ladder encourages repeat referrals, not one-off sharing. Gold/Platinum users become distribution assets.

### Driver 4: Enterprise Pipeline

Enterprise is not self-serve. It is sales-assisted and packaging-flexible.

Target customer profile:
- RIA practices and advisory firms in India or US
- Fintech companies building on top of structured market intelligence
- Investment clubs and high-volume individual traders
- Corporate treasury or research teams

Enterprise ACV target: $10K–$50K. Pipeline build starts M3–M4 once product proof points are documented.

---

## 6. COGS and Margin Architecture

### Marginal Cost Drivers

| Cost Component | Control Mechanism |
|---|---|
| LLM inference (nano/mini/full) | Plan-aware model role; single-call routing; nano/mini handles most traffic |
| History compression | Only fires for COMPLEX queries with >3,000-char history |
| Live research augmentation | Selective — skipped for chatMode and queries without recency intent |
| RAG / memory retrieval | Staged; short conversations skip full memory overhead |
| Premium workflow compute | Structured computation first; model interprets result, not inference |
| Support (Myra) | Separate architecture; shorter answers, lower per-call cost |
| Myra Voice | PRO+ plan-gated; separate Realtime API billing (not credit-based); voice cost tracked for admin dashboards |
| Infrastructure / hosting | Upstash Redis, Vercel, PostgreSQL — scales with usage |
| Data access / licensing | EOD pipelines, premium data tiers — scales with market coverage depth |

### Gross Margin Targets

| Plan | Estimated Gross Margin |
|---|---|
| Pro | 70–78% |
| Elite | 75–83% |
| Enterprise | 80–85% (higher ARPU absorbs custom support overhead) |

These targets assume model costs continue declining along the GPT-5.4 pricing curve and that cache efficiency improves with traffic volume.

---

## 7. Growth Channels and CAC Model

### Channel Mix (12-Month Target)

| Channel | CAC Range | Contribution |
|---|---|---|
| Organic SEO / GEO | $0–5 | 30–40% of signups |
| Blog (AMI 2.0 content pipeline) | $0–3 (infra cost only) | 10–15% |
| Content / social (X, LinkedIn) | $0–8 | 10–15% |
| Referral program | $0–3 (credit cost) | 15–20% |
| Paid acquisition (Meta / Google) | $15–30 | 15–20% |
| Creator / expert partnerships | $5–15 | 10–15% |
| Community (Reddit, Discord, fintech forums) | $0–5 | 5–10% |

**Blended CAC target (Base scenario):** $8–18 across all paying users

### SEO / GEO and Blog Strategy

LyraAlpha AI's content architecture targets three high-intent page types:
- **Tool pages** — "crypto screener India", "compare crypto assets India/US"
- **Answer pages** — "what is a good momentum score", "how to stress test a crypto portfolio"
- **Comparison pages** — "Bitcoin vs Ethereum correlation", "crypto vs gold in a rate shock"

These convert at 3–5x the rate of generic blog content and build a durable organic traffic base.

**AMI 2.0 content pipeline (shipped):** The public blog at `/blog` is fed by the external AMI 2.0 marketing agent via a secure HMAC-verified webhook. Posts are auto-published with ISR revalidation, OG share cards, category pages, and an RSS feed — all structured for search discovery. A weekly Monday digest goes to opted-in subscribers automatically. This makes the blog a near-zero-marginal-cost SEO and retention asset rather than a resource-intensive editorial operation.

---

## 8. 18-Month Milestones

| Milestone | Target Month |
|---|---|
| 500 paying users | M4–M5 |
| $10K MRR | M5–M6 |
| 1,500 paying users | M7–M8 |
| $25K MRR | M8–M9 |
| First Enterprise contract closed | M6–M8 |
| 3,000+ paying users | M10–M11 |
| $50K MRR (~$600K ARR run rate) | M12 |
| 3–5 Enterprise contracts | M12–M15 |
| $100K MRR (~$1.2M ARR run rate) | M16–M18 |

---

## 9. Why This Model Is Credible

Investors are increasingly skeptical of AI revenue projections because most lack structural grounding.

LyraAlpha AI's model is credible because:

1. **Credits make usage visible.** Starter exhausts credits → Pro conversion trigger is built into the product, not just marketing.
2. **Workflow gates make upgrade value obvious.** Compare Assets and Shock Simulator are behind an Elite gate — upgrade moment is clear and earned, not artificial.
3. **Cost discipline is architectural.** Single-call routing with plan-aware model roles means margin does not collapse at scale. All plans including ENTERPRISE have finite daily token ceilings.
4. **Referral mechanics are live.** Not a roadmap item — the program is implemented and adding signups today.
5. **Both India and US markets are open.** Dual pricing (USD + INR) means the product can compound across two large, fast-growing retail investor bases simultaneously.
6. **Blog distribution pipeline is live.** AMI 2.0 powers agent-automated publishing to `/blog` via a secure webhook bridge. Weekly Monday digest to opted-in subscribers is a recurring retention touchpoint with near-zero marginal cost — not a planned content strategy, a shipped infrastructure.
7. **Beta branding deployed.** Replaced "Elite Edition" with "Beta" badge, signaling live product status and enabling clearer communication with users.
8. **Comprehensive test coverage.** 1,750+ tests passing across 97 test files — production reliability is verified, not assumed.

---

## 10. Bottom Line

LyraAlpha AI's revenue story is a conversion ladder grounded in product structure:

- free acquisition with built-in upgrade pressure
- recurring Pro revenue with strong LTV:CAC
- premium Elite revenue tied to workflow differentiation
- high-margin Enterprise upside from sales-led packaging

That is a stronger and more believable monetization foundation than most AI products at this stage.
