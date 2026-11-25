import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  fasen,
  gebruikers,
  historie,
  meldingen,
  objecten,
  projecten,
  raakvlakKanten,
  rapportSnapshots,
  documenten,
  registratieBronnen,
  registratieKoppelingen,
  registratieRelaties,
  registraties,
} from "@/db/schema";
import { logHistorie } from "./historie";
import { volgendNummer } from "./nummering";
import { effectieveEigenaarUit, laadObjecten, nakomelingenUit, vooroudersUit, type ObjectRij } from "./objecten";
import { valideerDetails } from "./velden";
import { voortgangVan } from "./voortgang";
import { BEVROREN, Fout, type Actor, type RegistratieType } from "./types";

export type Koppeling =
  | { soort: "exemplaar"; objectId: string }
  | { soort: "type"; objecttype: string; toepassing: string | null; bereikObjectId: string | null };

export type RegistratieInvoer = {
  type: RegistratieType;
  titel: string;
  omschrijving: string;
  faseId?: string;
  koppelingen: Koppeling[];
  details?: Record<string, unknown>;
  eigenaarId?: string | null;
  discipline?: string | null;
  bronMeldingIds?: string[];
};

export type RegistratieRij = {
  id: string;
  nummer: string;
  type: RegistratieType;
  titel: string;
  status: string;
  faseId: string;
  faseCode: string;
  eigenaarId: string | null;
  viaType: boolean;
};

const BEGINSTATUS: Record<RegistratieType, string> = {
  issue: "open",
  afwijking: "concept",
  wijziging: "concept",
  ontwerpkeuze: "concept",
  raakvlak: "concept",
};

export async function actieveFase(db: Db, projectId: string): Promise<string> {
  const [p] = await db.select({ f: projecten.actieveFaseId }).from(projecten).where(eq(projecten.id, projectId));
  if (!p?.f) throw new Fout("Project heeft geen actieve fase");
  return p.f;
}

async function controleerKoppelingen(db: Db, projectId: string, koppelingen: Koppeling[]): Promise<Map<string, ObjectRij>> {
  const alle = new Map((await laadObjecten(db, projectId)).map((o) => [o.id, o]));
  for (const k of koppelingen) {
    const objectId = k.soort === "exemplaar" ? k.objectId : k.bereikObjectId;
    if (k.soort === "type" && !k.objecttype) throw new Fout("Kies een objecttype");
    if (!objectId) continue;
    const o = alle.get(objectId);
    if (!o) throw new Fout("Object bestaat niet of is niet actief");
    if (o.niveau > 3) throw new Fout("Koppelen kan alleen op niveau 0 t/m 3");
  }
  return alle;
}

function koppelingRij(registratieId: string, k: Koppeling) {
  return k.soort === "exemplaar"
    ? { registratieId, soort: "exemplaar" as const, objectId: k.objectId }
    : {
        registratieId,
        soort: "type" as const,
        objecttype: k.objecttype,
        toepassing: k.toepassing,
        bereikObjectId: k.bereikObjectId,
      };
}

export async function maakRegistratie(db: Db, actor: Actor, input: RegistratieInvoer): Promise<{ id: string; nummer: string }> {
  if (!input.titel.trim()) throw new Fout("Titel is verplicht");
  const details = valideerDetails(input.type, input.details);
  const alle = await controleerKoppelingen(db, actor.projectId, input.koppelingen);
  const eersteObject = input.koppelingen.find((k) => k.soort === "exemplaar") as { objectId: string } | undefined;
  const eigenaarId =
    input.eigenaarId !== undefined ? input.eigenaarId : eersteObject ? effectieveEigenaarUit(alle, eersteObject.objectId) : null;
  const nummer = await volgendNummer(db, actor.projectId, input.type);
  const [r] = await db
    .insert(registraties)
    .values({
      projectId: actor.projectId,
      type: input.type,
      nummer,
      titel: input.titel.trim(),
      omschrijving: input.omschrijving ?? "",
      faseId: input.faseId ?? (await actieveFase(db, actor.projectId)),
      status: BEGINSTATUS[input.type],
      discipline: input.discipline ?? null,
      eigenaarId,
      aangemaaktDoor: actor.gebruikerId,
      details,
    })
    .returning({ id: registraties.id });
  if (input.koppelingen.length)
    await db.insert(registratieKoppelingen).values(input.koppelingen.map((k) => koppelingRij(r.id, k)));
  if (input.bronMeldingIds?.length)
    await db.insert(registratieBronnen).values(input.bronMeldingIds.map((meldingId) => ({ registratieId: r.id, meldingId })));
  await logHistorie(db, {
    projectId: actor.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "registratie",
    entiteitId: r.id,
    actie: "aangemaakt",
    nieuw: { nummer, titel: input.titel },
  });
  return { id: r.id, nummer };
}

