# WHITEPAPER V2 — PART 2
# Technology Architecture (Implementation-Aligned)

**Last updated: March 2026 — reflects current live codebase**

---

## Architecture Principle
LyraAlpha AI should be described as a system built on:
- deterministic financial computation
- retrieval and context layering
- plan-aware AI routing
- strict separation between analysis and support

That is the implementation-aligned baseline today.

The future architecture continues to build on that baseline by expanding:
- **GPT-5.4** is now live across all plans — the model story is complete, routing discipline is the differentiator
- **Convex** remains the long-term primary app-state backend direction for reactive product behavior

Older wording tied to Gemini routing, superseded model assumptions, or speculative migration claims should not be treated as canonical.

---

## Current Baseline Architecture
The current implementation is rooted in:
- Next.js App Router
- React and Tailwind CSS v4
- PostgreSQL with Prisma
- Redis / Upstash for caching and rate limiting
- Clerk for auth
- GPT-5.4 (nano / mini / full) via Azure OpenAI Responses API for all Lyra paths

The current AI implementation already shows several important maturity signals:
- Responses-style GPT usage for premium workflows
- prompt-prefix optimization and caching discipline
- query classification into SIMPLE / MODERATE / COMPLEX
- educational fast paths and trivial-query short-circuiting
- staged retrieval and memory logic
- plan-aware routing between lower-cost and higher-depth model families
- disciplined activation of premium research/runtime controls rather than paying those costs uniformly

These are not temporary implementation details. They are the starting point for the next architecture phase.

---

## Query and Routing Model
### Query Complexity
The platform classifies requests into:
- SIMPLE
- MODERATE
- COMPLEX

That complexity drives:
- response depth
- retrieval depth
- model family selection
- credit cost
- latency/cost tradeoffs

### Live Routing Table (authoritative — March 2026)
| Plan | SIMPLE | MODERATE | COMPLEX |
|---|---|---|---|
| **STARTER** | GPT-5.4-nano · single | GPT-5.4-nano · single | GPT-5.4-mini · single |
| **PRO** | GPT-5.4-mini · single | GPT-5.4-mini · single | GPT-5.4-full · single |
| **ELITE** | GPT-5.4-mini · single | GPT-5.4-mini · single | GPT-5.4-full · single |
| **ENTERPRISE** | GPT-5.4-mini · single | GPT-5.4-mini · single | GPT-5.4-full · single |

All plans run on GPT-5.4 via Azure OpenAI Responses API. All use single-mode orchestration. The differentiator is model role (nano/mini/full) and token budget — not orchestration complexity.

### Orchestration Mode (live)
- **single** — one direct `streamText` call to the appropriate model. Used across all plans and all tiers. Lowest latency, most predictable cost, no two-phase overhead.

`router` and `draft_verify` modes remain as legacy code in `src/lib/ai/orchestration.ts` but are not active in any plan configuration. Benchmark data (March 2026) showed 0/10 ELITE MODERATE queries escalating via router; removing them cut cost 37.7% with no quality regression.

---

## GPT-5.4 Prompting and Runtime Direction
The live technical implementation aligns with GPT-5.4 guidance as follows.

### 1. Responses-First Model Usage
GPT-5.4 works best when the product narrative assumes a Responses-first architecture for flagship model usage.

Why this matters:
- better long-running workflow behavior
- better compatibility with multi-step agent patterns
- improved performance through preserved prior assistant state and chain-of-thought handling across turns
- lower end-to-end cost and latency in many tool-heavy flows compared with less disciplined usage

### 2. Explicit Prompt Contracts
The docs should state that future GPT-5.4 performance comes not only from model upgrades, but from stronger prompt engineering contracts such as:
- explicit output contracts
- completeness contracts
- verification loops
- dependency-aware tool persistence
- clear instruction-priority rules

This is strategically important because it keeps quality gains tied to product discipline, not model mythology.

### 3. Reasoning Effort as a Last-Mile Knob
The future architecture should explicitly avoid a naive “turn reasoning up everywhere” strategy.

Implementation-aligned future guidance:
- use **none**, **low**, or **medium** by default depending on task shape
- use stronger reasoning only where evaluations justify the cost and latency tradeoff
- improve prompts, output structure, and verification before increasing reasoning effort

