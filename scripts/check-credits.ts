import { directPrisma } from "../src/lib/prisma";
import { prisma } from "../src/lib/prisma";
import { getUserCredits } from "../src/lib/services/credit.service";

async function main() {
  // Check all users with 47 credits
  const users = await directPrisma.user.findMany({
    include: { creditSummary: true },
  });
  
  const with47 = users.filter(u => u.creditSummary?.balance === 47);
  console.log("Users with 47 credits:", with47.length);
  
  for (const u of with47) {
    console.log("\n--- User ---");
    console.log("ID:", u.id);
    console.log("Email:", u.email);
    console.log("Plan:", u.plan);
    console.log("Credits:", u.creditSummary?.balance);
  }
  
  // Now check using pooled prisma (like the API does)
  console.log("\n=== Checking via pooled Prisma ===");
  const userFromPooled = await prisma.user.findUnique({
    where: { email: "eb.ankit.exp@gmail.com" },
    select: { id: true, plan: true },
  });
  console.log("Pooled result:", userFromPooled);
  
  await Promise.all([directPrisma.$disconnect(), prisma.$disconnect()]);
}

main().catch(console.error);
