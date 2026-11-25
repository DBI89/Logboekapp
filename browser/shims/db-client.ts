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
  const d = drizzle(client, { schema }) as unknown as Db;
  const { rows } = await client.query<{ t: string | null }>("select to_regclass('public.projecten')::text as t");
  const nieuw = !rows[0]?.t;
  await client.exec("create table if not exists browser_migraties (naam text primary key)");
  const gedaan = new Set((await client.query<{ naam: string }>("select naam from browser_migraties")).rows.map((r) => r.naam));
  const namen = Object.keys(migraties).sort();
  // Een database uit de eerste demoversie heeft de beginstructuur al, maar nog geen administratie van updates.
  if (!nieuw && gedaan.size === 0) {
    await client.query("insert into browser_migraties (naam) values ($1)", [namen[0]]);
    gedaan.add(namen[0]);
  }
  for (const naam of namen) {
    if (gedaan.has(naam)) continue;
    await client.exec(migraties[naam]);
    await client.query("insert into browser_migraties (naam) values ($1)", [naam]);
  }
  if (nieuw) await seedDemo(d);
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
