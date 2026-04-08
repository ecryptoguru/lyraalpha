# AMI 2.0 — Agentic Yellow Paper
## Part 2 of 5: Agentic Orchestration & Cognitive Logic

**Version 4.0 — March 2026**
**Classification: Technical Specification**

---

> This document is the technical companion to the Score Engine Yellow Paper. While Part 1 specifies the mathematical foundations of the data layer (DSE/MRDE), Part 2 specifies the **Agentic Intelligence Layer** that autonomously interprets, packages, and distributes that data.

> **v4.0 changes:** Clerk replaced with Convex native auth (`@convex-dev/auth`). `auth.addHttpRoutes(http)` added to `http.ts`. `auth.config.ts` created. `authTables` added to `schema.ts`. `runCompetitorIntelligence` confirmed as `internalAction` (uses `internal.agents.tier4`, not `api`). Playwright multi-project auth test suite added.

---

## 1. Agentic Architecture

### 1.1 The Agent Primitive

All agents are instances of the `Agent` class from `@convex-dev/agent`. Each agent is a stateless, composable unit with three fixed properties:

```typescript
new Agent(components.agent, {
  name: string,            // Unique agent name string (used for telemetry, reasoning effort lookup)
  languageModel: AzureLanguageModel, // Resolved model via createAzureProvider shim
  instructions: string,   // Immutable persona + framework constraints (system prompt)
  tools: ToolSet,         // Strictly scoped capability set
})
```

**Language models are NOT OpenRouter.** As of v4.0, all agents run on **Azure AI Foundry** through a custom provider shim (`convex/lib/azureProvider.ts`) implementing the AI SDK v3 `LanguageModelV3` interface.

Model assignments:
- `gpt-5.4` — Tier 1 strategic agents + high-stakes Tier 3 agents
- `gpt-5.4-mini` — Tier 2 writers, Tier 3 engagement, Tier 4 analysts
- `gpt-5.4-nano` — Tier 5 distribution (email + scheduling)

### 1.2 Azure Provider Shim (`convex/lib/azureProvider.ts`)

The Azure provider is a hand-written adapter implementing `LanguageModelV3` because the official Azure SDK does not expose the AI SDK v3 interface directly. It wraps the Azure **Responses API** (`client.responses.create`).

Key implementation details:

| Feature | Implementation |
|---|---|
| **Base URL** | `endpoint.replace(/\/$/, "") + "/openai"` (single normalization, no double `/openai/v1`) |
| **`doGenerate`** | Full response parsing: maps `output_text` → `text`, `reasoning` → `reasoning`, `function_call` → `tool-call` content parts |
| **`doStream`** | Delegates to `doGenerate` then wraps in a `ReadableStream` — no recursion, avoids separate stream endpoint |
| **Prompt caching** | `prompt_cache_key` + `prompt_cache_retention: "24h"` on every request |
| **Parallel tool calls** | `parallel_tool_calls: true` enabled by default |
| **Tool call ID** | Uses `call_id ?? item.id ?? tool-${Date.now()}` for robust ID resolution |
| **Reasoning extraction** | Reads `item.summary[].text` or `item.content[].text` from reasoning output blocks |

```typescript
// Provider instantiation in convex/agents/instances.ts
const azure = createAzure({
  baseURL: process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, "") + "/openai",
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
});
```

### 1.3 Execution Safety

- **Thread Persistence** — Each agent run can optionally attach to a persistent `threadId` for cross-agent long-range context (via `@convex-dev/agent` thread management).
- **Iteration Caps** — The `auditContent` tool is hard-capped at **3 calls per run** via `checkIterationLimit()`. Additional recursive tools should follow the same pattern.
- **Retry with Backoff** — All `agent.generateText()` and `agent.generateObject()` calls are wrapped in `withRetry(op, maxRetries=3, baseDelayMs=1000)` with linear backoff (`delay = baseDelay * attempt`).
- **No Phantom Runs** — `updateActiveAgentStatus` is a no-op when no `running` `agentRun` exists. It never creates new records.
- **Parallel Batch Health** — `batchRecomputeHealthScores` uses `Promise.all()` over the batch, not a serial loop.

---

## 1.4 Authentication Infrastructure

As of v4.0, AMI 2.0 uses **Convex native auth** (`@convex-dev/auth`) replacing Clerk. All auth is enforced at two layers:

