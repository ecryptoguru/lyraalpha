import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12; // NIST SP 800-38D specifies 96-bit (12-byte) IVs for AES-GCM
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

// Cache for derived keys to avoid recomputation
const keyCache = new Map<string, Buffer>();

/**
 * Derives a key from a password using PBKDF2 (async with caching)
 */
async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  const cacheKey = password + ":" + salt.toString("hex");
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, KEY_LENGTH, "sha256", (err, key) => {
      if (err) reject(err);
      else {
        keyCache.set(cacheKey, key);
        resolve(key);
      }
    });
  });
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * @param data - The data to encrypt
 * @param password - The encryption password (should be from env var)
 * @returns Base64-encoded encrypted string with salt, IV, and auth tag
 */
export async function encrypt(data: string, password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = await deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypts sensitive data using AES-256-GCM
 * @param encryptedData - Base64-encoded encrypted string
 * @param password - The decryption password (should be from env var)
 * @returns Decrypted string
 */
export async function decrypt(encryptedData: string, password: string): Promise<string> {
  const buffer = Buffer.from(encryptedData, "base64");

  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = buffer.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const encrypted = buffer.subarray(ENCRYPTED_POSITION);

  const key = await deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}

/**
 * Sanitizes a string input by trimming and removing null bytes
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/\0/g, "");
}

/**
 * Validates that a string is safe for use in API calls
 */
export function isSafeString(input: string): boolean {
  if (typeof input !== "string") return false;
  if (input.length === 0 || input.length > 10000) return false;
  return /^[a-zA-Z0-9\-_\.@:+\/=~]+$/.test(input);
}

/**
 * Hashes a string using SHA-256 for comparison
 */
export function hashString(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
