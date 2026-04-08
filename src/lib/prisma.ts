import "dotenv/config";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as { 
  prisma: PrismaClient;
  directPrisma: PrismaClient;
};

// Supabase/Supavisor recommendation for serverless: PRISMA_POOL_MAX=2 per function instance.
// Each Vercel serverless invocation is isolated — at 50 concurrent requests that's 100 connections
// total, well within Supabase's limits. Higher values risk exhausting the connection pool.
// Direct connection (DIRECT_URL, port 5432) is for migrations/scripts only — keep low.
const POOL_MAX = Number(process.env.PRISMA_POOL_MAX) || 2;
const DIRECT_POOL_MAX = Number(process.env.PRISMA_DIRECT_POOL_MAX) || 3;

// Supabase uses a self-signed TLS cert on its connection pooler (port 6543) and direct
// connection (port 5432). rejectUnauthorized: false is required and intentional — the
// connection is still encrypted; we are trusting Supabase's infrastructure rather than
// validating the CA chain. Do NOT change without testing against Supabase directly.
const sslConfig = { rejectUnauthorized: false };

// 1. Pooling Connection (for high-concurrency app logic via Supavisor port 6543)
const poolingAdapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: sslConfig,
  max: POOL_MAX,
  idleTimeoutMillis: 30000,
});

// 2. Direct Connection (for background syncs/migrations via session port 5432)
const directAdapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: sslConfig,
  max: DIRECT_POOL_MAX,
});

const prismaLogConfig: Prisma.LogLevel[] = process.env.NODE_ENV === "development"
  ? ["error", "warn"]
  : ["error"];

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: poolingAdapter,
    log: prismaLogConfig,
  });

export const directPrisma = 
  globalForPrisma.directPrisma ||
  new PrismaClient({
    adapter: directAdapter,
    log: prismaLogConfig,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.directPrisma = directPrisma;
}

// Prisma client initialized successfully
// Using PG driver adapter for connection pooling
