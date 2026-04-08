# InsightAlpha AI — Product overview

> **The engines compute. The AI interprets.**

InsightAlpha AI is not another finance chatbot. It is the structured intelligence layer that sits between fragmented market data and real investor decisions — built on deterministic computation, not pattern-matched guesswork.

Live product. Shipped workflows. US and India, simultaneously.

---

## The problem every investor runs into

Retail investors in 2026 have more data than at any point in history — prices, charts, fundamentals, screeners, earnings, news feeds, and now AI summaries coming from every direction. The most common experience is still confusion.

Generic AI finance tools make this worse. They put a large language model in a financial wrapper and call it analysis. The outputs sound confident. They are not trustworthy. There is no deterministic backbone, no stable analytical framework, and no accountability when the model invents a metric it should have computed.

The gap is not between investors and data. It is between data and judgment.

That is what InsightAlpha AI is built to close.

---

## How it works: three layers

### Layer 1 — The engine

Before any AI speaks, the platform's proprietary engines compute structured market context:

- DSE Scores: Trend, Momentum, Volatility, Liquidity, Trust, Sentiment
- Market Regime: multi-horizon framing across macro, sector, and asset levels
- ARCS: Asset-Regime Compatibility Score
- Score Dynamics: velocity and directional signals on how scores are moving
- Stress scenarios: deterministic replay against historical windows
- Portfolio engines: health, fragility, benchmark, Monte Carlo, allocation analysis

The model never invents the analytical structure. It interprets what the engines already computed.

### Layer 2 — The AI

Two purpose-built agents, each with a hard domain boundary:

- **Lyra** — market intelligence: score explanation, regime-aware analysis, premium workflow output, cross-asset reasoning, portfolio interpretation
- **Myra** — platform support: product guidance, plan and credit help, onboarding, feature navigation

The separation keeps market analysis and support behavior isolated, easier to govern, and easier to trust. It also keeps costs lower — Myra never runs on the full model.

**Myra is now available on the public landing page** — unauthenticated visitors receive full AI-driven answers about the product, waitlist, early access, and how InsightAlpha works. No sign-in required. This is fully operational via the `/api/support/public-chat` endpoint.

### Layer 3 — The workflows

Premium intelligence experiences built on structured engine computation:

- **Compare Assets** — cross-sector synthesis across up to 4 assets simultaneously
- **Shock Simulator** — stress-scenario replay with Lyra hedge interpretation
- **Portfolio Intelligence Workspace** — health, fragility, benchmark, Monte Carlo, regime alignment, holdings heatmap in sequence
- **Asset Intelligence Pages** — scored, regime-aware, Lyra-interpreted per-asset views
- **Public Blog** — structured intelligence content at `/blog`, with category pages, RSS feed, OG share cards, and reading progress. Fed by the AMI 2.0 marketing agent via a secure webhook bridge. Weekly digest delivered every Monday to opted-in subscribers.

These are workflow products. Not chat with more tokens.

---

## Why investors choose InsightAlpha AI over alternatives

**vs. screeners (Screener.in, Finviz, Stock Analysis)**
Screeners have good data and no synthesis. Users still have to figure out what the numbers mean. InsightAlpha AI tells them — grounded in the same structured data.

**vs. generic AI chatbots (ChatGPT Finance, Perplexity Finance)**
Fluent outputs, no deterministic backbone. InsightAlpha AI's model receives computed engine context before generating a single word. It cannot hallucinate a Trend score because that score was computed before the model was called.

**vs. robo-advisors (Groww, Zerodha Coin, Betterment)**
Portfolio automation, not analytical intelligence. A different job entirely. InsightAlpha AI sharpens judgment before decisions are made — it does not automate execution.

**vs. niche AI tools (Danelfin, Kavout)**
US-only, narrow coverage, no premium workflow depth, no portfolio layer. InsightAlpha AI covers equities, ETFs, mutual funds, crypto, and commodities across US and India, first-class.

---

## What makes InsightAlpha AI different

### Grounded intelligence, not generated analysis

