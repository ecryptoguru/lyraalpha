CREATE INDEX IF NOT EXISTS "XPTransaction_userId_action_createdAt_idx" ON "XPTransaction" ("userId", "action", "createdAt" DESC);