| Layer | Mechanism | File |
|---|---|---|
| **Server-side** | `convexAuthNextjsMiddleware` in Next.js middleware | `middleware.ts` |
| **Client-side** | `<AuthGuard>` using `<Authenticated>` / `<Unauthenticated>` Convex hooks | `components/AuthGuard.tsx` |
| **Token storage** | localStorage via `<ConvexAuthProvider>` (pure React, not Next.js SSR) | `components/ConvexClientProvider.tsx` |
| **Provider config** | `CONVEX_SITE_URL` domain + RS256 JWT signing | `convex/auth.config.ts` |
| **HTTP routes** | Sign-in, sign-out, token refresh endpoints | `convex/http.ts` via `auth.addHttpRoutes(http)` |
| **Schema** | `...authTables` spreads 5 auth tables into Convex schema | `convex/schema.ts` |

### Required Convex Environment Variables

```bash
JWT_PRIVATE_KEY   # RS256 PEM private key (spaces not \n) — generated via jose
JWKS              # Matching RS256 public JWK set (JSON string)
SITE_URL          # e.g. http://localhost:3001 — used for OAuth/magic link redirects
```

Generate with:
```bash
node --input-type=module -e "
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';
const keys = await generateKeyPair('RS256', { extractable: true });
const priv = await exportPKCS8(keys.privateKey);
const pub = await exportJWK(keys.publicKey);
console.log(priv.trimEnd().replace(/\\n/g, ' '));
console.log(JSON.stringify({ keys: [{ use: 'sig', ...pub }] }));
" | npx convex env set JWT_PRIVATE_KEY
```

### Admin Allowlist

Access is gated via a hardcoded `Set` in `convex/auth.ts`. The `profile()` callback throws for any email not in the allowlist, blocking both sign-in and sign-up:

```typescript
const ADMIN_ALLOWLIST = new Set([
  "ankit@fusionwaveai.com",
  "eb.ankit.exp@gmail.com",
]);
```

### Public Routes (bypass auth)

`/login`, `/briefing/*`, `/join/*`, `/api/og/*`

---

## 2. Reasoning Effort System

Reasoning effort is resolved at call time via the `REASONING_EFFORT_MAP` in `convex/agents/base.ts`. Unmapped agents default to `"medium"`.

```typescript
const REASONING_EFFORT_MAP: Record<string, "none" | "low" | "medium" | "high"> = {
  "Brand Guardian":              "high",
  "Competitor Intelligence Agent": "high",
  "Customer Success Agent":      "high",
  "Email Marketing Specialist":  "none",
  "Distribution Engine":         "none",
  "Long-Form Writer":            "low",
  "Social Media Writer":         "low",
  "Content Repurposer":          "low",
  "Inbound SDR":                 "low",
  "Performance Analyst":         "low",
  "LinkedIn Discovery Agent":    "low",
  // All others → "medium" (CMO Orchestrator, Growth Strategist, etc.)
};
```

This maps directly to the `azure.reasoning.effort` field on each `responses.create` call, allowing per-agent cost/quality tuning without changing model assignment.

---

## 3. Dual-Model Embedding Architecture

### 3.1 Rationale

Two separate vector stores with different embedding models are used to optimize for distinct retrieval characteristics:

| Table | Model | Dimensions | Rationale |
|---|---|---|---|
| `marketingKnowledge` | `text-embedding-3-large` | **1536d** | Short, high-precision marketing texts (formulas, hero posts, scripts). Azure deployment currently serves both search paths. |
| `brandKnowledge` | `text-embedding-3-large` | **3072d** | Long-form technical documents (whitepaper/yellowpaper chunks). Higher dimensionality preserves semantic density over larger passages. |

Both are served through **Azure AI Foundry** via `generateAzureEmbedding(text, model, dimensions)` in `convex/lib/llmClients.ts`.

### 3.2 Embedding API

```typescript
// Single embedding
generateAzureEmbedding(text: string, model: "text-embedding-3-large" | "text-embedding-3-small", dimensions: number): Promise<number[]>

// Batch embedding (for bulk ingestion)
generateAzureEmbeddings(texts: string[], model, dimensions): Promise<number[][]>
```

Both functions use a **lazily-initialized, module-level cached** `OpenAI` client to avoid re-instantiating on every Convex action call.

### 3.3 Dual-Search Query Flow

Every `searchBrandMemory` invocation executes the following steps:

