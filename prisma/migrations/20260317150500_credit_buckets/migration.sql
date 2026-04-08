ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "monthlyCreditsBalance" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS "bonusCreditsBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "purchasedCreditsBalance" INTEGER NOT NULL DEFAULT 0;

UPDATE "User"
SET
  "monthlyCreditsBalance" = CASE
    WHEN "monthlyCreditsBalance" = 50 AND "credits" <> 50 THEN "credits"
    ELSE "monthlyCreditsBalance"
  END,
  "bonusCreditsBalance" = COALESCE("bonusCreditsBalance", 0),
  "purchasedCreditsBalance" = COALESCE("purchasedCreditsBalance", 0);