Every Lyra response is anchored to deterministic engine outputs computed before model invocation. The model interprets structure. It does not create it. This reduces hallucination surface, improves output consistency, and makes the product's reasoning auditable.

### Two agents, one clear separation

Lyra handles market intelligence. Myra handles platform support. Hard architectural boundary. The result is better output quality on both sides, lower inference cost, and simpler governance.

Myra now covers the full user journey from first landing page visit (unauthenticated public chat) through every authenticated support interaction inside the dashboard.

### Workflow products, not just a chat interface

Compare Assets, Shock Simulator, and Portfolio Intelligence are built on structured computation. Users run repeatable analytical routines. That creates habits and retention that a one-off chat session never will.

### Built for India and the US simultaneously

Not adapted. Built natively for both from the start.

- Separate EOD sync pipelines for NSE/BSE and US exchanges
- INR and USD pricing, number formatting, and market context throughout
- India-aware stress scenarios in Shock Simulator
- Broker connectivity for Indian brokers (Zerodha-style) and US aggregator paths
- RBI policy context and India-specific macro regime framing

India has 90M+ registered equity investors growing at 15-20% annually. Almost no premium analytical product is built natively for that market. InsightAlpha AI is.

### Credit economics that scale with analytical value

Flat unlimited subscriptions commoditize AI. InsightAlpha's credit model ties price to the depth of analysis:

- A quick score question costs 1 credit
- A full multi-factor analysis costs 3 credits
- A deep synthesis or premium workflow costs 5 credits, plus 3 per additional asset

Users who go deeper pay more. Margin improves as engagement deepens. That is the opposite of the usual SaaS cost cliff.

### Three independent cost controls built into the infrastructure

1. Query classification routes each request to the right model tier — nano, mini, or full — so full-model inference only runs when the analytical complexity justifies it
2. The credit system enforces a monthly usage envelope per plan, with atomic deduction
3. Per-user daily token caps in Redis act as a secondary backstop against runaway API spend — hot-patchable by admins without a code deploy

These are not settings. They are architecture.

### Production AI safety — already shipped

- Every RAG knowledge-base chunk is scanned for prompt-injection patterns before Lyra sees it
- Primary model failure degrades automatically to nano before any error reaches users
- Five alerting channels watch daily cost, fallback rate, RAG zero-result rate, output validation failures, and web search availability
- Daily token caps and alert thresholds are editable live from the admin panel
- Myra responses are cached (normalized query hash, 4h/8h TTL) to reduce redundant LLM calls on repetitive support questions

In financial AI, trust is the product. Most competitors have none of this in production.

### AMI 2.0 content pipeline — agent-automated distribution

InsightAlpha AI ships a public blog powered by an external AMI 2.0 marketing agent system.

- **Blog system** at `/blog`: category pages, RSS 2.0 feed, OG hero images, reading progress bar, share cards via the IntelligenceShare system, and contextual CTAs (waitlist for logged-out, Ask Lyra for logged-in)
- **HMAC-verified webhook bridge** (`/api/webhooks/ami`): AMI 2.0 publishes, updates, and archives posts via a shared-secret HMAC-SHA256 endpoint. Posts are Zod-validated, upserted into the `BlogPost` Prisma model, ISR-revalidated across all affected routes, and subscriber notifications fire asynchronously via Brevo
- **Weekly blog digest**: QStash-scheduled every Monday at 10:00 UTC. Batched delivery to `blogSubscribed: true` users. Zero incremental editorial cost once the pipeline is running
- **Enforced email boundary**: InsightAlpha owns transactional and lifecycle emails — welcome, notifications, digest, re-engagement, weekly reports, billing. AMI 2.0 owns outbound marketing — cold/warm outreach, nurture sequences, campaign copy — using its own Brevo API key. The boundary is a system-level contract, not a convention

Most products treat content distribution as an afterthought. InsightAlpha AI ships it as infrastructure.

### AI stack fully consolidated on GPT-5.4

All Gemini, OpenRouter, and Groq branches have been removed from the codebase. The entire AI stack — Lyra (nano / mini / full) and Myra (nano) — runs exclusively on GPT-5.4 via Azure OpenAI. This simplifies governance, eliminates provider-parity drift, and reduces operational surface area.

