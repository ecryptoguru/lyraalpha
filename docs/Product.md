# LyraAlpha AI — Product overview

> **The engines compute. The AI interprets.**

LyraAlpha AI is not another crypto finance chatbot. It is the structured intelligence layer that sits between fragmented crypto market data and real crypto investor decisions — built on deterministic computation, not pattern-matched guesswork.

Live product. Shipped workflows. US and India, simultaneously.

---

## The problem every crypto investor runs into

Retail crypto investors in 2026 have more data than at any point in history — prices, charts, on-chain metrics, DeFi analytics, protocol data, screeners, news feeds, and now AI summaries coming from every direction. The most common experience is still confusion.

Generic AI crypto tools make this worse. They put a large language model in a crypto wrapper and call it analysis. The outputs sound confident. They are not trustworthy. There is no deterministic backbone, no stable analytical framework, and no accountability when the model invents a metric it should have computed.

The gap is not between crypto investors and data. It is between data and judgment.

That is what LyraAlpha AI is built to close.

---

## How it works: three layers

### Layer 1 — The engine

Before any AI speaks, the platform's proprietary engines compute structured crypto market context:

- DSE Scores: Trend, Momentum, Volatility, Liquidity, Trust, Sentiment
- Crypto Market Regime: multi-horizon framing across macro, sector, and asset levels
- ARCS: Asset-Regime Compatibility Score
- Score Dynamics: velocity and directional signals on how scores are moving
- Stress scenarios: deterministic replay against historical crypto windows
- Portfolio engines: health, fragility, benchmark, Monte Carlo, allocation analysis
- On-chain metrics: protocol data, DeFi analytics, network signals
- Crypto news intelligence: NewsData.io integration for trending crypto news, per-asset news feeds, and sentiment extraction — synced every 12 hours via the `news-sync` cron

The model never invents the analytical structure. It interprets what the engines already computed.

### Layer 2 — The AI

Two purpose-built agents, each with a hard domain boundary:

- **Lyra** — crypto market intelligence: score explanation, regime-aware analysis, premium workflow output, cross-asset reasoning, portfolio interpretation
- **Myra** — platform support: product guidance, plan and credit help, onboarding, feature navigation

The separation keeps crypto market analysis and support behavior isolated, easier to govern, and easier to trust. It also keeps costs lower — Myra never runs on the full model.

**Myra is now available as a public support entry point** — unauthenticated visitors receive full AI-driven answers about the product, waitlist, early access, and how LyraAlpha works. No sign-in required. This is fully operational via the `/api/support/public-chat` endpoint.

**Myra Voice is now live** — hands-free voice support via the OpenAI Realtime API (`gpt-realtime-mini`). Users speak naturally and receive spoken responses. Available to PRO+ users from the dashboard Myra widget. Supports English, Hinglish, and Hindi. Includes client-side injection detection, PII redaction, virtual device filtering, and silence auto-stop.

### Layer 3 — The workflows

Premium intelligence experiences built on structured crypto engine computation:

- **Compare Crypto Assets** — cross-sector synthesis across up to 4 crypto assets simultaneously
- **Shock Simulator** — stress-scenario replay with Lyra hedge interpretation
- **Crypto Portfolio Intelligence Workspace** — health, fragility, benchmark, Monte Carlo, regime alignment, holdings heatmap in sequence
- **Asset Intelligence Pages** — scored, regime-aware, Lyra-interpreted per-crypto-asset views
- **Public Blog** — crypto-focused content (on-chain signals, regime cycles, AI hallucination risks), hybrid static + DB posts, WebP hero images (1200×800, optimized at ~90KB), category pages, RSS feed, OG share cards, reading progress. Fed by AMI 2.0 via secure webhook bridge. Weekly digest Mondays.

These are workflow products. Not chat with more tokens.

---

## Why crypto investors choose LyraAlpha AI over alternatives

**vs. crypto screeners (CoinGecko, CoinMarketCap, Messari)**
Screeners have good data and no synthesis. Users still have to figure out what the numbers mean. LyraAlpha AI tells them — grounded in the same structured crypto data.

**vs. generic AI crypto chatbots (ChatGPT Crypto, Perplexity Crypto)**
Fluent outputs, no deterministic backbone. LyraAlpha AI's model receives computed engine context before generating a single word. It cannot hallucinate a Trend score because that score was computed before the model was called.

**vs. robo-advisors (Coinbase, Binance Auto-Invest)**
Portfolio automation, not analytical intelligence. A different job entirely. LyraAlpha AI sharpens judgment before decisions are made — it does not automate execution.

