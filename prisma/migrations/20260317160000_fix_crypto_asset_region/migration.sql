-- Fix existing crypto assets that were created without a region.
-- Crypto assets are USD-listed global assets; assign them region "US"
-- so they match region-based queries across all platform pages.
UPDATE "Asset"
SET region = 'US'
WHERE region IS NULL
  AND type = 'CRYPTO';
