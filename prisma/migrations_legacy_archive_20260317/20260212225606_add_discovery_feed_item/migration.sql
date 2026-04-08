CREATE TABLE "DiscoveryFeedItem" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "drs" DOUBLE PRECISION NOT NULL,
    "archetype" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "inflections" JSONB,
    "isEliteOnly" BOOLEAN NOT NULL DEFAULT false,
    "isSuppressed" BOOLEAN NOT NULL DEFAULT false,
    "suppressionReason" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryFeedItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscoveryFeedItem_computedAt_idx" ON "DiscoveryFeedItem"("computedAt" DESC);
CREATE INDEX "DiscoveryFeedItem_assetType_drs_idx" ON "DiscoveryFeedItem"("assetType", "drs" DESC);
CREATE INDEX "DiscoveryFeedItem_isSuppressed_drs_idx" ON "DiscoveryFeedItem"("isSuppressed", "drs" DESC);
CREATE INDEX "DiscoveryFeedItem_assetId_idx" ON "DiscoveryFeedItem"("assetId");

ALTER TABLE "DiscoveryFeedItem" ADD CONSTRAINT "DiscoveryFeedItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
