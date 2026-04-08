# InsightAlpha AI — 1-Year Vision Roadmap
### March 2026 → March 2027

> This document is a long-horizon product and technology vision roadmap for InsightAlpha AI. It is organized into four quarterly phases and covers the five strategic pillars requested by leadership, plus additional high-conviction feature bets drawn from competitive analysis, user experience gaps, and emerging fintech AI trends.

---

## Strategic North Star

Transform InsightAlpha AI from a **score-driven intelligence dashboard** into the **world's most capable multi-asset AI research platform** — where deep research agents, institutional-grade reports, and real-time discovery combine into a single cohesive intelligence layer for every type of investor.

**Three headline outcomes by March 2027:**
1. **Report-native Lyra** — users get fast, grounded market analysis and structured report delivery from the dashboard
2. **TYRA research agent** — a Claude-powered deep research peer that takes hours-long research tasks end-to-end
3. **Report Engine** — actionable daily / weekly / monthly market intelligence digests that rival institutional research desks

---

## Product Pillars Summary

| Pillar | Code Name | ETA | Tier Gate |
|--------|-----------|-----|-----------|
| Report Engine — Lyra | `REPORT-ENGINE` | Q1 2026 | PRO+ |
| Deep Research Agent — TYRA | `TYRA` | Q2 2026 | Elite + Enterprise |
| Daily & Weekly Reports | `REPORT-ENGINE` | Q1–Q2 2026 | PRO+ |
| Discovery 2.0 | `DISCOVERY-2` | Q2–Q3 2026 | All Plans |
| Platform Intelligence Leap | `INTEL-LEAP` | Q3–Q4 2026 | All Plans |

---

## Phase 1 — Q1 2026 (April → June)
### Theme: **Reports + Alerts Foundation**

---

### 1.1 REPORTING SURFACE — Morning Intelligence UX

**Vision:** A polished dashboard layer for daily and weekly intelligence outputs. Users see a concise morning briefing, market-regime context, and a clear path into deeper reports without needing to search for them.

**Architecture:**
- **Briefing generation:** Existing Lyra and report pipelines produce structured morning intelligence summaries for each user.
- **Dashboard delivery:** Briefings are surfaced inline on the dashboard and in dedicated report pages, with staleness indicators and clear call-to-action routing.
- **Push/email delivery:** Reports can be delivered through push notifications and email digests depending on user preferences.
- **Report memory:** Briefing history persists long enough for users to compare day-over-day changes and review prior market context.

**Metrics for success:**
- Report open rate ≥ 45%
- Briefing interaction rate ≥ 30%
- No increase in hallucination vs. the baseline text path (A/B vs. baseline)

---

### 1.2 REPORT-ENGINE — Daily Market Briefing (Phase 1)

**Vision:** Every morning, InsightAlpha AI publishes a personalized, AI-generated daily market briefing for each user based on their watchlist, portfolio holdings, and tracked sectors. Think Bloomberg Intelligence Brief meets personalized fintech AI.

**Architecture:**
- **Cron trigger:** `src/app/api/cron/reports/daily/route.ts` — fires at market open (09:30 EST / 09:15 IST depending on user region)
- **Context assembly:** Pulls user watchlist, portfolio regime alignment, top movers in tracked sectors, macro regime state, and any overnight news signals
- **Generation:** Lyra-full single stream with a `reportMode: 'daily'` system prompt variant — produces a structured 4-section brief: (1) Market Mood, (2) Your Holdings Watch, (3) Sector Signals, (4) One Action to Consider
- **Delivery:** Push notification (PWA + email digest). Report stored in `UserReport` DB table with 30-day retention
- **UI surface:** New `/dashboard/reports/daily` page. Briefing also previewed inline on the dashboard home as a collapsible card

**Key new models (Prisma):**
```prisma
model UserReport {
  id          String   @id @default(cuid())
  userId      String
  type        ReportType  // DAILY | WEEKLY | MONTHLY
  generatedAt DateTime
  content     String      @db.Text
  metadata    Json
  region      String
}
enum ReportType { DAILY WEEKLY MONTHLY }
```

**Tier gate:** PRO+ for personalized reports. STARTER gets a generalized market summary (non-personalized).

---

### 1.3 Score Velocity & Regime Drift Alerts (Push)

