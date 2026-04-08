CREATE INDEX IF NOT EXISTS "DiscoveryFeedItem_isSuppressed_assetType_drs_computedAt_idx"
ON "DiscoveryFeedItem"("isSuppressed", "assetType", "drs" DESC, "computedAt" DESC);

CREATE INDEX IF NOT EXISTS "Portfolio_userId_region_updatedAt_idx"
ON "Portfolio"("userId", "region", "updatedAt" DESC);