```
1. Normalize query → compute queryHash
2. CHECK brandMemoryCache (by_hash index, TTL check)
   ↳ Cache HIT → return immediately

3. PARALLEL embedding generation:
   a. generateAzureEmbedding(query, text-embedding-3-large, 1536) → marketingVector
   b. generateAzureEmbedding(query, text-embedding-3-large, 3072)  → brandVector

4. PARALLEL vector search:
   a. ctx.vectorSearch("marketingKnowledge", "by_embedding", { vector: marketingVector, limit })
   b. ctx.vectorSearch("brandKnowledge",     "by_embedding", { vector: brandVector,     limit })

5. BATCH document fetch (single internalQuery each, no N+1):
   a. getDocs({ ids: marketingResults.map(r => r._id) })
   b. getBrandDocs({ ids: brandResults.map(r => r._id) })

6. MERGE: attach _score from vector results to each doc

7. SORT by score DESC, slice to limit

8. OPTIONAL category filter (marketingKnowledge only):
   brand docs always pass through regardless of category

9. FORMAT:
   marketing → "[MARKETING_DOC: CATEGORY] title:\ncontent"
   brand     → "[PRODUCT_SPEC: SOURCE] section:\ncontent"

10. WRITE to brandMemoryCache (7-day TTL)
    INVALIDATE cache on any new ingestBrandMemory call
```

---

## 4. Tool Safety Protocol

### 4.1 `checkIterationLimit(ctx, toolName, maxIterations)`

Prevents infinite agent loops. Called at the start of every capped tool handler.

```typescript
async function checkIterationLimit(ctx, toolName: string, maxIterations: number) {
  // 1. Fetch the latest RUNNING agentRun (no agentName required — global scope)
  const latestRun = await ctx.runQuery(internal.agents.queries.getLatestActiveRun, {});
  if (!latestRun) return; // No active run → no-op (non-blocking)

  // 2. Read current iteration count from metadata
  const currentCount = latestRun.metadata?.toolIterations?.[toolName] ?? 0;

  // 3. Hard stop if at limit
  if (currentCount >= maxIterations) {
    throw new Error(`CRITICAL: Max iterations (${maxIterations}) reached for '${toolName}'.`);
  }

  // 4. Increment and persist
  await ctx.runMutation(internal.agents.mutations.updateRunMetadata, {
    runId: latestRun._id,
    metadata: {
      ...latestRun.metadata,
      toolIterations: { ...latestRun.metadata?.toolIterations, [toolName]: currentCount + 1 }
    }
  });
}
```

**Design decisions:**
- Uses `getLatestActiveRun` (no `agentName` param) to work correctly regardless of which agent is calling the tool.
- Is a **no-op** (not a throw) when no active run is found — safe to call outside agent execution contexts.
- The `agentRuns` table has an `index("by_status", ["status"])` index that makes this query O(1).

### 4.2 `updateStatus` — Phantom Run Prevention

The `updateActiveAgentStatus` internal mutation was patched to eliminate a critical bug where calling `updateStatus` without an existing run would silently insert a phantom `agentRun` record:

```typescript
// CORRECT (current) behavior
if (latestRun && latestRun.status === "running") {
  await ctx.db.patch(latestRun._id, { inputSummary: args.status });
}
// No-op when no active run — status update is best-effort telemetry only.
```

---

## 5. Agent Run Lifecycle

### 5.1 `agentRuns` Table Schema

```typescript
interface AgentRun {
  _id:          Id<"agentRuns">;
  agentName:    string;                    // e.g. "Brand Guardian"
  status:       "running" | "completed" | "failed";
  inputSummary: string;                    // Brief description of the task; also used for real-time status updates
  outputSummary?: string;                  // Final output snippet (max 200 chars)
  error?:       string;                    // Error message if status === "failed"
  startedAt:    number;                    // Unix timestamp (ms)
  completedAt?: number;                    // Unix timestamp (ms)
  metadata?:    {
    toolIterations: Record<string, number>; // Per-tool call counts for iteration cap enforcement
    [key: string]: unknown;
  };
}
```

**Indexes:**
- `by_agent` on `["agentName"]` — used by `getLatestRun` and `updateActiveAgentStatus`
- `by_status` on `["status"]` — used by `getLatestActiveRun` for iteration cap checks

### 5.2 Run State Machine

```
                    ┌─────────────────┐
                    │   startAgentRun  │
                    │  status:running  │
                    └────────┬────────┘
                             │
              ┌──────────────┴───────────────┐
              │                              │
   agent.generateText() succeeds    agent.generateText() throws
   (after up to 3 retry attempts)   (after 3 retry attempts exhausted)
              │                              │
    ┌─────────▼──────────┐        ┌──────────▼────────────┐
    │   finishAgentRun    │        │    finishAgentRun      │
    │  status:completed   │        │   status:failed        │
    │  outputSummary:...  │        │   error: String(err)   │
    └────────────────────┘        └───────────────────────┘
```

