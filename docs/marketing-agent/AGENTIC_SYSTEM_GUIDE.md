# AMI 2.0 — Agentic System Guide
## Autonomous Marketing Intelligence Platform

**Version 4.0 — March 2026**
**Classification: Internal Engineering & Operations Reference**

---

## 1. Platform Overview

AMI 2.0 is a fully autonomous, multi-tier AI marketing and sales engine built on **Convex** (serverless backend + real-time database) and **Next.js 14** (App Router). It orchestrates 15 specialized AI agents that continuously generate, audit, and route content — all without direct publishing rights.

### Core Philosophy

- **Data First, Narrative Second** — No marketing claim is made without an underlying DSE Score or MRDE state grounding it.
- **Zero Hallucination** — Every agent has access to the dual-table RAG knowledge base (whitepapers + marketing memory) via `searchBrandMemory`. Technical claims are always cited.
- **Human-in-the-Loop by Default** — All generated content enters a `pending_approval` queue. No agent can publish directly to any external channel.
- **Cognitive Tiering** — Agents are assigned models based on task complexity: reasoning-heavy tasks (auditing, orchestration) use `gpt-5.4`; high-velocity content tasks use `gpt-5.4-mini`; lightweight distribution tasks use `gpt-5.4-nano`.

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), TailwindCSS, shadcn/ui, Lucide icons | 22 routes, SSR + client streaming |
| **Backend / Realtime** | Convex (BaaS) | All DB, actions, queries, mutations, crons, websockets |
| **Agent Framework** | `@convex-dev/agent` | Wraps AI SDK v3 interface |
| **LLM Provider** | Azure AI Foundry (Azure OpenAI) | Direct REST via custom provider shim |
| **LLM Models** | `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano` | All served through Azure deployment endpoints |
| **Image Generation** | Google Gemini `gemini-3.1-flash-image-preview` (Direct Google AI SDK) | Prompt enhancement via `gpt-5.4-mini` |
| **Embeddings** | Azure `text-embedding-3-large` (3072d brand / 1536d marketing) | Dual-search RAG strategy via Azure OpenAI |
| **Auth** | Convex native auth (`@convex-dev/auth`) | Password provider, admin allowlist, JWT-based, middleware + client guard |
| **External DB** | Supabase | Source of truth for users, subscriptions, MRDE, AIRequestLog |
| **Email** | Brevo | Drip sequences managed by Email Marketing Specialist agent |

### Environment Variables

#### Next.js / Frontend (`.env`)
```bash
NEXT_PUBLIC_CONVEX_URL          # Convex deployment URL
NEXT_PUBLIC_CONVEX_SITE_URL     # Convex site URL (for auth HTTP routes)
AZURE_OPENAI_ENDPOINT           # Azure AI Foundry deployment URL
AZURE_OPENAI_API_KEY            # Azure API key
GOOGLE_API_KEY                  # Google AI Studio key (image generation)
SUPABASE_WEBHOOK_SECRET         # Shared secret for Supabase → Convex webhooks
CORE_ENGINE_WEBHOOK_SECRET      # Shared secret for MRDE engine → Convex webhooks
```

#### Convex Deployment Environment Variables (set via `npx convex env set`)
```bash
JWT_PRIVATE_KEY     # RS256 private key (PEM, spaces not newlines) — signs auth JWTs
JWKS                # Matching public key set (JSON) — verifies auth JWTs
SITE_URL            # Base URL (e.g. http://localhost:3001) — used for OAuth/magic links
CONVEX_SITE_URL     # Auto-set by Convex — auth.config.ts domain
```

---

## 3. Authentication System

AMI 2.0 uses **Convex native auth** (`@convex-dev/auth`) with a password provider restricted to a hardcoded admin allowlist. Clerk was replaced in v4.0.

### Architecture

```
Browser (Next.js)
    ↓
middleware.ts  ←  convexAuthNextjsMiddleware (server-side cookie check)
    ↓ (redirect to /login if unauthenticated)
app/layout.tsx → <AuthGuard> (client-side fallback via Convex hooks)
    ↓
ConvexClientProvider → <ConvexAuthProvider> (localStorage token storage)
    ↓
convex/auth.ts → Password provider with ADMIN_ALLOWLIST
```

