-- Remove PriceAlert system (to be reintroduced later)

-- Drop the PriceAlert table and its indexes
DROP TABLE IF EXISTS "PriceAlert" CASCADE;

-- Drop the enums
DROP TYPE IF EXISTS "PriceAlertType";
DROP TYPE IF EXISTS "PriceAlertStatus";

-- Remove priceAlerts column from UserPreference
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'UserPreference'
  ) THEN
    ALTER TABLE "UserPreference" DROP COLUMN IF EXISTS "priceAlerts";
  END IF;
END $$;
