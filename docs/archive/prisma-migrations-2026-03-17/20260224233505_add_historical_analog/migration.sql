CREATE TABLE IF NOT EXISTS "HistoricalAnalog" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'US',
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "regimeState" TEXT NOT NULL,
    "breadthScore" DOUBLE PRECISION NOT NULL,
    "volatilityLevel" DOUBLE PRECISION NOT NULL,
    "crossSectorCorr" DOUBLE PRECISION NOT NULL,
    "avgTrend" DOUBLE PRECISION NOT NULL,
    "avgMomentum" DOUBLE PRECISION NOT NULL,
    "avgVolatility" DOUBLE PRECISION NOT NULL,
    "avgSentiment" DOUBLE PRECISION NOT NULL,
    "fwdReturn5d" DOUBLE PRECISION,
    "fwdReturn20d" DOUBLE PRECISION,
    "fwdReturn60d" DOUBLE PRECISION,
    "maxDrawdown20d" DOUBLE PRECISION,
    "recoveryDays" INTEGER,
    "topSectors" JSONB,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoricalAnalog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HistoricalAnalog_region_windowEnd_idx" ON "HistoricalAnalog"("region", "windowEnd" DESC);
CREATE INDEX IF NOT EXISTS "HistoricalAnalog_region_idx" ON "HistoricalAnalog"("region");