During execution, `updateActiveAgentStatus` is called on every `onStepFinish` callback (streaming steps), patching `inputSummary` with the first 100 chars of the step text + `"..."`. This drives the real-time status display on the `/agents` dashboard.

---

## 6. The 7-Sweep Copy Editing Process (Formal Spec)

The `brandGuardian` agent (`gpt-5.4`, reasoning: `high`) enforces a deterministic audit of all generated content via the `auditContent` tool before it enters `pending_approval`.

| Sweep | Metric | Logic Check |
|---|---|---|
| **1. Clarity** | SVO Structure | Verifies Subject-Verb-Object sentence clarity. Eliminates passive voice. |
| **2. Voice** | Tone Match | Penalizes "Flashy/Hype" language. Target tone: Institutional (score 1.0). Penalized: Crypto Bro language (score 0.0). |
| **3. Proof** | Data Anchor | Checks that technical claims cite specific DSE Scores (Trend, Momentum, ARCS). No data = no claim. |
| **4. Impact** | Hook Strength | Analyzes the first 100 characters for Question / Number / Contrast patterns. |
| **5. Emotion** | Cognitive Bias | Checks for Loss Aversion framing during DEFENSIVE/RISK_OFF regimes. Positive framing for RISK_ON. |
| **6. Format** | Skimmability | Enforces bullet points and sub-headers (F-pattern reading). Max 3 sentences per paragraph for social. |
| **7. Authenticity** | Fluff Removal | Strips banned words: `Revolutionary`, `Next-Gen`, `Game-changer`, `Disruptive`, `Cutting-edge`. |

The audit is called via `auditContent` tool (max 3 iterations enforced by `checkIterationLimit`). On the 4th call, the tool throws a `CRITICAL` error, halting the run and preventing infinite refinement loops.

---

## 7. 5-Phase Launch Framework

The `cmoOrchestrator` manages product launches through a state-controlled workflow in `triggerCampaignLaunch`.

| Phase | Audience | Content Strategy | Psychological Hook |
|---|---|---|---|
| **1. Internal** | Team only | DSE stability verification, math testing | — |
| **2. Alpha** | Whitelisted "Pioneer" users | Exclusivity-first messaging | Scarcity |
| **3. Beta** | Extended early cohort | Feedback-solicitation, product improvement framing | Loss Aversion ("Don't miss shaping the product") |
| **4. Early Access** | Waitlist | CTA density maximized | Hicks's Law (single clear action), Urgency |
| **5. Full Launch** | All channels | Omnichannel push via `runAggressiveLaunchWeek` | Social Proof + Authority |

---

## 8. LinkedIn Discovery & ICP Scoring

### 8.1 ICP Match Score Components

Leads are scored by the `linkedinDiscovery` agent using a composite `ICP_Match_Score`:

| Signal | Weight | Criteria |
|---|---|---|
| **Role Match** | 40% | Fund Manager, RIA, Investor, CIO, Portfolio Manager |
| **Activity Match** | 30% | Post in last 7 days OR profile update in last 14 days |
| **Keyword Match** | 30% | "AI", "Fintech", "Quant", "Alpha", "DSE" in bio or recent post |

### 8.2 Interaction Framework Selection

```
IF lead.recentPost EXISTS
    → draftLinkedInReply
       Logic: [Recap Post Point] + [DSE/MRDE Comparison] + [Unique Insight]

ELSE
    → draftLinkedInDM
       Logic: [Personalized Hook (role + recent signal)] + [Platform Alpha Value Prop] + [Low-Friction CTA]
```

All output from both paths goes through `brandGuardian` audit before entering the approval queue.

### 8.3 `searchLinkedInSimulated` Fallback

When the live LinkedIn scraper is inactive, `linkedinDiscovery` uses the `searchLinkedInSimulated` tool, which returns deterministic synthetic leads parameterized by `sector` and `regime`. These are clearly marked for review and not sent without human approval.

---

## 9. Batch Processing Architecture

### 9.1 `batchJobs` Table

```typescript
interface BatchJob {
  _id:          Id<"batchJobs">;
  provider:     "azure";
  externalId:   string;         // Provider-side batch ID
  status:       "queued" | "processing" | "completed" | "failed";
  jobType:      "weekly_content" | "image_generation" | "competitor_audit";
  outputSummary?: string;
  error?:       string;
  createdAt:    number;
  completedAt?: number;
}
```

**Indexes:** `by_status`, `by_provider`, `by_externalId`

### 9.2 Async Batch Flow

