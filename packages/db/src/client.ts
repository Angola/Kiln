import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type DbClient = ReturnType<typeof drizzle<typeof schema>> & {
  $sql: ReturnType<typeof postgres>;
};

let cached: DbClient | undefined;

/** Read the connection string, honouring the standard env var. */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your Postgres instance (kiln schema).",
    );
  }
  return url;
}

/**
 * Get a process-wide Drizzle client. The underlying postgres.js pool is
 * attached as `$sql` for the rare raw query and for graceful shutdown.
 */
export function getDb(url = databaseUrl()): DbClient {
  if (cached) return cached;
  const sql = postgres(url, { max: 10 });
  const db = drizzle(sql, { schema }) as DbClient;
  db.$sql = sql;
  cached = db;
  return db;
}

/** Create an isolated client (used by tests / migrations). */
export function createDb(url = databaseUrl()): DbClient {
  const sql = postgres(url, { max: 5 });
  const db = drizzle(sql, { schema }) as DbClient;
  db.$sql = sql;
  return db;
}
