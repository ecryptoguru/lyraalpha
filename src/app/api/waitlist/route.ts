import { NextRequest, NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { createOrUpdateWaitlistUser } from "@/lib/services/waitlist.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "public-waitlist" });

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const firstName = typeof body.firstName === "string" ? body.firstName : undefined;
    const lastName = typeof body.lastName === "string" ? body.lastName : undefined;
    const source = typeof body.source === "string" ? body.source : "landing_page";
    const notes = typeof body.notes === "string" ? body.notes : undefined;

    if (!email || !isValidEmail(email)) {
      return apiError("Valid email is required", 400);
    }

    const record = await createOrUpdateWaitlistUser({
      email,
      firstName,
      lastName,
      source,
      notes,
    });

    return NextResponse.json({
      success: true,
      waitlistUser: {
        id: record.id,
        email: record.email,
      },
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to add waitlist user");
    return apiError("Failed to join waitlist", 500);
  }
}