### Key Files

| File | Role |
|---|---|
| `convex/auth.ts` | Defines `convexAuth()` with Password provider + admin allowlist |
| `convex/auth.config.ts` | Provider domain config (`CONVEX_SITE_URL`) for JWT verification |
| `convex/http.ts` | Registers auth HTTP routes via `auth.addHttpRoutes(http)` |
| `convex/schema.ts` | Includes `...authTables` from `@convex-dev/auth/server` |
| `middleware.ts` | Server-side redirect for unauthenticated users |
| `components/AuthGuard.tsx` | Client-side fallback using `<Authenticated>` / `<Unauthenticated>` |
| `components/ConvexClientProvider.tsx` | Wraps app in `<ConvexAuthProvider>` |
| `app/login/page.tsx` | Sign-in and sign-up (first-time password creation) UI |

### Admin Allowlist

```typescript
// convex/auth.ts
const ADMIN_ALLOWLIST = new Set([
  "ankit@fusionwaveai.com",
  "eb.ankit.exp@gmail.com",
]);
```

Any email not in this set throws during the `profile()` callback, blocking sign-in and sign-up. Emails are normalized to lowercase before comparison.

### Public Routes

The following routes bypass authentication in both `middleware.ts` and `AuthGuard.tsx`:

- `/login` — sign-in / sign-up page
- `/briefing/*` — public shareable insight cards
- `/join/*` — referral invite landing pages
- `/api/og/*` — Open Graph image generation

### Key Setup Requirements

`@convex-dev/auth` requires these Convex env vars to be set via the dashboard or CLI:

```bash
# Generate with jose (RS256):
node --input-type=module -e "
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';
const keys = await generateKeyPair('RS256', { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
console.log('JWT_PRIVATE_KEY:', privateKey.trimEnd().replace(/\n/g, ' '));
console.log('JWKS:', JSON.stringify({ keys: [{ use: 'sig', ...publicKey }] }));
"

# Set via CLI (pipe to avoid shell escaping issues with PEM headers):
echo '<key>' | npx convex env set JWT_PRIVATE_KEY
echo '<jwks>' | npx convex env set JWKS
npx convex env set SITE_URL http://localhost:3001
```

---

## 4. Application Routes

| Route | Auth | Description |
|---|---|---|
| `/` | ✅ Required | Dashboard — agent telemetry, market regime, KPIs |
| `/chat` | ✅ Required | CMO Agent Chat — dispatch natural-language instructions |
| `/agents` | ✅ Required | Agent Command Center — status, run history, controls |
| `/campaigns` | ✅ Required | Campaign War Room — HITL content approval queue |
| `/workflows` | ✅ Required | Sequencer Studio — workflow builder and execution |
| `/analytics` | ✅ Required | Performance Intelligence Dashboard |
| `/abm` | ✅ Required | ABM Intelligence — account-based targeting |
| `/b2b` | ✅ Required | B2B Intel — LinkedIn discovery and outreach |
| `/sales` | ✅ Required | Sales Coach — PQL alerts, deal intelligence |
| `/social` | ✅ Required | Social Command — approval queue and publish logs |
| `/growth` | ✅ Required | Growth Hub — Reddit monitor, referrals, feedback |
| `/competitors` | ✅ Required | Competitor Radar — weekly intel reports |
| `/knowledge` | ✅ Required | Knowledge Base — RAG document management |
| `/connections` | ✅ Required | Connections — social and website integrations |
| `/prompts` | ✅ Required | Prompt Assembler — agent instruction builder |
| `/governance` | ✅ Required | Governance — autonomy settings, kill switch |
| `/settings` | ✅ Required | System Settings — brand kit, security, config |
| `/creative` | ✅ Required | Creative Studio — Gemini image generation |
| `/launch` | ✅ Required | Launch Blueprint — 5-phase campaign launch |
| `/success` | ✅ Required | Success Engine — health scores, churn alerts |
| `/briefing/[slug]` | 🌐 Public | Shareable insight cards with referral tracking |
| `/join/[code]` | 🌐 Public | Referral invite landing page |
| `/login` | 🌐 Public | Admin sign-in / first-time password creation |