### A clear upgrade ladder from free to Enterprise

```
STARTER (free) → PRO ($14.99 / ₹1,499) → ELITE ($39.99 / ₹3,999) → ENTERPRISE (custom)
```

Each tier has a natural upgrade trigger built into the product experience:
- Starter to Pro: credit exhaustion
- Pro to Elite: premium workflow access gate
- Elite to Enterprise: volume, team signals, or custom deployment needs

---

## Lyra — the market intelligence agent

> "Lyra doesn't guess. She interprets what the engines already computed, then tells you what it means in plain language."

---

### What Lyra is

Lyra is not a general-purpose chatbot given a finance persona. She is a purpose-built AI agent with one job: turn structured market data into clear, regime-aware analysis that an investor can actually act on.

Every response flows through a pipeline that resolves the user's plan, classifies the query by complexity, runs safety checks, assembles context from RAG knowledge, conversation memory, price data, cross-sector signals, and live web research in parallel — scans every retrieved chunk for injection patterns — then streams the response under a strict output contract. If the primary model fails, the pipeline falls back to nano automatically. Users never see the error.

No blocking calls. No invented structure. Every analysis built on computed context.

---

### What Lyra can do

**Regime-aware market analysis**

Lyra reads every asset within its current market regime — macro, sector, and asset-level simultaneously. A bullish momentum score means something different in a risk-off regime than in a broad risk-on environment. Lyra makes that distinction explicit every time, because ignoring regime context is one of the most common ways investors misread a signal.

**Multi-asset cross-sector synthesis**

With Compare Assets (Elite and above), Lyra analyzes up to 4 assets across sectors at once — divergence, correlation, relative regime alignment, and opportunity framing in a single response. This used to require a Bloomberg terminal and an analyst. Now it takes a prompt.

**Shock Simulator interpretation**

The Shock Simulator runs a deterministic stress replay first — direct historical data where it exists, hybrid proxy where it does not. Lyra then interprets the structured output: what the scenario revealed about each asset's pressure points, which assets showed genuine resilience versus which recovered on macro tailwinds, and how to think about hedging given the current regime.

Lyra is not guessing the stress narrative. She is interpreting a computation-backed payload.

**Portfolio intelligence**

Lyra reads a portfolio as a system, not a list of positions:

- Regime alignment across the whole book
- Fragility: which positions add risk concentration
- Benchmark comparison and drawdown context
- Holdings P&L with regime-aware score overlays
- Monte Carlo scenario framing
- Score velocity signals on individual positions

**Score explanation**

Any DSE score — Trend, Momentum, Volatility, Liquidity, Trust, Sentiment — can be explained in depth: what drove it, how it is moving, what it means for this asset type, and how it compares to peers in the same sector. Every explanation is grounded in computed values, not pattern-matched from training data.

**Conversation memory (PRO and above)**

Lyra remembers past analytical context, prior questions, and portfolio context across sessions. Users build analytical continuity rather than re-explaining their situation every time they open the app.

**Live research augmentation (Elite and Enterprise)**

On recency-sensitive queries, Lyra pulls live web research to complement RAG-retrieved platform knowledge. Earnings, macro shifts, and policy signals are woven into the response, not appended as a footnote.

**Full asset class coverage**

- Equities: individual stocks, earnings-aware analysis, sector regime context
- ETFs: lookthrough analysis, underlying exposure framing
- Mutual funds: lookthrough into holdings, manager context
- Crypto: on-chain signals, crypto-regime framing
- Commodities: macro pillar identification, dominant driver analysis, regime verdict

---

### How Lyra scales with plan

| Plan | What you get |
|---|---|
| STARTER | Score literacy, educational framing, lightweight regime context |
| PRO | Full retail analysis, portfolio intelligence, full model on complex queries |
| ELITE | Cross-asset synthesis, Compare Assets, Shock Simulator, live research augmentation |
| ENTERPRISE | Highest token budgets, uncapped daily usage, custom deployment |

Every plan gets real Lyra intelligence. Higher plans get more context depth, more workflow access, and the full model on complex queries.

---

