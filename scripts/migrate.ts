import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "@neondatabase/serverless";
import { getConfig } from "@/lib/config";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: getConfig().DATABASE_URL });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const filenames = (await readdir(resolve("migrations")))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort();

    for (const filename of filenames) {
      const sql = await readFile(resolve("migrations", filename), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await pool.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE filename = $1",
        [filename],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Migration ${filename} changed after it was applied.`);
        }
        console.log(`Skipping ${filename} (already applied).`);
        continue;
      }
      await pool.query("BEGIN");
      try {
        await pool.query(sql);
        await pool.query(
          "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
          [filename, checksum],
        );
        await pool.query("COMMIT");
        console.log(`Applied ${filename}.`);
      } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
      }
    }
    console.log("All database migrations completed successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
