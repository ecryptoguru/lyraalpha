import { directPrisma as prisma } from "../src/lib/prisma";

const TRENDING_QUESTIONS = [
  {
    question: "What are the key technical drivers for NVDA and the AI sector this week?",
    category: "markets",
    displayOrder: 1,
  },
  {
    question: "Analyze the current market regime. Are we in an inflationary or deflationary environment?",
    category: "economy",
    displayOrder: 2,
  },
  {
    question: "How will the upcoming FOMC meeting impact small-cap (RTY) growth targets?",
    category: "policy",
    displayOrder: 3,
  },
  {
    question: "What is the correlation between BTC and gold in the current liquidity cycle?",
    category: "crypto",
    displayOrder: 4,
  },
  {
    question: "Provide an institutional outlook on Copper (HG=F) supply constraints for 2026.",
    category: "commodities",
    displayOrder: 5,
  },
  {
    question: "Review major tech earnings (MSFT, GOOGL) and their impact on cloud infrastructure spend.",
    category: "corporate",
    displayOrder: 6,
  },
];

async function main() {
  console.log("🌱 Seeding Lyra Trending Questions...");

  for (const q of TRENDING_QUESTIONS) {
    await prisma.trendingQuestion.upsert({
      where: { id: `seed-q-${q.displayOrder}` },
      update: {
        question: q.question,
        category: q.category,
        displayOrder: q.displayOrder,
        isActive: true,
      },
      create: {
        id: `seed-q-${q.displayOrder}`,
        question: q.question,
        category: q.category,
        displayOrder: q.displayOrder,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  }

  console.log("✅ Lyra Trending Questions Seeded Successfully.");
}

if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}

export { main as seedTrendingQuestions };
