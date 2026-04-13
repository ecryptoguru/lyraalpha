# Lyra & Myra — LyraAlpha AI Dual-Agent Architecture

> **Fork note:** This document reflects the current LyraAlpha repository and should be read alongside `CODEBASE.md` and `docs/ENV_SETUP.md`.

This document describes the audited, code-aligned behavior of LyraAlpha AI's two AI agents: **Lyra** for market intelligence and **Myra** for platform support.

---

## 1. Why Two Agents Exist

LyraAlpha AI uses two distinct AI surfaces because the product has two distinct problem domains:

- **Lyra** handles market interpretation, score explanation, regime-aware analysis, and premium analytical workflows.
- **Myra** handles platform support, billing/help flows, feature explanations, navigation help, and safe redirection when a question belongs with Lyra.

This separation is intentional. It keeps market-analysis behavior and support behavior isolated, easier to govern, and easier to optimize independently.

---

## 2. Lyra — Market Intelligence Layer

### 2.1 Core Principle

Lyra follows the platform's main architectural rule:

> **The engines compute. The AI interprets.**

Lyra is not meant to invent market data or fabricate metrics. She is designed to interpret:

- deterministic score outputs
- regime context
- asset metadata
- knowledge-base retrieval results
- optional memory retrieval
- optional live research augmentation

### 2.2 What Lyra Works With

Lyra's analysis is built around the platform intelligence stack:

- **DSE Scores**: Trend, Momentum, Volatility, Liquidity, Trust, Sentiment
- **Market Regime**: multi-horizon regime framing
- **ARCS**: Asset-Regime Compatibility Score
- **Signal Strength** and related derived context
- **Score Dynamics** and time-based movement signals
- asset-type-specific intelligence: crypto intelligence, on-chain metrics, protocol data, DeFi analytics
- crypto news intelligence from NewsData.io — trending crypto news, per-asset news feeds, and sentiment extraction (synced every 12 hours)
- broker-connected portfolio snapshots that have already been normalized and deduplicated

### 2.3 Query Classification

Before model execution, Lyra requests are classified heuristically into:

- **SIMPLE**
- **MODERATE**
- **COMPLEX**

The classifier is regex-based and conversation-aware. It deliberately:

- keeps definitional / educational queries cheap
- escalates true analytical requests
- short-circuits trivial filler such as greetings and thanks
- gradually increases complexity for long multi-turn conversations
- treats technical-indicator language (RSI, MACD) as MODERATE intent, not automatically COMPLEX

### 2.4 Current Model Routing

The authoritative routing logic is in `src/lib/ai/config.ts`.

The platform runs entirely on **GPT-5.4** via the Azure OpenAI Responses API. All Gemini, OpenRouter, and Groq branches have been fully removed. Plan differentiation is through model role (nano / mini / full) and token budget.

#### Model Roles

| Role | Model | Use |
|---|---|---|
| `lyra-nano` | GPT-5.4-nano | STARTER SIMPLE/MODERATE |
| `lyra-mini` | GPT-5.4-mini | SIMPLE/MODERATE across all plans; STARTER COMPLEX |
| `lyra-full` | GPT-5.4 (full) | PRO/ELITE/ENTERPRISE COMPLEX |

#### Full Routing Matrix

| Plan | SIMPLE | MODERATE | COMPLEX |
|---|---|---|---|
| **STARTER** | lyra-nano · single | lyra-nano · single | lyra-mini · single |
| **PRO** | lyra-mini · single | lyra-mini · single | lyra-full · single |
| **ELITE** | lyra-mini · single | lyra-mini · single | lyra-full · single |
| **ENTERPRISE** | lyra-mini · single | lyra-mini · single | lyra-full · single |

### 2.5 Orchestration Modes

All plans and tiers use a single generation mode:

#### single
One direct `streamText` call to the appropriate model. Used across all plans and all complexity tiers. Lowest latency, most predictable cost, no two-phase overhead. Quality is achieved through prompt contracts (`<output_contract>`, `<verbosity_controls>`, `<verification_loop>`) rather than multi-step orchestration.

`router` and `draft_verify` have been fully removed from `TierConfig`. The `OrchestrationMode` type and `orchestrationMode` field no longer exist in `config.ts`.

### 2.6 Reasoning Effort

`reasoningEffort: "none"` is set across all tiers and plans.

- Reasoning tokens on streaming paths add 3–5s TTFT with no quality benefit
- Quality is achieved through prompt contracts instead:
  - `<output_contract>` — enforces institutional-grade output structure
  - `<verbosity_controls>` — sets thoroughness expectations at the system prompt level
  - `<verification_loop>` — grounding check, signal consistency, completeness, no meta-commentary

