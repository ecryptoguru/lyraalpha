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

  it("redacts Indian mobile format +91-9778871110", () => {
    const result = scrubPII("My number is +91-9778871110");
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

  // R1 regression tests: financial data should not be matched as phone numbers
  it("does not redact dollar amounts as phone numbers", () => {
    const result = scrubPII("The price is $50,000 and market cap is $1,234,567");
    expect(result.scrubbed).not.toContain("[phone]");
    expect(result.redactionCount).toBe(0);
  });

  it("does not redact rupee amounts as phone numbers", () => {
    const result = scrubPII("₹4,999 invested in crypto");
    expect(result.scrubbed).not.toContain("[phone]");
  });

  it("does not redact percentage values as phone numbers", () => {
    const result = scrubPII("Returns were 12,345% last year");
    expect(result.scrubbed).not.toContain("[phone]");
  });

  it("does not redact plain digit groups without phone context", () => {
    const result = scrubPII("Volume was 555-123-4567 shares");
    expect(result.scrubbed).not.toContain("[phone]");
  });

  it("redacts phone number after phone-context word", () => {
    const result = scrubPII("Call 555-123-4567 for support");
    expect(result.scrubbed).toContain("[phone]");
    expect(result.redactionTypes).toContain("phone");
  });

  // ─── Crypto-domain high-risk PII (AI audit finding) ─────────────────────────

  it("redacts BIP-39 mnemonic after explicit context word", () => {
    const seed = "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const result = scrubPII(`Seed phrase: ${seed} please don't save this`);
    expect(result.scrubbed).toContain("[redacted-seed-phrase]");
    expect(result.scrubbed).not.toContain("abandon ability");
    expect(result.redactionTypes).toContain("bip39-mnemonic");
  });

  it("redacts 24-word mnemonic with 'mnemonic:' prefix", () => {
    const words = Array(24).fill("abandon").join(" ");
    const result = scrubPII(`mnemonic: ${words}`);
    expect(result.scrubbed).toContain("[redacted-seed-phrase]");
  });

  it("does not redact normal sentences as mnemonic", () => {
    const result = scrubPII("the asset has strong fundamentals and clean tokenomics with solid");
    // 10 short words — below the 12-word floor and no trigger word
    expect(result.scrubbed).not.toContain("[redacted-seed-phrase]");
  });

  it("redacts hex private key when labelled", () => {
    const key = "0x" + "a".repeat(64);
    const result = scrubPII(`private key: ${key}`);
    expect(result.scrubbed).toContain("[redacted-private-key]");
    expect(result.redactionTypes).toContain("hex-private-key");
  });

  it("does NOT redact bare transaction hashes (no private-key context)", () => {
    const hash = "0x" + "f".repeat(64);
    const result = scrubPII(`The tx hash is ${hash}`);
    expect(result.scrubbed).toBe(`The tx hash is ${hash}`);
  });

  it("redacts OpenAI API keys", () => {
    const result = scrubPII("My key is sk-proj-abcdef0123456789abcdef0123456789abcd");
    expect(result.scrubbed).toContain("[redacted-api-key]");
    expect(result.redactionTypes).toContain("api-key");
  });

  it("redacts Stripe live secret keys", () => {
    // Split literal to avoid tripping GitHub push protection secret scanners.
    const fakeStripeKey = "sk_" + "live_" + "abcdef0123456789abcdef01";
    const result = scrubPII(`Webhook secret ${fakeStripeKey}`);
    expect(result.scrubbed).toContain("[redacted-api-key]");
  });

  it("redacts long JWT-shaped tokens", () => {
    // Realistic 3-part JWT: header.payload.signature. Header segment must be ≥ 100 chars.
    const header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" + "A".repeat(80); // >100 after eyJ prefix
    const longJwt = `${header}.payloadSegment.signatureSegment`;
    const result = scrubPII(`Bearer ${longJwt} please`);
    expect(result.scrubbed).toContain("[redacted-api-key]");
  });

  it("does NOT redact short base64 strings that look like keys", () => {
    // Short base64-ish blob that shouldn't match the api-key regex
    const result = scrubPII("Cache key: abc123def456");
    expect(result.scrubbed).toBe("Cache key: abc123def456");
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
