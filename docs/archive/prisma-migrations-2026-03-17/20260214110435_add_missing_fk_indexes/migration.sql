-- Add missing foreign key indexes (Supabase performance advisor)
CREATE INDEX IF NOT EXISTS "AIRequestLog_promptId_idx" ON "AIRequestLog" ("promptId");
CREATE INDEX IF NOT EXISTS "EvidenceReference_stockSectorId_idx" ON "EvidenceReference" ("stockSectorId");
CREATE INDEX IF NOT EXISTS "LyraAnalysis_assetId_idx" ON "LyraAnalysis" ("assetId");
CREATE INDEX IF NOT EXISTS "MarketRegime_assetId_idx" ON "MarketRegime" ("assetId");
