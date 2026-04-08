import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
  directPrisma: PrismaClient;
};

// RDS handles more connections than Supabase's Supavisor pooler
const POOL_MAX        = Number(process.env.PRISMA_POOL_MAX)        || 10;
const DIRECT_POOL_MAX = Number(process.env.PRISMA_DIRECT_POOL_MAX) || 5;

// RDS uses valid AWS-issued SSL certs — rejectUnauthorized: true (unlike Supabase self-signed)
const sslConfig = { rejectUnauthorized: true };

// Pooling adapter — for all regular app queries (API routes, SSR)
const poolingAdapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: sslConfig,
  max: POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Direct adapter — for migrations, background sync jobs, long queries
const directAdapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  ssl: sslConfig,
  max: DIRECT_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const logConfig: Prisma.LogLevel[] =
  process.env.NODE_ENV === "development" ? ["error", "warn", "query"] : ["error"];

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: poolingAdapter, log: logConfig });

export const directPrisma: PrismaClient =
  globalForPrisma.directPrisma ??
  new PrismaClient({ adapter: directAdapter, log: logConfig });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma       = prisma;
  globalForPrisma.directPrisma = directPrisma;
}

export default prisma;
