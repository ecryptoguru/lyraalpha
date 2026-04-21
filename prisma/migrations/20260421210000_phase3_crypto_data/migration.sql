-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "holderGini" DOUBLE PRECISION,
ADD COLUMN     "top10HolderPercent" DOUBLE PRECISION,
ADD COLUMN     "fundingRate" DOUBLE PRECISION,
ADD COLUMN     "exchangeFlows" JSONB,
ADD COLUMN     "stakingYield" JSONB,
ADD COLUMN     "emissionSchedule" JSONB,
ADD COLUMN     "governanceData" JSONB;

-- AlterTable (AssetMetrics)
ALTER TABLE "AssetMetrics" ADD COLUMN     "exchangeFlows" JSONB,
ADD COLUMN     "stakingYield" JSONB,
ADD COLUMN     "emissionSchedule" JSONB,
ADD COLUMN     "governanceData" JSONB;

-- CreateTable
CREATE TABLE "TokenUnlockEvent" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "unlockDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION,
    "percentOfSupply" DOUBLE PRECISION,
    "category" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenUnlockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenUnlockEvent_assetId_unlockDate_idx" ON "TokenUnlockEvent"("assetId", "unlockDate");

-- AddForeignKey
ALTER TABLE "TokenUnlockEvent" ADD CONSTRAINT "TokenUnlockEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
