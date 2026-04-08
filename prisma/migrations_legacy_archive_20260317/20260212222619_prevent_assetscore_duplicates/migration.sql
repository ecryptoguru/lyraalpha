-- Add a partial unique index to prevent duplicate scores per asset+type+day
CREATE UNIQUE INDEX IF NOT EXISTS "AssetScore_assetId_type_dateDay_key"
ON "AssetScore" ("assetId", type, (date::date));
