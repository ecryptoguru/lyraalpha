# InsightAlpha AI — Use of Funds

## Purpose

This raise is not about inventing the product from scratch. The core product is live. Premium workflows are shipped. The objective now is to **accelerate distribution, deepen premium differentiation, and harden the operating system** around a live financial intelligence platform.

Capital should compound execution, not fund reinvention.

---

## Raise Summary

**Round type:** Pre-seed / Angel
**Raise amount:** [Insert amount]
**Runway target:** 18–24 months
**Primary goal:** Reach $500K+ ARR run rate, 3,000+ paying users, and first Enterprise contracts closed by Month 12

---

## Allocation Overview

| Category | Allocation | Amount (est.) |
|---|---|---|
| **User Acquisition & Distribution** | ~40% | [Insert $] |
| **Infrastructure & Data** | ~25% | [Insert $] |
| **Product & Engineering** | ~25% | [Insert $] |
| **Operations & Team** | ~10% | [Insert $] |
| **Total** | 100% | [Insert $] |

---

## 1. User Acquisition & Distribution (~40%)

### Why This Is the Priority

Strong product quality does not compound without a strong distribution engine. The platform has a clear conversion ladder (Starter → Pro → Elite → Enterprise) — capital here lights the flywheel.

### Specific Uses

**Paid Acquisition Experiments (M1–M6)**
- Google / Meta retargeting campaigns targeted at retail investor intent signals
- Test 3–5 acquisition channels in 30-day sprints before scaling winners
- Expected CAC target: $15–30 for paid channels (organic-weighted blended CAC: $8–18)

**Creator & Expert Partnerships**
- Finance YouTubers, newsletter writers, and community builders in India and US
- Revenue share or co-branded access for distribution
- Target: 5–10 active creator partnerships by M6

**SEO / GEO Content Engine + AMI 2.0 Blog Pipeline**
- Build 50–100 high-intent answer pages, tool pages, and comparison pages
- Target keywords: "stock analysis tool India", "compare ETF vs mutual fund", "portfolio stress test", "momentum score explained"
- Content targeting: tool pages convert at 3–5x the rate of generic blog posts
- SEO is a long-cycle investment — start M1, compounding returns from M6+
- **AMI 2.0 content pipeline (already shipped):** the public blog at `/blog` is fed by the external AMI 2.0 agent via a secure webhook bridge. Posts are auto-published, ISR-revalidated, and paired with a weekly Monday digest to opted-in subscribers. This makes the blog a near-zero-marginal-cost distribution asset — capital here funds the AMI agent infrastructure and content strategy, not a writing team.

**Referral Program Amplification**
- Referral mechanics are live (50 credits referee / 75 credits referrer after 10-credit activation)
- Capital funds the credit cost of referral rewards at scale
- Referral contribution target: 15–20% of new signups at steady state
- Near-zero marginal CAC on referral-sourced users

**Community and Social Distribution**
- X (Twitter) and LinkedIn for financial intelligence thought leadership and product proof points
- Reddit (r/IndiaInvestments, r/investing, r/personalfinanceindia) for relationship-first community building
- Budget for content production (short-form video, analytical artifacts, shareable Lyra outputs)

### Expected Outcomes by M12
- 5,000–8,000 Starter signups (Base to Upside)
- 2,000–3,500 paying users (Base scenario)
- 3–5 active creator distribution partnerships
- Measurable organic SEO inbound from 50+ indexed pages
- 1,000+ blog subscribers receiving weekly digest (retention and re-engagement asset)

---

## 2. Infrastructure & Data (~25%)

### Why This Matters

InsightAlpha AI is a data-intensive product. Reliability and freshness are product quality signals, not just technical requirements. A stale briefing or a slow premium workflow harms conversion.

### Specific Uses

**Premium Data Access**
- Higher-rate API access for US and India market data (equities, ETFs, mutual funds, crypto, commodities)
- Priority EOD data freshness for US and India pipelines
- Coverage expansion as market universe grows

**Concurrency & Scaling**
- Database connection pooling and query optimization for traffic spikes
- Upstash Redis scaling for caching layer reliability (plan cache, credit cache, Myra response cache, compression result cache)
- Vercel serverless function tuning and edge capacity

**Production Reliability**
- EOD pipeline monitoring (IN + US): NSE/BSE close at 10:30 UTC, US close at 21:30–22:00 UTC
- Upstash QStash schedule reliability and failure alerting
- Premium workflow reliability under concurrent Elite/Enterprise usage
- Hosted Redis env hardening (already implemented — trimming + noop fallback pattern)

**Broker Connectivity Expansion**
- Deeper India broker coverage (Zerodha, Angel One, Upstox, Groww)
- US broker/aggregation path (Plaid, Alpaca, direct-broker expansion)
- Broker data contract normalization and confidence-scoring maintenance

### Expected Outcomes by M12
- <99.5% EOD sync success rate on both IN and US pipelines
- Premium workflow response times <4s P95 under load
- 3+ Indian brokers in active integration
- Infrastructure cost as % of revenue declining as traffic scales

---

## 3. Product & Engineering (~25%)

