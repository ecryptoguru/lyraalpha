import { prisma } from "../../src/lib/prisma";

async function main() {
  const userIds = [
    "user_3C8mCIIUz9EL8dwzNhh5RlnpKWB",
    "user_3CRELk0qjvLhMlZAAQ63Wz2sae4", 
    "user_3CLpptDYdQsP5YbkdkJLvXgpr2U"
  ];
  
  // Query without preferences to avoid enum issue
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      email: true,
      plan: true,
      credits: true,
      monthlyCreditsBalance: true,
      bonusCreditsBalance: true,
      purchasedCreditsBalance: true,
      points: true,
      createdAt: true,
      updatedAt: true,
      subscriptions: {
        select: {
          plan: true,
          status: true,
          currentPeriodEnd: true
        }
      }
    }
  });
  
  console.log("\n=== Elite User Verification ===\n");
  users.forEach(u => {
    const sub = u.subscriptions[0];
    console.log(`Email: ${u.email}`);
    console.log(`Plan: ${u.plan}`);
    console.log(`Credits: ${u.credits} (Monthly: ${u.monthlyCreditsBalance}, Bonus: ${u.bonusCreditsBalance}, Purchased: ${u.purchasedCreditsBalance})`);
    console.log(`Points: ${u.points}`);
    console.log(`Subscription: ${sub ? `${sub.plan} (${sub.status}) - expires ${sub.currentPeriodEnd.toISOString().split('T')[0]}` : 'None'}`);
    console.log(`Created: ${u.createdAt.toISOString().split('T')[0]}`);
    console.log(`---\n`);
  });
}

main().catch(console.error);
