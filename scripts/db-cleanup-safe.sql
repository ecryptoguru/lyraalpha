-- ============================================================================
-- DATABASE CLEANUP SCRIPT - SAFE OPERATIONS
-- ============================================================================
-- 
-- This script identifies and removes redundant/stale data from the database.
-- 
-- ⚠️  IMPORTANT: Review each section before executing!
-- 💾 BACKUP: Create a database backup before running any DELETE operations!
-- 
-- Usage:
--   1. Review each section
--   2. Uncomment the DELETE statements you want to execute
--   3. Run sections one at a time
--   4. Verify results after each section
-- ============================================================================

-- ============================================================================
-- SECTION 1: STALE AI REQUEST LOGS (90+ days old)
-- ============================================================================
-- Impact: Medium - Reduces database size, improves query performance
-- Risk: Low - Old logs are not used for active features
-- Estimated records: Run SELECT query first to check

-- Check count first:
SELECT COUNT(*) as "Stale AI Logs (90+ days)", 
       pg_size_pretty(SUM(pg_column_size("AIRequestLog".*))) as "Estimated Size"
FROM "AIRequestLog"
WHERE "createdAt" < NOW() - INTERVAL '90 days';

-- Uncomment to delete:
-- DELETE FROM "AIRequestLog" 
-- WHERE "createdAt" < NOW() - INTERVAL '90 days';

-- ============================================================================
-- SECTION 2: DUPLICATE TRENDING QUESTIONS
-- ============================================================================
-- Impact: Low - Cleans up duplicate questions
-- Risk: Very Low - Keeps most recent version
-- Estimated records: Run SELECT query first to check

-- Check duplicates:
SELECT question, COUNT(*) as duplicates
FROM "TrendingQuestion"
GROUP BY question
HAVING COUNT(*) > 1
ORDER BY duplicates DESC;

-- Uncomment to delete duplicates (keeps most recent):
-- DELETE FROM "TrendingQuestion" 
-- WHERE id NOT IN (
--   SELECT MAX(id) 
--   FROM "TrendingQuestion" 
--   GROUP BY question
-- );

-- ============================================================================
-- SECTION 3: ORPHANED ASSET SCORES
-- ============================================================================
-- Impact: High - Removes invalid data
-- Risk: Very Low - These are orphaned records
-- Estimated records: Run SELECT query first to check

-- Check orphaned scores:
SELECT COUNT(*) as "Orphaned Scores"
FROM "AssetScore" 
WHERE "assetId" NOT IN (SELECT id FROM "Asset");

-- Uncomment to delete:
-- DELETE FROM "AssetScore" 
-- WHERE "assetId" NOT IN (SELECT id FROM "Asset");

-- ============================================================================
-- SECTION 4: STALE ASSETS (No price update in 60+ days)
-- ============================================================================
-- Impact: Medium - Removes inactive/delisted assets
-- Risk: Medium - Review list before deleting!
-- Estimated records: Run SELECT query first to check

-- Review stale assets first:
SELECT symbol, name, type, "lastPriceUpdate", 
       COALESCE(EXTRACT(DAY FROM NOW() - "lastPriceUpdate"), 999) as "Days Since Update"
FROM "Asset"
WHERE "lastPriceUpdate" < NOW() - INTERVAL '60 days'
   OR "lastPriceUpdate" IS NULL
ORDER BY "lastPriceUpdate" ASC NULLS FIRST
LIMIT 50;

-- ⚠️  CAUTION: Review the list above before uncommenting!
-- Some assets may be intentionally inactive (e.g., commodities with different update schedules)
-- 
-- Uncomment to delete (BE CAREFUL):
-- DELETE FROM "Asset"
-- WHERE symbol IN (
--   -- Add specific symbols to delete after review
--   -- 'SYMBOL1', 'SYMBOL2', etc.
-- );

-- ============================================================================
-- SECTION 5: OLD CHAT MESSAGES (90+ days old)
-- ============================================================================
-- Impact: Medium - Reduces database size
-- Risk: Low - Old chat history not actively used
-- Estimated records: Run SELECT query first to check

-- Check count:
SELECT COUNT(*) as "Old Chat Messages (90+ days)"
FROM "ChatMessage"
WHERE "createdAt" < NOW() - INTERVAL '90 days';

-- Uncomment to delete:
-- DELETE FROM "ChatMessage"
-- WHERE "createdAt" < NOW() - INTERVAL '90 days';

-- ============================================================================
-- SECTION 6: EMPTY KNOWLEDGE DOCUMENTS
-- ============================================================================
-- Impact: Low - Removes empty/invalid documents
-- Risk: Very Low - These are invalid records
-- Estimated records: Run SELECT query first to check

-- Check empty documents:
SELECT COUNT(*) as "Empty Knowledge Docs"
FROM "KnowledgeDoc"
WHERE content IS NULL OR content = '' OR LENGTH(content) < 10;

-- Uncomment to delete:
-- DELETE FROM "KnowledgeDoc"
-- WHERE content IS NULL OR content = '' OR LENGTH(content) < 10;

-- ============================================================================
-- SECTION 7: OLD PRICE HISTORY (Keep last 2 years only)
-- ============================================================================
-- Impact: High - Significantly reduces database size
-- Risk: Medium - Historical data is useful for analysis
-- Recommendation: Archive before deleting, or keep all data
-- Estimated records: Run SELECT query first to check

-- Check old price history:
SELECT 
  COUNT(*) as "Price Records > 2 years old",
  pg_size_pretty(SUM(pg_column_size("PriceHistory".*))) as "Estimated Size"
FROM "PriceHistory"
WHERE date < NOW() - INTERVAL '2 years';

-- ⚠️  RECOMMENDATION: DO NOT DELETE - Keep for historical analysis
-- Price history is valuable for backtesting and regime analysis
-- 
-- If you must delete (NOT RECOMMENDED):
-- DELETE FROM "PriceHistory"
-- WHERE date < NOW() - INTERVAL '2 years';

-- ============================================================================
-- SECTION 8: VACUUM AND ANALYZE
-- ============================================================================
-- After cleanup, reclaim space and update statistics

-- Uncomment to run after cleanup:
-- VACUUM FULL ANALYZE;

-- Or for less aggressive cleanup (doesn't lock tables):
-- VACUUM ANALYZE;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check database size:
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- Check total database size:
SELECT pg_size_pretty(pg_database_size(current_database())) as "Total Database Size";

-- ============================================================================
-- CLEANUP SUMMARY
-- ============================================================================
-- 
-- Safe to delete:
--   ✅ Stale AI Request Logs (90+ days)
--   ✅ Duplicate Trending Questions
--   ✅ Orphaned Asset Scores
--   ✅ Old Chat Messages (90+ days)
--   ✅ Empty Knowledge Documents
-- 
-- Review before deleting:
--   ⚠️  Stale Assets (verify they're truly inactive)
-- 
-- DO NOT DELETE:
--   ❌ Old Price History (valuable for analysis)
--   ❌ Market Regime Records (needed for transition matrix)
--   ❌ Institutional Events (historical context)
-- 
-- ============================================================================
