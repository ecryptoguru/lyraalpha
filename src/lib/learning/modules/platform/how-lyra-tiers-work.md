---
title: "How Lyra Tiers Work"
description: "SIMPLE vs MODERATE vs COMPLEX — how Lyra routes your question and what changes at each level."
category: platform
xpReward: 15
estimatedTime: "1.5 minutes"
badgeContribution: lyra-user
---

## How Lyra Tiers Work

Every question you ask Lyra is classified into one of three complexity tiers before any analysis begins. This isn't about word count — it's about the nature of what you're asking.

### The Three Tiers

**SIMPLE**
Definitional or educational queries. "What is a Trend score?" or "Explain momentum." Lyra uses a lightweight model optimised for speed. Fast answer, lower credit cost (1 credit).

**MODERATE**
Analytical questions about a single asset or theme. "How is AAPL positioned relative to the current regime?" or "What does rising volatility in gold mean?" Lyra engages full context — score data, regime state, and memory. 3 credits.

**COMPLEX**
Multi-step synthesis. Compare Assets, Shock Simulator analysis, deep portfolio questions, or anything requiring cross-sector reasoning. Lyra uses the most capable model in your plan tier. 5 credits (or premium multi-asset pricing for Compare/Shock).

### Why This Matters

The tier determines:
- **Which model** answers you (nano → mini → full, depending on your plan)
- **How much context** Lyra assembles (RAG knowledge, memory, live research)
- **How much detail** appears in the response

You don't control the tier directly — Lyra classifies your intent automatically. Writing a longer question doesn't force COMPLEX routing. Asking "compare NVDA vs AMD" does.

## Quick Check

- [ ] Writing a very long question always triggers COMPLEX routing. | False — Lyra classifies by intent, not length. "What is a Trust score in detail?" is still SIMPLE.
- [x] COMPLEX queries use the most capable model available on your plan. | Correct — PRO, ELITE, and ENTERPRISE COMPLEX queries all use lyra-full (GPT-5.4).
- [ ] MODERATE queries cost 5 credits. | No — MODERATE costs 3 credits. COMPLEX costs 5.
- [x] A query like "compare NVDA vs AMD" is typically classified as COMPLEX. | Yes — comparative multi-asset synthesis is a COMPLEX query.
