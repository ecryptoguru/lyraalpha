-- Manual Migration: Add PromoCode.bonusCredits
-- Purpose: move promo credit values out of hardcoded application logic and into the database.
-- Safe to run multiple times.

BEGIN;

ALTER TABLE "PromoCode"
ADD COLUMN IF NOT EXISTS "bonusCredits" INTEGER;

ALTER TABLE "PromoCode"
ALTER COLUMN "bonusCredits" SET DEFAULT 50;

-- Backfill existing rows.
-- Preserve any value that may already exist.
UPDATE "PromoCode"
SET "bonusCredits" = CASE
  WHEN "code" = 'ELITE30' THEN 500
  WHEN "code" = 'ELITE15' THEN 250
  ELSE COALESCE("bonusCredits", 50)
END
WHERE "bonusCredits" IS NULL
   OR "code" IN ('ELITE30', 'ELITE15');

UPDATE "PromoCode"
SET "bonusCredits" = 50
WHERE "bonusCredits" IS NULL;

ALTER TABLE "PromoCode"
ALTER COLUMN "bonusCredits" SET NOT NULL;

COMMIT;

-- Verification
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'PromoCode'
  AND column_name = 'bonusCredits';

SELECT "code", "durationDays", "bonusCredits", "isActive", "usedCount"
FROM "PromoCode"
ORDER BY "code";
