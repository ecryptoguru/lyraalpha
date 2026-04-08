-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "EmbeddingStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'ACTIVATED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PointSource" AS ENUM ('DAILY_LOGIN', 'LYRA_QUERY', 'LEARNING_COMPLETE', 'QUIZ_PASS', 'WATCHLIST_ADD', 'DISCOVERY_CLICK', 'SHARE_ANALYSIS', 'REFERRAL', 'FIRST_PURCHASE');

-- CreateEnum
CREATE TYPE "PointRedemptionType" AS ENUM ('CREDITS_10', 'CREDITS_25', 'PRO_TRIAL_7D', 'ELITE_TRIAL_7D');

-- CreateEnum
CREATE TYPE "XPRedemptionType" AS ENUM ('PRO_TRIAL_7D_WITH_CREDITS', 'ELITE_TRIAL_7D_WITH_CREDITS');

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

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'RAZORPAY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'TRIALING');

-- CreateEnum
CREATE TYPE "UserPreferredRegion" AS ENUM ('US', 'IN', 'BOTH');

-- CreateEnum
CREATE TYPE "UserExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "UserInterest" AS ENUM ('STOCKS', 'ETF', 'CRYPTO', 'MUTUAL_FUNDS', 'COMMODITIES');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('PURCHASE', 'REFERRAL_BONUS', 'REFERRAL_REDEEMED', 'SUBSCRIPTION_MONTHLY', 'BONUS', 'SPENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportSenderRole" AS ENUM ('USER', 'AGENT');