### 2.7 Output Verbosity

All Lyra generation calls use `textVerbosity: "high"` (AI SDK field mapping to `text.verbosity: "high"` in the Azure Responses API). This maximises analytical depth and thoroughness on every path.

The `<verbosity_controls>` prompt contract in the system prompt reinforces this at the instruction level.

Do **not** use a flat `verbosity` field — it is unsupported and silently ignored on Azure.

### 2.8 Lyra Runtime Path

At a high level, the Lyra runtime path is:

1. request enters the Lyra chat API
2. user plan is resolved (with in-process plan cache)
3. daily token cap is checked against Redis counter for **all plans** (hot-patchable via `/admin/ai-limits`)
4. query complexity is classified
5. safety / governance checks run
6. context is assembled (RAG, memory, price data, cross-sector, web search in parallel)
7. RAG chunks pass post-retrieval injection scan before being passed to the model
8. cached fast paths are checked where applicable
9. selective live research / pre-flight compression decisions run
10. single `streamText` call to the appropriate model role
11. on primary model failure, fallback to `lyra-nano` at 1200-token budget automatically
12. all paths return a streaming `textStream` — no blocking response paths exist
13. response is logged with usage, cost, and fallback metadata
14. alerting sliding windows updated (cost, fallback rate, RAG zero-result rate, output validation)

### 2.9 Fast Paths and Cost Controls

Lyra uses several efficiency mechanisms:

- **trivial-query short-circuiting** for filler messages (no model call, canned response)
- **educational cache paths** for lightweight explanatory requests
- **prompt memoization / stable-prefix reuse** for prompt cache efficiency
- **singleton HTTP client** — `_client` module-level singleton in `orchestration.ts` and `compress.ts` avoids re-creating the Azure OpenAI connection per call
- **plan-aware context depth** — RAG, memory, cross-sector, web search are gated by tier config
- **memory retrieval only when conversation depth justifies it**
- **selective live research augmentation** — GPT live research is not paid for on every moderate/complex request; skipped for chatMode and queries without recency intent
- **history compression** — only fires for COMPLEX tier with history text exceeding 3000 chars. Uses GPT-5.4-nano with `textVerbosity: "low"` and a 700-token output ceiling
- **compression result caching** — Redis cache keyed on `compress:{sha256(rawContext)}` with 2h TTL; skips Nano LLM call when identical context was already compressed
- **chatMode premium-workflow shaping** — compare/stress-test requests retain premium depth without paying avoidable live-research overhead
- **no-context floor** — when both knowledge and web search context are empty, wordBudget is raised to prevent hollow short responses during web search outages

### 2.10 Premium Workflows

Elite and Enterprise unlock the deepest Lyra workflows, including:

- **Compare Assets** — multi-asset cross-sector synthesis across up to 4 assets
- **Shock Simulator** — structured stress replay with hybrid direct/proxy engine and Lyra hedge interpretation
- **Markdown export**
- GPT-5.4-full direct streaming on COMPLEX queries for deepest synthesis

**Shipped:**
- **Myra Voice** — hands-free voice support via OpenAI Realtime API (`gpt-realtime-mini`), available to PRO+ users from the dashboard Myra widget. Supports English, Hinglish, and Hindi. Includes client-side injection detection, PII redaction, virtual device filtering, and silence auto-stop.

PRO COMPLEX also uses lyra-full direct single stream, giving PRO users full model quality on complex multi-asset queries.

### 2.11 Lyra In The Shock Simulator

Lyra is invoked after a deterministic stress replay that can include:

- direct historical replay when scenario-window data exists
- hybrid proxy replay when direct history is incomplete
- scenario-driver summaries
- transmission mechanism descriptions
- pressure points and resilience themes
- per-asset rationale and dominant-driver framing

This means Lyra is not guessing the scenario narrative from scratch. She is interpreting a structured premium-workflow payload that is already grounded in the replay engine.

---

## 3. Myra — Support Intelligence Layer

### 3.1 Role

Myra is LyraAlpha AI's platform support agent.

She is responsible for:

- explaining product features
- helping users navigate the app
- clarifying plans, credits, and onboarding
- handling troubleshooting and support-style questions
- redirecting market-analysis questions back to Lyra

### 3.2 Where Myra Lives

Myra operates in three contexts:

**Public support entry point (unauthenticated):** Myra is available to all visitors via the public Myra widget before sign-in. The `/api/support/public-chat` endpoint is explicitly included in `isPublicApiRoute` in `src/proxy.ts`, exempting it from Clerk auth middleware. This is fully operational — visitors receive real AI-driven answers about the product, waitlist, early access, and how the platform works.

