-- Revert: crypto assets are global (region=null means "all regions").
-- The prior migration set region='US' which broke IN-region queries.
-- Keeping null is the correct semantic: null = globally available.
UPDATE "Asset"
SET region = NULL
WHERE type = 'CRYPTO'
  AND region = 'US';