**vs. niche AI crypto tools (Santiment, Glassnode)**
US-only, narrow coverage, no premium workflow depth, no portfolio layer. LyraAlpha AI covers crypto assets across US and India, first-class.

---

## Unique Selling Propositions (USPs)

### 1. Engine-grounded intelligence — not generated guesswork
Every Lyra response is anchored to deterministic engine outputs (DSE Scores, ARCS, regime framing, stress scenarios) computed **before** the model is invoked. The model interprets structure. It cannot hallucinate a Trend score because that score was already computed. This reduces hallucination surface, improves consistency, and makes every piece of reasoning auditable.

### 2. Dual-agent architecture with hard domain boundaries
- **Lyra** — crypto market intelligence: score explanation, regime-aware analysis, cross-asset synthesis, portfolio interpretation.
- **Myra** — platform support: product guidance, plan/credit help, onboarding, voice support.

The separation improves output quality on both sides, lowers inference cost, and simplifies governance. Myra now spans the full user journey from an **unauthenticated public support entry point** (no sign-in required) through every authenticated dashboard interaction.

### 3. Workflow products, not just a chat interface
Compare Assets, Shock Simulator, and Portfolio Intelligence are repeatable analytical routines built on structured computation — not longer chat sessions. This creates habits and retention that one-off Q&A never will.

### 4. Built natively for India and the US simultaneously
- Separate EOD sync pipelines for both markets
- INR and USD pricing, formatting, and market context
- India-aware stress scenarios and RBI policy framing
- Indian broker connectivity (Zerodha-style) and US aggregator paths

India has 90M+ registered equity investors growing at 15–20% annually, with accelerating crypto adoption. Almost no premium analytical product is built natively for that market.

### 5. Value-scaled credit economics
Flat unlimited subscriptions commoditize AI. LyraAlpha ties price to analytical depth:
- Quick score question: 1 credit
- Multi-factor analysis: 3 credits
- Deep synthesis / premium workflow: 5 credits + 3 per additional asset

Margin improves as engagement deepens — the opposite of the usual SaaS cost cliff.

### 6. Three-layer cost control architecture
1. **Query classification** — routes to nano, mini, or full tier; full-model inference only runs when justified.
2. **Credit ledger** — atomic monthly usage envelope per plan.
3. **Per-user daily token caps** — Redis-based secondary backstop, hot-patchable from `/admin/ai-limits` without a deploy.

These are architecture, not settings.

### 7. Production AI safety — shipped, not planned
- Full-conversation prompt-injection scanning (every message, not just the last)
- RAG chunk injection scanning before Lyra sees any retrieved knowledge
- User memory chunk injection scanning before context assembly
- Multi-asset mode plan-gated to prevent silent cost escalation
- Automatic nano fallback on primary model failure — users never see the error
- Five alerting channels: daily cost, fallback rate, RAG zero-result rate, output validation failures, web search availability
- Conversation log idempotency via a 10-second Redis dedup window
- Myra response caching (normalized query hash, 4h dashboard / 8h public TTL)

In financial AI, trust is the product.

### 8. Myra Voice — hands-free, real-time support
Powered by OpenAI Realtime API (`gpt-realtime-mini`, voice `marin`, PCM 24kHz). Supports English, Hinglish, and Hindi. Includes client-side injection detection, PII redaction, virtual-device filtering, and silence auto-stop. Available to PRO+ users from the dashboard Myra widget.

### 9. AMI 2.0 content pipeline — agent-automated distribution
- Public blog at `/blog` with category pages, RSS 2.0, OG hero images, reading progress, ISR, and contextual CTAs
- HMAC-SHA256 verified webhook bridge (`/api/webhooks/ami`) for agent publishing
- Weekly digest: QStash-scheduled every Monday at 10:00 UTC, zero incremental editorial cost
- Enforced email boundary: LyraAlpha owns transactional/lifecycle emails; AMI 2.0 owns outbound marketing with its own Brevo API key

Content distribution is infrastructure, not an afterthought.

### 10. AI stack fully consolidated on GPT-5.4
All Gemini, OpenRouter, and Groq branches removed. The entire stack — Lyra (nano / mini / full) and Myra (nano) — runs exclusively on GPT-5.4 via Azure OpenAI. Simpler governance, zero provider-parity drift, smaller operational surface area.

### 11. Real-time crypto news intelligence
NewsData.io integration delivers trending crypto news, per-asset news feeds, and sentiment extraction — synced every 12 hours via the `news-sync` cron. Replaces CryptoPanic with a broader, more reliable data source.

