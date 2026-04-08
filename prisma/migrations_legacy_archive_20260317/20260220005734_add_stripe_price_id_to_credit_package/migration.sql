DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'CreditPackage'
  ) THEN
    ALTER TABLE "CreditPackage" ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
  END IF;
END $$;
