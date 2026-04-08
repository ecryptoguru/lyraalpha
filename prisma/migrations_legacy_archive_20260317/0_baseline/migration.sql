-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'ETF', 'CRYPTO', 'COMMODITY', 'MUTUAL_FUND', 'IPO');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('ANNUAL_REPORT', 'INVESTOR_PRESENTATION', 'PRESS_RELEASE', 'EXCHANGE_FILING', 'NEWS_ARTICLE', 'MANAGEMENT_COMMENTARY');

-- CreateEnum
CREATE TYPE "InclusionType" AS ENUM ('CORE_BUSINESS', 'EVENT_DRIVEN', 'STRUCTURAL_STRENGTH', 'STRATEGIC_ALIGNMENT', 'NARRATIVE_SIGNAL');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'PRO', 'ELITE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ScoreType" AS ENUM ('TREND', 'MOMENTUM', 'VOLATILITY', 'SENTIMENT', 'LIQUIDITY', 'TRUST', 'PORTFOLIO_HEALTH');

-- CreateTable
CREATE TABLE "AIRequestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promptId" TEXT,
    "inputQuery" TEXT NOT NULL,
    "outputResponse" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL,
    "model" TEXT,
    "safetyFlag" BOOLEAN,
    "embedding" vector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "sector" TEXT,
    "exchange" TEXT,
    "description" TEXT,
    "marketCap" TEXT,
    "peRatio" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "avgVolume" DOUBLE PRECISION,
    "dividendYield" DOUBLE PRECISION,
    "industryPe" DOUBLE PRECISION,
    "oneYearChange" DOUBLE PRECISION,
    "roe" DOUBLE PRECISION,
    "roce" DOUBLE PRECISION,
    "technicalRating" TEXT,
    "analystRating" TEXT,
    "price" DOUBLE PRECISION,
    "changePercent" DOUBLE PRECISION,
    "lastPriceUpdate" TIMESTAMP(3),
    "factorData" JSONB,
    "correlationData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eps" DOUBLE PRECISION,
    "fiftyTwoWeekHigh" DOUBLE PRECISION,
    "fiftyTwoWeekLow" DOUBLE PRECISION,
    "metadata" JSONB,
    "pegRatio" DOUBLE PRECISION,
    "priceToBook" DOUBLE PRECISION,
    "shortRatio" DOUBLE PRECISION,
    "assetGroup" TEXT,
    "avgLiquidityScore" DOUBLE PRECISION,
    "avgMomentumScore" DOUBLE PRECISION,
    "avgSentimentScore" DOUBLE PRECISION,
    "avgTrendScore" DOUBLE PRECISION,
    "avgTrustScore" DOUBLE PRECISION,
    "avgVolatilityScore" DOUBLE PRECISION,
    "bookValue" DOUBLE PRECISION,
    "category" TEXT,
    "compatibilityLabel" TEXT,
    "compatibilityScore" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'USD',
    "expenseRatio" DOUBLE PRECISION,
    "forwardPe" DOUBLE PRECISION,
    "fundHouse" TEXT,
    "heldPercentInsiders" DOUBLE PRECISION,
    "heldPercentInstitutions" DOUBLE PRECISION,
    "morningstarRating" TEXT,
    "nav" DOUBLE PRECISION,
    "openInterest" DOUBLE PRECISION,
    "operatingMargins" DOUBLE PRECISION,
    "priceToSales" DOUBLE PRECISION,
    "profitMargins" DOUBLE PRECISION,
    "region" TEXT DEFAULT 'US',
    "revenueGrowth" DOUBLE PRECISION,
    "schemeType" TEXT,
    "scoreDynamics" JSONB,
    "performanceData" JSONB,
    "correlationRegime" JSONB,
    "factorAlignment" JSONB,
    "eventAdjustedScores" JSONB,
    "signalStrength" JSONB,
    "yield" DOUBLE PRECISION,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetScore" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "ScoreType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "context" TEXT,
    "description" TEXT,
    "direction" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dynamics" JSONB,

    CONSTRAINT "AssetScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSource" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChatSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT,
    "summary" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "sentimentScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceReference" (
    "id" TEXT NOT NULL,
    "stockSectorId" TEXT NOT NULL,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "excerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionalEvent" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "InstitutionalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDoc" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "embedding" vector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LyraAnalysis" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'daily_brief',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT,

    CONSTRAINT "LyraAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketRegime" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" TEXT NOT NULL,
    "breadthScore" DOUBLE PRECISION,
    "vixValue" DOUBLE PRECISION,
    "context" TEXT,
    "correlationMetrics" JSONB,
    "assetId" TEXT,
    "region" TEXT NOT NULL DEFAULT 'US',

    CONSTRAINT "MarketRegime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultiHorizonRegime" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current" JSONB NOT NULL,
    "shortTerm" JSONB NOT NULL,
    "mediumTerm" JSONB NOT NULL,
    "longTerm" JSONB NOT NULL,
    "transitionProbability" DOUBLE PRECISION NOT NULL,
    "transitionDirection" TEXT NOT NULL,
    "leadingIndicators" JSONB NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'US',

    CONSTRAINT "MultiHorizonRegime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptDefinition" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "safetyPrompt" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "favicon" TEXT,
    "publishedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rationale" TEXT,
    "drivers" TEXT,
    "isPremium" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectorRegime" (
    "id" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "regime" TEXT NOT NULL,
    "regimeScore" DOUBLE PRECISION NOT NULL,
    "participationRate" DOUBLE PRECISION NOT NULL,
    "relativeStrength" DOUBLE PRECISION NOT NULL,
    "rotationMomentum" DOUBLE PRECISION NOT NULL,
    "leadershipScore" DOUBLE PRECISION NOT NULL,
    "context" TEXT,

    CONSTRAINT "SectorRegime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSector" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "inclusionType" "InclusionType" NOT NULL,
    "inclusionReason" TEXT,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freshnessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "strengthScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "densityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "behaviorScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eligibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "firstIncludedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastValidatedAt" TIMESTAMP(3),
    "decayAfterDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockSector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendingQuestion" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendingQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL DEFAULT 'STARTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIRequestLog_userId_idx" ON "AIRequestLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_key" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "Asset_assetGroup_compatibilityScore_idx" ON "Asset"("assetGroup", "compatibilityScore" DESC);

-- CreateIndex
CREATE INDEX "Asset_compatibilityScore_idx" ON "Asset"("compatibilityScore");

-- CreateIndex
CREATE INDEX "Asset_lastPriceUpdate_idx" ON "Asset"("lastPriceUpdate");

-- CreateIndex
CREATE INDEX "Asset_type_compatibilityScore_idx" ON "Asset"("type", "compatibilityScore" DESC);

-- CreateIndex
CREATE INDEX "Asset_region_type_lastPriceUpdate_idx" ON "Asset"("region", "type", "lastPriceUpdate");

-- CreateIndex
CREATE INDEX "Asset_region_lastPriceUpdate_idx" ON "Asset"("region", "lastPriceUpdate");

-- CreateIndex
CREATE INDEX "Asset_name_idx" ON "Asset"("name");

-- CreateIndex
CREATE INDEX "AssetScore_assetId_type_date_idx" ON "AssetScore"("assetId", "type", "date" DESC);

-- CreateIndex
CREATE INDEX "AssetScore_date_idx" ON "AssetScore"("date" DESC);

-- CreateIndex
CREATE INDEX "AssetScore_type_date_value_idx" ON "AssetScore"("type", "date" DESC, "value");

-- CreateIndex
CREATE INDEX "ChatSource_messageId_idx" ON "ChatSource"("messageId");

-- CreateIndex
CREATE INDEX "ChatSource_sourceId_idx" ON "ChatSource"("sourceId");

-- CreateIndex
CREATE INDEX "Evidence_assetId_idx" ON "Evidence"("assetId");

-- CreateIndex
CREATE INDEX "InstitutionalEvent_assetId_date_idx" ON "InstitutionalEvent"("assetId", "date");

-- CreateIndex
CREATE INDEX "InstitutionalEvent_type_date_idx" ON "InstitutionalEvent"("type", "date" DESC);

-- CreateIndex
CREATE INDEX "LyraAnalysis_date_idx" ON "LyraAnalysis"("date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketRegime_date_region_key" ON "MarketRegime"("date", "region");

-- CreateIndex
CREATE INDEX "MultiHorizonRegime_date_idx" ON "MultiHorizonRegime"("date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MultiHorizonRegime_date_region_key" ON "MultiHorizonRegime"("date", "region");

-- CreateIndex
CREATE INDEX "PriceHistory_assetId_date_idx" ON "PriceHistory"("assetId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_assetId_date_key" ON "PriceHistory"("assetId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PromptDefinition_version_key" ON "PromptDefinition"("version");

-- CreateIndex
CREATE INDEX "QuestionSource_url_idx" ON "QuestionSource"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_slug_key" ON "Sector"("slug");

-- CreateIndex
CREATE INDEX "Sector_name_idx" ON "Sector"("name");

-- CreateIndex
CREATE INDEX "SectorRegime_date_idx" ON "SectorRegime"("date" DESC);

-- CreateIndex
CREATE INDEX "SectorRegime_sectorId_date_idx" ON "SectorRegime"("sectorId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SectorRegime_sectorId_date_key" ON "SectorRegime"("sectorId", "date");

-- CreateIndex
CREATE INDEX "StockSector_assetId_idx" ON "StockSector"("assetId");

-- CreateIndex
CREATE INDEX "StockSector_sectorId_isActive_eligibilityScore_idx" ON "StockSector"("sectorId", "isActive", "eligibilityScore" DESC);

-- CreateIndex
CREATE INDEX "StockSector_sectorId_isActive_idx" ON "StockSector"("sectorId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StockSector_assetId_sectorId_key" ON "StockSector"("assetId", "sectorId");

-- CreateIndex
CREATE INDEX "TrendingQuestion_category_idx" ON "TrendingQuestion"("category");

-- CreateIndex
CREATE INDEX "TrendingQuestion_isActive_displayOrder_idx" ON "TrendingQuestion"("isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "AIRequestLog" ADD CONSTRAINT "AIRequestLog_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "PromptDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRequestLog" ADD CONSTRAINT "AIRequestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetScore" ADD CONSTRAINT "AssetScore_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSource" ADD CONSTRAINT "ChatSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "QuestionSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReference" ADD CONSTRAINT "EvidenceReference_stockSectorId_fkey" FOREIGN KEY ("stockSectorId") REFERENCES "StockSector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionalEvent" ADD CONSTRAINT "InstitutionalEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LyraAnalysis" ADD CONSTRAINT "LyraAnalysis_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketRegime" ADD CONSTRAINT "MarketRegime_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectorRegime" ADD CONSTRAINT "SectorRegime_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSector" ADD CONSTRAINT "StockSector_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSector" ADD CONSTRAINT "StockSector_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
