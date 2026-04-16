import { headers } from "next/headers";
import { auth as clerkAuth } from "@clerk/nextjs/server";
import { isAuthBypassEnabled, isAuthBypassHeaderEnabled } from "@/lib/runtime-env";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "auth" });

// Memoized admin allowlist — parsed once per serverless instance, not per request
let _adminEmailCache: string[] | null = null;
function getAdminEmailAllowlist(): string[] {
  if (!_adminEmailCache) {
    _adminEmailCache = (process.env.ADMIN_EMAIL_ALLOWLIST ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }
  return _adminEmailCache;
}

export function isPrivilegedEmail(email: string | null | undefined) {
  if (!email) return false;
  return getAdminEmailAllowlist().includes(email.trim().toLowerCase());
}

export async function auth() {
  const headerStore = await headers().catch(() => null);
  const skipAuthViaHeader = isAuthBypassHeaderEnabled(
    headerStore?.get("x-skip-auth") ?? headerStore?.get("SKIP_AUTH") ?? null,
  );

  if (isAuthBypassEnabled() || skipAuthViaHeader) {
    // Auth bypass resolves a userId in this priority order:
    //   1. LYRA_E2E_USER_ID env — explicit, deterministic, safe to deploy.
    //   2. LYRA_E2E_USER_PLAN env + DB lookup — opt-in plan-based seeding for local dev
    //      (e.g. LYRA_E2E_USER_PLAN=ELITE). NEVER used unless the env var is set,
    //      so a leaked bypass flag cannot silently grant access to a real ELITE user.
    //   3. "test-user-id" sentinel — last resort.
    const explicitUserId = process.env.LYRA_E2E_USER_ID?.trim();
    if (explicitUserId) {
      return {
        userId: explicitUserId,
        sessionId: "test-session-id",
        getToken: async () => "test-token",
        debug: () => {},
        redirectToSignIn: () => {},
      };
    }

    const seedPlan = process.env.LYRA_E2E_USER_PLAN?.trim().toUpperCase();
    if (seedPlan) {
      try {
        const prismaModule = await import("@/lib/prisma");
        const seeded = await prismaModule.directPrisma.user.findFirst({
          where: { plan: seedPlan as never },
          select: { id: true },
        });
        if (seeded?.id) {
          return {
            userId: seeded.id,
            sessionId: "test-session-id",
            getToken: async () => "test-token",
            debug: () => {},
            redirectToSignIn: () => {},
          };
        }
        logger.warn({ seedPlan }, "Auth bypass: no user matched LYRA_E2E_USER_PLAN — falling back to test-user-id");
      } catch (e) {
        logger.warn({ err: e }, "Auth bypass: plan-seeded lookup failed — falling back to test-user-id");
      }
    }

    return {
      userId: "test-user-id",
      sessionId: "test-session-id",
      getToken: async () => "test-token",
      debug: () => {},
      redirectToSignIn: () => {},
    };
  }
  return clerkAuth();
}