export async function haalRij(db: Db, id: string) {
  const [r] = await db.select().from(registraties).where(eq(registraties.id, id));
  if (!r) throw new Fout("Registratie bestaat niet");
  return r;
}

export type Patch = {
  titel?: string;
  omschrijving?: string;
  details?: Record<string, unknown>;
  koppelingen?: Koppeling[];
  eigenaarId?: string | null;
  discipline?: string | null;
};

/** Past een niet-bevroren registratie aan. Details worden samengevoegd. */
export async function werkBij(db: Db, actor: Actor, id: string, patch: Patch, opties: { actie?: string; negeerBevroren?: boolean } = {}) {
  const r = await haalRij(db, id);
  if (r.projectId !== actor.projectId) throw new Fout("Registratie hoort niet bij dit project");
  if (!opties.negeerBevroren && (BEVROREN as readonly string[]).includes(r.status)) throw new Fout("Registratie is bevroren");
  if (!opties.negeerBevroren && r.status === "ter_goedkeuring")
    throw new Fout("Registratie staat ter goedkeuring; laat hem eerst afwijzen om te wijzigen");
  if (!opties.negeerBevroren && r.type === "issue" && r.status === "in_behandeling")
    throw new Fout("Issue is in behandeling; leg nieuwe informatie vast als voortgang");
  if (!opties.negeerBevroren && r.type === "issue" && ["opgelost", "vervallen"].includes(r.status)) throw new Fout("Issue is afgerond");
  if (!opties.negeerBevroren && r.type === "raakvlak") {
    const kanten = await db.select().from(raakvlakKanten).where(eq(raakvlakKanten.registratieId, id));
    if (kanten.some((k) => k.afgestemdOp)) throw new Fout("Afstemming is begonnen; de afspraak ligt vast");
  }
  const details = patch.details ? valideerDetails(r.type, { ...r.details, ...patch.details }) : undefined;
  if (patch.koppelingen) await controleerKoppelingen(db, actor.projectId, patch.koppelingen);
  const set: Partial<typeof registraties.$inferInsert> = {};
  if (patch.titel !== undefined) {
    if (!patch.titel.trim()) throw new Fout("Titel is verplicht");
    set.titel = patch.titel.trim();
  }
  if (patch.omschrijving !== undefined) set.omschrijving = patch.omschrijving;
  if (details) set.details = details;
  if (patch.eigenaarId !== undefined) set.eigenaarId = patch.eigenaarId;
  if (patch.discipline !== undefined) set.discipline = patch.discipline;
  if (Object.keys(set).length) await db.update(registraties).set(set).where(eq(registraties.id, id));
  if (patch.koppelingen) {
    // Koppelingen die na een import te herkoppelen zijn, blijven staan tot ze via Import zijn verplaatst.
    await db
      .delete(registratieKoppelingen)
      .where(and(eq(registratieKoppelingen.registratieId, id), eq(registratieKoppelingen.teHerkoppelen, false)));
    if (patch.koppelingen.length)
      await db.insert(registratieKoppelingen).values(patch.koppelingen.map((k) => koppelingRij(id, k)));
  }
  const oud = Object.fromEntries(Object.keys(set).map((k) => [k, r[k as keyof typeof r]]));
  await logHistorie(db, {
    projectId: actor.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "registratie",
    entiteitId: id,
    actie: opties.actie ?? "bijgewerkt",
    oud: patch.koppelingen ? { ...oud, koppelingen: "gewijzigd" } : oud,
    nieuw: patch.koppelingen ? { ...set, koppelingen: patch.koppelingen } : set,
  });
}

type KoppelRij = typeof registratieKoppelingen.$inferSelect;

/** Objecten (ids) die een koppeling raakt: het exemplaar, of alle actieve objecten van het type binnen het bereik. */
function geraakteObjecten(k: KoppelRij, alle: ObjectRij[]): string[] {
  if (k.teHerkoppelen) return [];
  if (k.soort === "exemplaar") return k.objectId ? [k.objectId] : [];
  const binnen = k.bereikObjectId ? new Set([k.bereikObjectId, ...nakomelingenUit(alle, k.bereikObjectId)]) : null;
  return alle
    .filter(
      (o) =>
        o.objecttype === k.objecttype &&
        (!k.toepassing || o.toepassing === k.toepassing) &&
        (!binnen || binnen.has(o.id)),
    )
    .map((o) => o.id);
}

