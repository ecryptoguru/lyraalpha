import { parsePublishableKey } from "@clerk/shared";
import { NextResponse, type NextRequest } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "clerk-js-proxy" });
const CLERK_JS_VERSION = process.env.NEXT_PUBLIC_CLERK_JS_VERSION || "5";

function validateClerkJsPath(path: string[]): boolean {
  const filePath = path.join("/");
  // Prevent directory traversal attacks
  if (filePath.includes("..") || filePath.includes("\\")) return false;
  // Ensure file has valid extension for Clerk JS assets
  const validExtensions = [".js", ".css", ".json", ".map", ".wasm"];
  return validExtensions.some(ext => filePath.endsWith(ext));
}

function getFrontendApi(): string | null {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return null;

  return parsePublishableKey(publishableKey)?.frontendApi ?? null;
}

function buildSourceUrl(path: string[]): string {
  const frontendApi = getFrontendApi();
  if (!frontendApi) {
    throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }

  const filePath = path.join("/");
  return `https://${frontendApi}/npm/@clerk/clerk-js@${CLERK_JS_VERSION}/dist/${filePath}`;
}

async function proxyClerkJs(path: string[]) {
  const sourceUrl = buildSourceUrl(path);
  const response = await fetch(sourceUrl, {
    headers: {
      Accept: "application/javascript,text/javascript,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 404) {
      logger.error({ sourceUrl, path: path.join("/") }, "Clerk JS asset not found");
      return NextResponse.json({ error: "Clerk asset not found" }, { status: 404 });
    } else if (response.status >= 500) {
      logger.error({ status: response.status, sourceUrl, errorText }, "Clerk CDN error");
      return NextResponse.json({ error: "Clerk service unavailable" }, { status: 503 });
    } else {
      logger.error({ status: response.status, sourceUrl, errorText }, "Failed to proxy Clerk JS asset");
      return NextResponse.json({ error: "Failed to load Clerk bundle" }, { status: response.status });
    }
  }

  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("content-type") || "application/javascript; charset=utf-8");
  
  // Differentiate cache strategy by file type for better performance
  const filePath = path.join("/");
  const isChunk = filePath.includes('.chunk.') || filePath.includes('.map.') || filePath.endsWith('.map');
  const cacheControl = isChunk 
    ? 'public, max-age=31536000, immutable' 
    : 'public, max-age=300, stale-while-revalidate=3600';
  headers.set("Cache-Control", cacheControl);
  headers.set("X-Content-Type-Options", "nosniff");

  // Stream the response body instead of buffering in memory for better performance
  return new Response(response.body, {
    status: 200,
    headers,
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    if (!path || path.length === 0) {
      return NextResponse.json({ error: "Missing Clerk bundle path" }, { status: 400 });
    }

    if (!validateClerkJsPath(path)) {
      logger.warn({ path: path.join("/") }, "Invalid Clerk JS path requested");
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    return await proxyClerkJs(path);
  } catch (error) {
    logger.error({ err: error }, "Failed to proxy Clerk JS asset");
    return NextResponse.json({ error: "Failed to load Clerk bundle" }, { status: 500 });
  }
}
