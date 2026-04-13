import { headers } from "next/headers";
import { auth as clerkAuth } from "@clerk/nextjs/server";
import { isAuthBypassEnabled, isAuthBypassHeaderEnabled } from "@/lib/runtime-env";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "auth" });

function getAdminEmailAllowlist() {
  return (process.env.ADMIN_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
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
    // For auth bypass, try to use a real ELITE user from database for testing
    // This ensures plan-gating works correctly during development
    try {
      const prismaModule = await import("@/lib/prisma");
      const eliteUser = await prismaModule.directPrisma.user.findFirst({
        where: { plan: "ELITE" },
        select: { id: true },
      });
      const userId = eliteUser?.id || "test-user-id";
      return {
        userId,
        sessionId: "test-session-id",
        getToken: async () => "test-token",
        debug: () => {},
        redirectToSignIn: () => {},
      };
    } catch (e) {
      logger.warn({ err: e }, "Auth bypass: failed to find ELITE user, using fallback test-user-id");
      return {
        userId: "test-user-id",
        sessionId: "test-session-id",
        getToken: async () => "test-token",
        debug: () => {},
        redirectToSignIn: () => {},
      };
    }
  }
  return clerkAuth();
}