async function projectRijen(db: Db, projectId: string, faseId?: string | null) {
  const voorwaarden = [eq(registraties.projectId, projectId)];
  if (faseId) voorwaarden.push(eq(registraties.faseId, faseId));
  const rijen = await db
    .select({ r: registraties, faseCode: fasen.code })
    .from(registraties)
    .innerJoin(fasen, eq(fasen.id, registraties.faseId))
    .where(and(...voorwaarden))
    .orderBy(asc(registraties.nummer));
  const ids = rijen.map((x) => x.r.id);
  const koppelingen = ids.length
    ? await db.select().from(registratieKoppelingen).where(inArray(registratieKoppelingen.registratieId, ids))
    : [];
  return { rijen, koppelingen };
}

const naarRij = (r: typeof registraties.$inferSelect, faseCode: string, viaType: boolean): RegistratieRij => ({
  id: r.id,
  nummer: r.nummer,
  type: r.type,
  titel: r.titel,
  status: r.status,
  faseId: r.faseId,
  faseCode,
  eigenaarId: r.eigenaarId,
  viaType,
});

export async function registratiesVoorObject(
  db: Db,
  objectId: string,
  opties: { inclusiefOnderliggend: boolean; faseId?: string | null },
): Promise<RegistratieRij[]> {
  const [obj] = await db.select().from(objecten).where(eq(objecten.id, objectId));
  if (!obj) throw new Fout("Object bestaat niet");
  const alle = await laadObjecten(db, obj.projectId);
  const doel = new Set([objectId, ...(opties.inclusiefOnderliggend ? nakomelingenUit(alle, objectId) : [])]);
  const { rijen, koppelingen } = await projectRijen(db, obj.projectId, opties.faseId);
  const uit: RegistratieRij[] = [];
  for (const { r, faseCode } of rijen) {
    const eigen = koppelingen.filter((k) => k.registratieId === r.id);
    const exemplaar = eigen.some((k) => k.soort === "exemplaar" && geraakteObjecten(k, alle).some((o) => doel.has(o)));
    const viaType = eigen.some((k) => k.soort === "type" && geraakteObjecten(k, alle).some((o) => doel.has(o)));
    if (exemplaar || viaType) uit.push(naarRij(r, faseCode, !exemplaar));
  }
  return uit;
}

/** Aantal registraties per object, inclusief alles wat eronder hangt. */
export async function registratiesOpObjectBoom(db: Db, projectId: string, faseId?: string | null): Promise<Map<string, number>> {
  const alle = await laadObjecten(db, projectId);
  const perId = new Map(alle.map((o) => [o.id, o]));
  const { rijen, koppelingen } = await projectRijen(db, projectId, faseId);
  const telling = new Map<string, number>();
  for (const { r } of rijen) {
    const geraakt = new Set<string>();
    for (const k of koppelingen.filter((k) => k.registratieId === r.id))
      for (const o of geraakteObjecten(k, alle)) {
        geraakt.add(o);
        vooroudersUit(perId, o).forEach((v) => geraakt.add(v));
      }
    for (const o of geraakt) telling.set(o, (telling.get(o) ?? 0) + 1);
  }
  return telling;
}

/** Objecten die een registratie raakt (voor rapporten): exemplaren en typetreffers. */
export async function geraakteObjectenVan(db: Db, projectId: string, registratieIds: string[]): Promise<Map<string, Set<string>>> {
  const alle = await laadObjecten(db, projectId);
  const koppelingen = registratieIds.length
    ? await db.select().from(registratieKoppelingen).where(inArray(registratieKoppelingen.registratieId, registratieIds))
    : [];
  const uit = new Map<string, Set<string>>(registratieIds.map((id) => [id, new Set()]));
  for (const k of koppelingen) for (const o of geraakteObjecten(k, alle)) uit.get(k.registratieId)!.add(o);
  return uit;
}

