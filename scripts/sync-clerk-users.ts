import { createClerkClient } from "@clerk/nextjs/server";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

type PlanTier = "STARTER" | "PRO" | "ELITE";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

const prisma = new PrismaClient({ adapter });

async function syncAllClerkUsers() {
  console.log("Fetching all Clerk users...\n");

  let allUsers: Awaited<ReturnType<typeof clerk.users.getUserList>>["data"] = [];
  let offset = 0;
  const limit = 100;

  // Paginate through all Clerk users
  while (true) {
    const { data } = await clerk.users.getUserList({ limit, offset });
    if (data.length === 0) break;
    allUsers = allUsers.concat(data);
    if (data.length < limit) break;
    offset += limit;
  }

  console.log(`Found ${allUsers.length} Clerk user(s).\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of allUsers) {
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "unknown";

    // Check user metadata for plan (if set via Clerk)
    const metaPlan = (user.publicMetadata as Record<string, unknown>)?.plan as string | undefined;
    const plan: PlanTier =
      metaPlan === "ELITE" ? "ELITE" : metaPlan === "PRO" ? "PRO" : "STARTER";

    try {
      const existing = await prisma.user.findUnique({ where: { id: user.id } });

      if (existing) {
        console.log(`  SKIP  ${user.id} (${email}) — already exists as ${existing.plan}`);
        skipped++;
        continue;
      }

      await prisma.user.create({
        data: {
          id: user.id,
          email,
          plan,
          updatedAt: new Date(),
        },
      });

      console.log(`  ADD   ${user.id} (${email}) — plan: ${plan}`);
      created++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERR   ${user.id} (${email}) — ${msg}`);
      errors++;
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
  await prisma.$disconnect();
}

syncAllClerkUsers().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