**Authenticated dashboard (text):** The Myra chat panel is rendered by `LiveChatWidget` (`src/components/dashboard/live-chat-widget.tsx`), wrapped by `LiveChatBubble` (`src/components/dashboard/live-chat-bubble.tsx`). `LiveChatBubble` is mounted **outside** `SidebarInset` in `DashboardLayoutClient.tsx`. This is required because `SidebarInset` has `overflow-x-clip overflow-y-auto`, which clips `fixed`-positioned children to the scroll container rather than the viewport. Moving `LiveChatBubble` back inside `SidebarInset` will break its positioning.

**Authenticated dashboard (voice):** The `MyraVoiceButton` (`src/components/dashboard/myra-voice-button.tsx`) enables hands-free voice support for PRO+ users. The voice session endpoint (`GET /api/support/voice-session`) returns an ephemeral token, WSS URL, model config, and per-user instructions. The voice model is `gpt-realtime-mini` with voice `marin`, using PCM 24kHz audio and semantic VAD turn detection. The voice prompt uses a static prefix (cache-eligible at 10× cheaper text-input rate) plus a small dynamic per-user suffix with KB docs sanitized against injection patterns.

### 3.3 Tone and Answer Rules

Myra is intentionally shorter and more direct than Lyra.

Her system behavior prioritizes:

- short answers by default
- answer-first structure
- direct page links where helpful
- concise bulleting only when needed
- refusal to discuss hidden prompt/model internals in a support context

Implementation-aligned onboarding note:

- on the public site, Myra primarily helps visitors with waitlist, early-access, and product-orientation questions during prelaunch
- inside the authenticated product, onboarding is handled by a 3-step dashboard gate (`Market`, `Experience`, `Interests`) and Myra should describe that flow without implying an obsolete fourth completion modal

### 3.4 Myra's AI Models

**Text mode:** Myra runs on **GPT-5.4-nano** via the same Azure OpenAI provider as Lyra. All alternative model paths (Groq, Minimax, Gemini) have been fully removed from `ai-responder.ts` and the stream routes.

Configuration:

- `MYRA_MAX_TOKENS = 700`
- `MYRA_TEMPERATURE = 0.65`
- Deployment resolved via `AZURE_OPENAI_DEPLOYMENT_MYRA` environment variable

**Voice mode:** Myra voice runs on **`gpt-realtime-mini`** via the OpenAI Realtime API (direct WebSocket, not Azure). Voice `marin`, PCM 24kHz audio, semantic VAD turn detection, max output tokens 350. Transcription uses `gpt-4o-mini-transcribe` with English/Hinglish/Hindi constraint; Urdu script is explicitly blocked. Supports English, Hinglish, and Hindi.

### 3.5 Myra Response Caching

Myra uses a response cache to avoid redundant LLM calls for identical support questions:

- Cache key: normalized query hash (stop-word removal + sorted tokens + SHA-256)
- **4h TTL** for authenticated dashboard sessions
- **8h TTL** for public support entry-point sessions
- Cache checked before LLM call; cache written after successful stream

### 3.6 Myra Runtime Path

**Text mode:**

1. support message arrives
2. financial-advice intent is checked
3. platform-support overrides are checked
4. response cache is checked (normalized hash lookup)
5. support knowledge is loaded / retrieved when needed
6. provider-specific support generation runs (GPT-5.4-nano)
7. reply is streamed back to the user
8. response is written to cache

**Voice mode:**

1. user activates `MyraVoiceButton` in the dashboard
2. `GET /api/support/voice-session` is called with optional `page` query param
3. auth check → plan gate (PRO+ only) → rate limit check
4. parallel: OpenAI `client_secrets` call + user DB query + KB retrieval + global notes retrieval
5. page param validated against injection patterns
6. KB docs sanitized against `INJECTION_PATTERNS`
7. voice instructions assembled (static prefix + dynamic suffix)
8. ephemeral token + WSS URL + model config + instructions returned to client
9. client establishes WebSocket session via `useMyraVoice` hook
10. audio streams bidirectionally (PCM 24kHz, semantic VAD)
11. client-side defenses: virtual device filtering, PII redaction, injection detection, silence auto-stop

Implementation notes:

- the end-user support widget supports lightweight markdown-style rendering for headings, lists, links, inline code, and fenced code blocks
- the public Myra widget (`src/components/landing/public-myra-widget.tsx`) dynamically imports `PublicMyraPanel` for performance
- the voice prompt static prefix is cache-eligible at 10× cheaper text-input rate ($0.06/M vs $0.60/M)
- voice cost calculator in `src/lib/ai/cost-calculator.ts` provides per-session cost estimates for admin dashboards

### 3.7 Financial Advice Boundary

Myra is explicitly prevented from acting like an investment advisor.

