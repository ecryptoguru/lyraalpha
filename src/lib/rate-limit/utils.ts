import { NextRequest } from "next/server";

/**
 * Extract client IP address from NextRequest.
 * Priority: Vercel trusted header → x-real-ip → x-forwarded-for → fallback.
 * x-vercel-forwarded-for is set by Vercel's edge and cannot be spoofed by clients.
 */
export function getClientIp(req: NextRequest): string {
  function firstIp(value: string): string | null {
    const first = value.split(",")[0]?.trim();
    return first ? first : null;
  }

  // 1. Vercel trusted header (cannot be spoofed — set by edge)
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    const ip = firstIp(vercelIp);
    if (ip) return ip;
  }

  // 2. x-real-ip (set by reverse proxies like nginx)
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    const ip = realIp.trim();
    if (ip) return ip;
  }

  // 3. x-forwarded-for (last resort — spoofable but better than nothing)
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = firstIp(forwardedFor);
    if (ip) return ip;
  }

  return "anonymous";
}
