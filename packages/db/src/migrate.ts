import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb, databaseUrl } from "./client.js";

/** Apply generated Drizzle migrations to the target database. */
async function main() {
  const db = createDb(databaseUrl());
  const migrationsFolder = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../drizzle",
  );
  console.log(`Applying migrations from ${migrationsFolder} ...`);
  await migrate(db, { migrationsFolder });
  await db.$sql.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
