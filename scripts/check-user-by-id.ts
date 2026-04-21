import { directPrisma } from "../src/lib/prisma";
import { normalizePlanTier, expireTrialIfNeeded } from "../src/lib/middleware/plan-gate";
import { isPrivilegedEmail } from "../src/lib/auth";

async function main() {
  const user = await directPrisma.user.findUnique({
    where: { email: "eb.ankit.exp@gmail.com" },
  });
  
  if (!user) {
    console.log("User not found");
    return;
  }
  
  console.log("=== Found User ===");
  console.log("User ID:", user.id);
  console.log("Email:", user.email);
  console.log("Plan in DB:", user.plan);
  console.log("Trial Ends At:", user.trialEndsAt);
  
  // Check subscriptions
  const subscriptions = await directPrisma.subscription.findMany({
    where: { userId: user.id, status: "ACTIVE", plan: { not: "STARTER" } },
  });
  console.log("\nActive Subscriptions (non-STARTER):", subscriptions.length);
  if (subscriptions.length > 0) {
    console.log(JSON.stringify(subscriptions, null, 2));
  }
  
  // Simulate the plan gating logic
  let plan = normalizePlanTier(user.plan);
  const hasActiveTrial = Boolean(user.trialEndsAt && user.trialEndsAt > new Date());
  const hasExpiredTrial = Boolean(user.trialEndsAt && user.trialEndsAt < new Date());
  const hasActivePaidSubscription = Boolean(subscriptions?.length);
  const isAdmin = isPrivilegedEmail(user.email);

  console.log("\n=== Plan Gating Logic ===");
  console.log("Initial Plan:", plan);
  console.log("Has Active Trial:", hasActiveTrial);
  console.log("Has Expired Trial:", hasExpiredTrial);
  console.log("Has Active Paid Subscription:", hasActivePaidSubscription);
  console.log("Is Admin:", isAdmin);
  
  if (isAdmin) {
    console.log("Result: ELITE (admin override)");
    plan = "ELITE";
  } else if (hasExpiredTrial && plan !== "STARTER") {
    console.log("Trial expired - would downgrade to STARTER");
    const result = await expireTrialIfNeeded(user.id, plan, user.trialEndsAt);
    console.log("After expireTrialIfNeeded:", result.plan);
    plan = result.plan;
  } else if (hasActiveTrial && plan === "STARTER") {
    console.log("Result: PRO (active trial)");
    plan = "PRO";
  } else if (hasActivePaidSubscription && plan === "STARTER") {
    console.log("Result: PRO (active subscription)");
    plan = "PRO";
  }
  
  console.log("\n=== Final Plan ===");
  console.log("Plan:", plan);
  
  await directPrisma.$disconnect();
}

main().catch(console.error);
