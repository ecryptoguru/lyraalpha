-- Add region to MarketRegime
ALTER TABLE "MarketRegime" ADD COLUMN IF NOT EXISTS "region" text NOT NULL DEFAULT 'US';
DROP INDEX IF EXISTS "MarketRegime_date_key";
CREATE UNIQUE INDEX IF NOT EXISTS "MarketRegime_date_region_key" ON "MarketRegime"("date", "region");

-- Add region to MultiHorizonRegime
ALTER TABLE "MultiHorizonRegime" ADD COLUMN IF NOT EXISTS "region" text NOT NULL DEFAULT 'US';
DROP INDEX IF EXISTS "MultiHorizonRegime_date_key";
CREATE UNIQUE INDEX IF NOT EXISTS "MultiHorizonRegime_date_region_key" ON "MultiHorizonRegime"("date", "region");
