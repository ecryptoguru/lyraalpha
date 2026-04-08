# LyraAlpha AI — Credit, Referral, and Reward System

> **Fork note:** This document reflects the current LyraAlpha repository and should be read alongside `CODEBASE.md` and `docs/ENV_SETUP.md`.

This document reflects the currently implemented credit and referral behavior in the codebase plus the parts of the broader rewards vision that are already visible in runtime surfaces.

---

## 1. Core Principle

LyraAlpha AI uses a credit-based access model for Lyra usage.

- **Credits** are the operational currency used for AI analysis.
- **Monthly plan resets** replenish credits according to plan tier.
- **Referral and reward surfaces** can add extra credits.
- **The credit ledger is durable** via `CreditTransaction` records.

The authoritative runtime logic is in `src/lib/services/credit.service.ts` and `src/lib/services/referral.service.ts`.

---

## 2. Implemented Monthly Credits

| Plan | Monthly Credits |
|---|---|
| **STARTER** | 50 |
| **PRO** | 500 |
| **ELITE** | 1,500 |
| **ENTERPRISE** | 1,500 |

### Reset Behavior

At monthly reset time, the platform:

- reads the user's current plan
- resets the `credits` balance to that tier's base amount
- writes a `SUBSCRIPTION_MONTHLY` credit transaction entry

This is implemented in `resetMonthlyCredits()`.

---

## 3. Implemented Query Credit Cost

The current Lyra query-cost model is uniform across plan tiers.

| Query Complexity | Credits |
|---|---|
| **SIMPLE** | 1 |
| **MODERATE** | 3 |
| **COMPLEX** | 5 |

This is the active implementation used by `getCreditCost()`.

### Important Note

Earlier strategy documents described per-tier complexity pricing such as discounted Elite query costs. That is **not** the current runtime behavior. The live implementation uses one shared cost schedule across tiers.

---

## 3.5 Secondary Cost Backstop: Daily Token Caps

In addition to monthly credits, a **per-user, per-UTC-day token ceiling** provides a secondary safeguard against runaway API spend from compromised tokens, loop clients, or unusually large context injections.

| Plan | Daily Token Cap |
|---|---|
| **STARTER** | 50,000 |
| **PRO** | 200,000 |
| **ELITE** | 500,000 |
| **ENTERPRISE** | Uncapped (governed by contract) |

This check runs before credit deduction. If the daily ceiling is hit, the request is rejected with a clear message before any credit or API cost is incurred. Caps reset at midnight UTC and are hot-patchable by admins via `/admin/ai-limits` without a code deploy.

---

## 4. Credit Consumption and Safety

Credit deduction is intentionally atomic.

When a Lyra request consumes credits, the platform:

- updates the user row only if enough credits are present
- decrements the balance inside a database transaction
- increments `totalCreditsSpent`
- writes a negative `SPENT` ledger entry

If the balance is insufficient, the transaction fails safely and the remaining balance is returned without partial mutation.

This behavior is implemented in `consumeCredits()`.

### Multi-Asset Premium Workflow Pricing

Compare Assets and Shock Simulator use a separate premium-workflow pricing rule:

| Workflow | Pricing | Current Guardrails |
|---|---|---|
| **Compare Assets** | **5 credits for the first asset + 3 credits per additional asset** | up to **4 unique assets** |
| **Shock Simulator** | **5 credits for the first asset + 3 credits per additional asset** | up to **4 unique assets** |

Implementation notes:

- the shared pricing helper is `calculateMultiAssetAnalysisCredits()`
- the client caps selection at 4 assets for both workflows
- the server also normalizes, dedupes, and validates symbols before charging credits
- Compare is explicit-action only in the UI and does not auto-run a paid request when assets are merely added

### Credit Cost vs. Daily Token Cap

These are two independent enforcement layers:

1. **Daily token cap** (checked first) — blocks requests that exceed the per-UTC-day token ceiling; hot-patchable from `/admin/ai-limits`
2. **Credit balance** (checked second) — atomic deduction per query; refunded if stream fails

Both must pass for a Lyra request to proceed.

---

## 5. Referral System

The referral system is implemented and user-facing.

### Current Implemented Referral Rewards

| Event | Reward |
|---|---|
| **Referee signs up via referral** | 50 credits |
| **Referrer gets successful activation reward** | 75 credits |
| **Activation threshold** | Referee uses 10 credits |

