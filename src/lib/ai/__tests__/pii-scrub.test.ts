/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { scrubPII, scrubPIIString } from "../pii-scrub";

describe("scrubPII", () => {
  it("returns original text when no PII is present", () => {
    const result = scrubPII("What is the price of BTC?");
    expect(result.scrubbed).toBe("What is the price of BTC?");
    expect(result.redactionCount).toBe(0);
    expect(result.redactionTypes).toEqual([]);
  });

  it("redacts email addresses", () => {
    const result = scrubPII("My email is user@example.com, please help");
    expect(result.scrubbed).toBe("My email is [email], please help");
    expect(result.redactionCount).toBe(1);
    expect(result.redactionTypes).toContain("email");
  });

  it("redacts multiple email addresses", () => {
    const result = scrubPII("Contact alice@work.io or bob@test.org for details");
    expect(result.scrubbed).toBe("Contact [email] or [email] for details");
    expect(result.redactionCount).toBe(2);
  });

  it("redacts phone numbers", () => {
    const result = scrubPII("Call me at +1-555-123-4567");
    expect(result.scrubbed).toBe("Call me at [phone]");
    expect(result.redactionTypes).toContain("phone");
  });

  it("redacts Indian phone numbers", () => {
    const result = scrubPII("My number is +91 98765 43210");
    expect(result.scrubbed).toContain("[phone]");
    expect(result.redactionTypes).toContain("phone");
  });

  it("redacts Clerk user IDs", () => {
    const result = scrubPII("Reference: user_2xABC12345def for my account");
    expect(result.scrubbed).toContain("[user-id]");
    expect(result.redactionTypes).toContain("clerk-user-id");
  });

  it("redacts multiple PII types in one pass", () => {
    const result = scrubPII("Email: test@domain.com, Phone: 555-123-4567, ID: user_abc123xyz456");
    expect(result.scrubbed).not.toContain("test@domain.com");
    expect(result.scrubbed).not.toContain("555-123-4567");
    expect(result.scrubbed).not.toContain("user_abc123xyz456");
    expect(result.redactionCount).toBeGreaterThanOrEqual(3);
    expect(result.redactionTypes).toContain("email");
    expect(result.redactionTypes).toContain("phone");
    expect(result.redactionTypes).toContain("clerk-user-id");
  });

  it("handles empty string", () => {
    const result = scrubPII("");
    expect(result.scrubbed).toBe("");
    expect(result.redactionCount).toBe(0);
  });

  it("does not redact crypto addresses or normal text", () => {
    const cryptoText = "Send to 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18";
    const result = scrubPII(cryptoText);
    expect(result.scrubbed).toBe(cryptoText);
    expect(result.redactionCount).toBe(0);
  });

  it("does not redact @ mentions that are not emails", () => {
    const result = scrubPII("Check @BTC on Twitter");
    expect(result.scrubbed).toBe("Check @BTC on Twitter");
  });
});

describe("scrubPIIString", () => {
  it("returns only the scrubbed string", () => {
    expect(scrubPIIString("Email me at test@example.com")).toBe("Email me at [email]");
  });

  it("returns original when no PII", () => {
    expect(scrubPIIString("What is BTC price?")).toBe("What is BTC price?");
  });
});
