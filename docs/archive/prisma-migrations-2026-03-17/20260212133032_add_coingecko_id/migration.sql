ALTER TABLE "Asset" ADD COLUMN "coingeckoId" TEXT;
CREATE INDEX "Asset_coingeckoId_idx" ON "Asset"("coingeckoId");
