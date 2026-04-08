-- Seed credit packages for Phase 1
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'CreditPackage'
  ) THEN
    INSERT INTO "CreditPackage" (id, name, credits, bonusCredits, priceInr, priceUsd, isPopular, isActive, createdAt, updatedAt)
    VALUES 
      ('pkg_starter_100', 'Starter Pack', 100, 10, 199, 2.99, false, true, NOW(), NOW()),
      ('pkg_starter_300', 'Starter Pack +', 300, 50, 499, 5.99, false, true, NOW(), NOW()),
      ('pkg_pro_500', 'Pro Pack', 500, 100, 799, 9.99, true, true, NOW(), NOW()),
      ('pkg_pro_1000', 'Pro Pack +', 1000, 250, 1499, 17.99, false, true, NOW(), NOW()),
      ('pkg_elite_1500', 'Elite Pack', 1500, 500, 2499, 29.99, true, true, NOW(), NOW()),
      ('pkg_elite_3000', 'Elite Pack +', 3000, 1000, 4499, 54.99, false, true, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      credits = EXCLUDED.credits,
      bonusCredits = EXCLUDED.bonusCredits,
      priceInr = EXCLUDED.priceInr,
      priceUsd = EXCLUDED.priceUsd,
      isPopular = EXCLUDED.isPopular,
      isActive = EXCLUDED.isActive,
      updatedAt = NOW();
  END IF;
END $$;