Extend existing `ScoreVelocityBadge` and drift alert logic into a **push notification engine**:
- Users subscribe to alerts per asset/sector
- Alert triggers: score delta > threshold, regime flip, watchlist drift, portfolio fragility spike
- Delivery: PWA push + optional email
- New API: `src/app/api/user/alerts/subscribe/route.ts`

---

## Phase 2 — Q2 2026 (July → September)
### Theme: **TYRA + Deep Research + Weekly Reports**

---

### 2.1 TYRA — Deep Research AI Agent (Claude-Powered)

**Vision:** TYRA (Total Yield Research Agent) is InsightAlpha AI's second major AI intelligence layer, distinct from Lyra in purpose and architecture. Where Lyra is a conversational real-time analyst, **TYRA is an asynchronous deep research agent** that takes complex research mandates and returns comprehensive, citation-backed institutional-grade research documents in 15–60 minutes.

**Powered by:** Anthropic Claude Sonnet 4.6 (`claude-sonnet-4-6`) via Anthropic API — chosen for its 200K context window, multi-step tool use, extended thinking mode, and superior long-form structured writing.

**Architecture — Multi-Agent Pipeline:**

```
User Research Brief
       ↓
[TYRA Orchestrator] — claude-sonnet-4-6 (extended thinking: on)
       ↓
  ┌────────────────────────────────────────────┐
  │  Parallel Sub-Agent Tasks (Tool Calls)     │
  │                                            │
  │  Agent A: Fundamental Research             │
  │   → SEC/BSE filings, earnings, valuation   │
  │                                            │
  │  Agent B: Technical Research               │
  │   → Price history, regime, score signals   │
  │   → Uses InsightAlpha's own engine output  │
  │                                            │
  │  Agent C: Macro & Sector Intelligence      │
  │   → Regime context, cross-sector signals   │
  │   → Fed / RBI / macro indicator feeds      │
  │                                            │
  │  Agent D: Sentiment & News Intelligence    │
  │   → Web search, news aggregation           │
  │   → Reddit/Twitter/Earnings call tone      │
  │                                            │
  │  Agent E: Competitive Landscape            │
  │   → Peer comparison, sector rank           │
  │   → InsightAlpha Compare engine output     │
  └────────────────────────────────────────────┘
       ↓
[TYRA Synthesis Layer] — claude-sonnet-4-6
  Combines all agent outputs into final report
       ↓
[InsightAlpha Fact-Check Gate]
  Validates claims against known engine data
       ↓
Final Research Document (Markdown + structured JSON)
```

**Research Document Structure (Output):**
1. **Executive Summary** — 150-word TL;DR with conviction score
2. **Fundamental Deep Dive** — valuation, earnings quality, balance sheet health
3. **Technical Regime Analysis** — Lyra engine score interpretation, momentum, trend
4. **Macro Sensitivity Map** — which macro factors drive this asset most
5. **Sector Positioning** — where this asset sits in its sector's cycle
6. **Sentiment Pulse** — news tone, search interest, social signal
7. **Risk Matrix** — 5 specific risk factors with probability tags
8. **Bull / Bear / Base Case** — three-scenario framework with catalysts
9. **Action Framework** — not financial advice, but decision-tree framing
10. **Citations** — all sources with timestamps

**Key new files:**
- `src/lib/ai/tyra/orchestrator.ts` — TYRA multi-agent orchestration engine
- `src/lib/ai/tyra/agents/fundamental.ts` — fundamental research sub-agent
- `src/lib/ai/tyra/agents/technical.ts` — technical/score research sub-agent
- `src/lib/ai/tyra/agents/macro.ts` — macro/sector research sub-agent
- `src/lib/ai/tyra/agents/sentiment.ts` — sentiment/news research sub-agent
- `src/lib/ai/tyra/agents/competitive.ts` — competitive landscape sub-agent
- `src/lib/ai/tyra/synthesizer.ts` — final synthesis and fact-check layer
- `src/lib/ai/tyra/config.ts` — Claude model config, token budgets, tool definitions
- `src/app/api/tyra/research/route.ts` — research job submission endpoint
- `src/app/api/tyra/status/[jobId]/route.ts` — async job status polling endpoint
- `src/app/dashboard/tyra/page.tsx` — TYRA research workspace UI
- `src/app/dashboard/tyra/[reportId]/page.tsx` — rendered research report view
- `src/components/dashboard/tyra/research-builder.tsx` — research brief composer
- `src/components/dashboard/tyra/report-viewer.tsx` — structured report renderer

