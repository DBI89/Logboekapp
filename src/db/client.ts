import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import path from "node:path";

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

const MIGRATIES = path.join(process.cwd(), "drizzle");

const globaal = globalThis as unknown as { __logboekDb?: Promise<Db> };

/** Database van de app: Postgres via DATABASE_URL (bv. Supabase), anders lokale PGlite in .data/pglite. */
export function getDb(): Promise<Db> {
  if (!globaal.__logboekDb) globaal.__logboekDb = maakDb();
  return globaal.__logboekDb;
}

async function maakDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const postgres = (await import("postgres")).default;
    const db = drizzle(postgres(url, { prepare: false }), { schema });
    await migrate(db, { migrationsFolder: MIGRATIES });
    return db as unknown as Db;
  }
  return openPglite(path.join(process.cwd(), ".data", "pglite"));
}

export async function openPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (dataDir) (await import("node:fs")).mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIES });
  return db as unknown as Db;
}