### Referral Tier Ladder

The code defines bonus tiers for growing referral counts:

| Referral Count | Bonus Credits | Badge |
|---|---|---|
| **1–3** | 75 | Bronze |
| **4–10** | 100 | Silver |
| **11–25** | 150 | Gold |
| **26+** | 200 | Platinum |

These values are defined in `src/lib/services/referral.service.ts`.

### Referral UX Notes

Current runtime surfaces communicate the referral loop as:
- **friend gets 50 credits** on sign-up flow
- **referrer gets 75 credits** after the referred user activates by using credits

This behavior is reflected in the dashboard referral panel and email messaging.

Implementation note:
- public-site support and onboarding messaging now runs in a prelaunch/waitlist context (handled by public Myra), so plan and credit explanations should avoid assuming the visitor is already an authenticated paid user

---

## 6. Credit Ledger Model

The platform keeps a durable transaction history for credit movement.

Typical transaction categories include:

- `SPENT`
- `SUBSCRIPTION_MONTHLY`
- purchase and bonus-related transaction types
- referral-related transaction types

This gives the system a proper accounting trail for:

- monthly replenishment
- query usage
- referral rewards
- bonus grants
- package purchases

Related runtime hardening note:

- package and credit surfaces may depend on hosted cache helpers, but Redis initialization now trims hosted env input and fails open to a noop client so malformed env whitespace does not crash application startup

---

## 7. Credit Packages

The platform supports DB-backed credit packages through `CreditPackage` records.

### Runtime Behavior

- active packages are read from the database
- package lists are cached in Redis for 1 hour
- packages are returned in `sortOrder` sequence

This behavior is implemented in `getCreditPackages()`.

Because package pricing and offers are database-driven, the codebase should treat package values as runtime-configurable rather than hardcoding them into this document.

---

## 8. Rewards / XP Layer

The codebase also contains an engagement layer around XP / rewards pages and redemption flows.

Important distinction:

- **Credits** are the authoritative spendable AI currency.
- **XP / reward surfaces** are engagement mechanics layered on top.
- Current implementation is more accurately described as **credits first, rewards second**.

---

## 9. What This Document Does Not Claim

This file intentionally does **not** lock in speculative assumptions about:

- per-tier discounted credit costs that are not yet implemented
- fixed package price ladders unless sourced from the live database
- margin math tied to older provider mixes
- obsolete provider references such as Groq/Gemini/OpenRouter assumptions (all removed)

Those concepts may still exist as strategy ideas, but they are not the stable implementation baseline.

---

## 10. Implementation Summary

### Implemented Today

- monthly credit reset by plan
- atomic credit consumption
- durable credit transaction ledger
- DB-backed credit packages with Redis caching
- referral reward flow with tier ladder
- rewards / XP surfaces in the dashboard
- premium multi-asset workflow pricing for Compare Assets and Shock Simulator
- daily token cap as secondary cost backstop (hot-patchable from `/admin/ai-limits`)
- Myra public chat — no credits consumed by public visitors (landing page Myra is free to all)
- Myra response caching — reduces LLM cost on repetitive support questions

### Still Product-Strategy / Evolving

- richer loyalty economics beyond current reward surfaces
- expanded redemption catalog
- broader viral-loop analytics and funnel instrumentation
- alternative per-tier query pricing models

---

## 11. Cron and Email Delivery Notes

Credit-adjacent cron jobs that run on QStash schedules:

| Cron | Schedule | Credit relevance |
|------|----------|-----------------|
| `/api/cron/reset-credits` | `0 0 1 * *` | Monthly credit reset by plan tier |
| `/api/cron/blog-digest` | `0 10 * * 1` | Weekly digest email — no credit cost to users |
| `/api/cron/reengagement` | `0 9 * * *` | Re-engagement / win-back — no credit cost |

Blog-related email notifications (new post, weekly digest) are sent by LyraAlpha via Brevo and do **not** consume user credits. The AMI 2.0 marketing agent triggers these flows via the webhook bridge; LyraAlpha owns the send.

> **Last reviewed:** March 2026. Credit amounts, referral rewards, and query pricing are unchanged. Myra public chat added as a zero-credit surface. Daily token caps added as secondary backstop.

---

## 12. Documentation Rule

This file is implementation-aligned. If plan credits, referral rewards, or query pricing change in code, update this document to match the live behavior first.

*Version 2.0 · March 2026*
