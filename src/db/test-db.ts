import * as schema from "./schema";
import type { Db } from "./client";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";

let sjabloon: Promise<PGlite> | undefined;

async function maakSjabloon(): Promise<PGlite> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return client;
}

/** Verse in-memory database met alle migraties (kloon van een eenmalig gemigreerd sjabloon). */
export async function maakTestDb(): Promise<Db> {
  sjabloon ??= maakSjabloon();
  const kloon = (await (await sjabloon).clone()) as PGlite;
  const { drizzle } = await import("drizzle-orm/pglite");
  return drizzle(kloon, { schema }) as unknown as Db;
}
