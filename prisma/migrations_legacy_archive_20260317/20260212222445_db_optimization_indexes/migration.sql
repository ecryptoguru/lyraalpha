-- 1. Drop redundant PriceHistory index (unique constraint covers same columns)
DROP INDEX IF EXISTS "PriceHistory_assetId_date_idx";

-- 2. Drop unused Asset_name_idx
DROP INDEX IF EXISTS "Asset_name_idx";

-- 3. Drop redundant Asset_compatibilityScore_idx
DROP INDEX IF EXISTS "Asset_compatibilityScore_idx";

-- 4. Drop redundant StockSector_sectorId_isActive_idx
DROP INDEX IF EXISTS "StockSector_sectorId_isActive_idx";

-- 5. Add composite index for movers query
CREATE INDEX IF NOT EXISTS "Asset_region_changePercent_idx" ON "Asset" ("region", "changePercent" DESC);

-- 6. Add trigram index for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Asset_symbol_trgm_idx" ON "Asset" USING gin ("symbol" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Asset_name_trgm_idx" ON "Asset" USING gin ("name" gin_trgm_ops);
