import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create the enum type
    await client.query(`
      CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED')
    `);
    console.log("Created BlogPostStatus enum");

    // Add a temporary column with the new type
    await client.query(`
      ALTER TABLE "BlogPost" ADD COLUMN "status_new" "BlogPostStatus"
    `);
    console.log("Added status_new column");

    // Convert existing string values to enum
    await client.query(`
      UPDATE "BlogPost"
      SET "status_new" = CASE
        WHEN status = 'published' THEN 'PUBLISHED'::"BlogPostStatus"
        WHEN status = 'draft' THEN 'DRAFT'::"BlogPostStatus"
        WHEN status = 'archived' THEN 'ARCHIVED'::"BlogPostStatus"
        ELSE 'PUBLISHED'::"BlogPostStatus"
      END
    `);
    console.log("Converted values");

    // Drop old column and rename new
    await client.query(`ALTER TABLE "BlogPost" DROP COLUMN "status"`);
    console.log("Dropped old column");

    await client.query(`ALTER TABLE "BlogPost" RENAME COLUMN "status_new" TO "status"`);
    console.log("Renamed column");

    // Set default
    await client.query(`
      ALTER TABLE "BlogPost" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED'::"BlogPostStatus"
    `);
    console.log("Set default");

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
