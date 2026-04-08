import Stripe from "stripe";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const packages = [
  { id: "pkg_starter_100",  name: "Starter Pack",   priceUsd: 2.99  },
  { id: "pkg_starter_300",  name: "Starter Pack +",  priceUsd: 5.99  },
  { id: "pkg_pro_500",      name: "Pro Pack",        priceUsd: 9.99  },
  { id: "pkg_pro_1000",     name: "Pro Pack +",      priceUsd: 17.99 },
  { id: "pkg_elite_1500",   name: "Elite Pack",      priceUsd: 29.99 },
  { id: "pkg_elite_3000",   name: "Elite Pack +",    priceUsd: 54.99 },
];

async function main() {
  const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  try {
    for (const pkg of packages) {
      const amountCents = Math.round(pkg.priceUsd * 100);

      const product = await stripe.products.create({
        name: pkg.name,
        metadata: { packageId: pkg.id },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: amountCents,
        currency: "usd",
        metadata: { packageId: pkg.id },
      });

      await client.query(
        `UPDATE "CreditPackage" SET "stripePriceId" = $1 WHERE id = $2`,
        [price.id, pkg.id]
      );

      console.log(`✓ ${pkg.name} → ${price.id}`);
    }

    console.log("\nAll done.");
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