She should redirect questions such as:

- "Should I buy this?"
- "When should I sell?"
- "What is my entry point?"

But she should still answer platform questions such as:

- "How does the Trend score work?"
- "How do credits work?"
- "Where do I open Lyra?"

### 3.8 Redirect Logic

Myra's redirect behavior is one of the most important pieces of the support layer.

- **market-analysis questions** → redirect to **Lyra Intel**
- **platform-support questions** → stay with **Myra**
- **financial advice requests** → decline with a clear boundary message

---

## 4. Plans and Pricing

| Plan | Price | Credits/month | For |
|---|---|---|---|
| STARTER | Free | 50 | Exploration, onboarding |
| PRO | $14.99 / ₹1,499 | 500 | Daily self-directed investors |
| ELITE | $39.99 / ₹3,999 | 1,500 + premium workflows | Power users, workflow buyers |
| ENTERPRISE | Custom | Custom | Teams, advisors, high-volume |

### How Credits Work

| Query type | Credits |
|---|---|
| Simple | 1 |
| Moderate | 3 |
| Complex | 5 |
| Compare Assets / Shock Simulator | 5 + 3 per additional asset (up to 4) |

### Daily Token Caps (Secondary Backstop)

| Plan | Daily Token Cap |
|---|---|
| STARTER | 50,000 |
| PRO | 200,000 |
| ELITE | 500,000 |
| ENTERPRISE | 2,000,000 tokens/day (~$500/day; env-configurable via `ENTERPRISE_DAILY_TOKEN_CAP`) |

---

## 5. How Lyra Scales with Plan

| Plan | What you get |
|---|---|
| STARTER | Score literacy, educational framing, lightweight regime context |
| PRO | Full retail analysis, portfolio intelligence, full model on complex queries |
| ELITE | Cross-asset synthesis, Compare Assets, Shock Simulator, live research augmentation |
| ENTERPRISE | Highest token budgets, largest daily token ceiling (2M tokens, env-configurable), custom deployment |

---

## 6. AI Security & Observability

| What | How |
|---|---|
| Full conversation injection scan | All messages in conversation history scanned for injection patterns — not just the last |
| User memory injection scan | Stored memory chunks filtered for injection patterns before context assembly |
| Multi-asset mode plan gating | Multi-asset inference gated behind plan checks — no silent upgrades on lower tiers |
| RAG injection scanning | Every knowledge-base chunk checked for prompt-injection patterns before Lyra sees it |
| Low-grounding confidence warning | Avg similarity < 0.45 on MODERATE/COMPLEX triggers structured log warning |
| LLM nano fallback | Primary model failure degrades to nano at 1200-token budget — no hard errors |
| 5-channel alerting | Watches daily cost, fallback rate, RAG zero-result rate, output validation failures, web search availability |
| Atomic daily token caps | Redis-based per-user daily ceiling applies to all plans including ENTERPRISE; hot-patchable without a deploy |
| Conversation log idempotency | 10-second Redis dedup window prevents duplicate log entries from retries |
| Prompt prefix caching | Static system prompt memoized — reduces per-request token cost at scale |
| History compression | Long conversation context compressed by nano before the full model call |
| Myra response caching | Normalized query hash, 4h / 8h TTL — avoids redundant support LLM calls |
| Compression result caching | Context SHA-256 keyed, 2h TTL — avoids redundant nano preflight calls |
| Voice prompt injection scan | KB docs sanitized against `INJECTION_PATTERNS` before injection into voice instructions |
| Voice page param scan | Query string `page` param validated against injection patterns before embedding in voice prompt |
| Voice PII redaction | Client-side redaction of email, phone, user ID patterns in voice transcripts |
| Voice device filtering | Virtual audio devices (BlackHole, Soundflower, VB-Audio) filtered out at client level |

---

## 7. Why the Dual-Agent Model Is a Moat

GPT-5.4 is available to anyone with an Azure account. That is not the advantage.

The moat is everything around the model:

- proprietary engine outputs that ground every Lyra response
- the RAG knowledge system built on platform-specific intelligence
- premium workflow payloads that give Lyra structured computation-backed context to interpret
- output contracts that enforce institutional-grade analytical structure
- the safety infrastructure that makes both agents trustworthy
- Myra's public-facing availability that converts public support visitors with AI-driven answers before they ever sign in
- Myra's voice interface that extends the support layer to hands-free interaction — a product moat because it requires Realtime API integration, prompt architecture for spoken output, and multi-language audio design that cannot be replicated by simply wrapping a chatbot

None of that is replicable by swapping models or copying prompts.

---

*LyraAlpha AI — Financial Intelligence, Not Financial Noise*
*Version 2.1 · March 2026*