### Why This Matters

The product is live — but the premium layer has significant depth left to build. The next 12 months of product work is where the moat hardens from "good product" to "defensible platform."

### Specific Uses

**Premium Workflow Expansion**
- New premium workflows beyond Compare Assets and Shock Simulator
- Deeper shareable analytical artifacts (exportable reports, portfolio summaries, comparison snapshots)
- Workflow UX polish and onboarding for new Elite features

**Portfolio Intelligence Depth**
- Deeper broker-connected portfolio intelligence
- Additional regime-alignment and signal overlay surfaces
- Monte Carlo refinement and benchmark expansion
- Portfolio-to-Lyra context improvements for more actionable per-holding interpretation

**Enterprise Readiness**
- Team/multi-user account support
- Admin and usage visibility for Enterprise accounts
- API surface for workflow-specific Enterprise integrations
- SLA-grade reliability and support infrastructure for Enterprise customers

**AI Runtime Hardening (Foundation already shipped — ongoing)**
- Post-retrieval injection scanning, LLM nano fallback, 5-channel proactive alerting, and admin hot-patch controls already live as of March 2026
- Continued prompt contract refinement (`<output_contract>`, `<verbosity_controls>`)
- Cache coverage expansion (Myra response cache, compression cache, educational cache)
- Query classifier improvement for edge cases (technical-indicator language, multi-ticker parsing)
- Audit pipeline maintenance (`scripts/audit-prompt-pipeline.ts`, `scripts/compare-audit-runs.ts`)

**Testing and Release Confidence**
- Expanded Playwright E2E coverage for new premium workflows
- Vitest unit/integration coverage for new service layers
- CI pipeline stability for faster release cycles

### Expected Outcomes by M12
- 2–3 new premium workflows shipped
- Portfolio Intelligence workspace at full depth (broker connectivity + all analytics surfaces)
- Enterprise-ready multi-user infrastructure
- Test coverage maintained at 95%+ on all core paths

---

## 4. Operations & Team (~10%)

### Why This Matters

At this stage, execution speed is a competitive advantage. The right team additions multiply the leverage of every other capital allocation.

### Specific Uses

**Core Team Expansion**
- First key hire: growth / distribution (owns acquisition, content, referral, creator partnerships)
- Second key hire: product / engineering (owns premium workflow expansion, infra reliability)
- Fractional or contract support for legal, compliance, and finance as needed

**Operating Costs**
- Domain, hosting, tooling, and software subscriptions
- Legal and compliance (terms of service, privacy policy, financial disclaimer review)
- Accounting and financial operations setup

### Expected Outcomes by M12
- Team of 3–4 covering product, engineering, and distribution
- Operating processes established for weekly growth reviews, release cadence, and investor updates

---

## 5. Why This Allocation Makes Sense

### The Highest-Leverage Opportunity Now Is Not Invention — It Is Execution

The product already has:
- a live premium workflow layer (Compare Assets, Shock Simulator, Portfolio Intelligence workspace)
- a clear monetization ladder (Starter → Pro → Elite → Enterprise)
- controllable AI economics (single-call routing, credit-governed usage, plan-aware model roles)
- a referral program live in production
- EOD pipelines running in both India and US markets

Capital should now:
- acquire users efficiently (40% → distribution)
- keep the infrastructure healthy under growth (25% → infra + data)
- deepen the premium layer to widen the moat (25% → product + engineering)
- build the team to sustain execution speed (10% → operations)

### What Capital Is NOT For

- Reinventing the core architecture
- Betting on unproven premium features before distribution is proven
- Scaling paid acquisition before activation is optimized
- Hiring before the growth model has evidence

Capital goes toward reinforcement and acceleration, not exploration.

---

## 6. 18-Month Milestones This Capital Enables

| Milestone | Target Month |
|---|---|
| 500 paying users | M4–M5 |
| $10K MRR | M5–M6 |
| First Enterprise contract closed | M6–M8 |
| 1,500 paying users | M7–M8 |
| $25K MRR | M8–M9 |
| 3,000+ paying users | M10–M11 |
| $50K MRR (~$600K ARR run rate) | M12 |
| 3–5 Enterprise contracts | M12–M15 |
| Seed-round ready (traction + metrics) | M15–M18 |

---

## 7. Investor Takeaway

InsightAlpha AI already has the core ingredients investors want to see:

- ✓ Live product with premium workflows shipped
- ✓ Clear monetization ladder with visible upgrade triggers
- ✓ Controllable AI economics (credit governance, single-call routing, plan-aware model roles, daily token caps)
- ✓ Production AI safety: post-retrieval injection scanning, LLM fallback, proactive observability alerting — all shipped, not planned
- ✓ Dual-market coverage (India + US) with first-class regional intelligence
- ✓ Referral program live in production
- ✓ Enterprise positioning established (custom packaging, not just self-serve)
- ✓ AMI 2.0 content pipeline live: agent-driven blog, HMAC-verified webhook bridge, weekly digest cron — distribution infrastructure that compounds from day one

This raise accelerates the execution of a business model that is already structurally sound. That is a more compelling use of capital than funding an unproven product concept.