---

## 5. Agent Roster

All agents are instances of the `Agent` class from `@convex-dev/agent`, instantiated in `convex/agents/instances.ts`. Each agent has a fixed `name`, `languageModel`, `instructions`, and `tools` scope.

### Tier 1 — Strategic Command (`gpt-5.4`, reasoning: `high` or `medium`)

| Agent | Name String | Reasoning Effort | Tools | Role |
|---|---|---|---|---|
| `cmoOrchestrator` | `CMO Orchestrator` | `medium` | `searchBrandMemory`, `updateStatus` | Orchestrates campaigns using the Zero Hallucination DSE framework. Owns the 5-Phase Launch and weekly content cycle. |
| `brandGuardian` | `Brand Guardian` | `high` | `searchBrandMemory`, `updateStatus` | Enforces Lyra's "Data First" voice. Runs the 7-Sweep Copy Editing audit on all content before approval. |
| `growthStrategist` | `Growth Strategist` | `medium` | `searchBrandMemory`, `updateStatus` | PLG experiments, CRO, and conversion bottleneck analysis using Hicks's Law and Prospect Theory. |

### Tier 2 — Content Factory (`gpt-5.4-mini`, reasoning: `low`)

| Agent | Name String | Tools | Role |
|---|---|---|---|
| `longFormWriter` | `Long-Form Writer` | `searchBrandMemory`, `auditContent`, `updateStatus` | Deep-dive technical articles, case studies, whitepapers. Uses RAG for exact DSE/ARCS formula retrieval. |
| `socialMediaWriter` | `Social Media Writer` | `searchBrandMemory`, `auditContent`, `updateStatus` | High-engagement Twitter/X and LinkedIn posts. Hook frameworks: Question, Number, Contrast. |
| `seoEngine` | `SEO Engine` | `searchBrandMemory`, `auditContent`, `updateStatus` | Programmatic SEO templates, GEO keyword optimization for AI search engines (Perplexity, ChatGPT). |
| `contentRepurposer` | `Content Repurposer` | `searchBrandMemory`, `auditContent`, `updateStatus` | Distills long-form reports into LinkedIn Carousels and Twitter threads using the ACCA framework. |

### Tier 3 — Always-On Engagement (`gpt-5.4-mini` / `gpt-5.4`)

| Agent | Model | Name String | Tools | Role |
|---|---|---|---|---|
| `socialCommunityManager` | `gpt-5.4-mini` | `Social Community Manager` | `searchBrandMemory`, `auditContent`, `updateStatus` | Technically sharp community replies and engagement. |
| `inboundSdr` | `gpt-5.4-mini` | `Inbound SDR` | `searchBrandMemory`, `updateStatus` | Consultative outreach to Product-Qualified Leads (PQLs) based on usage milestones. |
| `customerSuccess` | `gpt-5.4` | `Customer Success Agent` | `searchBrandMemory`, `updateStatus` | Churn risk mitigation and onboarding using "Value Check-In" frameworks. Reasoning: `high`. |
| `linkedinDiscovery` | `gpt-5.4-mini` | `LinkedIn Discovery Agent` | `searchBrandMemory`, `searchLinkedInSimulated`, `updateStatus` | ICP-based lead filtering from LinkedIn signals. Falls back to `searchLinkedInSimulated` when live scraper is inactive. |
| `linkedinOutreachAgent` | `gpt-5.4` | `LinkedIn Outreach Agent` | `searchBrandMemory`, `updateStatus` | Personalized DMs and contextual replies for B2B leads. Reasoning: `high`. |

### Tier 4 — Intelligence & Analytics (`gpt-5.4-mini` / `gpt-5.4`)