export async function zoekRegistraties(
  db: Db,
  projectId: string,
  filter: { type?: RegistratieType[]; status?: string[]; faseId?: string | null; tekst?: string } = {},
): Promise<RegistratieRij[]> {
  const { rijen } = await projectRijen(db, projectId, filter.faseId);
  const t = filter.tekst?.trim().toLowerCase();
  return rijen
    .filter(({ r }) => !filter.type?.length || filter.type.includes(r.type))
    .filter(({ r }) => !filter.status?.length || filter.status.includes(r.status))
    .filter(({ r }) => !t || `${r.nummer} ${r.titel} ${r.omschrijving}`.toLowerCase().includes(t))
    .map(({ r, faseCode }) => naarRij(r, faseCode, false));
}

export async function haalRegistratie(db: Db, id: string) {
  const r = await haalRij(db, id);
  const [fase] = await db.select().from(fasen).where(eq(fasen.id, r.faseId));
  const alleObjecten = await laadObjecten(db, r.projectId, false);
  const objectVan = new Map(alleObjecten.map((o) => [o.id, o]));
  const koppelingen = await db.select().from(registratieKoppelingen).where(eq(registratieKoppelingen.registratieId, id));
  const relVan = await db
    .select({ rel: registratieRelaties, ander: registraties })
    .from(registratieRelaties)
    .innerJoin(registraties, eq(registraties.id, registratieRelaties.naarId))
    .where(eq(registratieRelaties.vanId, id));
  const relNaar = await db
    .select({ rel: registratieRelaties, ander: registraties })
    .from(registratieRelaties)
    .innerJoin(registraties, eq(registraties.id, registratieRelaties.vanId))
    .where(eq(registratieRelaties.naarId, id));
  const bronnen = await db
    .select({ m: meldingen })
    .from(registratieBronnen)
    .innerJoin(meldingen, eq(meldingen.id, registratieBronnen.meldingId))
    .where(eq(registratieBronnen.registratieId, id));
  const kanten = await db.select().from(raakvlakKanten).where(eq(raakvlakKanten.registratieId, id));
  const log = await db
    .select({ h: historie, naam: gebruikers.naam })
    .from(historie)
    .innerJoin(gebruikers, eq(gebruikers.id, historie.gebruikerId))
    .where(eq(historie.entiteitId, id))
    .orderBy(asc(historie.op));
  const snapshots = await db
    .select({ s: rapportSnapshots, d: documenten })
    .from(rapportSnapshots)
    .innerJoin(documenten, eq(documenten.id, rapportSnapshots.documentId))
    .where(eq(documenten.projectId, r.projectId));
  const objectInfo = (oid: string | null) => {
    const o = oid ? objectVan.get(oid) : undefined;
    return o ? { id: o.id, code: o.code, naam: o.naam, niveau: o.niveau, extern: o.extern, actief: o.actief } : null;
  };
  return {
    ...r,
    faseCode: fase.code,
    koppelingen: koppelingen.map((k) => ({
      id: k.id,
      soort: k.soort,
      object: objectInfo(k.objectId),
      objecttype: k.objecttype,
      toepassing: k.toepassing,
      bereik: objectInfo(k.bereikObjectId),
      teHerkoppelen: k.teHerkoppelen,
    })),
    relaties: [
      ...relVan.map(({ rel, ander }) => ({ richting: "uit" as const, soort: rel.soort, id: ander.id, nummer: ander.nummer, titel: ander.titel, status: ander.status })),
      ...relNaar.map(({ rel, ander }) => ({ richting: "in" as const, soort: rel.soort, id: ander.id, nummer: ander.nummer, titel: ander.titel, status: ander.status })),
    ],
    bronnen: bronnen.map(({ m }) => ({ id: m.id, nummer: m.nummer, titel: m.titel, bronSoort: m.bronSoort, bronRef: m.bronRef })),
    kanten: kanten.map((k) => ({ ...k, object: objectInfo(k.objectId)! })),
    historie: log.map(({ h, naam }) => ({ ...h, naam })),
    voortgang: await voortgangVan(db, id),
    opgenomenIn: snapshots
      .filter(({ s }) => s.inhoud.some((i) => i.id === id))
      .map(({ s, d }) => ({ documentNummer: d.nummer, revisie: s.revisie, op: s.vastgelegdOp })),
  };
}

export type RegistratieDetail = Awaited<ReturnType<typeof haalRegistratie>>;

export async function registratieIdVanNummer(db: Db, projectId: string, nummer: string): Promise<string | null> {
  const [r] = await db
    .select({ id: registraties.id })
    .from(registraties)
    .where(and(eq(registraties.projectId, projectId), eq(registraties.nummer, nummer)));
  return r?.id ?? null;
}