**Research Job lifecycle:**
```
SUBMITTED → QUEUED → RESEARCHING → SYNTHESIZING → FACT_CHECKING → COMPLETE | FAILED
```

**Prisma model:**
```prisma
model TyraResearchJob {
  id           String      @id @default(cuid())
  userId       String
  assetSymbols String[]
  sectors      String[]
  brief        String      @db.Text
  status       ResearchJobStatus
  result       Json?
  creditsUsed  Int
  createdAt    DateTime    @default(now())
  completedAt  DateTime?
  region       String
}
enum ResearchJobStatus {
  SUBMITTED QUEUED RESEARCHING SYNTHESIZING FACT_CHECKING COMPLETE FAILED
}
```

**Credit cost:** 50 credits per TYRA research job (reflects real compute and API cost)
**Tier gate:** Elite + Enterprise only

**TYRA vs. Lyra — Positioning:**

| | Lyra | TYRA |
|---|---|---|
| **Speed** | Real-time (2–5s) | Async (15–60 min) |
| **Depth** | Conversational analysis | Institutional research document |
| **Model** | GPT-5.4 (Azure) | Claude Sonnet 4.6 (Anthropic) |
| **Output** | Streaming text | Structured multi-section report |
| **Use case** | Quick Q&A, regime check | Deep pre-investment research |
| **Memory** | Session conversation | Saved permanent research library |

---

### 2.2 REPORT-ENGINE Phase 2 — Weekly & Monthly Reports

**Weekly Report (Monday pre-market):**
- 7-day recap of tracked sectors + portfolio regime drift
- Top 3 opportunities surfaced from Discovery 2.0 engine
- Macro regime check for the week ahead
- Generated by Lyra-full with `reportMode: 'weekly'` system variant
- Estimated generation time: 45–90s (background job)

**Monthly Report (First Monday of month):**
- Full portfolio performance attribution — which holdings drove P&L
- 30-day sector rotation map
- Lyra's qualitative assessment of the month's macro narrative
- Forward 30-day watch list with regime signals
- Downloadable PDF export (Elite+)
- Generated by TYRA synthesis layer (first non-research TYRA use case)
- Estimated generation time: 5–15 min (background)

**Report Personalization Engine:**
- User-configurable report sections (toggle on/off per section)
- Report delivery preference (push / email / in-app only)
- Time zone-aware delivery scheduling

---

### 2.3 Portfolio AI Co-Pilot (Phase 1)

An always-on background intelligence layer watching the user's portfolio:
- **Regime Mismatch Alerts** — fires when >30% of portfolio holdings are misaligned with current macro regime
- **Concentration Risk Monitor** — alerts when single-asset or single-sector exposure exceeds configurable thresholds
- **Correlation Spike Detector** — detects when inter-asset correlation in the portfolio spikes (tail-risk signal)
- **Rebalance Trigger Framing** — non-prescriptive "your portfolio has drifted X% from your stated allocation" framing
- Each insight delivered as a Lyra-narrated card on the portfolio surface and as a push notification

---

### 2.4 LYRA Voice Fintech Consultant

**Vision:** A voice-enabled AI consultant interface that allows users to interact with Lyra hands-free for portfolio and market analysis. Designed for mobile and desktop accessibility, enabling users to get intelligence while multitasking or during commutes.

**Key Capabilities:**
- **Voice Input:** Speech-to-text integration for natural language queries
- **Audio Output:** Text-to-speech for hands-free consumption of analysis
- **Portfolio Briefings:** Voice-activated morning portfolio summaries and market updates
- **Quick Queries:** Ask about specific assets, portfolio health, or market regimes without typing
- **Mobile-First Design:** Optimized for smartphone use with clear audio in noisy environments

**Architecture:**
- Voice capture via browser/device native APIs
- STT (Speech-to-Text) processing pipeline
- TTS (Text-to-Speech) rendering for responses
- Lyra orchestration layer adapted for voice verbosity (concise, audio-optimized outputs)
- Session management for voice-driven conversation flow

**Tier gate:** Elite + Enterprise

**Metrics for success:**
- Voice query completion rate ≥ 70%
- Average session duration ≥ 3 minutes
- User satisfaction score ≥ 4.0/5 for voice experience
- Mobile adoption rate ≥ 25% of Elite users

---