| Agent | Model | Name String | Reasoning Effort | Tools | Role |
|---|---|---|---|---|---|
| `performanceAnalyst` | `gpt-5.4-mini` | `Performance Analyst` | `low` | `searchBrandMemory`, `updateStatus` | Quant-style funnel analysis and A/B test evaluation correlated with DSE/ARCS models. |
| `competitorIntelligence` | `gpt-5.4` | `Competitor Intelligence` | `high` | `searchBrandMemory`, `updateStatus` | Weekly competitor scan for market movements and moat reinforcement. |

### Tier 5 — Distribution (`gpt-5.4-nano`, reasoning: `none`)

| Agent | Name String | Tools | Role |
|---|---|---|---|
| `emailMarketingSpecialist` | `Email Marketing Specialist` | `searchBrandMemory`, `auditContent`, `updateStatus` | Drip email sequences and newsletters via Brevo, timed to market close. |
| `distributionEngine` | `Distribution Engine` | `updateStatus` | Cross-channel content scheduling and platform velocity optimization. |

---

## 6. Agent Execution Engine (`convex/agents/base.ts`)

All agent invocations flow through two shared functions in `convex/agents/base.ts`:

### `executeAgentAction(ctx, agent, args)`
The primary text-generation executor. Used by all Tier 1–5 agents for prose, social posts, email drafts, and analyses.

**Execution flow:**
1. Inserts a `running` record into `agentRuns` via `startAgentRun`.
2. Resolves the agent's `reasoningEffort` from `REASONING_EFFORT_MAP`.
3. Calls `agent.generateText()` with Azure provider options (prompt caching, parallel tool calls, 24h cache retention).
4. On each step completion, patches `inputSummary` in `agentRuns` for real-time dashboard telemetry.
5. On success, patches status to `completed` with `outputSummary`.
6. On failure, patches status to `failed` with error string and re-throws.
7. All API calls are wrapped in `withRetry()` (3 attempts, exponential backoff starting at 1s).

### `executeAgentObjectAction<T>(ctx, agent, args)`
Used for structured JSON output (e.g., campaign briefs, SEO templates). Follows the same lifecycle as above but calls `agent.generateObject()` with a Zod schema.

### Reasoning Effort Map

```
Brand Guardian             → high
Competitor Intelligence    → high
Customer Success Agent     → high
Long-Form Writer           → low
Social Media Writer        → low
Content Repurposer         → low
Inbound SDR                → low
Performance Analyst        → low
LinkedIn Discovery Agent   → low
Email Marketing Specialist → none
Distribution Engine        → none
(all others)               → medium
```

---

## 7. Agent Tools (`convex/agents/tools.ts`)

| Tool | Max Iterations | Description |
|---|---|---|
| `searchBrandMemory` | Unlimited | Dual-table vector search (marketing + brand knowledge). Queries both `marketingKnowledge` (1536d) and `brandKnowledge` (3072d) tables and returns merged, relevance-ranked context. Uses 7-day `brandMemoryCache` for repeat queries. |
| `auditContent` | **3 per run** | Calls `agents/tier1:auditContent`. Hard-capped via `checkIterationLimit()` which tracks per-tool iteration counts in `agentRuns.metadata.toolIterations`. Throws a fatal error on the 4th call. |
| `updateStatus` | Unlimited | Best-effort telemetry. Patches `inputSummary` on the current `running` `agentRun` row. No-op if no active run exists. |
| `searchLinkedInSimulated` | Unlimited | Returns realistic synthetic B2B leads (fund managers, RIAs, investors) when live LinkedIn scraper is inactive. Parameterized by `sector` and `regime`. |

---

## 8. RAG — Dual-Table Knowledge Base

### Architecture

The knowledge base uses **two separate Convex vector tables** with different embedding models:

| Table | Embedding Model | Dimensions | Content |
|---|---|---|---|
| `marketingKnowledge` | `text-embedding-3-large` | **1536d** | Math formulas (DSE/ARCS), hero posts, objection-handling scripts |
| `brandKnowledge` | `text-embedding-3-large` | **3072d** | Whitepaper chunks, yellowpaper sections, competitor briefs, product updates |

Both embedding models are served through **Azure AI Foundry** using `generateAzureEmbedding()` from `convex/lib/llmClients.ts`.

