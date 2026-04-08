-- Phase 27: Infrastructure Modernization - Manual Migration Script
-- Purpose: Add materialized analytics and performance indexes

-- 1. Add Materialized Columns to AssetTable
ALTER TABLE "Asset" 
ADD COLUMN IF NOT EXISTS "compatibilityScore" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "compatibilityLabel" TEXT,
ADD COLUMN IF NOT EXISTS "assetGroup" TEXT,
ADD COLUMN IF NOT EXISTS "avgTrendScore" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "avgMomentumScore" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "avgVolatilityScore" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "avgLiquidityScore" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "avgSentimentScore" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "avgTrustScore" DOUBLE PRECISION;

-- 2. Add Optimized Indexes to Asset
CREATE INDEX IF NOT EXISTS "Asset_assetGroup_compatibilityScore_idx" ON "Asset" ("assetGroup", "compatibilityScore" DESC);
CREATE INDEX IF NOT EXISTS "Asset_compatibilityScore_idx" ON "Asset" ("compatibilityScore");

-- 3. Add Optimized Indexes to AssetScore
-- Note: Sort descending by date is critical for "latest score" performance
DROP INDEX IF EXISTS "AssetScore_assetId_type_date_idx";
CREATE INDEX IF NOT EXISTS "AssetScore_assetId_type_date_idx" ON "AssetScore" ("assetId", "type", "date" DESC);
CREATE INDEX IF NOT EXISTS "AssetScore_type_date_value_idx" ON "AssetScore" ("type", "date" DESC, "value");

-- 4. Verify Columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Asset' 
AND column_name IN ('compatibilityScore', 'assetGroup');