-- CreateTable
CREATE TABLE "AIRequestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promptId" TEXT,
    "inputQuery" TEXT NOT NULL,
    "outputResponse" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL,
    "complexity" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cachedInputTokens" INTEGER,
    "reasoningTokens" INTEGER,
    "model" TEXT,
    "wasFallback" BOOLEAN NOT NULL DEFAULT false,
    "inputCost" DOUBLE PRECISION,
    "outputCost" DOUBLE PRECISION,
    "cachedInputCost" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "safetyFlag" BOOLEAN,
    "embedding" vector,
    "embeddingStatus" "EmbeddingStatus" NOT NULL DEFAULT 'PENDING',
    "embeddingAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastEmbeddingError" TEXT,
    "embeddedAt" TIMESTAMP(3),
    "embeddingProcessingAt" TIMESTAMP(3),
    "embeddingTextHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "coingeckoId" TEXT,
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
    "financials" JSONB,
    "topHoldings" JSONB,
    "etfLookthrough" JSONB,
    "mfLookthrough" JSONB,
    "commodityIntelligence" JSONB,
    "cryptoIntelligence" JSONB,
    "fundPerformanceHistory" JSONB,
    "scenarioData" JSONB,
    "industry" TEXT,
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
CREATE TABLE "ChatSource" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChatSource_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "LyraFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "vote" INTEGER NOT NULL,
    "query" TEXT NOT NULL,
    "responseSnippet" TEXT,
    "symbol" TEXT,
    "queryTier" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LyraFeedback_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "HistoricalAnalog" (
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
    "trialEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "razorpayCustomerId" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 50,
    "totalCreditsEarned" INTEGER NOT NULL DEFAULT 50,
    "totalCreditsSpent" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "totalPointsEarned" INTEGER NOT NULL DEFAULT 0,
    "totalPointsSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "symbol" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "path" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerSubId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "plan" "PlanTier" NOT NULL DEFAULT 'PRO',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredRegion" "UserPreferredRegion" NOT NULL DEFAULT 'US',
    "experienceLevel" "UserExperienceLevel" NOT NULL DEFAULT 'BEGINNER',
    "dashboardMode" TEXT NOT NULL DEFAULT 'simple',
    "interests" "UserInterest"[] DEFAULT ARRAY[]::"UserInterest"[],
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "onboardingSkipped" BOOLEAN NOT NULL DEFAULT false,
    "tourCompleted" BOOLEAN NOT NULL DEFAULT false,
    "blogSubscribed" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT false,
    "pushSubscriptionJson" TEXT,
    "newsAlerts" BOOLEAN NOT NULL DEFAULT true,
    "morningIntelligence" BOOLEAN NOT NULL DEFAULT true,
    "portfolioAlerts" BOOLEAN NOT NULL DEFAULT true,
    "opportunityAlerts" BOOLEAN NOT NULL DEFAULT true,
    "narrativeAlerts" BOOLEAN NOT NULL DEFAULT true,
    "shockWarnings" BOOLEAN NOT NULL DEFAULT true,
    "weeklyReports" BOOLEAN NOT NULL DEFAULT true,
    "welcomeEmailSentAt" TIMESTAMP(3),
    "reengagementNudge1SentAt" TIMESTAMP(3),
    "reengagementNudge2SentAt" TIMESTAMP(3),
    "winbackEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "bonusCredits" INTEGER NOT NULL DEFAULT 0,
    "priceInr" INTEGER NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "stripePriceId" TEXT,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "referrerCreditsAwarded" BOOLEAN NOT NULL DEFAULT false,
    "refereeCreditsAwarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" "PointSource",
    "redemption" "PointRedemptionType",
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "weeklyXp" INTEGER NOT NULL DEFAULT 0,
    "weeklyResetAt" TIMESTAMP(3),
    "xpMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeSlug" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XPTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XPTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XPRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "XPRedemptionType" NOT NULL,
    "xpCost" INTEGER NOT NULL,
    "creditsGranted" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XPRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleSlug" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION,

    CONSTRAINT "LearningCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "scores" JSONB,
    "price" DOUBLE PRECISION,
    "changePercent" DOUBLE PRECISION,
    "currency" TEXT,
    "isEliteOnly" BOOLEAN NOT NULL DEFAULT false,
    "isSuppressed" BOOLEAN NOT NULL DEFAULT false,
    "suppressionReason" TEXT,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryFeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'US',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT,
    "plan" "PlanTier" NOT NULL,
    "userContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" "SupportSenderRole" NOT NULL,
    "content" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportKnowledgeDoc" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportKnowledgeDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeEventId" TEXT,
    "stripeObjectId" TEXT,
    "eventType" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT NOT NULL,
    "amount" INTEGER,
    "currency" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "region" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 15,
    "bonusCredits" INTEGER NOT NULL DEFAULT 50,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'landing_page',
    "status" TEXT NOT NULL DEFAULT 'WAITLISTED',
    "notes" TEXT,
    "couponAccess" BOOLEAN NOT NULL DEFAULT false,
    "brevoSyncedAt" TIMESTAMP(3),
    "lastEmailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioHolding" (
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

-- CreateTable
CREATE TABLE "PortfolioHealthSnapshot" (
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

-- CreateIndex
CREATE INDEX "AIRequestLog_userId_idx" ON "AIRequestLog"("userId");

-- CreateIndex
CREATE INDEX "AIRequestLog_userId_createdAt_idx" ON "AIRequestLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AIRequestLog_promptId_idx" ON "AIRequestLog"("promptId");

-- CreateIndex
CREATE INDEX "AIRequestLog_embeddingStatus_createdAt_idx" ON "AIRequestLog"("embeddingStatus", "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_key" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "Asset_assetGroup_compatibilityScore_idx" ON "Asset"("assetGroup", "compatibilityScore" DESC);

-- CreateIndex
CREATE INDEX "Asset_lastPriceUpdate_idx" ON "Asset"("lastPriceUpdate");

-- CreateIndex
CREATE INDEX "Asset_type_compatibilityScore_idx" ON "Asset"("type", "compatibilityScore" DESC);

-- CreateIndex
CREATE INDEX "Asset_region_type_lastPriceUpdate_idx" ON "Asset"("region", "type", "lastPriceUpdate");

-- CreateIndex
CREATE INDEX "Asset_region_lastPriceUpdate_idx" ON "Asset"("region", "lastPriceUpdate");

-- CreateIndex
CREATE INDEX "Asset_region_changePercent_idx" ON "Asset"("region", "changePercent" DESC);

-- CreateIndex
CREATE INDEX "Asset_coingeckoId_idx" ON "Asset"("coingeckoId");

-- CreateIndex
CREATE INDEX "AssetScore_assetId_type_date_idx" ON "AssetScore"("assetId", "type", "date" DESC);

-- CreateIndex
CREATE INDEX "AssetScore_date_idx" ON "AssetScore"("date" DESC);

-- CreateIndex
CREATE INDEX "AssetScore_type_date_value_idx" ON "AssetScore"("type", "date" DESC, "value");

-- CreateIndex
CREATE INDEX "Evidence_assetId_idx" ON "Evidence"("assetId");

-- CreateIndex
CREATE INDEX "EvidenceReference_stockSectorId_idx" ON "EvidenceReference"("stockSectorId");

-- CreateIndex
CREATE INDEX "InstitutionalEvent_assetId_date_idx" ON "InstitutionalEvent"("assetId", "date");

-- CreateIndex
CREATE INDEX "InstitutionalEvent_type_date_idx" ON "InstitutionalEvent"("type", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PromptDefinition_version_key" ON "PromptDefinition"("version");

-- CreateIndex
CREATE INDEX "QuestionSource_url_idx" ON "QuestionSource"("url");

-- CreateIndex
CREATE INDEX "ChatSource_messageId_idx" ON "ChatSource"("messageId");

-- CreateIndex
CREATE INDEX "ChatSource_sourceId_idx" ON "ChatSource"("sourceId");

-- CreateIndex
CREATE INDEX "LyraAnalysis_date_idx" ON "LyraAnalysis"("date" DESC);

-- CreateIndex
CREATE INDEX "LyraFeedback_vote_createdAt_idx" ON "LyraFeedback"("vote", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LyraFeedback_createdAt_idx" ON "LyraFeedback"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "LyraFeedback_userId_answerId_key" ON "LyraFeedback"("userId", "answerId");

-- CreateIndex
CREATE INDEX "MarketRegime_assetId_idx" ON "MarketRegime"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketRegime_date_region_key" ON "MarketRegime"("date", "region");

-- CreateIndex
CREATE INDEX "MultiHorizonRegime_date_idx" ON "MultiHorizonRegime"("date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MultiHorizonRegime_date_region_key" ON "MultiHorizonRegime"("date", "region");

-- CreateIndex
CREATE INDEX "HistoricalAnalog_region_windowEnd_idx" ON "HistoricalAnalog"("region", "windowEnd" DESC);

-- CreateIndex
CREATE INDEX "HistoricalAnalog_region_idx" ON "HistoricalAnalog"("region");

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_assetId_date_key" ON "PriceHistory"("assetId", "date");

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
CREATE UNIQUE INDEX "StockSector_assetId_sectorId_key" ON "StockSector"("assetId", "sectorId");

-- CreateIndex
CREATE INDEX "TrendingQuestion_category_idx" ON "TrendingQuestion"("category");

-- CreateIndex
CREATE INDEX "TrendingQuestion_isActive_displayOrder_idx" ON "TrendingQuestion"("isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_razorpayCustomerId_key" ON "User"("razorpayCustomerId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_startedAt_idx" ON "UserSession"("startedAt");

-- CreateIndex
CREATE INDEX "UserSession_lastActivityAt_idx" ON "UserSession"("lastActivityAt");

-- CreateIndex
CREATE INDEX "UserActivityEvent_userId_createdAt_idx" ON "UserActivityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivityEvent_eventType_createdAt_idx" ON "UserActivityEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivityEvent_sessionId_idx" ON "UserActivityEvent"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubId_key" ON "Subscription"("providerSubId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_providerSubId_idx" ON "Subscription"("providerSubId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_eventId_key" ON "PaymentEvent"("eventId");

-- CreateIndex
CREATE INDEX "PaymentEvent_eventId_idx" ON "PaymentEvent"("eventId");

-- CreateIndex
CREATE INDEX "PaymentEvent_userId_idx" ON "PaymentEvent"("userId");

-- CreateIndex
CREATE INDEX "PaymentEvent_processedAt_idx" ON "PaymentEvent"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "UserPreference_onboardingCompleted_idx" ON "UserPreference"("onboardingCompleted");

-- CreateIndex
CREATE INDEX "UserPreference_blogSubscribed_idx" ON "UserPreference"("blogSubscribed");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CreditTransaction_createdAt_idx" ON "CreditTransaction"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_refereeId_idx" ON "Referral"("refereeId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referrerId_refereeId_key" ON "Referral"("referrerId", "refereeId");

-- CreateIndex
CREATE INDEX "PointTransaction_userId_idx" ON "PointTransaction"("userId");

-- CreateIndex
CREATE INDEX "PointTransaction_createdAt_idx" ON "PointTransaction"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_key" ON "UserProgress"("userId");

-- CreateIndex
CREATE INDEX "UserProgress_userId_idx" ON "UserProgress"("userId");

-- CreateIndex
CREATE INDEX "UserProgress_level_idx" ON "UserProgress"("level" DESC);

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeSlug_key" ON "UserBadge"("userId", "badgeSlug");

-- CreateIndex
CREATE INDEX "XPTransaction_userId_createdAt_idx" ON "XPTransaction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "XPTransaction_userId_action_createdAt_idx" ON "XPTransaction"("userId", "action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "XPRedemption_userId_idx" ON "XPRedemption"("userId");

-- CreateIndex
CREATE INDEX "LearningCompletion_userId_idx" ON "LearningCompletion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningCompletion_userId_moduleSlug_key" ON "LearningCompletion"("userId", "moduleSlug");

-- CreateIndex
CREATE INDEX "DiscoveryFeedItem_computedAt_idx" ON "DiscoveryFeedItem"("computedAt" DESC);

-- CreateIndex
CREATE INDEX "DiscoveryFeedItem_assetType_drs_idx" ON "DiscoveryFeedItem"("assetType", "drs" DESC);

-- CreateIndex
CREATE INDEX "DiscoveryFeedItem_isSuppressed_drs_idx" ON "DiscoveryFeedItem"("isSuppressed", "drs" DESC);

-- CreateIndex
CREATE INDEX "DiscoveryFeedItem_isSuppressed_assetType_drs_computedAt_idx" ON "DiscoveryFeedItem"("isSuppressed", "assetType", "drs" DESC, "computedAt" DESC);

-- CreateIndex
CREATE INDEX "DiscoveryFeedItem_assetId_idx" ON "DiscoveryFeedItem"("assetId");

-- CreateIndex
CREATE INDEX "DiscoveryFeedItem_generation_idx" ON "DiscoveryFeedItem"("generation");

-- CreateIndex
CREATE INDEX "WatchlistItem_userId_region_idx" ON "WatchlistItem"("userId", "region");

-- CreateIndex
CREATE INDEX "WatchlistItem_assetId_idx" ON "WatchlistItem"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_assetId_key" ON "WatchlistItem"("userId", "assetId");

-- CreateIndex
CREATE INDEX "SupportConversation_userId_idx" ON "SupportConversation"("userId");

-- CreateIndex
CREATE INDEX "SupportConversation_status_createdAt_idx" ON "SupportConversation"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SupportMessage_conversationId_createdAt_idx" ON "SupportMessage"("conversationId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "SupportKnowledgeDoc_id_idx" ON "SupportKnowledgeDoc"("id");

-- CreateIndex
CREATE INDEX "BillingAuditLog_userId_timestamp_idx" ON "BillingAuditLog"("userId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "BillingAuditLog_stripeEventId_idx" ON "BillingAuditLog"("stripeEventId");

-- CreateIndex
CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");

-- CreateIndex
CREATE INDEX "Portfolio_userId_region_updatedAt_idx" ON "Portfolio"("userId", "region", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_userId_name_key" ON "Portfolio"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_code_idx" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistUser_email_key" ON "WaitlistUser"("email");

-- CreateIndex
CREATE INDEX "WaitlistUser_createdAt_idx" ON "WaitlistUser"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "WaitlistUser_status_createdAt_idx" ON "WaitlistUser"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WaitlistUser_couponAccess_idx" ON "WaitlistUser"("couponAccess");

-- CreateIndex
CREATE INDEX "PortfolioHolding_portfolioId_idx" ON "PortfolioHolding"("portfolioId");

-- CreateIndex
CREATE INDEX "PortfolioHolding_assetId_idx" ON "PortfolioHolding"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioHolding_portfolioId_assetId_key" ON "PortfolioHolding"("portfolioId", "assetId");

-- CreateIndex
CREATE INDEX "PortfolioHealthSnapshot_portfolioId_date_idx" ON "PortfolioHealthSnapshot"("portfolioId", "date" DESC);

-- AddForeignKey
ALTER TABLE "AIRequestLog" ADD CONSTRAINT "AIRequestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRequestLog" ADD CONSTRAINT "AIRequestLog_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "PromptDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetScore" ADD CONSTRAINT "AssetScore_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReference" ADD CONSTRAINT "EvidenceReference_stockSectorId_fkey" FOREIGN KEY ("stockSectorId") REFERENCES "StockSector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionalEvent" ADD CONSTRAINT "InstitutionalEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSource" ADD CONSTRAINT "ChatSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "QuestionSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LyraAnalysis" ADD CONSTRAINT "LyraAnalysis_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LyraFeedback" ADD CONSTRAINT "LyraFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivityEvent" ADD CONSTRAINT "UserActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XPTransaction" ADD CONSTRAINT "XPTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XPRedemption" ADD CONSTRAINT "XPRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCompletion" ADD CONSTRAINT "LearningCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryFeedItem" ADD CONSTRAINT "DiscoveryFeedItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAuditLog" ADD CONSTRAINT "BillingAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioHolding" ADD CONSTRAINT "PortfolioHolding_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioHolding" ADD CONSTRAINT "PortfolioHolding_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioHealthSnapshot" ADD CONSTRAINT "PortfolioHealthSnapshot_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
