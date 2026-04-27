# Marketing Audit — LyraAlpha AI

**Date:** 2026-04-27 | **Scope:** Landing page, pricing, tools, SEO, funnel

---

## Executive Summary

The landing page is visually sophisticated but has **critical trust and conversion gaps** that will suppress sign-ups and risk regulatory issues if launched publicly.

**Top 5 Blockers:**
1. Fake testimonials labeled "Trusted by analysts worldwide" — FTC/compliance risk
2. Contradictory user counts (250M+ vs 50,000+) across sections
3. No lead capture before sign-up wall — 100% funnel drop-off risk
4. Jargon-heavy hero headline lacks user benefit
5. Pricing page lacks plan-selection passthrough to sign-up

---

## 1. Funnel Architecture

```
Landing (/) → Sign Up (/sign-up)        [Direct wall — no lead capture]
Tools (/tools) → Sign Up                [Better — but still hard gate]
Pricing (/pricing) → Sign Up            [No plan pre-selection]
```

**Gap:** Zero intermediate touchpoints. No email capture, no demo preview, no sample report.

**Fix:** Add email capture with lead magnet ("Get Weekly Market Regime Report") before sign-up wall.

---

## 2. Messaging Audit

### Hero Headline
**Current:** `engines compute. AI interprets. AI OS for Investments.`

| Issue | Severity |
|---|---|
| No user benefit stated | High |
| "AI OS" is jargon | High |
| Three sentences, no verb directed at user | Medium |

**Recommended A/B:**
- `The only AI that shows its math before telling you to buy.`
- `Know which crypto to own — before the market moves.`
- `Stop guessing. Start knowing.` (already in eyebrow — promote to headline)

### Sub-copy
**Current:** `Engines compute the signals. Lyra interprets them. No hallucinated metrics — ever.`

**Strong:** "No hallucinated metrics" is a powerful anti-ChatGPT differentiator.
**Weak:** Still feature-language. Does not say what the user gets.

---

## 3. Trust Signals — CRITICAL

### Fake Testimonials
`SocialProofWall` title: **"Trusted by analysts worldwide"**

Data source: `testimonials.ts` — explicitly labeled `// Illustrative testimonials. Not real users.`

| Risk | Level |
|---|---|
| FTC Act §5 — deceptive practices | Critical |
| EU/India consumer protection | Critical |
| Brand credibility if discovered | Critical |

**Fix (Immediate):**
1. Replace title with `What LyraAlpha believes`
2. Or remove component entirely until real testimonials collected
3. Or add visible disclosure: `*Illustrative positioning statements, not customer reviews`

### Contradictory Claims
| Location | Claim |
|---|---|
| Hero stats | `250M+ Investors · US & India` |
| Final CTA | `Join 50,000+ investors` |
| Pricing teaser | `Save up to 20% with annual billing` (no social proof) |

**Fix:** Use consistent, verifiable numbers. If pre-launch, state `Join early access` instead.

---

## 4. SEO & Metadata Audit

### Current Metadata (`layout.tsx`)
```
title: "LyraAlpha AI | Institutional-Grade Crypto Intelligence"
description: "Decode crypto market signals with AI..."
```

| Issue | Fix |
|---|---|
| Only mentions "crypto" — product supports 5 asset classes | Expand to "Multi-asset intelligence: crypto, equities, and alternatives" |
| Missing `keywords` meta (still used by some engines) | Add `AI investment research, crypto analysis, portfolio intelligence` |
| No structured data (JSON-LD) | Add Organization + SoftwareApplication schema |
| No FAQ schema for voice search | Add to `/` or `/tools` |
| Blog RSS link present but no blog SEO optimization | Ensure blog posts have unique titles/descriptions |

### Tools Page — SEO Strength
The `/tools` page is the **strongest SEO entry point**:
- 5 distinct tool pages with specific intent keywords
- Good metadata with "Free investor tools" positioning
- Missing: FAQ sections, how-to content, comparison tables

**Recommendation:** Expand each tool page with 300+ words of educational content to capture long-tail search.

---

## 5. Conversion Optimization

### CTA Issues
| Location | Issue |
|---|---|
| All pricing cards link to `/sign-up` | No plan pre-selection — user loses context |
| Pricing page has no annual/monthly toggle | Teaser has toggle, page doesn't — inconsistent |
| Final CTA repeats same CTA as hero | Wasted opportunity for secondary action |
| No "Try Demo" or "See Sample" anywhere | Users can't experience value before commitment |

### Recommended CTA Hierarchy
```
Hero Primary:     "See How It Works" → scroll to demo/interactive
Hero Secondary:   "Start Free — 300 Credits" → /sign-up
Mid-page:         "Try Demo Portfolio" → /tools/demo-portfolio
Pricing CTA:      "Start [Plan] Trial" → /sign-up?plan=[tier]
Final CTA:        "Join 2,000+ Beta Users" → /sign-up (social proof)
```

---

## 6. Content Marketing

| Asset | Status | Gap |
|---|---|---|
| Blog | Exists (`/blog`) | Not featured prominently on landing |
| Tools pages | 5 strong pages | Not linked from landing page hero |
| Newsletter/Email capture | Missing | No lead gen outside sign-up |
| Case studies | Missing | No proof of outcomes |
| Comparison content | Missing | No "LyraAlpha vs ChatGPT/Kimi" |
| Glossary/Education | Missing | Missing SEO long-tail opportunities |

---

## 7. Recommended Action Plan

### Week 1 — Trust & Compliance (Launch Blocker)
- [ ] Fix fake testimonials: replace title or add disclosure
- [ ] Fix contradictory user counts — use single consistent metric
- [ ] Add visible Beta/Early Access label if pre-launch

### Week 2 — Messaging
- [ ] A/B test hero headline (outcome vs feature vs differentiation)
- [ ] Add 3 benefit bullets below hero sub-copy
- [ ] Move "6 engines, no hallucination" value prop above the fold

### Week 3 — Conversion
- [ ] Add email capture (lead magnet: "Weekly Regime Report")
- [ ] Pass plan selection to sign-up URL
- [ ] Add "Try Demo" secondary CTA on hero
- [ ] Add annual/monthly toggle to `/pricing` page

### Week 4 — SEO
- [ ] Add JSON-LD structured data to `/` and `/tools`
- [ ] Expand each tool page with educational content
- [ ] Add comparison content ("LyraAlpha vs generic AI")
- [ ] Optimize meta descriptions for all pages

### Month 2 — Content
- [ ] Collect 3-5 real user testimonials with photos/roles
- [ ] Publish 2 case studies (portfolio before/after)
- [ ] Launch weekly newsletter with regime analysis
- [ ] Add FAQ page with voice-search optimized answers

---

## Metrics to Track

| Metric | Baseline Target |
|---|---|
| Landing → Sign-up conversion | > 3% |
| Landing → Tools page | > 8% |
| Email capture rate | > 5% of non-converting visitors |
| Time on page | > 90 seconds |
| Scroll depth to Pricing Teaser | > 60% |
| Bounce rate | < 45% |
