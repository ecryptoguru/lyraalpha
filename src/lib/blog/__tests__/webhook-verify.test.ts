/**
 * @vitest-environment node
 * Tests for the AMI webhook HMAC-SHA256 signature verification utility.
 */
import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { signPayload, verifyAmiSignature } from "../webhook-verify";

const SECRET = "test-secret-32-bytes-long-enough-x";
const PAYLOAD = JSON.stringify({ event: "blog_post.published", data: { contentId: "abc" } });

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

describe("signPayload", () => {
  it("produces a deterministic hex HMAC-SHA256 signature", () => {
    const sig = signPayload(PAYLOAD, SECRET);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(sig).toBe(sign(PAYLOAD, SECRET));
  });

  it("different payload produces different signature", () => {
    expect(signPayload("a", SECRET)).not.toBe(signPayload("b", SECRET));
  });

  it("different secret produces different signature", () => {
    expect(signPayload(PAYLOAD, "secret-a")).not.toBe(signPayload(PAYLOAD, "secret-b"));
  });
});

describe("verifyAmiSignature", () => {
  it("accepts a correct bare hex signature", () => {
    const sig = sign(PAYLOAD, SECRET);
    expect(verifyAmiSignature(PAYLOAD, sig, SECRET)).toBe(true);
  });

  it("accepts a signature with sha256= prefix (GitHub-style)", () => {
    const sig = `sha256=${sign(PAYLOAD, SECRET)}`;
    expect(verifyAmiSignature(PAYLOAD, sig, SECRET)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const sig = sign(PAYLOAD, SECRET);
    expect(verifyAmiSignature(PAYLOAD + "x", sig, SECRET)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const sig = sign(PAYLOAD, "wrong-secret");
    expect(verifyAmiSignature(PAYLOAD, sig, SECRET)).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(verifyAmiSignature(PAYLOAD, "", SECRET)).toBe(false);
  });

  it("rejects an empty secret", () => {
    const sig = sign(PAYLOAD, SECRET);
    expect(verifyAmiSignature(PAYLOAD, sig, "")).toBe(false);
  });

  it("rejects a truncated signature (wrong length)", () => {
    const sig = sign(PAYLOAD, SECRET).slice(0, 32);
    expect(verifyAmiSignature(PAYLOAD, sig, SECRET)).toBe(false);
  });

  it("is timing-safe — does not throw on malformed hex input", () => {
    expect(() => verifyAmiSignature(PAYLOAD, "not-hex!!", SECRET)).not.toThrow();
    expect(verifyAmiSignature(PAYLOAD, "not-hex!!", SECRET)).toBe(false);
  });
});
