import { prisma } from "../../src/lib/prisma";

async function main() {
  console.log("Listing all users...");
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      credits: true,
      plan: true
    }
  });
  
  console.table(users);
}

main().catch(console.error);
