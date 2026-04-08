-- Phase 2.4: Gamification & Learning System

CREATE TABLE IF NOT EXISTS "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "weeklyXp" INTEGER NOT NULL DEFAULT 0,
    "weeklyResetAt" TIMESTAMP(3),
    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeSlug" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "XPTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "XPTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LearningCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleSlug" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION,
    CONSTRAINT "LearningCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserProgress_userId_key" ON "UserProgress"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserBadge_userId_badgeSlug_key" ON "UserBadge"("userId", "badgeSlug");
CREATE UNIQUE INDEX IF NOT EXISTS "LearningCompletion_userId_moduleSlug_key" ON "LearningCompletion"("userId", "moduleSlug");

CREATE INDEX IF NOT EXISTS "UserProgress_userId_idx" ON "UserProgress"("userId");
CREATE INDEX IF NOT EXISTS "UserProgress_level_idx" ON "UserProgress"("level" DESC);
CREATE INDEX IF NOT EXISTS "UserBadge_userId_idx" ON "UserBadge"("userId");
CREATE INDEX IF NOT EXISTS "XPTransaction_userId_createdAt_idx" ON "XPTransaction"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "LearningCompletion_userId_idx" ON "LearningCompletion"("userId");

ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "XPTransaction" ADD CONSTRAINT "XPTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningCompletion" ADD CONSTRAINT "LearningCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
