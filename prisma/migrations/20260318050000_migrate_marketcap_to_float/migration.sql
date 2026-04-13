-- Migrate Asset.marketCap from String to Float
-- Convert existing string values to numeric, setting invalid values to NULL

-- Step 1: Add a temporary float column
ALTER TABLE "Asset" ADD COLUMN "marketCap_new" DOUBLE PRECISION;

-- Step 2: Convert existing string values to float (invalid values become NULL)
-- Only convert valid numeric strings to avoid casting errors
UPDATE "Asset"
SET "marketCap_new" = ("marketCap")::DOUBLE PRECISION
WHERE "marketCap" IS NOT NULL
  AND "marketCap" != ''
  AND "marketCap" ~ '^[0-9]+(\.[0-9]+)?$';

-- Step 3: Drop old column and rename new one
ALTER TABLE "Asset" DROP COLUMN "marketCap";
ALTER TABLE "Asset" RENAME COLUMN "marketCap_new" TO "marketCap";