### 12. Clear upgrade ladder with natural triggers

```
STARTER (free) → PRO ($14.99 / ₹1,499) → ELITE ($39.99 / ₹3,999) → ENTERPRISE (custom)
```

Each tier has a natural upgrade trigger built into the product experience:
- Starter to Pro: credit exhaustion
- Pro to Elite: premium workflow access gate
- Elite to Enterprise: volume, team signals, or custom deployment needs

### 13. Cross-session conversation memory (PRO+)
Lyra remembers past analytical context, prior questions, and portfolio context across sessions. Users build analytical continuity instead of re-explaining their situation every time.

### 14. Live research augmentation (Elite+)
On recency-sensitive queries, Lyra pulls live web research to complement RAG knowledge — protocol metrics, macro shifts, and policy signals woven into the response, not appended as a footnote.

### 15. Regime-aware multi-asset synthesis (Elite+)
Compare up to 4 crypto assets simultaneously across sectors: divergence, correlation, relative regime alignment, and opportunity framing in a single response. Regime context makes the same momentum score mean different things in risk-off vs. risk-on environments.

### 16. System-level portfolio intelligence
Portfolio is analyzed as a system, not a list of positions:
- Regime alignment across the whole book
- Fragility and concentration risk identification
- Benchmark comparison and drawdown context
- Monte Carlo scenario framing
- Holdings P&L with regime-aware score overlays
- Score velocity signals on individual positions

---

## Lyra — the crypto market intelligence agent

> "Lyra doesn't guess. She interprets what the engines already computed, then tells you what it means in plain language."

---

### What Lyra is

Lyra is not a general-purpose chatbot given a crypto persona. She is a purpose-built AI agent with one job: turn structured crypto market data into clear, regime-aware analysis that a crypto investor can actually act on.

Every response flows through a pipeline that resolves the user's plan, classifies the query by complexity, runs safety checks, assembles context from RAG knowledge, conversation memory, price data, cross-sector signals, and live web research in parallel — scans every retrieved chunk for injection patterns — then streams the response under a strict output contract. If the primary model fails, the pipeline falls back to nano automatically. Users never see the error.

No blocking calls. No invented structure. Every analysis built on computed context.

---

### What Lyra can do

**Regime-aware crypto market analysis**

Lyra reads every crypto asset within its current crypto market regime — macro, sector, and asset-level simultaneously. A bullish momentum score means something different in a risk-off regime than in a broad risk-on environment. Lyra makes that distinction explicit every time, because ignoring regime context is one of the most common ways crypto investors misread a signal.

**Multi-asset cross-sector synthesis**

With Compare Crypto Assets (Elite and above), Lyra analyzes up to 4 crypto assets across sectors at once — divergence, correlation, relative regime alignment, and opportunity framing in a single response. This used to require a Bloomberg terminal and an analyst. Now it takes a prompt.

**Shock Simulator interpretation**

The Shock Simulator runs a deterministic stress replay first — direct historical data where it exists, hybrid proxy where it does not. Lyra then interprets the structured output: what the scenario revealed about each crypto asset's pressure points, which assets showed genuine resilience versus which recovered on macro tailwinds, and how to think about hedging given the current regime.

Lyra is not guessing the stress narrative. She is interpreting a computation-backed payload.

**Crypto portfolio intelligence**

Lyra reads a crypto portfolio as a system, not a list of positions:

- Regime alignment across the whole book
- Fragility: which crypto positions add risk concentration
- Benchmark comparison and drawdown context
- Holdings P&L with regime-aware score overlays
- Monte Carlo scenario framing
- Score velocity signals on individual crypto positions

**Score explanation**

Any DSE score — Trend, Momentum, Volatility, Liquidity, Trust, Sentiment — can be explained in depth: what drove it, how it is moving, what it means for this crypto asset type, and how it compares to peers in the same sector. Every explanation is grounded in computed values, not pattern-matched from training data.

**Conversation memory (PRO and above)**

Lyra remembers past analytical context, prior questions, and crypto portfolio context across sessions. Users build analytical continuity rather than re-explaining their situation every time they open the app.

**Live research augmentation (Elite and Enterprise)**

On recency-sensitive queries, Lyra pulls live web research to complement RAG-retrieved platform knowledge. Protocol metrics, macro shifts, and policy signals are woven into the response, not appended as a footnote.

**Full crypto asset class coverage**

- Crypto: on-chain signals, crypto-regime framing, protocol metrics, DeFi analytics

