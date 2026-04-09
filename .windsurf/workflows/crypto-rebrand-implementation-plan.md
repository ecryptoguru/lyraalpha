---
description: Crypto-only rebrand implementation plan for LyraAlpha
---

# LyraAlpha Crypto-Only Rebrand — Implementation Plan

**Objective:** Pivot LyraAlpha from a multi-asset platform (stocks, ETFs, mutual funds, commodities, crypto) to a crypto-only market intelligence and analytics platform.

## Phase 1: Deep Cleanup (COMPLETED ✅)

### 1.1 Remove Non-Crypto Asset Sync Services
- ✅ Deleted `src/lib/services/finnhub-sync.service.ts` (Finnhub stock/ETF data)
- ✅ Deleted `src/lib/services/mutual-fund-sync.service.ts`
- ✅ Deleted `src/lib/services/nse-india.service.ts` (NSE India stock data)
- ✅ Deleted `src/lib/services/mf-holdings-scraper.service.ts` (mutual fund holdings)
- ✅ Deleted `src/lib/services/metals-dev.service.ts` (commodity price data)

### 1.2 Remove Obsolete Cron Routes
- ✅ Deleted `full-sync` route
- ✅ Deleted `india-sync`, `in-market-sync`, `in-eod-sync`, `in-eod-pipeline`, `in-eod-postprocess` routes
- ✅ Deleted `us-market-sync`, `us-eod-sync`, `us-eod-stocks-sync`, `us-eod-etfs-sync`, `us-eod-commodities-sync`, `us-eod-pipeline`, `us-eod-postprocess` routes
- ✅ Deleted `mf-holdings-sync` route

**Active cron routes retained:**
- `crypto-sync` — crypto market data sync via CoinGecko
- `us-eod-crypto-sync` — US EOD crypto data
- `news-sync` — crypto news via CryptoPanic
- `daily-briefing` — daily intelligence briefing
- `trending-questions` — trending question generation
- `housekeeping` — cache invalidation and maintenance

### 1.3 Remove Legacy Scripts
- ✅ Deleted `scripts/master-sync.ts`
- ✅ Deleted `scripts/init-database.ts`
- ✅ Deleted `scripts/enrich-us-assets.ts`
- ✅ Deleted `scripts/enrich-in-stocks.ts`
- ✅ Deleted `scripts/enrich-mutual-funds.ts`
- ✅ Deleted `scripts/enrich-commodity-futures.ts`
- ✅ Deleted `scripts/compute-in-dynamics.ts`
- ✅ Deleted `scripts/run-compute.ts`
- ✅ Deleted `scripts/setup-eventbridge-schedules.ts`

### 1.4 Clean Package.json
- ✅ Removed `stock-nse-india` dependency
- ✅ Removed npm scripts: `master-sync`, `db:init`, `db:init:skip-mc`, `sync:us`, `sync:india`

### 1.5 Update QStash Schedule Setup
- ✅ Updated `scripts/setup-qstash-schedules.ts` to remove deleted cron routes
- ✅ Retained only active crypto and product cron jobs

### 1.6 Fix Code References
- ✅ Cleaned `src/lib/services/market-sync.service.ts` — removed dead imports and methods
- ✅ Cleaned `src/lib/market-data.ts` — removed mutual-fund interceptor and dead import
- ✅ Cleaned `src/app/api/cron/crypto-sync/route.ts` — removed Finnhub dependency
- ✅ Cleaned `src/app/api/cron/news-sync/route.ts` — aligned to crypto-only news
- ✅ Removed `FinnhubIntelligenceCard` import and usage from `src/app/dashboard/assets/[symbol]/page.tsx`

### 1.7 Clean Environment Variables
- ✅ Removed `FINNHUB_API_KEY` from `.env` and `.env.aws.template`
- ✅ Removed `METALS_DEV_API_KEY` from `.env` and `.env.aws.template`
- ✅ Removed `VOICE_SESSION_SECRET`, `VOICE_STT_MODEL`, `VOICE_TTS_MODEL` (unused voice features)
- ✅ Removed `AZURE_OPENAI_DEPLOYMENT_VOICE` (unused voice deployment)
- ✅ Removed `DEEPGRAM_API_KEY`, `DEEPGRAM_ALLOW_DIRECT_API_KEY_FALLBACK` (unused voice transcription)

### 1.8 Delete Dead UI Components
- ✅ Deleted `src/components/analytics/finnhub-intelligence-card.tsx`

### 1.9 Validation
- ✅ Ran typecheck — passes clean
- ✅ Removed stale `.next` generated artifacts

---

## Phase 2: Page Updates (PENDING)

### 2.1 Landing Page (`src/app/page.tsx`)
- [ ] Update metadata and description to reflect crypto-only positioning
- [ ] Remove "5 asset classes" reference
- [ ] Update hero copy to emphasize crypto market intelligence

