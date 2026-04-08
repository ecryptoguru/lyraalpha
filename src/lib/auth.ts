import { headers } from "next/headers";
import { auth as clerkAuth } from "@clerk/nextjs/server";
import { isAuthBypassEnabled, isAuthBypassHeaderEnabled } from "@/lib/runtime-env";

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
