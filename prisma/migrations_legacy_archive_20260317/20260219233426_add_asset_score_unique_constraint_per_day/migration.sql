-- Add unique constraint on (assetId, type, date truncated to day)
CREATE UNIQUE INDEX IF NOT EXISTS "AssetScore_assetId_type_day_key"
  ON "AssetScore" ("assetId", type, (date::date));
