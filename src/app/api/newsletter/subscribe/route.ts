import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { subscribeToBrevoBlogList, upsertBrevoContact } from "@/lib/email/brevo";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "newsletter-subscribe-api" });

const NewsletterSchema = z.object({
  email: z.string().email().max(320),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = NewsletterSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Invalid request body", 400);
    }

    const { email, firstName, lastName } = validation.data;

    await upsertBrevoContact({
      email,
      firstName,
      lastName,
      attributes: {
        SOURCE: "blog_footer",
      },
    });
    await subscribeToBrevoBlogList(email);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed newsletter subscription");
    return apiError("Failed to subscribe", 500);
  }
}
