# Deep Code Review: Performance & Optimization Recommendations

**Date:** April 2026  
**Scope:** LyraAlpha AI Service Layer & Related Systems  
**Priority:** High-impact, low-risk improvements

---

## 1. CRITICAL: AI Service File Size & Complexity

### Issue
`src/lib/ai/service.ts` is 1,684 lines — violates single responsibility principle.

### Impact
- Slow compile times
- Difficult testing
- Merge conflicts
- Cognitive load

### Recommendations

```typescript
// Extract these to separate modules:

// 1. src/lib/ai/asset-resolution.ts (lines 189-319)
//    - getAvailableAssetSymbols
//    - parseMarketCapValue
//    - inferSearchRegion
//    - scoreAssetCandidate
//    - resolveAssetFromShortQuery

// 2. src/lib/ai/cache-strategies.ts (lines 513-584, 1347-1435)
//    - Early/late cache hit handlers
//    - Cache key generation helpers
//    - TTL resolution logic

// 3. src/lib/ai/context-assembly.ts (lines 1092-1423)
//    - Parallel task orchestration
//    - Context message building
//    - History compression coordination

// 4. src/lib/ai/response-streaming.ts (lines 1467-1683)
//    - streamText configuration
//    - onFinish callback logic
//    - Fallback chain invocation
```

**Estimated benefit:** 40% reduction in compile time, improved testability

---

## 2. HIGH: Array Chain Optimization

### Issue
Multiple `.map().filter()` chains create intermediate arrays (memory pressure)

### Locations
```typescript
// service.ts:298-302 (3 iterations over same data)
const ranked = candidates
  .map((asset) => ({...}))
  .filter((c) => c.score >= 500)
  .map((c) => ({ ...c, marketCapValue: ... }))
  .sort(...)

// output-validation.ts:331-348 (array spread in loop)
claims.push(...numberMatches.slice(0, 5));

// market-sync.service.ts:302-304 (filter after map)
const cryptoAssetIds = markets
  .map((m) => { ... })
  .filter(Boolean)
```

### Optimized Pattern
```typescript
// Single-pass with reduce
const ranked = candidates.reduce((acc, asset) => {
  const score = scoreAssetCandidate(...);
  if (score >= 500) {
    acc.push({
      asset,
      score,
      marketCapValue: parseMarketCapValue(asset.marketCap)
    });
  }
  return acc;
}, [] as Array<{asset: typeof candidates[0], score: number, marketCapValue: number}>)
.sort((a, b) => ...);
```

**Estimated benefit:** 15-30% reduction in memory allocation during asset resolution

---

## 3. HIGH: Inefficient String Operations

### Issue
Repeated string operations in hot paths

### Locations
```typescript
// service.ts:379-393 (query extraction)
const query = typeof lastUserMessage?.content === "string"
  ? lastUserMessage.content
  : Array.isArray(lastUserMessage?.content)
    ? (lastUserMessage.content as unknown[])
        .filter(...)
        .map(...)
        .join(" ")
    : "Multimodal Input";

// context-builder.ts:150-155 (repeated string concat)
return messages
  .filter(...)
  .map((m) => {
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return `${m.role === "user" ? "User" : assistantLabel}: ${content.slice(0, 400)}`;
  })
  .join("\n");
```

### Optimizations
```typescript
// 1. Use StringBuilder pattern for large concatenations
function extractQuery(message: LyraMessage): string {
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "Multimodal Input";
  
  // Pre-size array if possible
  const parts: string[] = [];
  for (const part of message.content) {
    if (isTextPart(part)) parts.push(part.text);
  }
  return parts.join(" ");
}

// 2. Avoid JSON.stringify in hot paths — use type guards
const content = typeof m.content === "string" 
  ? m.content 
  : fastStringify(m.content); // custom fast path
```

**Estimated benefit:** 10-20% faster context building

---

## 4. MEDIUM: Regex Compilation

### Issue
Dynamic regex creation in loops/functions