---

### How Lyra scales with plan

| Plan | What you get |
|---|---|
| STARTER | Score literacy, educational framing, lightweight regime context |
| PRO | Full retail analysis, portfolio intelligence, full model on complex queries |
| ELITE | Cross-asset synthesis, Compare Assets, Shock Simulator, live research augmentation |
| ENTERPRISE | Highest token budgets, largest daily token ceiling (2M tokens, env-configurable), custom deployment |

Every plan gets real Lyra intelligence. Higher plans get more context depth, more workflow access, and the full model on complex queries.

---

### For engineers: what makes Lyra technically defensible

| What it does | Why it matters |
|---|---|
| Full conversation injection scan | Every message in the conversation history is checked for injection patterns — not just the last |
| User memory injection scan | Stored memory chunks are filtered for injection patterns before being added to context |
| Multi-asset mode plan gating | Multi-asset inference is gated behind plan checks — no silent upgrades on lower tiers |
| RAG injection scanning | Every knowledge-base chunk is checked for prompt-injection patterns before Lyra sees it |
| Low-grounding confidence warning | Average retrieval similarity below 0.45 triggers a structured log warning before any hallucination risk reaches users |
| LLM nano fallback | Primary model failure degrades to nano at a 1200-token budget — no hard errors from infrastructure variability |
| 5-channel alerting | Watches daily cost, fallback rate, RAG zero-result rate, output validation failures, and web search availability continuously |
| Atomic daily token caps | Redis-based per-user daily ceiling applies to all plans including ENTERPRISE; hot-patchable without a deploy |
| Conversation log idempotency | 10-second Redis dedup window prevents duplicate log entries from retries or concurrent requests |
| Prompt prefix caching | Static system prompt memoized — reduces per-request token cost at scale |
| History compression | Long conversation context is compressed by nano before the full model call, without adding visible latency |
| Compression result caching | Redis-keyed on context SHA-256, 2h TTL — avoids redundant nano preflight calls on identical context |
| Myra response caching | Normalized query hash, 4h TTL (dashboard) / 8h TTL (public) — repetitive support questions never hit the LLM twice |
| GPT-5.4 exclusive stack | All Gemini/OpenRouter/Groq branches removed — single provider, simpler governance, no parity drift |

---

### Why Lyra is a moat, not just a feature

GPT-5.4 is available to anyone with an Azure account. That is not the advantage.

The moat is everything around the model: the proprietary engine outputs that ground every response, the RAG knowledge system built on platform-specific intelligence, the premium workflow payloads that give Lyra structured computation-backed context to interpret, the output contracts that enforce institutional-grade analytical structure, and the safety infrastructure that makes Lyra trustworthy enough to use for financial decisions.

None of that is replicable by swapping models or copying prompts.

---

## Myra — the support intelligence agent

> "Myra handles everything that isn't about markets. Platform help, onboarding, credits, navigation — so Lyra never has to."

### What Myra does

Myra is LyraAlpha AI's platform support agent. She handles product guidance, plan and credit questions, feature navigation, troubleshooting, and redirects market-analysis questions to Lyra.

### Where Myra lives

Myra operates across the entire user journey:

- **Public support entry point** — fully operational for unauthenticated visitors. The public Myra widget answers questions about the product, waitlist, early access, and how LyraAlpha works — before any sign-in. Runs on GPT-5.4-nano via the same Azure OpenAI provider as Lyra.
- **Authenticated dashboard** — the Myra chat panel (`LiveChatWidget`) renders in the bottom-right corner of the dashboard, outside the main scroll container so its fixed positioning anchors correctly to the viewport at all times.
- **Voice interface** — the `MyraVoiceButton` inside the chat widget enables hands-free voice support for PRO+ users. Uses OpenAI Realtime API with `gpt-realtime-mini`, voice `marin`, PCM 24kHz audio, and semantic VAD turn detection. The voice prompt uses a static prefix (cache-eligible at 10× cheaper text-input rate) plus a small dynamic per-user suffix.

### What makes Myra efficient

- **Response caching**: normalized query hash (stop-word removal + SHA-256), 4h TTL on dashboard, 8h TTL on public site. Repetitive support questions never hit the LLM twice.
- **GPT-5.4-nano**: cheapest and fastest model, perfectly matched to support response length and complexity requirements.
- **Hard financial advice boundary**: Myra declines investment-decision questions and redirects them to Lyra, so the support layer never creates compliance risk.

---

## Plans and pricing

