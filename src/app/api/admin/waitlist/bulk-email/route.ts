import { NextRequest, NextResponse } from "next/server";

import { sendBrevoEmail } from "@/lib/email/brevo";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { getWaitlistUsersByIds, markWaitlistUsersEmailed } from "@/lib/services/waitlist.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-waitlist-bulk-email" });

export async function POST(request: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const htmlContent = typeof body.htmlContent === "string" ? body.htmlContent.trim() : "";
    const textContent = typeof body.textContent === "string" ? body.textContent.trim() : undefined;

    if (ids.length === 0) {
      return apiError("At least one waitlist user must be selected", 400);
    }

    if (!subject || !htmlContent) {
      return apiError("Subject and htmlContent are required", 400);
    }

    const users = await getWaitlistUsersByIds(ids);

    if (users.length === 0) {
      return apiError("No waitlist users found", 404);
    }

    const sent = await sendBrevoEmail({
      to: users.map((user) => ({
        email: user.email,
        name: user.firstName ?? undefined,
      })),
      subject,
      htmlContent,
      textContent,
      tags: ["waitlist", "bulk-admin"],
    });

    if (!sent) {
      return apiError("Brevo send failed", 502);
    }

    await markWaitlistUsersEmailed(users.map((user) => user.id));

    return NextResponse.json({ success: true, sent: users.length });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to send waitlist bulk email");
    return apiError("Failed to send waitlist email", 500);
  }
}
