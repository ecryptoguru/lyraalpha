import { parsePublishableKey } from "@clerk/shared";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "clerk-js-proxy" });
const CLERK_JS_VERSION = process.env.CLERK_JS_VERSION || "5";

function getFrontendApi(): string | null {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return null;

  return parsePublishableKey(publishableKey)?.frontendApi ?? null;
}

export async function GET() {
  const frontendApi = getFrontendApi();
  if (!frontendApi) {
    logger.error("Missing CLERK_PUBLISHABLE_KEY");
    return NextResponse.json({ error: "Missing Clerk publishable key" }, { status: 500 });
  }

  const sourceUrl = `https://${frontendApi}/npm/@clerk/clerk-js@${CLERK_JS_VERSION}/dist/clerk.browser.js`;
  const response = await fetch(sourceUrl, {
    headers: {
      Accept: "application/javascript,text/javascript,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, errorText }, "Failed to proxy Clerk JS bundle");
    return NextResponse.json(
      { error: "Failed to load Clerk bundle" },
      { status: response.status },
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("content-type") || "application/javascript; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(await response.text(), {
    status: 200,
    headers,
  });
}