## Phase 3 — Q3 2026 (October → December)
### Theme: **Discovery 2.0 + Intelligence Leap**

---

### 3.1 DISCOVERY-2 — Next-Generation Asset & Sector Discovery

**Vision:** Transform the Discovery feed from a score-ranked list into a full **multi-signal, multi-asset-class intelligence radar** with interactive filtering, thematic clustering, and AI-narrated discovery narratives.

**3.1.1 Universal Asset Discovery (Crypto + Commodities + FX + ETFs)**

Current discovery covers equities and sectors. Expand to:
- **Crypto:** Top 200 assets by market cap. DRS (Discovery Relevance Score) adapted for volatility-regime awareness. Regime tagging: Bull / Bear / Accumulation / Distribution
- **Commodities:** Gold, Silver, Oil, NatGas, Copper, Wheat, Corn. Macro-driver overlays (inflation, geopolitics, supply chains)
- **FX / Currency Pairs:** Major + EM pairs. Carry trade signals, central bank regime context
- **ETFs:** Sector ETFs, thematic ETFs, leveraged instruments. Underlying exposure map overlaid on existing sector engine
- **Indian Market Expansion:** Full BSE 500 coverage, Nifty sector indices, Indian sectoral ETFs, SGBs (Sovereign Gold Bonds)

**3.1.2 Thematic Intelligence Clusters**

AI-curated investment themes that cut across asset classes:
- Examples: "AI Infrastructure Buildout", "Energy Transition", "India Domestic Consumption", "Deglobalization Plays", "Defensive Value in Rate Plateau"
- Each theme has: constituent assets, regime alignment score, Lyra-narrated 200-word thesis, historical performance context
- New themes surface dynamically via weekly TYRA analysis pass

**3.1.3 Trend Radar**

Real-time emerging trend detection across:
- Web search volume spikes for asset/sector terms
- Earnings revision momentum
- Institutional flow signals (SEC 13F aggregation for US, bulk deals for India)
- Social sentiment velocity
- Macro event calendar overlay (Fed meetings, earnings dates, central bank decisions)

Rendered as: interactive heatmap grid on `/dashboard/discovery` with drill-down to Lyra analysis

**3.1.4 Discovery Personalization**

- User-defined universe filters (only show me: India equities + Gold + Tech ETFs)
- Saved discovery views / screeners
- Comparison of current discovery snapshot vs. 1-week / 1-month prior

---

### 3.2 INTEL-LEAP — Platform Intelligence Upgrades

**3.2.1 Lyra Memory 2.0 — Long-Term User Intelligence**

Current Lyra session memory is scoped to the active conversation. Extend to:
- **Persistent Investment Profile** — Lyra remembers: your stated risk tolerance, preferred sectors, past analysis focus, key decisions discussed, and portfolio context across sessions
- **Longitudinal Context Injection** — automatically surfaces relevant past Lyra conversations when the same asset / theme comes up again
- **Memory Manager UI** — `/dashboard/preferences/lyra-memory` — users can view, edit, and delete stored memory fragments

**3.2.2 Real-Time Market Regime Dashboard**

A dedicated macro intelligence surface showing:
- Current global macro regime classification (Risk-On / Risk-Off / Stagflationary / Deflationary)
- 8 key macro signal pillars with live state: Rates, Credit Spreads, USD, Oil, VIX, Earnings Momentum, Breadth, Global PMI
- How each pillar maps to asset class implications
- Lyra's narrative regime interpretation (refreshed daily)
- Regime timeline — 12-month visual history of regime transitions

**3.2.3 Institutional Signal Layer**

Aggregate and surface institutional-grade signals:
- **Options Flow** — unusual options activity (US equities and ETFs), with Lyra interpretation
- **Dark Pool / Block Prints** — large off-exchange trades as accumulation/distribution signal
- **Short Interest Tracker** — days-to-cover, short squeeze setup detection
- **Earnings Quality Score** — accruals ratio, cash flow conversion, revenue quality index
- **Insider Transaction Monitor** — SEC Form 4 filings aggregated per asset

**3.2.4 Scenario Planning Studio**

Extend the existing Shock Simulator into a full scenario planning workspace:
- Multi-scenario builder: define up to 5 parallel scenarios with different macro assumptions
- Side-by-side portfolio impact simulation
- TYRA-generated scenario narrative with historical analogue sourcing
- Shareable scenario reports for team/enterprise workflows
- Saved scenario library per user

