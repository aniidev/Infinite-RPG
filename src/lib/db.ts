import postgres, { type Sql } from "postgres";

// The shared client type, for helpers that take the client as a parameter.
export type PostgresClient = Sql;

// A single lazily-created client, reused across warm serverless invocations.
let client: Sql | null = null;

/**
 * Returns the shared Postgres client.
 *
 * IMPORTANT: DATABASE_URL must be the Supabase *pooled* (Supavisor / PgBouncer)
 * connection string, not a direct connection. Under the transaction pooler,
 * prepared statements are not supported, so we set `prepare: false`.
 */
export function getSql(): Sql {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add it to .env.local (Supabase pooled/Supavisor connection string)."
      );
    }
    client = postgres(connectionString, {
      prepare: false, // required for Supavisor transaction-mode pooling
      max: 3, // keep the per-instance pool small for serverless
      idle_timeout: 20,
    });
  }
  return client;
}
