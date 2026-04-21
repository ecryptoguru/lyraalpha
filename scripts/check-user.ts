import { directPrisma } from "../src/lib/prisma";

async function main() {
  const user = await directPrisma.user.findUnique({
    where: { email: "eb.ankit.exp@gmail.com" },
  });
  if (!user) {
    console.log("User not found");
    process.exit(1);
  }
  console.log("=== User Plan Diagnostic ===");
  console.log("Email:", user.email);
  console.log("User ID:", user.id);
  console.log("Current Plan:", user.plan);
  console.log("Created At:", user.createdAt);
  console.log("Trial Ends At:", user.trialEndsAt);
  console.log("Trial Expired:", user.trialEndsAt ? user.trialEndsAt < new Date() : false);
  
  const subscriptions = await directPrisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  console.log("\n=== Subscriptions ===");
  console.log(subscriptions.length > 0 ? JSON.stringify(subscriptions, null, 2) : "No subscriptions");
  
  await directPrisma.$disconnect();
}

main().catch(console.error);
