import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";

const logger = createLogger({ service: "brevo-email" });
const BREVO_API_BASE = "https://api.brevo.com/v3";

interface BrevoContactPayload {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  listIds?: number[];
  attributes?: Record<string, string | number | boolean>;
}

interface BrevoEmailPayload {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  tags?: string[];
}

function getBrevoApiKey(): string | null {
  return process.env.BREVO_API_KEY || null;
}

function parseListId(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function brevoRequest(path: string, body: unknown): Promise<boolean> {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    logger.warn({ path }, "BREVO_API_KEY not configured, skipping email operation");
    return false;
  }

  try {
    const response = await fetch(`${BREVO_API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(
        { path, status: response.status, errorText },
        "Brevo API request failed",
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ err: sanitizeError(error), path }, "Brevo request failed");
    return false;
  }
}

export async function upsertBrevoContact(payload: BrevoContactPayload): Promise<boolean> {
  const onboardingListId = parseListId(process.env.BREVO_ONBOARDING_LIST_ID);
  const listIds = payload.listIds && payload.listIds.length > 0
    ? payload.listIds
    : onboardingListId
      ? [onboardingListId]
      : undefined;

  return brevoRequest("/contacts", {
    email: payload.email,
    attributes: {
      FIRSTNAME: payload.firstName || undefined,
      LASTNAME: payload.lastName || undefined,
      ...(payload.attributes || {}),
    },
    listIds,
    updateEnabled: true,
  });
}

export async function sendBrevoEmail(payload: BrevoEmailPayload): Promise<boolean> {
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "LyraAlpha AI";

  if (!senderEmail) {
    logger.warn("BREVO_SENDER_EMAIL not configured, skipping email send");
    return false;
  }

  return brevoRequest("/smtp/email", {
    sender: {
      email: senderEmail,
      name: senderName,
    },
    to: payload.to,
    subject: payload.subject,
    htmlContent: payload.htmlContent,
    textContent: payload.textContent,
    tags: payload.tags,
  });
}

export async function subscribeToBrevoBlogList(email: string): Promise<boolean> {
  const blogListId = parseListId(process.env.BREVO_BLOG_LIST_ID);
  if (!blogListId) {
    logger.warn("BREVO_BLOG_LIST_ID not configured, skipping blog subscription");
    return false;
  }

  return upsertBrevoContact({
    email,
    listIds: [blogListId],
  });
}

export async function unsubscribeFromBrevoBlogList(email: string): Promise<boolean> {
  const blogListId = parseListId(process.env.BREVO_BLOG_LIST_ID);
  if (!blogListId) {
    logger.warn("BREVO_BLOG_LIST_ID not configured, skipping blog unsubscription");
    return false;
  }

  return brevoRequest(`/contacts/lists/${blogListId}/contacts/remove`, {
    emails: [email],
  });
}
