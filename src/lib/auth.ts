import { headers } from "next/headers";
import { auth as clerkAuth } from "@clerk/nextjs/server";
import { isAuthBypassEnabled, isAuthBypassHeaderEnabled } from "@/lib/runtime-env";
import { createLogger } from "@/lib/logger";
import type { PlanTier } from "@/lib/ai/config";

const logger = createLogger({ service: "auth" });

// Memoized admin allowlist with 5-minute TTL. On Vercel, process.env is immutable
// per deploy so the TTL is cosmetic; on local dev it picks up .env changes without
// restarting the dev server.
let _adminEmailCache: string[] | null = null;
let _adminEmailCacheRefreshedAt = 0;
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getAdminEmailAllowlist(): string[] {
  const now = Date.now();
  if (!_adminEmailCache || now - _adminEmailCacheRefreshedAt > ADMIN_CACHE_TTL_MS) {
    _adminEmailCache = (process.env.ADMIN_EMAIL_ALLOWLIST ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    _adminEmailCacheRefreshedAt = now;
  }
  return _adminEmailCache;
}

export function isPrivilegedEmail(email: string | null | undefined) {
  if (!email) return false;
  return getAdminEmailAllowlist().includes(email.trim().toLowerCase());
}

// Cached E2E bypass userId with 5-minute TTL. Without this cache, concurrent
// auth() calls each do a dynamic Prisma import + findFirst, which is both slow
// and non-deterministic (findFirst without orderBy can return different rows).
// Under heavy session-upsert churn this caused portfolios to "vanish" because
// one request created a portfolio with userId A and a concurrent request's auth()
// resolved userId B, making the ownership check fail (404).
let _bypassUserIdCache: string | null = null;
let _bypassUserIdCacheRefreshedAt = 0;
const BYPASS_USER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function makeBypassAuth(userId: string) {
  return {
    userId,
    sessionId: "test-session-id",
    getToken: async () => "test-token",
    debug: () => {},
    redirectToSignIn: () => {},
  };
}

export async function auth() {
  const headerStore = await headers().catch(() => null);
  const skipAuthViaHeader = isAuthBypassHeaderEnabled(
    headerStore?.get("x-skip-auth") ?? headerStore?.get("SKIP_AUTH") ?? null,
  );

  if (isAuthBypassEnabled() || skipAuthViaHeader) {
    // Auth bypass resolves a userId in this priority order:
    //   1. LYRA_E2E_USER_ID env — explicit, deterministic, safe to deploy.
    //   2. LYRA_E2E_USER_PLAN env + DB lookup (cached) — opt-in plan-based seeding
    //      for local dev (e.g. LYRA_E2E_USER_PLAN=ELITE). NEVER used unless the env
    //      var is set, so a leaked bypass flag cannot silently grant access to a real
    //      ELITE user. The resolved userId is cached for 5 minutes so concurrent
    //      requests always resolve the same identity.
    //   3. "test-user-id" sentinel — last resort.
    const explicitUserId = process.env.LYRA_E2E_USER_ID?.trim();
    if (explicitUserId) {
      return makeBypassAuth(explicitUserId);
    }

    const seedPlan = process.env.LYRA_E2E_USER_PLAN?.trim().toUpperCase();
    if (seedPlan) {
      const now = Date.now();
      if (_bypassUserIdCache && now - _bypassUserIdCacheRefreshedAt <= BYPASS_USER_CACHE_TTL_MS) {
        return makeBypassAuth(_bypassUserIdCache);
      }

      try {
        const prismaModule = await import("@/lib/prisma");
        const seeded = await prismaModule.directPrisma.user.findFirst({
          where: { plan: seedPlan as PlanTier },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (seeded?.id) {
          _bypassUserIdCache = seeded.id;
          _bypassUserIdCacheRefreshedAt = now;
          return makeBypassAuth(seeded.id);
        }
        logger.warn({ seedPlan }, "Auth bypass: no user matched LYRA_E2E_USER_PLAN — falling back to test-user-id");
      } catch (e) {
        logger.warn({ err: e }, "Auth bypass: plan-seeded lookup failed — falling back to test-user-id");
      }
    }

    return makeBypassAuth("test-user-id");
  }
  return clerkAuth();
}
