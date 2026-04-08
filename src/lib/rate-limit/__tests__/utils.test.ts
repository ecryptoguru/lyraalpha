/**
 * @vitest-environment node
 *
 * Tests for rate-limit/utils.ts — IP resolution with Vercel trusted headers.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp } from "../utils";

function makeReq(headers: Record<string, string> = {}): NextRequest {
  const h = new Headers(headers);
  return new NextRequest("http://localhost/api/test", { headers: h });
}

describe("getClientIp", () => {
  it("prefers x-vercel-forwarded-for over all others", () => {
    const req = makeReq({
      "x-vercel-forwarded-for": "1.2.3.4",
      "x-real-ip": "5.6.7.8",
      "x-forwarded-for": "9.10.11.12",
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when vercel header missing", () => {
    const req = makeReq({
      "x-real-ip": "5.6.7.8",
      "x-forwarded-for": "9.10.11.12",
    });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("falls back to x-forwarded-for when vercel and real-ip missing", () => {
    const req = makeReq({
      "x-forwarded-for": "9.10.11.12, 13.14.15.16",
    });
    expect(getClientIp(req)).toBe("9.10.11.12");
  });

  it("takes first IP from comma-separated x-vercel-forwarded-for", () => {
    const req = makeReq({
      "x-vercel-forwarded-for": "1.2.3.4, 5.6.7.8",
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("trims whitespace from IP addresses", () => {
    const req = makeReq({
      "x-vercel-forwarded-for": "  1.2.3.4  ",
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns 'anonymous' when no IP headers present", () => {
    const req = makeReq({});
    expect(getClientIp(req)).toBe("anonymous");
  });
});
