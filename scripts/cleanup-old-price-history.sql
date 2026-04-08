-- ============================================================================
-- DELETE PRICE HISTORY OLDER THAN 5 YEARS
-- ============================================================================
-- 
-- This script removes price history records older than 5 years (1825 days).
-- Keeps recent data for analysis while significantly reducing database size.
-- 
-- ⚠️  IMPORTANT: Create a backup before running!
-- 💾 BACKUP: pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
-- 
-- ============================================================================

-- Step 1: Check how much data will be deleted
SELECT 
  COUNT(*) as "Records to Delete",
  pg_size_pretty(SUM(pg_column_size("PriceHistory".*))) as "Estimated Size to Free"
FROM "PriceHistory"
WHERE date < NOW() - INTERVAL '5 years';

-- Step 2: Check breakdown by asset type
SELECT 
  a.type,
  COUNT(ph.id) as "Old Records",
  pg_size_pretty(SUM(pg_column_size(ph.*))) as "Size"
FROM "PriceHistory" ph
JOIN "Asset" a ON ph."assetId" = a.id
WHERE ph.date < NOW() - INTERVAL '5 years'
GROUP BY a.type
ORDER BY COUNT(ph.id) DESC;

-- Step 3: Verify retention (records we're keeping)
SELECT 
  COUNT(*) as "Records to Keep (Last 5 Years)",
  pg_size_pretty(SUM(pg_column_size("PriceHistory".*))) as "Size"
FROM "PriceHistory"
WHERE date >= NOW() - INTERVAL '5 years';

-- ============================================================================
-- EXECUTE DELETION (Uncomment after reviewing above)
-- ============================================================================

-- Option A: Delete in batches (safer for large datasets)
-- Run this multiple times until it returns 0 rows affected

-- DELETE FROM "PriceHistory"
-- WHERE id IN (
--   SELECT id FROM "PriceHistory"
--   WHERE date < NOW() - INTERVAL '5 years'
--   LIMIT 10000
-- );

-- Option B: Delete all at once (faster but locks table longer)
-- Use this if you have a maintenance window

-- DELETE FROM "PriceHistory"
-- WHERE date < NOW() - INTERVAL '5 years';

-- ============================================================================
-- POST-DELETION CLEANUP
-- ============================================================================

-- After deletion, reclaim space and update statistics
-- VACUUM ANALYZE "PriceHistory";

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check oldest record after cleanup
SELECT 
  MIN(date) as "Oldest Record",
  MAX(date) as "Newest Record",
  COUNT(*) as "Total Records",
  pg_size_pretty(pg_total_relation_size('"PriceHistory"')) as "Table Size"
FROM "PriceHistory";

-- Check records per asset type
SELECT 
  a.type,
  COUNT(ph.id) as "Records",
  MIN(ph.date) as "Oldest",
  MAX(ph.date) as "Newest"
FROM "PriceHistory" ph
JOIN "Asset" a ON ph."assetId" = a.id
GROUP BY a.type
ORDER BY COUNT(ph.id) DESC;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- 
-- This script:
-- ✅ Deletes price history older than 5 years
-- ✅ Keeps recent 5 years for analysis and backtesting
-- ✅ Significantly reduces database size
-- ✅ Improves query performance
-- 
-- Expected impact:
-- - Regime analysis: Still works (uses recent data)
-- - Backtesting: Limited to 5-year window (acceptable)
-- - Charts: Cleaner, faster rendering
-- - Database size: Potentially 50-70% reduction in PriceHistory table
-- 
-- ============================================================================
