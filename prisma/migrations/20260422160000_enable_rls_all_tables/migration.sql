-- Enable Row Level Security on all tables in the public schema
-- This prevents unrestricted access via the Supabase REST API (PostgREST).
--
-- The app uses Prisma server-side, which connects directly to Postgres as the
-- table owner (`postgres`). Table owners bypass RLS by default, so existing
-- API routes and Server Components continue to work unchanged.
--
-- Client-side Supabase (anon key) is only used for Realtime subscriptions.
-- With RLS enabled and no policies for anon on sensitive tables, the REST API
-- is fully protected. Public tables get SELECT policies so public read access
-- remains available.

-- ─── Enable RLS on every table ──────────────────────────────────────────────

ALTER TABLE "AIRequestLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssetScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlogPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditLot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditPackage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiscoveryFeedItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EvidenceReference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HistoricalAnalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstitutionalEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeDoc" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningCompletion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LyraAnalysis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LyraFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarketRegime" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MultiHorizonRegime" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PointTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Portfolio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortfolioHealthSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortfolioHolding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromoCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Referral" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sector" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SectorRegime" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockSector" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportKnowledgeDoc" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrendingQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserActivityEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBadge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserMemoryNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WaitlistUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WatchlistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "XPRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "XPTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- ─── Public read policies (SELECT for anon) ───────────────────────────────
--
-- These tables contain public/market data that anyone should be able to read.
-- No INSERT/UPDATE/DELETE policies are added, so anon can only read.

CREATE POLICY "Public read published blog posts" ON "BlogPost"
  FOR SELECT TO anon USING ("status" = 'PUBLISHED');

CREATE POLICY "Public read assets" ON "Asset"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read asset scores" ON "AssetScore"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read evidence" ON "Evidence"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read institutional events" ON "InstitutionalEvent"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read lyra analysis" ON "LyraAnalysis"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read market regimes" ON "MarketRegime"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read multi-horizon regimes" ON "MultiHorizonRegime"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read price history" ON "PriceHistory"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read sectors" ON "Sector"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read sector regimes" ON "SectorRegime"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read stock sectors" ON "StockSector"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read trending questions" ON "TrendingQuestion"
  FOR SELECT TO anon USING ("isActive" = true);

CREATE POLICY "Public read discovery feed" ON "DiscoveryFeedItem"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read historical analogs" ON "HistoricalAnalog"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read knowledge docs" ON "KnowledgeDoc"
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read credit packages" ON "CreditPackage"
  FOR SELECT TO anon USING ("isActive" = true);

CREATE POLICY "Public read question sources" ON "QuestionSource"
  FOR SELECT TO anon USING (true);

-- ─── Limited write policies ───────────────────────────────────────────────

-- Allow anonymous users to join the waitlist via the public landing page.
-- No SELECT policy is added, so waitlist emails remain private.
CREATE POLICY "Public insert waitlist" ON "WaitlistUser"
  FOR INSERT TO anon WITH CHECK (true);