### Search Flow (`searchBrandMemory`)

1. **Cache check** — normalizes query, computes `queryHash`, queries `brandMemoryCache`. Returns immediately on hit (7-day TTL).
2. **Dual vector search** — queries both tables in parallel with `vectorSearch()`.
3. **Merge and rank** — combines results, deduplicates, sorts by relevance score.
4. **Cache write** — stores formatted context string in `brandMemoryCache` for 7 days.
5. **Return** — formatted string with source labels for agent context injection.

---

## 9. Cron Schedule (`convex/crons.ts`)

| Cron | Schedule | Handler | Description |
|---|---|---|---|
| Indian Market Close | Daily 15:35 IST | `triggerIndianMarketContent` | Generates BSE/NSE-aligned content at Indian market close |
| US Market Close | Daily 16:00 ET | `triggerUSMarketContent` | Generates NYSE/NASDAQ-aligned content at US market close |
| Weekly Content Batch | Monday 06:00 UTC | `submitWeeklyContentBatch` | Full weekly content cycle submission to Azure batch |
| Competitor Scan | Weekly | `runCompetitorIntelligence` | Competitor monitoring via `internal.agents.tier4` |
| Regime Cache Refresh | Hourly | `refreshMarketRegimeCache` | Polls Supabase MRDE source of truth |
| Health Score Refresh | Every 6h | `refreshAllHealthScores` | Recomputes user health scores from Supabase events |
| PQL Engine | Every 4h | `runPqlEngine` | Detects product-qualified leads from usage signals |
| Churn Engine | Every 6h | `runChurnEngine` | Flags churn risk users and drafts recovery emails |

> **Note:** `runCompetitorIntelligence` is registered as `internal.agents.tier4` (not `api`) because it is an `internalAction`.

---

## 10. HTTP Routes (`convex/http.ts`)

| Path | Method | Handler | Description |
|---|---|---|---|
| `/api/auth/*` | ALL | `auth.addHttpRoutes(http)` | Convex Auth sign-in, sign-out, token refresh endpoints |
| `/api/webhooks/supabase` | POST | `httpAction` | Receives Supabase table change events (User, AIRequestLog, etc.) |
| `/api/webhooks/core-engine` | POST | `httpAction` | Receives MRDE regime shift events from the core AI engine |
| `/api/health` | GET | `httpAction` | Health check — returns `{ status: "ok", service, ts }` |

Auth routes are registered first via `auth.addHttpRoutes(http)` — this is **required** for `@convex-dev/auth` sign-in/sign-out to work.

---

## 11. 5-Phase Launch Framework

The `cmoOrchestrator` manages product launches through a state-controlled workflow in `triggerCampaignLaunch`.

| Phase | Audience | Content Strategy | Psychological Hook |
|---|---|---|---|
| **1. Internal** | Team only | DSE stability verification, math testing | — |
| **2. Alpha** | Whitelisted "Pioneer" users | Exclusivity-first messaging | Scarcity |
| **3. Beta** | Extended early cohort | Feedback-solicitation, product improvement framing | Loss Aversion ("Don't miss shaping the product") |
| **4. Early Access** | Waitlist | CTA density maximized | Hicks's Law (single clear action), Urgency |
| **5. Full Launch** | All channels | Omnichannel push via `runAggressiveLaunchWeek` | Social Proof + Authority |

---

## 12. Market Regime Integration (MRDE)

### Regime States

```typescript
type MarketRegime =
  | "STRONG_RISK_ON"   // Bullish — aggressive growth content
  | "RISK_ON"          // Mildly bullish — standard growth content
  | "NEUTRAL"          // Balanced — educational/informational content
  | "DEFENSIVE"        // Risk-aware — hedging narratives
  | "RISK_OFF";        // Bearish — emergency playbook triggered
```

### Regime → Content Strategy Mapping

