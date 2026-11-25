import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { registratieRelaties, registraties } from "@/db/schema";
import { logHistorie } from "./historie";
import type { Actor } from "./types";

/** Na goedkeuring/vaststelling: een registratie die door deze wordt vervangen krijgt status 'vervangen'. */
export async function rondVervangingAf(db: Db, actor: Actor, registratieId: string): Promise<void> {
  const rel = await db
    .select()
    .from(registratieRelaties)
    .where(and(eq(registratieRelaties.vanId, registratieId), eq(registratieRelaties.soort, "vervangt")));
  for (const { naarId } of rel) {
    const [oud] = await db.select().from(registraties).where(eq(registraties.id, naarId));
    if (!oud || oud.status === "vervangen") continue;
    await db.update(registraties).set({ status: "vervangen", vervangenDoorId: registratieId }).where(eq(registraties.id, naarId));
    await logHistorie(db, {
      projectId: oud.projectId,
      gebruikerId: actor.gebruikerId,
      entiteit: "registratie",
      entiteitId: naarId,
      actie: "vervangen",
      oud: { status: oud.status },
      nieuw: { status: "vervangen", door: registratieId },
    });
  }
}
