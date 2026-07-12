// Minimal migration runner: executes every migrations/*.sql file in order.
// Run with `npm run db:migrate` (loads .env.local via node --env-file-if-exists).
import postgres from "postgres";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Add it to .env.local (Supabase pooled/Supavisor connection string)."
  );
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false, max: 1 });

try {
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const contents = await readFile(path.join(migrationsDir, file), "utf8");
    process.stdout.write(`Running ${file} ... `);
    await sql.unsafe(contents);
    console.log("done");
  }
  console.log("All migrations applied.");
} catch (err) {
  console.error("\nMigration failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