| Regime | Content Tone | Hook Type | Agent Behaviour |
|---|---|---|---|
| `STRONG_RISK_ON` | Aggressive, opportunity-forward | Number + Urgency | Launch campaigns, outbound push |
| `RISK_ON` | Positive, data-driven | Authority + Social Proof | Standard weekly cycle |
| `NEUTRAL` | Educational, balanced | Question + Contrast | Product tutorials, case studies |
| `DEFENSIVE` | Risk-aware, responsible | Loss Aversion | Hedging narratives, portfolio protection |
| `RISK_OFF` | Crisis communication | Crisis/Urgency | Emergency playbook — defensive posts only |

### Regime Data Flow

```
Supabase (MRDE source of truth)
    ↓ (hourly poll via refreshMarketRegimeCache)
marketRegimeCache table (Convex)
    ↓ (read by cron handlers at market close)
triggerIndianMarketContent / triggerUSMarketContent
    ↓
runDailyAutonomousDrafting(marketRegime, recentEvents)
    ↓
Content agents generate regime-matched drafts
```

For critical regime changes (`RISK_OFF` / `STRESS`), the core engine pushes via webhook to `/api/webhooks/core-engine`, bypassing the hourly poll for immediate response.

---

## 13. Testing

### Playwright Test Suite

The frontend uses **Playwright** with a multi-project setup:

```
auth-setup    →  tests/auth.setup.ts       Logs in as admin, saves .auth/user.json
auth-tests    →  tests/auth.spec.ts        Auth-specific tests (fresh context per test)
chromium      →  all other *.spec.ts       All page/feature tests with saved admin session
```

### Test Files

| File | Project | Description |
|---|---|---|
| `tests/auth.setup.ts` | `auth-setup` | Authenticates admin, saves session to `.auth/user.json` |
| `tests/auth.spec.ts` | `auth-tests` | Allowlist enforcement, redirect behavior, session persistence |
| `tests/e2e.spec.ts` | `chromium` | Core navigation smoke tests |
| `tests/critical.spec.ts` | `chromium` | Dashboard data loading, dialogs, responsiveness |
| `tests/all-pages.spec.ts` | `chromium` | All 22 pages — headings, inputs, interactions |
| `tests/deep-dive.spec.ts` | `chromium` | Deep UI tests — campaigns, connections, knowledge, settings |
| `tests/creative.spec.ts` | `chromium` | Creative Studio — Gemini image workflow |

### Running Tests

```bash
# Step 1: Ensure dev server is running on port 3001
# Step 2: Run full suite
npx playwright test

# Run specific projects
npx playwright test --project=auth-setup    # Login + save session
npx playwright test --project=auth-tests    # Auth gating tests
npx playwright test --project=chromium      # All other tests
```

### Auth Test Coverage (`auth.spec.ts`)

- Unauthenticated redirect to `/login` for protected routes (`/`, `/agents`, `/campaigns`, `/settings`)
- Login page UI — sign-in form by default, toggle to sign-up
- Allowlist enforcement — non-admin email rejected on sign-in and sign-up
- Successful admin sign-in with session persistence
- Case-insensitive email handling

### Session Storage

Playwright session state is saved to `.auth/user.json` (gitignored). The `auth-setup` project runs first and all other projects depend on it.

---

## 14. Key Internal API Reference

### Queries

| Function | File | Description |
|---|---|---|
| `getAgentStatuses` | `agents/queries.ts` | Latest status per agent from `agentRuns` (last 100 runs). Returns `{ agentName, id, name, status, lastActive, latency_ms }`. |
| `getRecentRuns` | `agents/queries.ts` | Last N `agentRuns` records ordered desc. |
| `getLatestActiveRun` | `agents/queries.ts` | Single latest `running` run (used by `checkIterationLimit`). Uses `by_status` index. |
| `getLatestRun` | `agents/queries.ts` | Latest run for a specific agent by name. Uses `by_agent` index. |
| `getDocuments` | `agents/knowledge.ts` | Merged list of `marketingKnowledge` + `brandKnowledge` docs for the Knowledge Base UI. |
| `search` | `agents/knowledge.ts` | Public dual-table vector search (for Knowledge page semantic search UI). |
| `getWorkflows` | `agents/workflows.ts` | Static workflow registry for the Workflows UI. |
| `getWorkflowMetrics` | `agents/workflows.ts` | Execution stats derived from `agentRuns`. |
| `getExecutions` | `agents/workflows.ts` | Last 20 `agentRuns` formatted as workflow executions. |

