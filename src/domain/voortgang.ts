import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { gebruikers, voortgang } from "@/db/schema";
import { logHistorie } from "./historie";
import { haalRij } from "./registraties";
import { rolVan } from "./rechten";
import { Fout, type Actor } from "./types";

/** Voegt een voortgangsnotitie toe aan een lopend issue. */
export async function voegVoortgangToe(db: Db, actor: Actor, registratieId: string, tekst: string): Promise<void> {
  if (!tekst?.trim()) throw new Fout("Tekst is verplicht");
  const r = await haalRij(db, registratieId);
  if (r.projectId !== actor.projectId) throw new Fout("Registratie hoort niet bij dit project");
  if (!(await rolVan(db, actor))) throw new Fout("Geen lid van dit project");
  if (r.type !== "issue") throw new Fout("Voortgang geldt alleen voor issues");
  if (!["open", "in_behandeling"].includes(r.status)) throw new Fout("Issue is afgerond");
  await db.insert(voortgang).values({ registratieId, tekst: tekst.trim(), door: actor.gebruikerId });
  await logHistorie(db, { projectId: r.projectId, gebruikerId: actor.gebruikerId, entiteit: "registratie", entiteitId: registratieId, actie: "voortgang", nieuw: { tekst: tekst.trim() } });
}

export async function voortgangVan(db: Db, registratieId: string) {
  return db
    .select({ id: voortgang.id, tekst: voortgang.tekst, door: voortgang.door, naam: gebruikers.naam, op: voortgang.op })
    .from(voortgang)
    .innerJoin(gebruikers, eq(gebruikers.id, voortgang.door))
    .where(eq(voortgang.registratieId, registratieId))
    .orderBy(desc(voortgang.op));
}
