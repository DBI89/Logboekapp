import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { nummerteller } from "@/db/schema";
import { PREFIX, type NummerSoort } from "./types";

export async function volgendNummer(db: Db, projectId: string, soort: NummerSoort): Promise<string> {
  const [rij] = await db
    .insert(nummerteller)
    .values({ projectId, soort, laatste: 1 })
    .onConflictDoUpdate({
      target: [nummerteller.projectId, nummerteller.soort],
      set: { laatste: sql`${nummerteller.laatste} + 1` },
    })
    .returning({ laatste: nummerteller.laatste });
  return `${PREFIX[soort]}-${String(rij.laatste).padStart(4, "0")}`;
}
