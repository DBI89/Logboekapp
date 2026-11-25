import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { seedDemo } from "@/seed/demo";

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

const migraties = import.meta.glob("../../drizzle/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
export const DB_NAAM = "ontwerp-logboek-demo";

let db: Promise<Db> | undefined;
export let bewaardInBrowser = false;

async function fsBundel(): Promise<Blob> {
  const res = await fetch(new URL("./assets/pglite-fs.wasm", document.baseURI));
  if (!res.ok) throw new Error(`Databasebestand niet geladen (${res.status})`);
  return res.blob();
}

async function open(): Promise<PGlite> {
  const fsBundle = await fsBundel();
  try {
    const p = new PGlite(`idb://${DB_NAAM}`, { fsBundle });
    await p.waitReady;
    bewaardInBrowser = true;
    return p;
  } catch {
    bewaardInBrowser = false;
    const p = new PGlite({ fsBundle });
    await p.waitReady;
    return p;
  }
}

async function maak(): Promise<Db> {
  const client = await open();
  const { rows } = await client.query<{ t: string | null }>("select to_regclass('public.projecten')::text as t");
  const d = drizzle(client, { schema }) as unknown as Db;
  if (!rows[0]?.t) {
    for (const sleutel of Object.keys(migraties).sort()) await client.exec(migraties[sleutel]);
    await seedDemo(d);
  }
  return d;
}

export function getDb(): Promise<Db> {
  db ??= maak();
  return db;
}

/** Wist de demodatabase in deze browser; na herladen begint de demo opnieuw. */
export async function wisDemo(): Promise<void> {
  try {
    indexedDB.deleteDatabase(`/pglite/${DB_NAAM}`);
  } catch {
    /* geen browseropslag */
  }
}