### For engineers: what makes Lyra technically defensible

| What it does | Why it matters |
|---|---|
| RAG injection scanning | Every knowledge-base chunk is checked for prompt-injection patterns before Lyra sees it |
| Low-grounding confidence warning | Average retrieval similarity below 0.45 triggers a structured log warning before any hallucination risk reaches users |
| LLM nano fallback | Primary model failure degrades to nano at a 1200-token budget — no hard errors from infrastructure variability |
| 5-channel alerting | Watches daily cost, fallback rate, RAG zero-result rate, output validation failures, and web search availability continuously |
| Atomic daily token caps | Redis-based per-user daily ceiling, hot-patchable without a deploy |
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

Myra is InsightAlpha AI's platform support agent. She handles product guidance, plan and credit questions, feature navigation, troubleshooting, and redirects market-analysis questions to Lyra.

### Where Myra lives

Myra operates across the entire user journey:

- **Public landing page** — fully operational for unauthenticated visitors. The public Myra widget answers questions about the product, waitlist, early access, and how InsightAlpha works — before any sign-in. Runs on GPT-5.4-nano via the same Azure OpenAI provider as Lyra.
- **Authenticated dashboard** — the Myra chat panel (`LiveChatWidget`) renders in the bottom-right corner of the dashboard, outside the main scroll container so its fixed positioning anchors correctly to the viewport at all times.

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
| ENTERPRISE | Uncapped (governed by contract) |

Hot-patchable from `/admin/ai-limits` without a code deploy.

---

## The market

India has 90M+ registered equity investors, growing 15-20% annually, with almost no premium analytical product built natively for it. The US has 160M+ brokerage account holders where premium tool ARPU of $150-600/year is well established.

AI trust is splitting. Users who tried shallow wrappers and found them unreliable are actively looking for something grounded. That is the exact moment InsightAlpha AI is positioned for.

- TAM: $50B+ global retail fintech SaaS and AI investing tools
- SAM: $8-12B (self-directed US and India investors paying for analytical tools)
- SOM (3-year): $50-150M ARR at current plan economics

---

## What is coming

| Feature | When | Available to |
|---|---|---|
| Lyra Reports — scheduled portfolio and market analysis | Q2 2026 | Elite, Enterprise |
| TYRA — a deep research agent for hours-long tasks | Q2 2026 | Elite, Enterprise |
| Daily market briefings — personalized morning intelligence | Q1-Q2 2026 | PRO and above |
| Portfolio co-pilot — proactive drift alerts and rebalancing signals | Q2 2026 | PRO and above |
| Discovery 2.0 — semantic asset discovery across the full universe | Q2-Q3 2026 | All plans |
| Mobile app — React Native, iOS and Android | Q4 2026 | All plans |

---

## The stack

Next.js 16 App Router with React 19, streaming-first with no blocking response paths. GPT-5.4 exclusively via Azure OpenAI Responses API with nano/mini/full routing for Lyra and nano for Myra — Gemini, OpenRouter, and Groq fully removed. Vercel AI SDK. PostgreSQL and Prisma for the credit ledger, asset universe, and `BlogPost` model. Upstash Redis for caching, daily token counters, and alerting windows. Upstash QStash for cron scheduling (weekly digest, re-engagement, reports, credit reset, trial expiry). Clerk for auth and plan metadata. Stripe and Razorpay for US and India payment rails. Brevo for all email delivery (transactional + lifecycle owned by InsightAlpha; outbound marketing owned by AMI 2.0 via its own API key). Vitest and Playwright for testing.

---

## In one sentence

For investors: InsightAlpha AI is a live, revenue-generating financial intelligence product with a defensible architecture, dual-market coverage, and a commercial model that improves margin as engagement deepens.

For users: Ask Lyra anything about your portfolio or the markets. She will tell you what it means — backed by computation, not a confident guess. Ask Myra anything about the platform — from the landing page before you sign in, to every support question after.

For engineers: The model interprets what deterministic engines already computed. That is not a prompt trick. That is the architecture.

---

*InsightAlpha AI — Financial Intelligence, Not Financial Noise*
*Version 2.0 · March 2026*