```
submitWeeklyContentBatch (Convex action)
    ↓
agents/batch:submitBatchJob → inserts into batchJobs (status: "queued")
    ↓
Provider processes asynchronously (Azure Batch API)
    ↓
Webhook or polling callback → updates batchJobs.status
    ↓
completeWeeklyContentBatch (internalAction)
    → fetches job record
    → runs Brand Guardian audit on batch output
    → saves final content to contentPieces (pending_approval)
```

**Cost reduction:** Long-form article generation via batch saves ~50% vs real-time inference by allowing the provider to schedule at off-peak capacity.

---

## 10. Prompt Caching Strategy

Every `executeAgentAction` and `executeAgentObjectAction` call sends the following Azure-specific options:

```typescript
const azureProviderOptions = {
  azure: {
    reasoning: { effort: getReasoningEffort(agent.options.name) },
    parallelToolCalls: true,
    store: true,
    prompt_cache_retention: "24h",
    prompt_cache_key: createPromptCacheKey(agent.options.name, args.inputSummary),
  },
};
```

`createPromptCacheKey(agentName, prefix)` normalizes whitespace and truncates the prefix to 160 characters, producing stable keys like `"Brand Guardian:Draft a defensive Twitter post..."`. This allows the Azure platform to reuse cached KV attention for repeated agent invocations with similar inputs, reducing latency and cost on high-frequency cron runs.

---

## 11. Market Regime Integration (MRDE)

### 11.1 Regime States

```typescript
type MarketRegime =
  | "STRONG_RISK_ON"   // Bullish — aggressive growth content
  | "RISK_ON"          // Mildly bullish — standard growth content
  | "NEUTRAL"          // Balanced — educational/informational content
  | "DEFENSIVE"        // Risk-aware — hedging narratives
  | "RISK_OFF";        // Bearish — emergency playbook triggered
```

### 11.2 Regime → Content Strategy Mapping

| Regime | Content Tone | Hook Type | Agent Behaviour |
|---|---|---|---|
| `STRONG_RISK_ON` | Aggressive, opportunity-forward | Number + Urgency | Launch campaigns, outbound push |
| `RISK_ON` | Positive, data-driven | Authority + Social Proof | Standard weekly cycle |
| `NEUTRAL` | Educational, balanced | Question + Contrast | Product tutorials, case studies |
| `DEFENSIVE` | Risk-aware, responsible | Loss Aversion | Hedging narratives, portfolio protection |
| `RISK_OFF` | Crisis communication | Crisis/Urgency | Emergency playbook — defensive posts only |

### 11.3 Regime Data Flow

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

## 12. System Schemas — Complete Agentic Data Structures

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

### `marketingKnowledge`
```typescript
{
  category:  "math_formula" | "hero_post" | "objection_handling";
  title:     string;
  content:   string;
  embedding: number[];   // 1536d — text-embedding-3-large via Azure
  createdAt: number;
}
// VectorIndex: by_embedding (dimensions: 1536)
```

### `brandKnowledge`
```typescript
{
  source:    "whitepaper" | "yellowpaper" | "competitor_brief" | "product_update";
  section:   string;     // e.g. "DSE Score Engine"
  content:   string;
  embedding: number[];   // 3072d — text-embedding-3-large via Azure
  createdAt: number;
}
// VectorIndex: by_embedding (dimensions: 3072)
```

### `brandMemoryCache`
```typescript
{
  queryHash:  string;    // Normalized query fingerprint
  category?:  string;    // Optional category filter key
  results:    string;    // Serialized formatted context string
  expiresAt:  number;    // Unix ms — 7 days from creation
}
// Index: by_hash(queryHash)
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
}
```

---

## 13. Key Internal API Reference

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

## 14. Cron Handler Notes

### `runCompetitorIntelligence` is an `internalAction`

This function is registered as `internalAction` in `convex/agents/tier4.ts`. It must be called via `internal.agents.tier4.runCompetitorIntelligence` in cron handlers — **not** `api.agents.tier4`. Using the `api` namespace for internal actions causes a TypeScript error at build time.

```typescript
// convex/cronHandlers.ts — correct
await ctx.runAction(internal.agents.tier4.runCompetitorIntelligence, { ... });

// WRONG — will fail TypeScript check
await ctx.runAction(api.agents.tier4.runCompetitorIntelligence, { ... });
```

### Workflow Actions (`draftArticle`, `repurposeContent`)

The correct exported function names in `convex/agents/tier2.ts` are:
- `draftArticle` — not `writeLongFormArticle`
- `repurposeContent` — not `repurposeToThread`

Both accept `{ campaignBrief, targetKeyword, dataSources }` and `{ sourceMaterials, targetFormat }` respectively.

---

*AMI 2.0 — Agentic Yellow Paper v4.0 | Technical Specification | March 2026*
