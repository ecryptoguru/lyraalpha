CREATE TABLE IF NOT EXISTS "Portfolio" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'My Portfolio',
  "description" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "region" TEXT NOT NULL DEFAULT 'US',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PortfolioHolding" (
  "id" TEXT NOT NULL,
  "portfolioId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "avgPrice" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortfolioHolding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PortfolioHealthSnapshot" (
  "id" TEXT NOT NULL,
  "portfolioId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "healthScore" DOUBLE PRECISION NOT NULL,
  "diversificationScore" DOUBLE PRECISION NOT NULL,
  "concentrationScore" DOUBLE PRECISION NOT NULL,
  "volatilityScore" DOUBLE PRECISION NOT NULL,
  "correlationScore" DOUBLE PRECISION NOT NULL,
  "qualityScore" DOUBLE PRECISION NOT NULL,
  "fragilityScore" DOUBLE PRECISION,
  "riskMetrics" JSONB,
  "regime" TEXT,
  CONSTRAINT "PortfolioHealthSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Portfolio"
  ADD CONSTRAINT "Portfolio_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioHolding"
  ADD CONSTRAINT "PortfolioHolding_portfolioId_fkey"
  FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioHolding"
  ADD CONSTRAINT "PortfolioHolding_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioHealthSnapshot"
  ADD CONSTRAINT "PortfolioHealthSnapshot_portfolioId_fkey"
  FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioHolding_portfolioId_assetId_key"
  ON "PortfolioHolding"("portfolioId", "assetId");

CREATE INDEX IF NOT EXISTS "Portfolio_userId_idx" ON "Portfolio"("userId");
CREATE INDEX IF NOT EXISTS "Portfolio_userId_region_idx" ON "Portfolio"("userId", "region");
CREATE INDEX IF NOT EXISTS "PortfolioHolding_portfolioId_idx" ON "PortfolioHolding"("portfolioId");
CREATE INDEX IF NOT EXISTS "PortfolioHolding_assetId_idx" ON "PortfolioHolding"("assetId");
CREATE INDEX IF NOT EXISTS "PortfolioHealthSnapshot_portfolioId_date_idx"
  ON "PortfolioHealthSnapshot"("portfolioId", "date" DESC);
