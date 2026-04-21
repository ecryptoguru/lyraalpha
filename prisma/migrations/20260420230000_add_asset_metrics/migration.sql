-- Create AssetMetrics table for normalized asset data
CREATE TABLE IF NOT EXISTS "AssetMetrics" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "factorData" JSONB,
    "correlationData" JSONB,
    "scoreDynamics" JSONB,
    "performanceData" JSONB,
    "signalStrength" JSONB,
    "correlationRegime" JSONB,
    "factorAlignment" JSONB,
    "eventAdjustedScores" JSONB,
    "cryptoIntelligence" JSONB,
    "scenarioData" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetMetrics_pkey" PRIMARY KEY ("id")
);

-- Create unique index on assetId
CREATE UNIQUE INDEX "AssetMetrics_assetId_key" ON "AssetMetrics"("assetId");

-- Create indexes for common queries
CREATE INDEX "AssetMetrics_assetId_idx" ON "AssetMetrics"("assetId");
CREATE INDEX "AssetMetrics_updatedAt_idx" ON "AssetMetrics"("updatedAt");

-- Add foreign key constraint
ALTER TABLE "AssetMetrics" ADD CONSTRAINT "AssetMetrics_assetId_fkey" 
    FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