### Locations
```typescript
// service.ts:270-272 (per-request compilation)
const wordBoundaryRe = new RegExp(`\\b${escapedQuery}\\b`, "i");

// output-validation.ts:328-346 (4 regexes compiled per validation)
const numberUnitPattern = /.../gi;  // recompiled each call
const datePattern = /.../gi;
```

### Optimizations
```typescript
// 1. Pre-compile static patterns at module level
const WORD_BOUNDARY_CACHE = new Map<string, RegExp>();
function getWordBoundaryRegex(query: string): RegExp {
  const cached = WORD_BOUNDARY_CACHE.get(query);
  if (cached) return cached;
  
  const re = new RegExp(`\\b${escapeRegex(query)}\\b`, "i");
  if (WORD_BOUNDARY_CACHE.size < 1000) {
    WORD_BOUNDARY_CACHE.set(query, re);
  }
  return re;
}

// 2. Move static patterns outside functions
const SEMANTIC_NUMBER_PATTERN = /(?:\$|€|₹|£)?\s?\d[\d,.]+(?:\s?(?:million|billion|...))?/gi;
const SEMANTIC_DATE_PATTERN = /.../gi;
```

**Estimated benefit:** Eliminate ~500 regex compilations per 1000 requests

---

## 5. MEDIUM: Promise.all Overhead

### Issue
`Promise.all` with conditional promises creates unnecessary promise objects

### Locations
```typescript
// service.ts:829-851
const ragWork = Promise.all([
  retrieveInstitutionalKnowledge(...),
  tierConfig.ragMemoryEnabled && safeMessages.length >= 4
    ? retrieveUserMemory(...)
    : Promise.resolve(""),  // Creates resolved promise every time
  tier !== "SIMPLE" && safeMessages.length >= 2 
    ? getGlobalNotes(...) 
    : Promise.resolve(""),
  ...
]);
```

### Optimizations
```typescript
// Build array dynamically
const ragTasks: Promise<unknown>[] = [
  retrieveInstitutionalKnowledge(...)
];

if (tierConfig.ragMemoryEnabled && safeMessages.length >= 4) {
  ragTasks.push(retrieveUserMemory(...));
}
if (tier !== "SIMPLE" && safeMessages.length >= 2) {
  ragTasks.push(getGlobalNotes(...));
  ragTasks.push(getSessionNotes(...));
}

const ragResult = await Promise.race([
  Promise.all(ragTasks),
  ragTimeout
]);
```

**Estimated benefit:** Fewer promise allocations, cleaner stack traces

---

## 6. MEDIUM: Cache Stampede Risk

### Issue
Multiple concurrent cache misses for same key trigger duplicate work

### Locations
```typescript
// lyra-cache.ts:76-86 (no deduplication)
export async function getEduCacheValue<T>(key: string): Promise<T | null> {
  if (!EDU_CACHE_ENABLED) return null;
  const { getCache } = await import("@/lib/redis");
  return getCache<T>(key);  // N concurrent calls = N Redis round-trips
}

// service.ts:537-583 (early cache check)
const earlyCacheText = await getCache<string>(earlyGptKey);
```

### Optimizations
```typescript
// Implement request coalescing
const pendingGets = new Map<string, Promise<unknown>>();

export async function getCacheCoalesced<T>(key: string): Promise<T | null> {
  const pending = pendingGets.get(key);
  if (pending) return pending as Promise<T | null>;
  
  const promise = getCache<T>(key).finally(() => {
    pendingGets.delete(key);
  });
  pendingGets.set(key, promise);
  return promise;
}
```

**Estimated benefit:** Prevents thundering herd on cache expiry

---

## 7. LOW: Unnecessary Object Spreads

### Issue
Object spread for small updates creates GC pressure

### Locations
```typescript
// service.ts:460-466 (tierConfig override)
tierConfig = {
  ...getTierConfig("ELITE", "COMPLEX"),
  maxTokens: userMaxTokens,
};

// service.ts:366-370 (message cloning)
const safeMessages: LyraMessage[] = messages.map((m) => {
  if (Array.isArray(m.content)) {
    return { ...m, content: [...m.content] } as typeof m;
  }
  return { ...m };
});
```