### 4. Verbosity as a Product Lever (Live)
`textVerbosity: "high"` is active on all Lyra generation paths via the AI SDK's `providerOptions.openai` field, which maps to `text.verbosity` in the Azure Responses API. The context compressor uses `textVerbosity: "low"` for dense summary bullets.

This is a live production lever for:
- cost control
- latency control
- clearer answer shaping by plan
- better UX for support vs research vs premium workflows

Word budgets are enforced at the prompt level with hard ceilings (e.g. ELITE MODERATE: 1000w target / 1100w hard ceiling injected into format instructions).

### 5. Phase-Aware Long-Running Flows
The GPT-5.4 migration story should acknowledge phase-aware assistant state for long-running or tool-heavy flows.

In product terms, this supports:
- clearer intermediate updates
- better multi-step execution reliability
- fewer premature final answers on tool-dependent tasks

---

## Credit Model
### Current Runtime Defaults
| Plan | Monthly Credits |
|---|---|
| STARTER | 50 |
| PRO | 500 |
| ELITE | 1500 |
| ENTERPRISE | 1500 runtime default |

### Query Cost Schedule
| Complexity | Cost |
|---|---|
| SIMPLE | 1 |
| MODERATE | 3 |
| COMPLEX | 5 |

This remains the current implementation-aligned schedule.

### Future Economics Direction
The future technical story should make clear that cost control comes from architecture, not hope:
- correct model-task matching
- stronger prompt contracts
- better caching
- verbosity control
- retrieval discipline
- staged context assembly

That is a more credible economics model than simply raising token ceilings or broadening GPT usage indiscriminately.

---

## Convex as the Long-Term Primary App-State Backend
The current implementation remains relational-first and cache-assisted. That is still true.

The future architecture should describe **Convex** as the long-term primary backend for application state, reactive user experiences, and live product workflows.

### Why Convex Fits the Direction
Convex is a strong fit for the future-state product narrative because it supports:
- reactive query surfaces
- simpler real-time synchronization
- reduced glue code for stateful UX
- better foundations for live collaboration and streaming UI behavior
- product-developer-friendly backend iteration in TypeScript-heavy stacks

### What Convex Should Mean in the Story
The docs should not imply that Convex replaces every database concern immediately.

Instead, the story should be:
- Convex becomes the long-term primary home for application state and reactive product behavior
- relational systems may continue to anchor canonical market data, audit-grade records, and other strongly historical or structured domains during migration phases
- the migration is phased, deliberate, and workload-specific

### Product Surfaces That Benefit Most
The future technical narrative should identify high-value reactive surfaces such as:
- live support and session state
- saved analytical sessions
- notifications and feed freshness
- collaboration-ready workspaces
- agent activity timelines and persistent context

The point is not technology novelty. The point is reducing friction between intelligence generation and user-facing product state.

---

## Search, Retrieval, and Research Story
The architecture should continue to frame search and retrieval as disciplined layers rather than a monolithic “AI search” feature.

Stable future-state framing:
- lightweight requests should avoid unnecessary research overhead
- deeper workflows can use richer retrieval and live research augmentation
- provider choice is secondary to user-facing product guarantees
- evidence-rich synthesis matters more than naming every provider in top-level docs
- premium workflows should preserve depth while still using selective runtime controls to protect UX

---

## Latency and Cost Optimization Narrative
The next-level technology story should explicitly emphasize:

### Latency optimization
- shorter critical paths
- selective retrieval rather than maximal retrieval
- reactive backend state to reduce polling-style patterns
- response shaping through verbosity and workflow contracts
- clearer separation between fast support flows and deep analytical workflows
- activate heavyweight premium controls only when the user-facing gain justifies the latency tradeoff
- protect premium workflows from unnecessary overhead that does not materially improve answer quality

### Cost optimization
- route cheaper tasks to cheaper paths
- reserve premium model spend for high-value workflows
- improve prompt contracts before increasing reasoning effort
- use caching and context compression aggressively where correctness allows

This keeps cost proportional to delivered value.

---

## Documentation Rule
Static docs should avoid hardcoding:
- obsolete providers or superseded model references
- speculative migration claims presented as current truth
- pricing promises not reflected in official packaging
- architecture claims that imply Convex migration is already complete

The correct story is implementation-aligned today, future-directed tomorrow, and explicit about the path between the two.

---

*Part 2 of 5 — implementation-aligned future draft*