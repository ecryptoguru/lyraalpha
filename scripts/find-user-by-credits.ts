import { directPrisma } from "../src/lib/prisma";

async function main() {
  // Find users by credit lots sum
  const lots = await (directPrisma as any).creditLot.groupBy({
    by: ["userId"],
    where: { remainingAmount: { gt: 0 } },
    _sum: { remainingAmount: true },
  });
  
  const with42 = lots.filter((l: any) => l._sum.remainingAmount === 42);
  console.log("Users with 42 credits in lots:", with42.length);
  
  for (const l of with42) {
    const user = await directPrisma.user.findUnique({
      where: { id: l.userId },
      select: { id: true, email: true, plan: true },
    });
    console.log("\nUser:", user);
  }
  
  // Also check denormalized credits field
  const usersWith42 = await directPrisma.user.findMany({
    where: { credits: 42 },
    select: { id: true, email: true, plan: true, credits: true },
  });
  console.log("\nUsers with credits=42 in User table:", usersWith42.length);
  for (const u of usersWith42) {
    console.log(u);
  }
  
  await directPrisma.$disconnect();
}

main().catch(console.error);