### Mutations

| Function | File | Description |
|---|---|---|
| `startAgentRun` | `agents/mutations.ts` | Inserts a new `running` `agentRun` record. Returns `runId`. |
| `finishAgentRun` | `agents/mutations.ts` | Patches `agentRun` to `completed` or `failed` with output/error. |
| `updateActiveAgentStatus` | `agents/mutations.ts` | Patches `inputSummary` on current running run. No-op if no active run. |
| `updateRunMetadata` | `agents/mutations.ts` | Patches `metadata` object on a run (used by `checkIterationLimit`). |
| `ingestBrandMemory` | `agents/knowledge.ts` | Embeds content (1536d) and inserts into `marketingKnowledge`. Clears cache. |
| `deleteDocument` | `agents/knowledge.ts` | Deletes a document from either `marketingKnowledge` or `brandKnowledge`. Requires explicit `table` discriminant. |

---

## 15. System Schemas — Complete Agentic Data Structures

### Auth Tables (via `@convex-dev/auth`)
```typescript
// Automatically included via ...authTables in schema.ts
// authAccounts  — stores hashed passwords and provider accounts
// authSessions  — active session tokens
// authVerificationCodes — OTP/magic link codes
// authRefreshTokens — long-lived refresh tokens
// authRateLimits — brute-force protection
// users         — extended user profiles (auto-created on first sign-in)
```

### `agentRuns`
```typescript
{
  agentName:    string;          // "CMO Orchestrator", "Brand Guardian", etc.
  status:       "running" | "completed" | "failed";
  inputSummary: string;          // Real-time task description / status
  outputSummary?: string;        // Final output (max 200 chars)
  error?:       string;
  startedAt:    number;
  completedAt?: number;
  metadata?: {
    toolIterations: Record<string, number>;  // e.g. { auditContent: 2 }
  };
}
// Indexes: by_agent(agentName), by_status(status)
```

### `contentPieces` (HITL state machine)
```typescript
{
  type:   "blog_post" | "twitter_thread" | "linkedin_post" | "email" | "newsletter" | "reddit_post" | "competitor_brief";
  status: "draft" | "pending_approval" | "approved" | "rejected" | "published";
  brandGuardianApproved: boolean;
  generatedByAgent:      string;
  marketRegime?:         string;
  // SEO fields
  keywords?:         string[];
  metaDescription?:  string;
  // Visual assets
  visualMode?:           "none" | "hero" | "hero_plus_inline";
  heroImageUrl?:         string;
  heroImageStatus?:      "queued" | "generated" | "needs_review" | "failed";
  heroImageBatchJobId?:  Id<"batchJobs">;
}
```

### `brandKit`
```typescript
{
  companyName:    string;
  logoUrl:        string;
  primaryColor:   string;    // hex
  secondaryColor: string;    // hex
  fontFamily:     string;
  toneOfVoice:    string;
  tagline:        string;
  updatedAt:      number;
}
```

### `batchJobs`
```typescript
{
  provider:     "azure";
  externalId:   string;
  status:       "queued" | "processing" | "completed" | "failed";
  jobType:      "weekly_content" | "image_generation" | "competitor_audit";
  outputSummary?: string;
  error?:       string;
  createdAt:    number;
  completedAt?: number;
}
// Indexes: by_status, by_provider, by_externalId
```

### `autonomyConfig`
```typescript
{
  globalAutonomyLevel:       number;   // 0.0–1.0
  publishingPaused:          boolean;  // Global kill switch
  firstPostApprovalRequired: boolean;
  firstPostApproved:         boolean;
  riskTolerance:             number;   // 0.0–1.0
  visualGovernanceEnabled:   boolean;
  updatedAt:                 number;
}
```

---

*AMI 2.0 — Agentic System Guide v4.0 | Internal Engineering Reference | March 2026*
