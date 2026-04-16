CREATE TABLE IF NOT EXISTS "WaitlistUser" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistUser_email_key" ON "WaitlistUser"("email");
CREATE INDEX IF NOT EXISTS "WaitlistUser_createdAt_idx" ON "WaitlistUser"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "WaitlistUser_status_createdAt_idx" ON "WaitlistUser"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "WaitlistUser_couponAccess_idx" ON "WaitlistUser"("couponAccess");
