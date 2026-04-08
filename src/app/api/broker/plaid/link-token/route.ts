import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { createPlaidLinkToken } from "@/lib/connectors/plaid";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "plaid-link" });

export const dynamic = "force-dynamic";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return apiError("Unauthorized", 401);
  }

  try {
    const linkToken = await createPlaidLinkToken(userId);
    return NextResponse.json({ link_token: linkToken });
  } catch (error) {
    logger.error({ err: sanitizeError(error), userId }, "Failed to create Plaid link token");
    return apiError("Failed to create Plaid link token", 500);
  }
}
