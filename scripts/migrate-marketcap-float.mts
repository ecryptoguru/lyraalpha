import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Add new float column
    await client.query(`ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "marketCap_new" DOUBLE PRECISION`);
    console.log("Added marketCap_new column");

    // Convert string values to float (only valid numeric strings)
    await client.query(`
      UPDATE "Asset"
      SET "marketCap_new" = ("marketCap")::DOUBLE PRECISION
      WHERE "marketCap" IS NOT NULL
        AND "marketCap" != ''
        AND "marketCap" ~ '^[0-9]+(\\.[0-9]+)?$'
    `);
    console.log("Converted values");

    // Drop old column and rename new
    await client.query(`ALTER TABLE "Asset" DROP COLUMN "marketCap"`);
    console.log("Dropped old column");

    await client.query(`ALTER TABLE "Asset" RENAME COLUMN "marketCap_new" TO "marketCap"`);
    console.log("Renamed column");

    await client.query("COMMIT");
    console.log("Done!");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
