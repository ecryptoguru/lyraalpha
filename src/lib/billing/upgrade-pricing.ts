export type UpgradeRegion = "US" | "IN";

export type UpgradePlanKey = "starter" | "pro" | "elite" | "enterprise";

const PLAN_PRICE_CONFIG = {
  starter: {
    US: { label: "Free", amount: 0, currencyCode: "USD" },
    IN: { label: "Free", amount: 0, currencyCode: "INR" },
  },
  pro: {
    US: { label: "$14.99", amount: 14.99, currencyCode: "USD" },
    IN: { label: "₹1,499", amount: 1499, currencyCode: "INR" },
  },
  elite: {
    US: { label: "$39.99", amount: 39.99, currencyCode: "USD" },
    IN: { label: "₹3,999", amount: 3999, currencyCode: "INR" },
  },
  enterprise: {
    US: { label: "Coming Soon", amount: 0, currencyCode: "USD" },
    IN: { label: "Coming Soon", amount: 0, currencyCode: "INR" },
  },
} as const satisfies Record<UpgradePlanKey, Record<UpgradeRegion, { label: string; amount: number; currencyCode: "USD" | "INR" }>>;

export function getPlanPrice(region: UpgradeRegion, plan: UpgradePlanKey) {
  return PLAN_PRICE_CONFIG[plan][region];
}

export function getPlanStripePriceId(region: UpgradeRegion, plan: Extract<UpgradePlanKey, "pro" | "elite">): string | undefined {
  if (plan === "pro") {
    return region === "IN"
      ? process.env.STRIPE_PRO_PRICE_ID_IN || process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_PRO_PRICE_ID_US || process.env.STRIPE_PRO_PRICE_ID;
  }

  return region === "IN"
    ? process.env.STRIPE_ELITE_PRICE_ID_IN || process.env.STRIPE_ELITE_PRICE_ID
    : process.env.STRIPE_ELITE_PRICE_ID_US || process.env.STRIPE_ELITE_PRICE_ID;
}

export function getLocalizedCreditPackPrice(
  creditPackage: { priceUsd: number; priceInr: number },
  region: UpgradeRegion,
): { label: string; currencyCode: "USD" | "INR" } {
  if (region === "IN") {
    return {
      label: new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(creditPackage.priceInr / 100),
      currencyCode: "INR",
    };
  }

  return {
    label: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(creditPackage.priceUsd),
    currencyCode: "USD",
  };
}

function slugifyCreditPackageName(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function getCreditPackStripePriceId(
  creditPackage: { id?: string; name: string; sortOrder?: number | null; stripePriceId?: string | null },
  region: UpgradeRegion,
): string | undefined {
  const slug = slugifyCreditPackageName(creditPackage.name);
  const stableId = creditPackage.id?.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const sortOrderKey = typeof creditPackage.sortOrder === "number" ? String(creditPackage.sortOrder) : undefined;
  const regionKeys = [
    stableId ? `STRIPE_CREDIT_PRICE_ID_${region}_${stableId}` : undefined,
    sortOrderKey ? `STRIPE_CREDIT_PRICE_ID_${region}_SORT_${sortOrderKey}` : undefined,
    `STRIPE_CREDIT_PRICE_ID_${region}_${slug}`,
  ].filter(Boolean) as string[];
  const genericKeys = [
    stableId ? `STRIPE_CREDIT_PRICE_ID_${stableId}` : undefined,
    sortOrderKey ? `STRIPE_CREDIT_PRICE_ID_SORT_${sortOrderKey}` : undefined,
    `STRIPE_CREDIT_PRICE_ID_${slug}`,
  ].filter(Boolean) as string[];

  for (const key of [...regionKeys, ...genericKeys]) {
    if (process.env[key]) return process.env[key];
  }

  return creditPackage.stripePriceId || undefined;
}
