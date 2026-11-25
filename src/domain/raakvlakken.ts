import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { raakvlakKanten, registratieRelaties, registraties } from "@/db/schema";
import { logHistorie } from "./historie";
import { effectieveEigenaarUit, laadObjecten, nakomelingenUit } from "./objecten";
import { haalRij, maakRegistratie } from "./registraties";
import { isOntwerpleider } from "./rechten";
import { rondVervangingAf } from "./vervanging";
import { Fout, type Actor } from "./types";

export type RaakvlakInvoer = {
  titel: string;
  omschrijving: string;
  objectIds: string[];
  details: { soort?: "fysiek" | "functioneel" | "ruimtelijk"; afspraak?: string };
  bronMeldingIds?: string[];
};

export async function maakRaakvlak(db: Db, actor: Actor, input: RaakvlakInvoer): Promise<{ id: string; nummer: string }> {
  const ids = [...new Set(input.objectIds)];
  if (ids.length < 2) throw new Fout("Kies minstens twee objecten");
  const alle = new Map((await laadObjecten(db, actor.projectId)).map((o) => [o.id, o]));
  const objs = ids.map((i) => alle.get(i));
  if (objs.some((o) => !o)) throw new Fout("Object bestaat niet of is niet actief");
  if (new Set(objs.map((o) => o!.niveau)).size > 1) throw new Fout("Raakvlak alleen tussen objecten op hetzelfde niveau");
  const r = await maakRegistratie(db, actor, {
    type: "raakvlak",
    titel: input.titel,
    omschrijving: input.omschrijving,
    koppelingen: ids.map((objectId) => ({ soort: "exemplaar", objectId })),
    details: input.details,
    eigenaarId: null,
    bronMeldingIds: input.bronMeldingIds,
  });
  await db
    .insert(raakvlakKanten)
    .values(ids.map((objectId) => ({ registratieId: r.id, objectId, verantwoordelijkeId: effectieveEigenaarUit(alle, objectId) })));
  return r;
}

async function laadKant(db: Db, actor: Actor, kantId: string) {
  const [kant] = await db.select().from(raakvlakKanten).where(eq(raakvlakKanten.id, kantId));
  if (!kant) throw new Fout("Kant bestaat niet");
  const r = await haalRij(db, kant.registratieId);
  if (r.projectId !== actor.projectId) throw new Fout("Registratie hoort niet bij dit project");
  if (kant.verantwoordelijkeId !== actor.gebruikerId && !(await isOntwerpleider(db, actor)))
    throw new Fout("Alleen de verantwoordelijke van deze kant of de ontwerpleider");
  return { kant, r };
}

async function alleKanten(db: Db, registratieId: string) {
  return db.select().from(raakvlakKanten).where(eq(raakvlakKanten.registratieId, registratieId));
}

async function zetStatus(db: Db, actor: Actor, r: { id: string; projectId: string; status: string }, status: string, actie: string, nieuw: Record<string, unknown> = {}) {
  await db.update(registraties).set({ status }).where(eq(registraties.id, r.id));
  await logHistorie(db, {
    projectId: r.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "registratie",
    entiteitId: r.id,
    actie,
    oud: { status: r.status },
    nieuw: { status, ...nieuw },
  });
}

export async function kantAfgestemd(db: Db, actor: Actor, kantId: string, bron?: string): Promise<void> {
  const { kant, r } = await laadKant(db, actor, kantId);
  if (r.status !== "concept") throw new Fout("Afstemmen kan alleen bij een concept-afspraak");
  const objecten = new Map((await laadObjecten(db, r.projectId, false)).map((o) => [o.id, o]));
  if (objecten.get(kant.objectId)?.extern && !bron?.trim())
    throw new Fout("Leg de bron van het akkoord van de externe partij vast");
  await db
    .update(raakvlakKanten)
    .set({ afgestemdOp: new Date(), afgestemdBron: bron?.trim() || null })
    .where(eq(raakvlakKanten.id, kantId));
  await logHistorie(db, {
    projectId: r.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "registratie",
    entiteitId: r.id,
    actie: "kant_afgestemd",
    nieuw: { object: objecten.get(kant.objectId)?.code, bron },
  });
  if ((await alleKanten(db, r.id)).every((k) => k.afgestemdOp)) await zetStatus(db, actor, r, "afgestemd", "afgestemd");
}

export async function kantVerwerkt(db: Db, actor: Actor, kantId: string): Promise<void> {
  const { kant, r } = await laadKant(db, actor, kantId);
  if (r.status !== "afgestemd") throw new Fout("Eerst afstemmen, dan verwerken");
  await db.update(raakvlakKanten).set({ verwerktOp: new Date() }).where(eq(raakvlakKanten.id, kantId));
  await logHistorie(db, {
    projectId: r.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "registratie",
    entiteitId: r.id,
    actie: "kant_verwerkt",
    nieuw: { kantId: kant.id },
  });
  if ((await alleKanten(db, r.id)).every((k) => k.verwerktOp)) await zetStatus(db, actor, r, "verwerkt", "verwerkt");
}

export async function eindoordeel(
  db: Db,
  actor: Actor,
  id: string,
  akkoord: boolean,
  opts: { opmerking?: string; terugNaarKantIds?: string[] } = {},
): Promise<void> {
  if (!(await isOntwerpleider(db, actor))) throw new Fout("Alleen de ontwerpleider geeft het eindoordeel");
  const r = await haalRij(db, id);
  if (r.type !== "raakvlak" || r.projectId !== actor.projectId) throw new Fout("Geen raakvlakafspraak in dit project");
  if (r.status !== "verwerkt") throw new Fout(`Overgang niet toegestaan: ${r.status} → vastgesteld`);
  if (akkoord) {
    await db
      .update(registraties)
      .set({ goedgekeurdDoor: actor.gebruikerId, goedgekeurdOp: new Date() })
      .where(eq(registraties.id, id));
    await zetStatus(db, actor, r, "vastgesteld", "eindoordeel_akkoord", { opmerking: opts.opmerking });
    await rondVervangingAf(db, actor, id);
    return;
  }
  if (!opts.opmerking?.trim()) throw new Fout("Opmerking is verplicht bij niet akkoord");
  const kanten = await alleKanten(db, id);
  const terug = (opts.terugNaarKantIds ?? []).filter((k) => kanten.some((x) => x.id === k));
  if (!terug.length) throw new Fout("Kies de kant(en) die nog actie hebben");
  await db.update(raakvlakKanten).set({ verwerktOp: null }).where(inArray(raakvlakKanten.id, terug));
  await zetStatus(db, actor, r, "afgestemd", "eindoordeel_niet_akkoord", { opmerking: opts.opmerking, terugNaarKantIds: terug });
}

export async function verfijn(db: Db, actor: Actor, raakvlakId: string, input: RaakvlakInvoer): Promise<{ id: string; nummer: string }> {
  const r = await haalRij(db, raakvlakId);
  if (r.type !== "raakvlak" || r.projectId !== actor.projectId) throw new Fout("Geen raakvlakafspraak in dit project");
  const alle = await laadObjecten(db, actor.projectId);
  const kanten = await alleKanten(db, raakvlakId);
  const onder = new Set(kanten.flatMap((k) => nakomelingenUit(alle, k.objectId)));
  if (!input.objectIds.every((o) => onder.has(o))) throw new Fout("Verfijnen kan alleen naar objecten onder de oorspronkelijke kanten");
  const nieuw = await maakRaakvlak(db, actor, input);
  await db.insert(registratieRelaties).values({ vanId: nieuw.id, naarId: raakvlakId, soort: "verfijnt" });
  return nieuw;
}
