# WHITEPAPER V2 — PART 3
# Lyra and Myra (Implementation-Aligned)

**Last updated: March 2026 — reflects current live codebase**

---

## Role Separation
LyraAlpha AI uses a dual-agent model because the platform has two distinct product responsibilities.

### Lyra
Lyra is the market-intelligence agent. She handles:
- asset analysis
- score interpretation
- regime-aware framing
- premium analytical workflows
- deeper market synthesis for higher-value user questions

### Myra
Myra is the platform-support agent. She handles:
- plans
- credits
- billing/help flows
- navigation and product guidance
- onboarding and support-style clarification

This separation is not cosmetic. It is one of the product’s core architectural strengths and should remain canonical in both current and future storytelling.

---

## Lyra: Interpretation, Not Computation
Lyra continues to follow the product’s defining rule:

**the engines compute, the AI interprets.**

She does not invent the platform’s market structure. She interprets deterministic context already produced by the system.

That context includes:
- DSE scores
- regime state
- compatibility framing
- premium workflow outputs
- knowledge retrieval
- optional memory and live research augmentation

This design continues to matter in the future because it reduces hallucination risk, improves analytical consistency, and makes the product more governable.

An important implementation-aligned refinement is that higher-discipline answer formats should be triggered by real analytical context, not by superficial wording alone.

---

## Current Lyra Runtime Story
The current implementation runs entirely on **GPT-5.4** (nano / mini / full) via Azure OpenAI Responses API across all plans:
- STARTER: nano for SIMPLE/MODERATE, mini for COMPLEX — single streaming call
- PRO: mini for SIMPLE/MODERATE, full with `draft_verify` for COMPLEX
- ELITE: mini for SIMPLE, full with `router` for MODERATE, full with `draft_verify` for COMPLEX
- ENTERPRISE: mirrors ELITE orchestration with the largest token budgets
- query complexity governs depth, model role, orchestration mode, and economics
- selective premium runtime controls (web search, cross-sector, RAG memory) activate by plan and tier

That remains the current truth.

---

## Lyra Intelligence Architecture (Live)
GPT-5.4 is now Lyra's live analytical engine across all plans. The implementation aligns with GPT-5.4's strengths:

### Why GPT-5.4 Fits Lyra (Delivered)
GPT-5.4 was chosen for the product's highest-value analytical workflows because it offers:
- stronger instruction following in long, structured prompts
- better multi-step task completion
- more reliable evidence-rich synthesis
- stronger long-context handling across research and platform context
- better control over answer depth through explicit output shaping and verbosity controls

For Lyra, this should not be framed as “more creative AI.” It should be framed as:
- sharper synthesis
- better workflow discipline
- stronger premium answer quality
- more reliable execution across deeper analytical tasks

### Lyra Prompting Contracts (Live)
The live system uses stronger prompt contracts that enforce output discipline without reasoning overhead:
- `<output_contract>` — exact section order, no skipping, no merging
- `<verbosity_controls>` — every sentence must add a new fact; no padding to reach word target
- hard word ceilings injected into format instructions (e.g. ELITE MODERATE: 1000w target, 1100w ceiling)
- `reasoningEffort: "none"` across all tiers — quality comes from prompt contracts, not reasoning overhead
- verification loop contract in `draft_verify` — full model grounded on mini draft before streaming answer
- dependency-aware retrieval behavior
- selective reasoning effort rather than indiscriminate overuse
- selective activation of premium research/runtime controls so latency is only paid when answer quality meaningfully benefits

This matters because premium quality should come from a well-engineered analytical system, not only from a model upgrade.

---

## Myra: Support Context, Not Brittle Support Copy
Myra should continue to be described as operating from a generated support-context layer rather than brittle hardcoded facts.

Her stable support story includes:
- current plan defaults
- query-cost schedule
- routing summary
- promo-based Elite trial semantics
- custom-commercial Enterprise positioning
- generic credit-pack messaging unless live package data is available

That remains implementation-aligned today.

---

## Future Myra Direction: Faster, More Reactive, More Persistent
The future-state story for Myra should evolve beyond “support chatbot” language.

Myra should increasingly feel like a reactive product-support layer with:
- faster support responses
- stronger session continuity
- better onboarding context
- more precise billing/help guidance
- improved support-state persistence across sessions and surfaces

### Why Convex Matters for Myra
As Convex becomes the long-term primary app-state backend direction, Myra gains a stronger foundation for:
- live support session state
- reactive support surfaces
- persistent onboarding context
- faster support-state synchronization across UI surfaces
- richer saved product-help interactions

This is especially important because support quality is not only about wording. It is also about state continuity and product responsiveness.

---

## Plan and Credit Semantics
### Monthly Credits
- STARTER: 50
- PRO: 500
- ELITE: 1500
- ENTERPRISE: managed runtime default exists, while external positioning remains custom-commercial

### Query Costs
- SIMPLE: 1
- MODERATE: 3
- COMPLEX: 5

These remain the implementation-aligned current facts.

---

## Trial and Enterprise Messaging
The future-state docs should preserve the current packaging truth:
- Elite trial messaging remains **promo-based**
- Enterprise remains **commercially custom**

These constraints matter because they prevent polished future messaging from drifting into false entitlement claims.

---

## User-Facing Contract
From the user perspective, the contract should remain simple and durable:
- Lyra is for market analysis
- Myra is for product support
- credit usage follows shared complexity-based rules
- higher tiers unlock better workflows, richer depth, and stronger continuity

That contract should become more polished over time, but it should not become more confusing.

---

## Shared Governance Direction
Both agents should continue operating under non-negotiable product constraints:
- the platform is analytical, not a brokerage
- the platform does not provide personalized financial advice
- support and analysis remain separated
- plan gating and rate limiting remain enforced server-side
- high-impact outputs benefit from verification and evidence discipline

In the future-state narrative, this governance posture should be framed as a product strength, not as a limitation.

---

## Strategic Summary
The dual-agent architecture remains one of LyraAlpha AI’s clearest differentiators.

Its future shape should be:
- **Lyra** becoming a stronger premium analytical surface built around GPT-5.4 for flagship synthesis
- **Myra** becoming a faster, more reactive support layer backed by stronger state and session continuity
- both agents remaining grounded in deterministic product logic rather than free-form improvisation
- premium workflows preserving depth while using more selective runtime controls instead of simply paying for maximum context on every run

That is a more durable and more defensible story than a single undifferentiated AI assistant.

---

*Part 3 of 5 — implementation-aligned future draft*