**3.2.5 Smart Watchlist 2.0**

Upgrade the current watchlist into an active intelligence layer:
- **Catalyst Calendar** — earnings dates, dividend ex-dates, central bank dates, index rebalance dates — all mapped to watched assets
- **Price Target Tracker** — user-defined price targets with regime-aware distance calculation
- **Thesis Tracker** — attach a Lyra conversation or TYRA report as the "investment thesis" for a watchlist item
- **Watchlist Digest** — weekly AI summary of all watchlist items: what changed, what matters

---

## Phase 4 — Q4 2026 / Q1 2027 (January → March 2027)
### Theme: **Platform Maturity + Enterprise + Social Layer**

---

### 4.1 Collaborative Research & Social Intelligence Layer

**Vision:** Enable teams and communities to share, discuss, and build on each other's research — without becoming a social network noise machine.

- **Research Sharing:** TYRA reports and Lyra conversations can be published as shareable links (anonymized or attributed)
- **Team Workspaces (Enterprise):** Shared research library, shared watchlists, team-level briefings, role-based access (Analyst / Portfolio Manager / Observer)
- **Insight Feed (Optional Public Layer):** Curated public TYRA research notes from opted-in users, ranked by quality score (not likes) — anti-noise algorithm
- **Expert Analyst Network:** Verified analysts can publish research on InsightAlpha AI; users can follow analysts whose research they respect

---

### 4.2 InsightAlpha API + Developer Platform

Open InsightAlpha's intelligence layer to third-party builders:
- **Public REST API:** Asset scores, regime classifications, sector DRS, price data, portfolio health
- **Webhook Subscriptions:** Asset regime flip, score velocity threshold, DRS burst events
- **TYRA API Access:** Programmatic research job submission and retrieval
- **SDK (TypeScript/Python):** Official client libraries
- **Rate limits and API plans:** Developer (free tier), Builder ($99/mo), Enterprise (custom)
- Use case unlock: algo trading systems, custom dashboards, Bloomberg Terminal overlays, research firm integrations

---

### 4.3 Mobile-First Experience (iOS + Android)

Current product is web-first with PWA capabilities. Phase 4 ships native mobile:
- **React Native** app targeting iOS 17+ and Android 13+
- Full Lyra report and analysis experience as a first-class mobile feature
- Portfolio health glanceable widget (iOS WidgetKit / Android App Widget)
- Push notification center with deep-links into specific dashboard surfaces
- Biometric auth (Face ID / Fingerprint) with Clerk session handoff
- Offline mode: last-cached portfolio snapshot and Lyra briefing readable offline

---

### 4.4 Advanced Portfolio Intelligence (Phase 2)

**Factor Attribution Engine:**
- Decompose portfolio returns into: Market Beta, Sector Rotation, Momentum, Quality, Value, Size
- Per-holding factor exposure heatmap
- Factor drift monitor — alerts when portfolio's factor tilt shifts

**Tax-Loss Harvesting Intelligence (US):**
- Identify unrealized losses eligible for tax-loss harvesting
- Cross-asset wash-sale rule guidance
- Lyra narrates tax-optimization framing (informational, not advice)

**Goal-Based Portfolio Framing:**
- User defines goals: "Retire at 55", "Buy house in 5 years", "Protect wealth"
- Portfolio health score re-framed against goal horizon and required return
- Monte Carlo extended to include goal-probability distribution

**Multi-Account Aggregation:**
- Connect multiple brokers (Zerodha + Upstox + Fidelity + Schwab)
- Unified consolidated portfolio view across all accounts
- Cross-account deduplication and true exposure calculation

---

### 4.5 Myra 2.0 — Proactive Support Intelligence

Upgrade Myra from reactive support to a proactive product intelligence layer:
- **Proactive Onboarding Coach:** Myra monitors user behavior and surfaces feature discovery nudges ("You haven't tried Compare Assets yet — here's how it works with your watchlist")
- **Usage Anomaly Detection:** Myra detects if a user is stuck (e.g., multiple failed searches) and proactively offers help
- **Credit Burn Advisor:** Alerts when user is on pace to exhaust monthly credits early, suggests usage optimization
- **Plan Upgrade Framing:** Myra identifies moments when a user would clearly benefit from upgrading and presents non-pushy contextual upgrade prompts
- **Knowledge Base 2.0:** Myra backed by a vector-embedded product documentation store (Pinecone) rather than hardcoded knowledge — always accurate, always up to date

