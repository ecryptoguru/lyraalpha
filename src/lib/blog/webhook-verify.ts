import { createHmac, timingSafeEqual } from "crypto";

export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyAmiSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = signPayload(payload, secret);
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}
