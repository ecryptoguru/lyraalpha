import "dotenv/config";
import { directPrisma as prisma } from "../src/lib/prisma";

async function main() {
  const packages = [
    { id: "pkg_starter_100", name: "Starter Pack", credits: 100, bonusCredits: 10, priceInr: 299, priceUsd: 2.99, isPopular: false, isActive: true, sortOrder: 1 },
    { id: "pkg_starter_300", name: "Starter Pack +", credits: 300, bonusCredits: 50, priceInr: 599, priceUsd: 5.99, isPopular: false, isActive: true, sortOrder: 2 },
    { id: "pkg_pro_500", name: "Pro Pack", credits: 500, bonusCredits: 100, priceInr: 999, priceUsd: 9.99, isPopular: true, isActive: true, sortOrder: 3 },
    { id: "pkg_pro_1000", name: "Pro Pack +", credits: 1000, bonusCredits: 250, priceInr: 1799, priceUsd: 17.99, isPopular: false, isActive: true, sortOrder: 4 },
    { id: "pkg_elite_1500", name: "Elite Pack", credits: 1500, bonusCredits: 500, priceInr: 2999, priceUsd: 29.99, isPopular: true, isActive: true, sortOrder: 5 },
    { id: "pkg_elite_3000", name: "Elite Pack +", credits: 3000, bonusCredits: 1000, priceInr: 5499, priceUsd: 54.99, isPopular: false, isActive: true, sortOrder: 6 },
  ];

  for (const pkg of packages) {
    await prisma.creditPackage.upsert({
      where: { id: pkg.id },
      update: pkg,
      create: pkg,
    });
    console.log(`Created/updated: ${pkg.name}`);
  }

  console.log("Done seeding credit packages!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
