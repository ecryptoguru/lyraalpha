/**
 * Admin Guard — Clerk metadata role check
 *
 * Protects admin routes by verifying publicMetadata.role === "admin".
 * Set the role in Clerk Dashboard → Users → [user] → Public Metadata:
 *   { "role": "admin" }
 */

import { auth as appAuth } from "@/lib/auth";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { isAuthBypassEnabled } from "@/lib/runtime-env";

const logger = createLogger({ service: "admin-guard" });

export async function requireAdmin(): Promise<
  | { authorized: true; userId: string }
  | { authorized: false; response: NextResponse }
> {
  // Dev-mode bypass: when SKIP_AUTH is true, auto-authorize as admin
  if (isAuthBypassEnabled()) {
    return { authorized: true, userId: "test-user-id" };
  }

  const { userId } = await appAuth();

  if (!userId) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const role = (user.publicMetadata as Record<string, unknown>)?.role;

    if (role !== "admin") {
      return {
        authorized: false,
        response: NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 }),
      };
    }

    return { authorized: true, userId };
  } catch (err) {
    logger.error({ err }, "Clerk API call failed in requireAdmin");
    return {
      authorized: false,
      response: NextResponse.json({ error: "Auth check failed" }, { status: 500 }),
    };
  }
}
