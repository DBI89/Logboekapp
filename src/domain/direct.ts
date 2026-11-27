import type { Db } from "@/db/client";
import { magBeoordelen } from "./rechten";
import { maakRegistratie } from "./registraties";
import { maakRaakvlak } from "./raakvlakken";
import { Fout, type Actor, type RegistratieType } from "./types";

/** Ontwerpleider en coördinator starten een registratie direct vanuit een overzicht, zonder melding in de inbox. */
export async function maakDirect(
  db: Db,
  actor: Actor,
  input: { type: RegistratieType; titel: string; objectIds: string[] },
): Promise<{ id: string; nummer: string }> {
  if (!(await magBeoordelen(db, actor))) throw new Fout("Alleen ontwerpleider of ontwerpcoördinator maakt direct een registratie");
  if (!input.titel?.trim()) throw new Fout("Titel is verplicht");
  if (input.type === "raakvlak")
    return maakRaakvlak(db, actor, { titel: input.titel, omschrijving: "", objectIds: input.objectIds, details: {} });
  return maakRegistratie(db, actor, {
    type: input.type,
    titel: input.titel,
    omschrijving: "",
    koppelingen: input.objectIds.map((objectId) => ({ soort: "exemplaar" as const, objectId })),
  });
}