### Optimizations
```typescript
// For tierConfig, use Object.assign (mutates reference)
const eliteConfig = getTierConfig("ELITE", "COMPLEX");
tierConfig = Object.assign(eliteConfig, { maxTokens: userMaxTokens });

// For messages, consider if shallow copy is truly needed
// If callers don't mutate, skip the copy entirely
```

---

## 8. LOW: Numeric Precision in Logging

### Issue
`.toFixed()` creates string allocations for every log entry

### Locations
```typescript
// output-validation.ts:438-448
confidence: Number(result.confidence.toFixed(2)),

// service.ts:1506
duration: `${(durationMs / 1000).toFixed(1)}s`,
```

### Recommendation
Use integer scaling or defer formatting to log ingestion:
```typescript
// Instead of toFixed(2), store as integer (0-10000)
confidence: Math.round(result.confidence * 100), // basis points
```

---

## 9. ARCHITECTURE: Streaming Response Optimization

### Current Flow
```
Request → Parallel Tasks → LLM Stream → Buffer All → Respond
```

### Optimized Flow
```
Request → Start LLM Stream → Backpressure-aware piping → Client
         ↓
    Fire-and-forget side effects (logging, caching, etc.)
```

### Implementation
```typescript
// Use TransformStream for zero-copy piping
const transform = new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk);
    // Side effects on chunk (non-blocking)
    logChunkMetrics(chunk).catch(() => {});
  }
});

return result.textStream.pipeThrough(transform);
```

---

## 10. DATABASE: Query Optimization

### Issue
N+1 patterns in parallel task execution

### Current
```typescript
// Task 1: RAG (embedding API call)
// Task 2: Asset enrichment (DB query)
// Task 3: Price data (DB query)
// Task 4: Cross-sector (DB query)
```

### Optimized
```typescript
// Batch related queries
const [assetData, marketRegime] = await Promise.all([
  prisma.asset.findUnique({ ... }),
  prisma.marketRegime.findFirst({ ... }),
]);

// Consider DataLoader pattern for repeated lookups
const assetLoader = new DataLoader(async (symbols: string[]) => {
  const assets = await prisma.asset.findMany({
    where: { symbol: { in: symbols } }
  });
  return symbols.map(s => assets.find(a => a.symbol === s));
});
```

---

## Quick Wins Checklist

- [ ] Extract asset resolution to separate file (1-2 hours)
- [ ] Replace `.map().filter()` chains with `.reduce()` (2-3 hours)
- [ ] Pre-compile regex patterns at module level (30 min)
- [ ] Implement cache request coalescing (2 hours)
- [ ] Remove unnecessary message cloning if safe (30 min)
- [ ] Add DataLoader for asset lookups (3-4 hours)

---

## Measurement Strategy

Before optimizing, add these metrics:

```typescript
// Performance.mark for key phases
performance.mark('rag-start');
await retrieveInstitutionalKnowledge(...);
performance.mark('rag-end');
performance.measure('rag-duration', 'rag-start', 'rag-end');

// Memory profiling
const heapStats = v8.getHeapStatistics();
logger.debug({ 
  usedHeapSize: heapStats.used_heap_size,
  totalHeapSize: heapStats.total_heap_size 
}, 'Memory snapshot');
```

---

## Files to Prioritize

| File | Lines | Priority | Effort |
|------|-------|----------|--------|
| `service.ts` | 1,684 | Critical | High |
| `rag.ts` | 1,245 | High | Medium |
| `market-sync.service.ts` | ~800 | Medium | Medium |
| `output-validation.ts` | 454 | Low | Low |

---

**Next Steps:**
1. Start with file extraction (#1) — biggest maintainability win
2. Add performance.mark instrumentation
3. Address array chains (#2) — measurable memory improvement
4. Implement cache coalescing (#6) — production stability