| Plan | Price | Credits/month | For |
|---|---|---|---|
| STARTER | Free | 50 | Exploration, onboarding |
| PRO | $14.99 / ₹1,499 | 500 | Daily self-directed investors |
| ELITE | $39.99 / ₹3,999 | 1,500 + premium workflows | Power users, workflow buyers |
| ENTERPRISE | Custom | Custom | Teams, advisors, high-volume |

### How credits work

| Query type | Credits |
|---|---|
| Simple | 1 |
| Moderate | 3 |
| Complex | 5 |
| Compare Assets / Shock Simulator | 5 + 3 per additional asset (up to 4) |

The heavier the analysis, the more it costs. That aligns price with the product's most differentiated capabilities and keeps light usage genuinely cheap.

### Daily token caps (secondary backstop)

| Plan | Daily Token Cap |
|---|---|
| STARTER | 50,000 tokens |
| PRO | 200,000 tokens |
| ELITE | 500,000 tokens |
| ENTERPRISE | 2,000,000 tokens (~$500/day; env-configurable via `ENTERPRISE_DAILY_TOKEN_CAP`) |

The cap check applies to **all plans including ENTERPRISE**. Hot-patchable from `/admin/ai-limits` without a code deploy.

---

## The market

India has 90M+ registered equity investors growing at 15-20% annually, with crypto adoption accelerating. Almost no premium analytical product is built natively for that market. The US has 160M+ brokerage account holders where premium tool ARPU of $150-600/year is well established, with crypto investors increasingly seeking institutional-grade intelligence.

AI trust is splitting. Users who tried shallow wrappers and found them unreliable are actively looking for something grounded. That is the exact moment LyraAlpha AI is positioned for.

- TAM: $50B+ global retail fintech SaaS and AI investing tools
- SAM: $8-12B (self-directed US and India investors paying for analytical tools)
- SOM (3-year): $50-150M ARR at current plan economics

---

## What is coming

| Feature | When | Available to |
|---|---|---|
| Myra Voice — hands-free voice support via OpenAI Realtime API | **Shipped** | PRO and above |
| Lyra Reports — scheduled portfolio and market analysis | Q2 2026 | Elite, Enterprise |
| TYRA — a deep research agent for hours-long tasks | Q2 2026 | Elite, Enterprise |
| Daily market briefings — personalized morning intelligence | Q1-Q2 2026 | PRO and above |
| Portfolio co-pilot — proactive drift alerts and rebalancing signals | Q2 2026 | PRO and above |
| Discovery 2.0 — semantic asset discovery across the full universe | Q2-Q3 2026 | All plans |
| Mobile app — React Native, iOS and Android | Q4 2026 | All plans |

---

## The stack

Next.js 16 App Router with React 19, streaming-first with no blocking response paths. GPT-5.4 exclusively via Azure OpenAI Responses API with nano/mini/full routing for Lyra and nano for Myra — Gemini, OpenRouter, and Groq fully removed. Vercel AI SDK. PostgreSQL and Prisma for the credit ledger, asset universe, and `BlogPost` model. Upstash Redis for caching windows. Upstash QStash for cron scheduling (weekly digest, re-engagement, reports, credit reset, trial expiry). Clerk for auth and plan metadata. Stripe and Razorpay for US and India payment rails. Brevo for all email delivery (transactional + lifecycle owned by LyraAlpha; outbound marketing owned by AMI 2.0 via its own API key). Vitest and Playwright for testing (1,750+ tests passing).

---

## In one sentence

For crypto investors: LyraAlpha AI is a live, revenue-generating crypto intelligence product with a defensible architecture, dual-market coverage, and a commercial model that improves margin as engagement deepens.

For users: Ask Lyra anything about your crypto portfolio or the crypto markets. She will tell you what it means — backed by computation, not a confident guess. Ask Myra anything about the platform — from the public support entry point before you sign in, to every support question after.

For engineers: The model interprets what deterministic engines already computed. That is not a prompt trick. That is the architecture.

---

*LyraAlpha AI — Crypto Intelligence, Not Crypto Noise*
*Version 2.4 · April 2026*

> **Latest updates:** Streaming fixes — context-length blocker resolved, token-by-token streaming via `toTextStreamResponse()` with tee drain. Landing page thesis cards rewritten (PROBLEM, ARCHITECTURE, DIFFERENTIATION, WORKFLOWS, MARKET, CORE THESIS) replacing fake testimonials. ThesisSection: "Built on conviction. Not copy." Prisma pooled connection fix for `public-ticker` route.
