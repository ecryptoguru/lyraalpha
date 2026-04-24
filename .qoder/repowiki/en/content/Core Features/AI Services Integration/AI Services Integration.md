# AI Services Integration

<cite>
**Referenced Files in This Document**
- [service.ts](file://src/lib/ai/service.ts)
- [config.ts](file://src/lib/ai/config.ts)
- [orchestration.ts](file://src/lib/ai/orchestration.ts)
- [rag.ts](file://src/lib/ai/rag.ts)
- [search.ts](file://src/lib/ai/search.ts)
- [context-builder.ts](file://src/lib/ai/context-builder.ts)
- [memory.ts](file://src/lib/ai/memory.ts)
- [cost-calculator.ts](file://src/lib/ai/cost-calculator.ts)
- [types.ts](file://src/lib/ai/types.ts)
- [ai-responder.ts](file://src/lib/support/ai-responder.ts)
- [guardrails.ts](file://src/lib/ai/guardrails.ts)
- [output-validation.ts](file://src/lib/ai/output-validation.ts)
- [fallback-chain.ts](file://src/lib/ai/streaming/fallback-chain.ts)
- [cache-handler.ts](file://src/lib/ai/streaming/cache-handler.ts)
- [utils.ts](file://src/lib/ai/streaming/utils.ts)
- [route.ts](file://src/app/api/lyra/personal-briefing-ai/route.ts)
- [route.ts](file://src/app/api/lyra/personal-briefing/route.ts)
- [route.ts](file://src/app/api/cron/daily-briefing/route.ts)
- [route.ts](file://src/app/api/cron/trending-questions/route.ts)
- [route.ts](file://src/app/api/support/public-chat/route.ts)
- [route.ts](file://src/app/api/support/messages/route.ts)
- [route.ts](file://src/app/api/support/conversations/route.ts)
- [route.ts](file://src/app/api/support/stream/route.ts)
- [route.ts](file://src/app/api/support/voice-session/route.ts)
- [route.ts](file://src/app/api/lyra/briefing/route.ts)
- [route.ts](file://src/app/api/lyra/history/route.ts)
- [route.ts](file://src/app/api/lyra/feedback/route.ts)
- [route.ts](file://src/app/api/lyra/explain-signal/route.ts)
- [route.ts](file://src/app/api/lyra/related/route.ts)
- [route.ts](file://src/app/api/lyra/whats-changed/route.ts)
- [route.ts](file://src/app/api/discovery/search/route.ts)
- [route.ts](file://src/app/api/discovery/feed/route.ts)
- [route.ts](file://src/app/api/discovery/explain/route.ts)
- [route.ts](file://src/app/api/market/factor-rotation/route.ts)
- [route.ts](file://src/app/api/market/regime-multi-horizon/route.ts)
- [route.ts](file://src/app/api/market/volatility-structure/route.ts)
- [route.ts](file://src/app/api/market/breadth/route.ts)
- [route.ts](file://src/app/api/market/correlation-stress/route.ts)
- [route.ts](file://src/app/api/intelligence/feed/route.ts)
- [route.ts](file://src/app/api/intelligence/analog/route.ts)
- [route.ts](file://src/app/api/intelligence/calendars/route.ts)
- [route.ts](file://src/app/api/portfolio/route.ts)
- [route.ts](file://src/app/api/portfolio/[id]/route.ts)
- [route.ts](file://src/app/api/portfolio/asset-search/route.ts)
- [route.ts](file://src/app/api/user/plan/route.ts)
- [route.ts](file://src/app/api/user/preferences/route.ts)
- [route.ts](file://src/app/api/user/profile/route.ts)
- [route.ts](file://src/app/api/user/session/route.ts)
- [route.ts](file://src/app/api/user/watchlist/route.ts)
- [route.ts](file://src/app/api/user/weekly-report/route.ts)
- [route.ts](file://src/app/api/user/credits/route.ts)
- [route.ts](file://src/app/api/user/notifications/route.ts)
- [route.ts](file://src/app/api/user/onboarding/route.ts)
- [route.ts](file://src/app/api/admin/ai-costs/route.ts)
- [route.ts](file://src/app/api/admin/ai-limits/route.ts)
- [route.ts](file://src/app/api/admin/ai-ops/route.ts)
- [route.ts](file://src/app/api/admin/analytics/route.ts)
- [route.ts](file://src/app/api/admin/usage/route.ts)
- [route.ts](file://src/app/api/admin/users/route.ts)
- [route.ts](file://src/app/api/admin/waitlist/route.ts)
- [route.ts](file://src/app/api/admin/revenue/route.ts)
- [route.ts](file://src/app/api/admin/billing/route.ts)
- [route.ts](file://src/app/api/admin/credits/route.ts)
- [route.ts](file://src/app/api/admin/cache-stats/route.ts)
- [route.ts](file://src/app/api/admin/infrastructure/route.ts)
- [route.ts](file://src/app/api/admin/myra/route.ts)
- [route.ts](file://src/app/api/admin/regime/route.ts)
- [route.ts](file://src/app/api/admin/overview/route.ts)
- [route.ts](file://src/app/api/admin/crypto-data/route.ts)
- [route.ts](file://src/app/api/admin/engines/route.ts)
- [route.ts](file://src/app/api/admin/growth/route.ts)
- [route.ts](file://src/app/api/admin/revenue/route.ts)
- [route.ts](file://src/app/api/admin/support/conversations/route.ts)
- [route.ts](file://src/app/api/admin/support/messages/route.ts)
- [route.ts](file://src/app/api/admin/support/public-chat/route.ts)
- [route.ts](file://src/app/api/admin/support/stream/route.ts)
- [route.ts](file://src/app/api/admin/support/voice-session/route.ts)
- [route.ts](file://src/app/api/admin/support/retention/route.ts)
- [route.ts](file://src/app/api/admin/support/weekly-report/route.ts)
- [route.ts](file://src/app/api/admin/support/whats-changed/route.ts)
- [route.ts](file://src/app/api/admin/support/related/route.ts)
- [route.ts](file://src/app/api/admin/support/explain-signal/route.ts)
- [route.ts](file://src/app/api/admin/support/history/route.ts)
- [route.ts](file://src/app/api/admin/support/briefing/route.ts)
- [route.ts](file://src/app/api/admin/support/feedback/route.ts)
- [route.ts](file://src/app/api/admin/support/personal-briefing/route.ts)
- [route.ts](file://src/app/api/admin/support/personal-briefing-ai/route.ts)
- [route.ts](file://src/app/api/admin/support/discovery/search/route.ts)
- [route.ts](file://src/app/api/admin/support/discovery/feed/route.ts)
- [route.ts](file://src/app/api/admin/support/discovery/explain/route.ts)
- [route.ts](file://src/app/api/admin/support/market/factor-rotation/route.ts)
- [route.ts](file://src/app/api/admin/support/market/regime-multi-horizon/route.ts)
- [route.ts](file://src/app/api/admin/support/market/volatility-structure/route.ts)
- [route.ts](file://src/app/api/admin/support/market/breadth/route.ts)
- [route.ts](file://src/app/api/admin/support/market/correlation-stress/route.ts)
- [route.ts](file://src/app/api/admin/support/intelligence/feed/route.ts)
- [route.ts](file://src/app/api/admin/support/intelligence/analog/route.ts)
- [route.ts](file://src/app/api/admin/support/intelligence/calendars/route.ts)
- [route.ts](file://src/app/api/admin/support/portfolio/route.ts)
- [route.ts](file://src/app/api/admin/support/portfolio/[id]/route.ts)
- [route.ts](file://src/app/api/admin/support/portfolio/asset-search/route.ts)
- [route.ts](file://src/app/api/admin/support/user/plan/route.ts)
- [route.ts](file://src/app/api/admin/support/user/preferences/route.ts)
- [route.ts](file://src/app/api/admin/support/user/profile/route.ts)
- [route.ts](file://src/app/api/admin/support/user/session/route.ts)
- [route.ts](file://src/app/api/admin/support/user/watchlist/route.ts)
- [route.ts](file://src/app/api/admin/support/user/weekly-report/route.ts)
- [route.ts](file://src/app/api/admin/support/user/credits/route.ts)
- [route.ts](file://src/app/api/admin/support/user/notifications/route.ts)
- [route.ts](file://src/app/api/admin/support/user/onboarding/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/analytics/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/usage/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/users/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/waitlist/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/revenue/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/billing/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/credits/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/cache-stats/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/infrastructure/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/myra/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/regime/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/overview/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/crypto-data/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/engines/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/growth/route.ts)
- [route.ts](file://src/app/api/admin/support/admin/revenue/route.ts)
</cite>

## Update Summary
**Changes Made**
- Enhanced AI security and reliability with advanced guardrails including base64-encoded payload scanning and comprehensive prompt injection pattern detection
- Added output validation system with semantic consistency checking for ELITE/COMPLEX tiers
- Implemented streaming response caching, fallback chain management, and improved memory handling
- Updated security validation pipeline with Unicode normalization and conversation length validation
- Added semantic hallucination detection for high-value tiers

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Security and Reliability Enhancements](#security-and-reliability-enhancements)
7. [Dependency Analysis](#dependency-analysis)
8. [Performance Considerations](#performance-considerations)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Conclusion](#conclusion)
11. [Appendices](#appendices)

## Introduction
This document explains the AI Services Integration for LyraAlpha, focusing on personal briefing AI, market analysis AI, support AI system, and Retrieval-Augmented Generation (RAG). It covers the AI provider abstraction, cost optimization strategies, fallback mechanisms, multi-model orchestration, RAG implementation for knowledge access and semantic search, contextual AI responses, configuration and provider switching, performance monitoring, interaction patterns, cost management, and AI-powered content generation workflows.

**Updated** Enhanced with advanced security guardrails, output validation systems, streaming response caching, and improved reliability mechanisms.

## Project Structure
The AI system is implemented primarily under src/lib/ai with orchestration entry points in src/app/api routes. Key areas:
- AI orchestration and streaming: src/lib/ai/service.ts
- Provider abstraction and model routing: src/lib/ai/config.ts, src/lib/ai/orchestration.ts
- RAG and knowledge access: src/lib/ai/rag.ts
- Web search and grounding: src/lib/ai/search.ts
- Context building and compression: src/lib/ai/context-builder.ts
- User memory and long-term context: src/lib/ai/memory.ts
- Cost estimation and billing: src/lib/ai/cost-calculator.ts
- Security guardrails and input validation: src/lib/ai/guardrails.ts
- Output validation and semantic consistency: src/lib/ai/output-validation.ts
- Streaming utilities and fallback chains: src/lib/ai/streaming/
- Support AI responder with RAG and BM25: src/lib/support/ai-responder.ts
- API endpoints for personal briefing, market analysis, support, and admin controls: src/app/api/...

```mermaid
graph TB
subgraph "API Layer"
PB["Personal Briefing API"]
MB["Market Analysis APIs"]
SUP["Support APIs"]
ADMIN["Admin AI Ops APIs"]
end
subgraph "AI Orchestration"
SVC["service.ts<br/>generateLyraStream"]
CFG["config.ts<br/>provider config"]
ORCH["orchestration.ts<br/>model selection"]
end
subgraph "Security & Validation"
GUARD["guardrails.ts<br/>input validation + guardrails"]
OUTVAL["output-validation.ts<br/>semantic consistency + output checks"]
end
subgraph "Streaming & Caching"
STREAM["streaming/utils.ts<br/>refundOnStreamError"]
FALLBACK["streaming/fallback-chain.ts<br/>fallback chain management"]
CACHE["streaming/cache-handler.ts<br/>streaming response caching"]
end
subgraph "RAG & Search"
RAG["rag.ts<br/>vector store + fast-path"]
SEARCH["search.ts<br/>web search"]
end
subgraph "Context & Memory"
CTX["context-builder.ts<br/>structured context"]
MEM["memory.ts<br/>global/session notes"]
end
subgraph "Cost & Monitoring"
COST["cost-calculator.ts<br/>pricing & estimation"]
end
PB --> SVC
MB --> SVC
SUP --> SVC
ADMIN --> SVC
SVC --> CFG
SVC --> ORCH
SVC --> GUARD
SVC --> OUTVAL
SVC --> STREAM
SVC --> FALLBACK
SVC --> CACHE
SVC --> RAG
SVC --> SEARCH
SVC --> CTX
SVC --> MEM
SVC --> COST
```

**Diagram sources**
- [service.ts:383-700](file://src/lib/ai/service.ts#L383-L700)
- [config.ts:124-389](file://src/lib/ai/config.ts#L124-L389)
- [orchestration.ts:1-8](file://src/lib/ai/orchestration.ts#L1-L8)
- [guardrails.ts:173-258](file://src/lib/ai/guardrails.ts#L173-L258)
- [output-validation.ts:426-496](file://src/lib/ai/output-validation.ts#L426-L496)
- [fallback-chain.ts:57-209](file://src/lib/ai/streaming/fallback-chain.ts#L57-L209)
- [cache-handler.ts:38-86](file://src/lib/ai/streaming/cache-handler.ts#L38-L86)
- [rag.ts:186-800](file://src/lib/ai/rag.ts#L186-L800)
- [search.ts:167-337](file://src/lib/ai/search.ts#L167-L337)
- [context-builder.ts:80-618](file://src/lib/ai/context-builder.ts#L80-L618)
- [memory.ts:174-347](file://src/lib/ai/memory.ts#L174-L347)
- [cost-calculator.ts:293-313](file://src/lib/ai/cost-calculator.ts#L293-L313)

**Section sources**
- [service.ts:383-700](file://src/lib/ai/service.ts#L383-L700)
- [config.ts:124-389](file://src/lib/ai/config.ts#L124-L389)

## Core Components
- AI Provider Abstraction and Multi-Model Orchestration
  - Centralized provider configuration and model selection via Azure OpenAI deployments with role-based routing.
  - Tiered routing controls token budgets, reasoning effort, and feature flags per plan tier.
- Enhanced Security Guardrails
  - Comprehensive input validation with Unicode normalization, conversation length limits, and base64-encoded payload scanning.
  - Advanced prompt injection pattern detection with expanded regex patterns and intent-aware financial guardrails.
- Output Validation and Semantic Consistency
  - Post-stream output validation with tier-aware section requirements and follow-up question limits.
  - Semantic consistency checking for ELITE/COMPLEX tiers with claim extraction and context verification.
- Streaming Response Caching and Fallback Management
  - Intelligent caching with cost tracking and conversation logging for cache hits.
  - Multi-tier fallback chain management with progressive model degradation and timeout handling.
- RAG and Semantic Search
  - Vector store with pgvector-backed chunked knowledge, tier-aware similarity thresholds, and fast-path caches.
  - Query-aware and asset-type caches reduce latency and cost.
- Web Search and Fresh Evidence
  - Tavily integration with topic detection, regional domain steering, and circuit-breaker resilience.
- Context Building and Compression
  - Structured, token-efficient context assembly with response-mode and tier-aware truncation.
- User Memory and Long-Term Personalization
  - Global/session notes distilled via a nano model with injection guards and distributed locking.
- Cost Management and Monitoring
  - Token-based cost calculation, daily token caps, credit checks, and alerts for cost overrun and outages.

**Section sources**
- [config.ts:124-389](file://src/lib/ai/config.ts#L124-L389)
- [guardrails.ts:41-258](file://src/lib/ai/guardrails.ts#L41-L258)
- [output-validation.ts:107-496](file://src/lib/ai/output-validation.ts#L107-L496)
- [fallback-chain.ts:25-245](file://src/lib/ai/streaming/fallback-chain.ts#L25-L245)
- [cache-handler.ts:19-86](file://src/lib/ai/streaming/cache-handler.ts#L19-L86)
- [rag.ts:18-800](file://src/lib/ai/rag.ts#L18-L800)
- [search.ts:167-337](file://src/lib/ai/search.ts#L167-L337)
- [context-builder.ts:80-618](file://src/lib/ai/context-builder.ts#L80-L618)
- [memory.ts:174-347](file://src/lib/ai/memory.ts#L174-L347)
- [cost-calculator.ts:293-313](file://src/lib/ai/cost-calculator.ts#L293-L313)

## Architecture Overview
The AI pipeline orchestrates multiple data sources and models to produce contextual, grounded, and cost-controlled responses. The flow integrates:
- Input classification and plan-based tier selection
- Security validation with comprehensive guardrails and input sanitization
- Parallel retrieval: RAG, web search, asset enrichment, memory, cross-sector context
- Structured context compression and optional behavioral coaching
- Streaming generation with cost estimation, daily cap enforcement, and fallback management
- Output validation and semantic consistency checking for high-value tiers
- Optional fallbacks and graceful degradation

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "API Route"
participant SVC as "service.ts"
participant GUARD as "guardrails.ts"
participant OUTVAL as "output-validation.ts"
participant STREAM as "streaming/utils.ts"
participant FALLBACK as "streaming/fallback-chain.ts"
participant CACHE as "streaming/cache-handler.ts"
participant CFG as "config.ts"
participant ORCH as "orchestration.ts"
participant RAG as "rag.ts"
participant SEARCH as "search.ts"
participant CTX as "context-builder.ts"
participant MEM as "memory.ts"
participant COST as "cost-calculator.ts"
Client->>API : POST /api/lyra/personal-briefing-ai
API->>SVC : generateLyraStream(messages, context, userId)
SVC->>GUARD : validateInput(query) + validateConversationLength(messages)
SVC->>CFG : getTierConfig(plan, tier)
SVC->>ORCH : resolveGptDeployment(role)
par Parallel Retrieval
SVC->>RAG : retrieveInstitutionalKnowledge(query, ...)
SVC->>SEARCH : searchWeb(query, region, complexity)
SVC->>MEM : getGlobalNotes(userId, source)
SVC->>MEM : getSessionNotes(userId, source)
end
SVC->>CTX : buildCompressedContext(...)
SVC->>COST : calculateLLMCost(...)
SVC->>CACHE : handleLateCacheHit(cachedText, ctx)
SVC->>STREAM : refundOnStreamError(textStream, userId, creditCost)
SVC->>FALLBACK : executeFallbackChain(primaryError, ctx)
SVC-->>API : streamText(...)
OUTVAL->>OUTVAL : validateOutput(text, tier, plan, ...)
OUTVAL->>OUTVAL : validateSemanticConsistency(text, context, tier, plan)
API-->>Client : SSE stream
```

**Diagram sources**
- [service.ts:383-700](file://src/lib/ai/service.ts#L383-L700)
- [guardrails.ts:232-258](file://src/lib/ai/guardrails.ts#L232-L258)
- [output-validation.ts:426-496](file://src/lib/ai/output-validation.ts#L426-L496)
- [fallback-chain.ts:57-209](file://src/lib/ai/streaming/fallback-chain.ts#L57-L209)
- [cache-handler.ts:38-86](file://src/lib/ai/streaming/cache-handler.ts#L38-L86)
- [config.ts:379-389](file://src/lib/ai/config.ts#L379-L389)
- [orchestration.ts:1-8](file://src/lib/ai/orchestration.ts#L1-L8)
- [rag.ts:1033-1049](file://src/lib/ai/rag.ts#L1033-L1049)
- [search.ts:170-337](file://src/lib/ai/search.ts#L170-L337)
- [context-builder.ts:80-618](file://src/lib/ai/context-builder.ts#L80-L618)
- [memory.ts:277-338](file://src/lib/ai/memory.ts#L277-L338)
- [cost-calculator.ts:293-313](file://src/lib/ai/cost-calculator.ts#L293-L313)

## Detailed Component Analysis

### AI Provider Abstraction and Multi-Model Orchestration
- Provider abstraction
  - Shared AI SDK client and lazy-initialized embedding client for Azure OpenAI.
  - Centralized deployment configuration and environment-driven feature flags.
- Multi-model orchestration
  - Role-based deployment selection (lyra-full, lyra-mini, lyra-nano, myra) with graceful fallback.
  - Tiered routing defines max tokens, reasoning effort, RAG/web search/cross-sector flags, and latency budgets per plan tier.
- Model selection
  - resolveGptDeployment chooses the appropriate deployment for a single-model call.

```mermaid
classDiagram
class Config {
+getSharedAISdkClient()
+getGpt54Deployment(role)
+getTierConfig(plan, complexity)
+getTargetOutputTokens(config, complexity)
}
class Orchestration {
+resolveGptDeployment(role)
}
class TierConfig {
+maxTokens
+reasoningEffort
+ragEnabled
+webSearchEnabled
+crossSectorEnabled
+wordBudgetMultiplier
+gpt54Role
+latencyBudgetMs
}
Config --> TierConfig : "returns"
Orchestration --> Config : "uses"
```

**Diagram sources**
- [config.ts:124-389](file://src/lib/ai/config.ts#L124-L389)
- [orchestration.ts:1-8](file://src/lib/ai/orchestration.ts#L1-L8)

**Section sources**
- [config.ts:124-389](file://src/lib/ai/config.ts#L124-L389)
- [orchestration.ts:1-8](file://src/lib/ai/orchestration.ts#L1-L8)

### Enhanced Security Guardrails and Input Validation
- Comprehensive input validation pipeline
  - Unicode normalization (NFKC) to defeat homoglyph evasion attacks across all guardrail checks.
  - Conversation length validation preventing context-window exhaustion from extremely long messages.
  - Base64-encoded payload scanning with Shannon entropy analysis to detect encoded injection attempts.
- Advanced prompt injection detection
  - Expanded regex patterns covering role hijacking, instruction override, and system prompt manipulation.
  - Intent-aware financial guardrails blocking prohibited language and prediction requests.
- Multi-layered protection strategy
  - First-line regex pattern matching, second-line base64 scanning, third-line financial guardrails.
  - Single normalization point ensures consistent pattern matching across all validation layers.

```mermaid
flowchart TD
Start(["Input Validation Pipeline"]) --> Normalize["Unicode Normalization (NFKC)"]
Normalize --> LengthCheck["Conversation Length Check (≤50k chars)"]
LengthCheck --> RegexCheck["Regex Pattern Matching"]
RegexCheck --> Base64Scan["Base64 Payload Scanning"]
Base64Scan --> FinancialCheck["Financial Guardrails"]
FinancialCheck --> Result{"Valid Input?"}
Result --> |Yes| Pass["Allow Request"]
Result --> |No| Block["SafetyViolationError"]
```

**Diagram sources**
- [guardrails.ts:173-258](file://src/lib/ai/guardrails.ts#L173-L258)

**Section sources**
- [guardrails.ts:41-258](file://src/lib/ai/guardrails.ts#L41-L258)

### Output Validation and Semantic Consistency
- Post-stream output validation
  - Tier-aware section requirement checking with plan-specific expectations.
  - Follow-up question count validation ensuring exactly 3 questions per response.
  - Crypto-specific banned phrase detection for hype language prevention.
- Semantic consistency validation for high-value tiers
  - Sample-based validation (~5% of ELITE/COMPLEX responses) to detect factual inconsistencies.
  - Claim extraction using regex patterns for numbers, dates, and comparative statements.
  - Context-based verification with confidence scoring and unverified claim reporting.
- Non-blocking validation approach
  - Validation never blocks user delivery, only logs warnings for monitoring and improvement.

```mermaid
flowchart TD
Output["LLM Output"] --> StructuralCheck["Structural Validation"]
StructuralCheck --> SectionCheck["Section Presence Check"]
SectionCheck --> FollowUpCheck["Follow-up Count Validation"]
FollowUpCheck --> CryptoCheck["Crypto Banned Phrase Check"]
CryptoCheck --> SemanticSample{"ELITE/COMPLEX COMPLEX?"}
SemanticSample --> |Yes| SemanticCheck["Semantic Consistency Check"]
SemanticSample --> |No| Complete["Validation Complete"]
SemanticCheck --> ClaimExtraction["Extract Claims"]
ClaimExtraction --> ContextVerification["Verify Against Context"]
ContextVerification --> Result["Validation Result"]
Complete --> Result
```

**Diagram sources**
- [output-validation.ts:107-496](file://src/lib/ai/output-validation.ts#L107-L496)

**Section sources**
- [output-validation.ts:107-496](file://src/lib/ai/output-validation.ts#L107-L496)

### Streaming Response Caching and Fallback Management
- Intelligent caching system
  - Late cache hit processing with cost tracking and conversation logging.
  - Deterministic cost calculation for cached responses with cached input token discounting.
  - Single-chunk streaming for cache hits to minimize overhead.
- Fallback chain management
  - Progressive model degradation from full to mini to nano deployments.
  - Configurable timeouts and token budgets for each fallback step.
  - Error propagation with detailed logging for debugging and monitoring.
- Stream error handling
  - Automatic credit refunds for mid-stream failures to prevent billing for broken streams.
  - Non-blocking refund process with retry logic and error logging.

```mermaid
sequenceDiagram
participant SVC as "service.ts"
participant CACHE as "cache-handler.ts"
participant FALLBACK as "fallback-chain.ts"
participant STREAM as "streaming/utils.ts"
SVC->>CACHE : handleLateCacheHit(cachedText, ctx)
CACHE->>STREAM : singleChunkStream(cachedText)
STREAM-->>SVC : cached text stream
SVC->>FALLBACK : executeFallbackChain(primaryError, ctx)
FALLBACK->>FALLBACK : Step 1 : lyra-mini (higher timeout)
FALLBACK->>FALLBACK : Step 2 : lyra-nano (shorter timeout)
FALLBACK-->>SVC : fallback stream or error
SVC->>STREAM : refundOnStreamError(textStream, userId, creditCost)
STREAM-->>SVC : refunded stream
```

**Diagram sources**
- [cache-handler.ts:38-86](file://src/lib/ai/streaming/cache-handler.ts#L38-L86)
- [fallback-chain.ts:57-209](file://src/lib/ai/streaming/fallback-chain.ts#L57-L209)
- [utils.ts:20-46](file://src/lib/ai/streaming/utils.ts#L20-L46)

**Section sources**
- [cache-handler.ts:19-86](file://src/lib/ai/streaming/cache-handler.ts#L19-L86)
- [fallback-chain.ts:25-245](file://src/lib/ai/streaming/fallback-chain.ts#L25-L245)
- [utils.ts:14-54](file://src/lib/ai/streaming/utils.ts#L14-L54)

### RAG Implementation and Semantic Search
- Vector store and chunking
  - Knowledge base is chunked Markdown files hydrated into KnowledgeDoc with embeddings.
  - Boot-level hydration lock prevents concurrent instances from embedding simultaneously.
- Fast-path caches
  - Pre-warmed asset-type caches and query-aware fast-path caches reduce latency and cost.
- Similarity thresholds and quality scoring
  - Tier-aware thresholds and recency-weighted quality scoring improve relevance.
- Injection guards and normalization
  - Unicode normalization and injection pattern filtering protect against poisoned chunks.
- Embedding resilience
  - Retries and graceful degradation return empty arrays to continue without RAG.

```mermaid
flowchart TD
Start(["Query Received"]) --> Init["Initialize Vector Store"]
Init --> FastPath{"Asset-Type + Query Cache?"}
FastPath --> |Yes| UseFast["Use Fast-Path Chunks"]
FastPath --> |No| Embed["Embed Query"]
Embed --> Similarity["pgvector similarity search"]
Similarity --> Threshold{"Meets Threshold?"}
Threshold --> |No| Empty["Return Empty Context"]
Threshold --> |Yes| Boost["Boost by Asset-Type"]
Boost --> Quality["Quality Score (Recency, Length)"]
Quality --> Filter["Filter Injection Patterns"]
Filter --> Return["Return Context + Sources"]
```

**Diagram sources**
- [rag.ts:186-800](file://src/lib/ai/rag.ts#L186-L800)

**Section sources**
- [rag.ts:18-800](file://src/lib/ai/rag.ts#L18-L800)

### Web Search and Fresh Evidence
- Topic detection and regional domain steering
  - Finance/news/general topics guide Tavily search and domain lists.
- Circuit breaker and graceful degradation
  - Consecutive failures tracked in Redis; degraded behavior on outages.
- Snippet sanitization
  - Injection pattern filtering and Unicode normalization prevent prompt injection.

```mermaid
flowchart TD
WSStart["searchWeb(query, region, complexity)"] --> Client{"Tavily API Key?"}
Client --> |No| Empty["Return Empty"]
Client --> |Yes| Cache{"Cache Hit?"}
Cache --> |Yes| Return["Return Cached"]
Cache --> |No| Topic["Resolve Topic + Domains"]
Topic --> Call["Call Tavily"]
Call --> Sanitize["Sanitize Results"]
Sanitize --> Circuit["Increment Circuit Breaker"]
Circuit --> Save["Cache + Return"]
```

**Diagram sources**
- [search.ts:167-337](file://src/lib/ai/search.ts#L167-L337)

**Section sources**
- [search.ts:167-337](file://src/lib/ai/search.ts#L167-L337)

### Context Building and Compression
- Structured context assembly
  - Asset identity, price, engine scores, regime, top movers, region, enrichment, portfolio context, comparison cards, available assets.
- Response-mode and tier-aware truncation
  - Truncates at sentence boundaries to preserve coherence and fit token budgets.
- Behavioral coaching
  - Optional mentoring message injected for MODERATE/COMPLEX tiers.

```mermaid
flowchart TD
CtxStart["buildCompressedContext(...)"] --> Asset["Asset Identity + Focus"]
Asset --> Price["Real-Time Price"]
Price --> Scores["Engine Scores + Chain"]
Scores --> Regime["Regime + Top Movers"]
Regime --> Enrich["Asset Enrichment (Conditional)"]
Enrich --> Portfolio["Portfolio Health/Fragility/Simulation"]
Portfolio --> RAG["Institutional Knowledge"]
RAG --> Memory["User Memory + Profile + Session"]
Memory --> Cross["Cross-Sector / Analogs / Behavior Insights"]
Cross --> Assets["Available Assets (Smart Subset)"]
Assets --> Trunc["Tier/Mode Aware Truncation"]
Trunc --> CtxEnd["Final Context String"]
```

**Diagram sources**
- [context-builder.ts:80-618](file://src/lib/ai/context-builder.ts#L80-L618)

**Section sources**
- [context-builder.ts:80-618](file://src/lib/ai/context-builder.ts#L80-L618)

### User Memory and Long-Term Personalization
- Distillation and consolidation
  - Single nano call extracts durable notes and merges with global notes.
- Injection guards and schema validation
  - Zod schema validates outputs; injection patterns filtered at ingestion and read time.
- Distributed locking
  - Redis SET NX prevents concurrent writes across instances.

```mermaid
sequenceDiagram
participant SVC as "service.ts"
participant MEM as "memory.ts"
participant DB as "Prisma DB"
SVC->>MEM : distillSessionNotes(userId, messages, source)
MEM->>MEM : Build Combined Prompt
MEM->>MEM : callNano(prompt)
MEM->>MEM : safeParseNotes(raw)
MEM->>DB : Transaction : Delete Old + Insert New Notes
DB-->>MEM : OK
MEM-->>SVC : Updated Global Notes
```

**Diagram sources**
- [memory.ts:174-347](file://src/lib/ai/memory.ts#L174-L347)

**Section sources**
- [memory.ts:174-347](file://src/lib/ai/memory.ts#L174-L347)

### Cost Management and Billing
- Token-based cost calculation
  - Pricing tiers for gpt-5.4, gpt-5.4-mini, gpt-5.4-nano; cached input costs discounted.
- Daily token caps and credit checks
  - Redis-based counters and per-plan caps; ENTERPRISE bypasses credits.
- Refund on stream errors
  - Mid-stream failures trigger credit refunds to avoid charging broken streams.

```mermaid
flowchart TD
Start(["Before Stream"]) --> Cap["Check Daily Token Cap"]
Cap --> |Exceeded| Deny["UsageLimitError"]
Cap --> |OK| Credits["Consume Credits (if not ENTERPRISE)"]
Credits --> Stream["Generate Stream"]
Stream --> Cost["calculateLLMCost(...)"]
Stream --> |Error Mid-Stream| Refund["Refund Credits"]
Cost --> Log["Log Usage + Alerts"]
```

**Diagram sources**
- [service.ts:656-700](file://src/lib/ai/service.ts#L656-L700)
- [cost-calculator.ts:293-313](file://src/lib/ai/cost-calculator.ts#L293-L313)

**Section sources**
- [service.ts:656-700](file://src/lib/ai/service.ts#L656-L700)
- [cost-calculator.ts:293-313](file://src/lib/ai/cost-calculator.ts#L293-L313)

### Support AI System with RAG and BM25
- RAG skip heuristic
  - Short definitional questions (<40 chars) without specific keywords bypass RAG.
- BM25-based search
  - PostgreSQL tsvector-based keyword matching for the support knowledge base; fast (<10ms), zero API calls, with fallback to vector search if results are insufficient.
- Deduplication and quality
  - Duplicate content deduplication and pattern-based filtering.

```mermaid
flowchart TD
Msg["User Message"] --> Len["Length Check"]
Len --> |<40 chars & No Keywords| Skip["Skip RAG (Static Prompt)"]
Len --> |Else| BM25["BM25 Keyword Search"]
BM25 --> Results{"Results >= 2?"}
Results --> |Yes| Return["Return BM25 Results"]
Results --> |No| Vector["Vector Search Fallback"]
Vector --> Return
```

**Diagram sources**
- [ai-responder.ts:222-277](file://src/lib/support/ai-responder.ts#L222-L277)
- [ai-responder.ts:264-277](file://src/lib/support/ai-responder.ts#L264-L277)

**Section sources**
- [ai-responder.ts:222-277](file://src/lib/support/ai-responder.ts#L222-L277)
- [ai-responder.ts:264-277](file://src/lib/support/ai-responder.ts#L264-L277)

### Personal Briefing AI and Market Analysis AI
- Personal briefing AI
  - Endpoint routes under src/app/api/lyra/personal-briefing-ai and related personal-briefing endpoints integrate the AI pipeline for tailored daily insights.
- Market analysis AI
  - Market, discovery, intelligence, and portfolio endpoints leverage the same orchestration for contextual analysis and synthesis.

**Section sources**
- [route.ts](file://src/app/api/lyra/personal-briefing-ai/route.ts)
- [route.ts](file://src/app/api/lyra/personal-briefing/route.ts)
- [route.ts](file://src/app/api/cron/daily-briefing/route.ts)
- [route.ts](file://src/app/api/discovery/search/route.ts)
- [route.ts](file://src/app/api/discovery/feed/route.ts)
- [route.ts](file://src/app/api/discovery/explain/route.ts)
- [route.ts](file://src/app/api/market/factor-rotation/route.ts)
- [route.ts](file://src/app/api/market/regime-multi-horizon/route.ts)
- [route.ts](file://src/app/api/market/volatility-structure/route.ts)
- [route.ts](file://src/app/api/market/breadth/route.ts)
- [route.ts](file://src/app/api/market/correlation-stress/route.ts)
- [route.ts](file://src/app/api/intelligence/feed/route.ts)
- [route.ts](file://src/app/api/intelligence/analog/route.ts)
- [route.ts](file://src/app/api/intelligence/calendars/route.ts)
- [route.ts](file://src/app/api/portfolio/route.ts)
- [route.ts](file://src/app/api/portfolio/[id]/route.ts)
- [route.ts](file://src/app/api/portfolio/asset-search/route.ts)

### Admin Operations and Monitoring
- Admin endpoints for AI costs, limits, and operations expose controls for daily token caps, cost monitoring, and operational dashboards.
- Monitoring hooks for model cache events, retrieval metrics, and context budget metrics.

**Section sources**
- [route.ts](file://src/app/api/admin/ai-costs/route.ts)
- [route.ts](file://src/app/api/admin/ai-limits/route.ts)
- [route.ts](file://src/app/api/admin/ai-ops/route.ts)
- [route.ts](file://src/app/api/admin/analytics/route.ts)
- [route.ts](file://src/app/api/admin/usage/route.ts)

## Security and Reliability Enhancements

### Advanced Input Validation Pipeline
The system now implements a comprehensive multi-layered security validation pipeline designed to prevent various attack vectors:

- **Unicode Normalization**: All input validation operates on NFKC-normalized text to defeat homoglyph evasion attacks that attempt to bypass regex patterns using visually similar characters.
- **Conversation Length Limits**: Prevents context-window exhaustion with a 50,000 character cap on total conversation history.
- **Base64 Payload Detection**: Scans for encoded injection attempts using Shannon entropy analysis with a 5.8-bit threshold and requires minimum suspicious runs (≥2) to trigger blocking.
- **Expanded Prompt Injection Patterns**: Comprehensive regex coverage for role hijacking, instruction override, system prompt manipulation, and XML-style injection attempts.
- **Intent-Aware Financial Guardrails**: Blocks prohibited language and prediction requests while allowing legitimate financial analysis queries.

### Output Validation and Semantic Consistency
Post-processing validation ensures response quality and factual accuracy:

- **Tier-Aware Structural Validation**: Different section requirements based on plan tier (STARTER requires 3 sections, PRO requires 6, ELITE requires 6).
- **Follow-up Question Compliance**: Ensures exactly 3 follow-up questions are provided in all responses.
- **Semantic Consistency Checking**: For ELITE/COMPLEX tiers, validates factual claims against retrieved context with confidence scoring.
- **Non-Blocking Validation**: Never prevents user delivery; only logs warnings for monitoring and improvement.

### Streaming Response Caching and Fallback Management
Enhanced reliability through intelligent caching and progressive fallback mechanisms:

- **Late Cache Hit Processing**: Processes cache hits after context building with proper cost tracking and conversation logging.
- **Progressive Fallback Chain**: From full to mini to nano deployments with configurable timeouts and token budgets.
- **Automatic Credit Refunds**: Prevents billing for broken streams with automatic refund processing.
- **Distributed Locking**: Prevents concurrent memory updates across instances.

**Section sources**
- [guardrails.ts:173-258](file://src/lib/ai/guardrails.ts#L173-L258)
- [output-validation.ts:107-496](file://src/lib/ai/output-validation.ts#L107-L496)
- [cache-handler.ts:38-86](file://src/lib/ai/streaming/cache-handler.ts#L38-L86)
- [fallback-chain.ts:57-209](file://src/lib/ai/streaming/fallback-chain.ts#L57-L209)
- [utils.ts:20-46](file://src/lib/ai/streaming/utils.ts#L20-L46)
- [memory.ts:256-271](file://src/lib/ai/memory.ts#L256-L271)

## Dependency Analysis
- Cohesion and coupling
  - service.ts orchestrates tightly with config.ts, guardrails.ts, output-validation.ts, streaming utilities, rag.ts, search.ts, context-builder.ts, memory.ts, and cost-calculator.ts.
  - Low coupling via typed interfaces (e.g., LyraMessage, Source) and shared types (e.g., COMMON_WORDS, AssetEnrichment).
- External dependencies
  - Azure OpenAI (AI SDK and embeddings), Tavily for web search, Prisma/pgvector for RAG, Redis for caching and coordination.
- Potential circular dependencies
  - None observed among the analyzed modules; orchestration depends on config, not vice versa.

```mermaid
graph LR
SVC["service.ts"] --> CFG["config.ts"]
SVC --> GUARD["guardrails.ts"]
SVC --> OUTVAL["output-validation.ts"]
SVC --> STREAM["streaming/utils.ts"]
SVC --> FALLBACK["streaming/fallback-chain.ts"]
SVC --> CACHE["streaming/cache-handler.ts"]
SVC --> RAG["rag.ts"]
SVC --> SEARCH["search.ts"]
SVC --> CTX["context-builder.ts"]
SVC --> MEM["memory.ts"]
SVC --> COST["cost-calculator.ts"]
CFG --> ORCH["orchestration.ts"]
```

**Diagram sources**
- [service.ts:1-50](file://src/lib/ai/service.ts#L1-L50)
- [config.ts:1-25](file://src/lib/ai/config.ts#L1-L25)
- [orchestration.ts:1-8](file://src/lib/ai/orchestration.ts#L1-L8)
- [guardrails.ts:1-259](file://src/lib/ai/guardrails.ts#L1-L259)
- [output-validation.ts:1-496](file://src/lib/ai/output-validation.ts#L1-L496)
- [fallback-chain.ts:1-245](file://src/lib/ai/streaming/fallback-chain.ts#L1-L245)
- [cache-handler.ts:1-88](file://src/lib/ai/streaming/cache-handler.ts#L1-L88)
- [rag.ts:1-15](file://src/lib/ai/rag.ts#L1-L15)
- [search.ts:1-10](file://src/lib/ai/search.ts#L1-L10)
- [context-builder.ts:1-5](file://src/lib/ai/context-builder.ts#L1-L5)
- [memory.ts:1-10](file://src/lib/ai/memory.ts#L1-L10)
- [cost-calculator.ts:1-10](file://src/lib/ai/cost-calculator.ts#L1-L10)

**Section sources**
- [service.ts:1-50](file://src/lib/ai/service.ts#L1-L50)
- [config.ts:1-25](file://src/lib/ai/config.ts#L1-L25)

## Performance Considerations
- Latency optimization
  - Early model cache, educational cache, asset-type fast-path, and BM25 for support KB minimize API calls and latency.
  - Streaming response caching reduces latency for repeated queries and trivial responses.
- Throughput and cost control
  - Tiered routing, daily token caps, and credit checks prevent runaway usage.
  - Progressive fallback chain ensures continued service during partial outages.
- Resilience
  - Embedding retries, circuit-breaker for web search, and graceful degradation ensure availability under partial outages.
  - Automatic credit refunds prevent billing for broken streams and maintain user trust.

## Troubleshooting Guide
- Mid-stream LLM failures
  - Credits are refunded automatically to avoid charging broken streams.
- Web search outages
  - Circuit-breaker increments and degraded behavior; alerts triggered after threshold breaches.
- RAG poisoning or low-quality results
  - Injection pattern filtering and quality scoring reduce risk; embedding failures degrade gracefully.
- Daily token cap exceeded
  - UsageLimitError thrown with reset timestamp for midnight UTC.
- Security violations
  - SafetyViolationError thrown with specific reason for blocked input; see guardrails.ts for exact violation reasons.
- Output validation warnings
  - Non-blocking warnings logged for monitoring; responses still delivered to users.

**Section sources**
- [service.ts:63-89](file://src/lib/ai/service.ts#L63-L89)
- [search.ts:306-337](file://src/lib/ai/search.ts#L306-L337)
- [rag.ts:389-412](file://src/lib/ai/rag.ts#L389-L412)
- [service.ts:656-676](file://src/lib/ai/service.ts#L656-L676)
- [guardrails.ts:7-39](file://src/lib/ai/guardrails.ts#L7-L39)
- [output-validation.ts:206-238](file://src/lib/ai/output-validation.ts#L206-L238)

## Conclusion
The AI Services Integration provides a robust, cost-conscious, and resilient system for personal briefing, market analysis, and support. It leverages multi-model orchestration, RAG with fast-path caches, web search, structured context building, and long-term user memory to deliver contextual, grounded, and efficient AI responses. Built-in cost controls, fallbacks, monitoring, and comprehensive security guardrails ensure reliability and sustainability at scale. The enhanced security validation pipeline, output validation system, and streaming response caching provide additional layers of protection and performance optimization.

## Appendices

### AI Interaction Patterns
- Personal briefing AI
  - Route: POST /api/lyra/personal-briefing-ai
  - Pattern: Streamed response with RAG, web search, and asset enrichment; tiered cost control; comprehensive security validation.
- Market analysis AI
  - Routes: /api/discovery/*, /api/market/*, /api/intelligence/*
  - Pattern: Contextual synthesis with cross-sector and portfolio data; mode-aware truncation; output validation.
- Support AI
  - Routes: /api/support/*
  - Pattern: BM25 for KB, RAG fallback, and injection guards; public chat and voice session variants.

**Section sources**
- [route.ts](file://src/app/api/lyra/personal-briefing-ai/route.ts)
- [route.ts](file://src/app/api/discovery/search/route.ts)
- [route.ts](file://src/app/api/market/factor-rotation/route.ts)
- [route.ts](file://src/app/api/support/public-chat/route.ts)
- [route.ts](file://src/app/api/support/voice-session/route.ts)

### Configuration and Provider Switching
- Environment variables
  - AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_CHAT_DEPLOYMENT, AZURE_OPENAI_EMBEDDING_DEPLOYMENT, AZURE_RESPONSES_API_ENABLED, AZURE_NATIVE_WEB_SEARCH_ENABLED.
- Deployment keys
  - AZURE_OPENAI_DEPLOYMENT_LYRA_FULL, LYRA_MINI, LYRA_NANO, MYRA.
- Hot-patchable daily token caps via Redis hash.

**Section sources**
- [config.ts:64-122](file://src/lib/ai/config.ts#L64-L122)
- [config.ts:33-62](file://src/lib/ai/config.ts#L33-L62)
- [service.ts:143-156](file://src/lib/ai/service.ts#L143-L156)

### Cost Management Examples
- Estimating cost
  - calculateLLMCost(inputTokens, outputTokens, cachedInputTokens, model) returns input, cached input, output, and total cost.
- Daily token cap enforcement
  - getEffectiveDailyTokenCaps merges defaults with Redis overrides; incrementDailyTokens and getDailyTokensUsed manage counters.

**Section sources**
- [cost-calculator.ts:293-313](file://src/lib/ai/cost-calculator.ts#L293-L313)
- [service.ts:143-206](file://src/lib/ai/service.ts#L143-L206)

### AI-Powered Content Generation Workflows
- Personal briefing
  - Classify query complexity, resolve plan tier, validate input security, assemble context (RAG, web, memory, enrichment), stream response, validate output, log usage, and enforce cost caps.
- Market narrative tracker
  - Combine institutional knowledge, cross-sector context, and portfolio signals for narrative synthesis with semantic consistency checking.
- Support responder
  - Detect trivial queries, BM25 search, RAG fallback, and injection guards before generating contextual answers with output validation.

**Section sources**
- [service.ts:455-700](file://src/lib/ai/service.ts#L455-L700)
- [guardrails.ts:232-258](file://src/lib/ai/guardrails.ts#L232-L258)
- [output-validation.ts:426-496](file://src/lib/ai/output-validation.ts#L426-L496)
- [rag.ts:1033-1049](file://src/lib/ai/rag.ts#L1033-L1049)
- [ai-responder.ts:222-277](file://src/lib/support/ai-responder.ts#L222-L277)