ALTER TABLE "CreditTransaction"
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

DO $$
BEGIN
  CREATE TYPE "CreditLotBucket" AS ENUM ('MONTHLY', 'BONUS', 'PURCHASED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CreditLot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "transactionId" TEXT,
  "bucket" "CreditLotBucket" NOT NULL,
  "originalAmount" INTEGER NOT NULL,
  "remainingAmount" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditLot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CreditLot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CreditLot_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "CreditTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CreditLot_userId_bucket_expiresAt_idx" ON "CreditLot"("userId", "bucket", "expiresAt");
CREATE INDEX IF NOT EXISTS "CreditLot_userId_remainingAmount_idx" ON "CreditLot"("userId", "remainingAmount");
CREATE INDEX IF NOT EXISTS "CreditLot_transactionId_idx" ON "CreditLot"("transactionId");
CREATE INDEX IF NOT EXISTS "CreditTransaction_userId_type_createdAt_idx" ON "CreditTransaction"("userId", "type", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "CreditTransaction_expiresAt_idx" ON "CreditTransaction"("expiresAt");

UPDATE "CreditTransaction"
SET "expiresAt" = CASE
  WHEN "type" = 'SUBSCRIPTION_MONTHLY' THEN date_trunc('month', "createdAt") + INTERVAL '1 month'
  WHEN "type" = 'PURCHASE' THEN "createdAt" + INTERVAL '1 year'
  WHEN "type" IN ('BONUS', 'REFERRAL_BONUS', 'REFERRAL_REDEEMED', 'ADJUSTMENT') THEN "createdAt" + INTERVAL '3 months'
  ELSE NULL
END
WHERE "amount" > 0 AND "expiresAt" IS NULL;

INSERT INTO "CreditLot" (
  "id",
  "userId",
  "transactionId",
  "bucket",
  "originalAmount",
  "remainingAmount",
  "expiresAt",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('lot_', md5(u."id" || '_monthly')),
  u."id",
  NULL,
  'MONTHLY'::"CreditLotBucket",
  u."monthlyCreditsBalance",
  u."monthlyCreditsBalance",
  date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."monthlyCreditsBalance" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "CreditLot" cl WHERE cl."userId" = u."id"
  );

INSERT INTO "CreditLot" (
  "id",
  "userId",
  "transactionId",
  "bucket",
  "originalAmount",
  "remainingAmount",
  "expiresAt",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('lot_', md5(u."id" || '_bonus')),
  u."id",
  NULL,
  'BONUS'::"CreditLotBucket",
  u."bonusCreditsBalance",
  u."bonusCreditsBalance",
  CURRENT_TIMESTAMP + INTERVAL '3 months',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."bonusCreditsBalance" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "CreditLot" cl WHERE cl."userId" = u."id" AND cl."bucket" = 'BONUS'
  );

INSERT INTO "CreditLot" (
  "id",
  "userId",
  "transactionId",
  "bucket",
  "originalAmount",
  "remainingAmount",
  "expiresAt",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('lot_', md5(u."id" || '_purchased')),
  u."id",
  NULL,
  'PURCHASED'::"CreditLotBucket",
  u."purchasedCreditsBalance",
  u."purchasedCreditsBalance",
  CURRENT_TIMESTAMP + INTERVAL '1 year',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."purchasedCreditsBalance" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "CreditLot" cl WHERE cl."userId" = u."id" AND cl."bucket" = 'PURCHASED'
  );
