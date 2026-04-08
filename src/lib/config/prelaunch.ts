const DEFAULT_ALLOWED_COUPONS = ["ELITE15", "ELITE30"] as const;

const PRELAUNCH_COUPON_ALIASES: Record<string, string> = {
  ELITE15: "ELITE15",
  ELITE30: "ELITE30",
  "ELITE15/30": "ELITE15",
  "ELITE30/15": "ELITE30",
};

function loadAllowedCoupons(): readonly string[] {
  const raw = process.env.PRELAUNCH_ALLOWED_COUPONS?.trim();
  if (!raw) return DEFAULT_ALLOWED_COUPONS;

  const parsed = raw
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_COUPONS;
}

const ALLOWED_COUPONS = loadAllowedCoupons();

export const PRELAUNCH_WAITLIST_ENABLED = true;
export const PRELAUNCH_WAITLIST_SECTION_ID = "join-waitlist";
export const PRELAUNCH_TRIAL_DAYS = 30;
export const PRELAUNCH_BONUS_CREDITS = 500;

export function normalizePrelaunchCoupon(code?: string | null): string | null {
  if (!code) return null;

  const normalized = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!normalized) return null;

  return PRELAUNCH_COUPON_ALIASES[normalized] ?? normalized;
}

export function getAllowedPrelaunchCoupons(): readonly string[] {
  return ALLOWED_COUPONS;
}

export function isAllowedPrelaunchCoupon(code?: string | null): boolean {
  const normalized = normalizePrelaunchCoupon(code);
  if (!normalized) return false;
  return ALLOWED_COUPONS.includes(normalized as (typeof ALLOWED_COUPONS)[number]);
}