---

## Additional High-Conviction Feature Bets

These features are not yet phased but represent the highest-ROI opportunities identified through competitive analysis:

### A. AlphaScore Explainability Layer
Every score (DRS, Trend, Momentum, Quality) gets a natural-language explainability card:
- "Your DRS of 78 is driven primarily by: Earnings revision momentum (+22 pts), Relative strength vs. sector (+18 pts), Regime alignment (+15 pts)"
- Removes score opacity, builds user trust, increases engagement
- Lyra generates these dynamically using the engine's sub-component data

### B. Earnings Intelligence Center
A dedicated surface around earnings events:
- Pre-earnings: historical beat/miss record, implied move from options, analyst estimate vs. InsightAlpha quality score
- Earnings day: live score recalculation as numbers drop, Lyra instant analysis within 5 minutes of report
- Post-earnings: guidance revision impact on sector peers

### C. Macro Calendar Intelligence
An AI-enriched economic calendar:
- Fed / RBI / ECB / BoJ meeting dates with Lyra's pre-meeting regime positioning brief
- CPI, NFP, GDP release dates with historical asset reaction maps
- Upcoming IPOs / FPOs with fundamental quality pre-screening
- Earnings season heat — which sector is most earnings-dense this week

### D. Portfolio Stress-Testing Expansion
Extend Shock Simulator scenarios beyond current library:
- AI-generated novel scenarios (TYRA creates historically-grounded new shock scenarios quarterly)
- Custom user-defined scenario parameters
- Sector-level stress test (stress the entire portfolio's energy exposure independently)
- Monte Carlo tail-risk extension: CVaR (Conditional Value at Risk) reporting

### E. Lyra Knowledge Graph
Build a persistent cross-session knowledge graph where Lyra tracks:
- Relationships between assets the user has analyzed (same sector, correlated, inverse)
- Macro factor sensitivities learned per user's portfolio
- A visual "research map" showing all analyzed assets, their connections, and the themes that link them
- Nodes can be opened to show the Lyra conversation history for that asset

### F. Institutional Research Digest Integration
Aggregate and summarize publicly available institutional research:
- Goldman Sachs, Morgan Stanley, JPMorgan public research summaries
- Automatically cross-referenced with InsightAlpha's own score signals
- "Research Consensus" tag: when multiple institutional views align with InsightAlpha score signal

### G. AI-Powered Screener Builder
Replace current discovery filters with a natural language screener:
- User types: "Show me Indian mid-caps with rising momentum, strong quality score, and positive earnings revisions in the last 30 days"
- TYRA translates to engine query parameters and executes
- Results saved as a named screener
- Screeners can be scheduled to re-run weekly and alert on new entries/exits

### H. InsightAlpha Academy
Embedded educational layer integrated into the product:
- Lyra teaches concepts in context: when a user asks "what is a DRS?", Lyra teaches it AND shows the user's own assets sorted by DRS
- Short interactive modules (5-minute reads) covering: regime investing, momentum, quality factors, portfolio construction
- Progress tracking, completion badges
- Academy completion unlocks bonus monthly credits (gamification + retention)

### I. Real-Time Broker Data Sync
Move from manual portfolio import to live broker streaming:
- Zerodha Kite Connect websocket for real-time Indian portfolio prices
- Alpaca / Interactive Brokers streaming for US portfolios
- Portfolio health score re-calculates on live price events (not just on manual refresh)
- Real-time P&L ticker on the portfolio surface

### J. Multi-Language Support (Hinglish + Regional)
India-first localization strategy:
- Lyra responds in Hinglish (Hindi + English mixed) when user's language preference is set
- UI labels in Hindi, Marathi, Tamil, Telugu for key surfaces
- Number formatting: Indian system (lakhs, crores) vs. international system (millions, billions) — already partially supported, extend to all surfaces
- India-specific content: BSE/NSE-first discovery, Indian macro regime framing, RBI policy context

---

## ✅ Shipped Foundation (March 2026) — AI Runtime Hardening

The following items were completed as pre-roadmap infrastructure hardening before Q1 2026 feature work begins:

| Item | Status | Description |
|------|--------|-------------|
| **COST-4** | ✅ Shipped Mar 2026 | Removed dead `router`/`draft_verify` orchestration code. `OrchestrationMode` type and `orchestrationMode` field deleted from `config.ts`. All plans confirmed `single`. |
| **COST-1** | ✅ Shipped Mar 2026 | LLM nano fallback — primary model failure degrades to `lyra-nano` at 1200-token budget automatically before surfacing any error to users. |
| **SEC-1** | ✅ Shipped Mar 2026 | Post-retrieval injection scan — every RAG chunk filtered against `INJECTION_PATTERNS` before reaching the LLM. Poisoned knowledge-base entries silently dropped. |
| **RAG-1** | ✅ Shipped Mar 2026 | Low-grounding confidence warning — avg chunk similarity < 0.45 on MODERATE/COMPLEX emits a structured `warn` log flagging potential confabulation risk. |
| **OBS-1** | ✅ Shipped Mar 2026 | `alerting.ts` — 5-channel proactive alerting with Redis sliding windows and Slack/Discord webhook delivery (daily cost, fallback rate, RAG zero-result rate, output validation failures, web search outage). |
| **COST-3** | ✅ Shipped Mar 2026 | Admin AI Limits UI at `/admin/ai-limits` — hot-patch daily token caps and alert thresholds via Redis without a code deploy. |

---

## Milestones & Success Metrics

| Quarter | Key Milestones | Success Metrics |
|---------|---------------|-----------------|
| **Q1 2026** | Lyra beta expansion (Elite), Daily Reports live (PRO+) | Lyra activation rate ≥ 15% Elite users; Report open rate ≥ 45% |
| **Q2 2026** | TYRA GA (Elite), Weekly Reports live, Portfolio Co-Pilot | TYRA job submission ≥ 500/week; Report engagement ≥ 60%; Co-Pilot alert click-through ≥ 25% |
| **Q3 2026** | Discovery 2.0 (all plans), Crypto/Commodity coverage, Real-Time Regime Dashboard | Discovery DAU lift ≥ 40%; Multi-asset coverage activation ≥ 30% users |
| **Q4 2026** | Mobile app launch, Team Workspaces (Enterprise), API beta | Mobile DAU ≥ 25% total sessions; Enterprise ACV uplift ≥ 2×; API developer signups ≥ 200 |

---

## Technology Dependencies

| Feature | New Dependency | Risk Level |
|---------|---------------|------------|
| Lyra beta chat streaming | Azure OpenAI Responses API | Low — same Azure tenant |
| Lyra response rendering | Azure streaming responses | Low — same Azure tenant |
| TYRA Agent | Anthropic Claude Sonnet 4.6 | Medium — new vendor, API stability |
| TYRA Extended Thinking | Claude `extended_thinking: on` | Medium — higher latency, cost |
| Real-Time Broker Sync | Zerodha Kite Connect, Alpaca | High — partner agreements required |
| Options Flow Data | Market data vendor (e.g., Unusual Whales API) | Medium — licensing required |
| SEC 13F Aggregation | SEC EDGAR API | Low — public API |
| Institutional Research | Research vendor API | High — licensing required |
| Mobile App | React Native, Expo | Medium — new build pipeline |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Claude API rate limits on TYRA under load | Medium | High | Job queue with backpressure, per-user job throttling |
| Report delivery latency exceeds UX threshold on mobile | Medium | High | Sentence-level streaming, progressive delivery, push-first UX |
| TYRA research accuracy / hallucinations | High | High | Fact-check gate against InsightAlpha engine data, citation requirement |
| Regulatory risk on financial information | Low | Critical | All outputs tagged as informational, not advice; legal review before launch |
| Data licensing for options/institutional flow | High | Medium | Phased rollout, start with free/public sources |
| Multi-agent orchestration cost blowout | Medium | High | Per-job credit cost (50 credits), hard token ceilings per agent |

---

## Documentation & Maintenance Rule

When any feature in this roadmap ships:
1. Update `CODEBASE.md` with new file locations and architecture patterns
2. Update `LYRA-MYRA.md` if Lyra or Myra behavior changes
3. Update `TieredPlans.md` if plan gating or credit costs change
4. Update `YELLOWPAPER.md` if new AI models or orchestration patterns are added
5. Update `WHITEPAPER.md` if product positioning or feature set changes materially
6. Mark completed milestones in this document with ✅ and completion date

---

*Last updated: March 2026 | Version: 1.0 | Owner: InsightAlpha AI Product & Engineering*