### 2.2 Dashboard Home (`src/app/dashboard/page.tsx`)
- [ ] Remove non-crypto shortcuts (Portfolio stress, Multibagger Radar)
- [ ] Update region filter context for crypto-only
- [ ] Remove references to stock/ETF/mutual fund/commodity features

### 2.3 Discovery Page (`src/app/dashboard/discovery/page.tsx`)
- [ ] Filter discovery feed to show only crypto assets
- [ ] Repurpose region filter for crypto-specific contexts (e.g., BTC/ETH, DeFi, NFTs)
- [ ] Update "Sector Pulse" and "Multibagger Radar" tabs for crypto relevance

### 2.4 Assets Page (`src/app/dashboard/assets/page.tsx`)
- [ ] Rename to "Crypto Intel"
- [ ] Remove non-crypto asset type filters (STOCK, ETF, COMMODITY, MUTUAL_FUND)
- [ ] Update top movers to show crypto only
- [ ] Update search to crypto symbols only

### 2.5 Macro Page (`src/app/dashboard/macro/page.tsx`)
- [ ] Re-imagine for crypto-native indicators
- [ ] Replace GDP, CPI, policy indicators with:
  - BTC Dominance
  - Fear & Greed Index
  - On-chain metrics (active addresses, whale activity)
  - DeFi TVL trends
- [ ] Update Lyra prompts for crypto macro context

---

## Phase 3: AI Prompt Updates (PENDING)

### 3.1 System Prompts (`src/lib/ai/prompts/system.ts`)
- [ ] Remove STOCK, ETF, MUTUAL_FUND, COMMODITY, GLOBAL asset type guidance
- [ ] Strengthen CRYPTO asset type expertise
- [ ] Update core rules to emphasize crypto-specific analysis
- [ ] Remove legacy multi-asset follow-up questions

### 3.2 Plan Facts (`src/lib/plans/facts.ts`)
- [ ] Update `PLAN_MARKET_ACCESS` to reflect crypto-only asset types
- [ ] Remove stock/ETF/mutual fund/commodity access references
- [ ] Update `buildMyraPlatformFacts` to describe crypto-only coverage

### 3.3 Discovery Feed Service (`src/lib/services/discovery-feed.service.ts`)
- [ ] Remove `TYPE_MAP` entries for stock, etf, commodity, mf
- [ ] Update `canAccessAssetType` to only allow CRYPTO
- [ ] Filter Prisma queries to only return crypto assets
- [ ] Remove region-based filtering logic (replace with crypto context)

---

## Phase 4: Documentation Updates (PENDING)

### 4.1 CODEBASE.md
- [ ] Update "What this app is" section to reflect crypto-only positioning
- [ ] Remove multi-asset references from architecture overview
- [ ] Update service descriptions to remove Finnhub, Metals-Dev, etc.
- [ ] Clean up any remaining legacy references

### 4.2 AWS_MIGRATION_GUIDE.md
- [ ] Remove references to deleted scripts (master-sync, init-database, etc.)
- [ ] Update cron job list to reflect active crypto-only routes
- [ ] Clean up any legacy sync service references

### 4.3 README.md
- [ ] Update project description to crypto-only market intelligence
- [ ] Remove multi-asset feature mentions

---

## Phase 5: Validation (PENDING)

### 5.1 End-to-End Validation
- [ ] Run full typecheck after all updates
- [ ] Test dashboard navigation with crypto-only filters
- [ ] Test discovery feed with crypto-only results
- [ ] Test Lyra AI with crypto-specific queries
- [ ] Verify no broken references to deleted services
- [ ] Run E2E tests to ensure no regressions

---

## Notes

### What Was Left Intact (Balanced Approach)
- `yahoo-finance2` package — still imported by `market-data.ts` for potential commodity/ETF history fallbacks
- Commodity intelligence engines — asset model still supports COMMODITY type; full removal requires schema changes
- `.env` runtime flags — `ENABLE_LEGACY_YAHOO_INTELLIGENCE`, `ENABLE_EDU_CACHE`, `ENABLE_TRENDING_FALLBACK` kept as they may have crypto relevance
- Sidebar sections — not deleted as requested

### Key Files Still Referencing Legacy Data (To Be Addressed in Phase 2-3)
- `src/lib/services/market-sync.service.ts` — still has comments and metadata field references to Finnhub data (these are in DB metadata, not active sync)
- `src/lib/ai/context-builder.ts` — may have Finnhub references in context building
- `src/app/api/intelligence/calendars/route.ts` — may reference Finnhub calendars
- `src/lib/data-quality/reliability.test.ts` — test file with Finnhub references

These will be cleaned as part of the page and prompt updates in Phase 2-3.

---

## Verification Checklist

After completing all phases:

- [ ] Typecheck passes with zero errors
- [ ] No runtime references to deleted services remain
- [ ] All user-facing pages show crypto-only content
- [ ] AI responses are crypto-focused
- [ ] Documentation is updated and consistent
- [ ] E2E tests pass without regressions
