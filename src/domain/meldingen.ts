import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { meldingen, meldingObjecten, objecten, registratieBronnen, registraties, type BronSoort, type MeldingStatus } from "@/db/schema";
import { logHistorie } from "./historie";
import { volgendNummer } from "./nummering";
import { laadObjecten, type ObjectRij } from "./objecten";
import { magBeoordelen } from "./rechten";
import { actieveFase, maakRegistratie, type Koppeling } from "./registraties";
import { Fout, type Actor, type RegistratieType } from "./types";
import { maakRaakvlak } from "./raakvlakken";

export type MeldingRij = {
  id: string;
  nummer: string;
  titel: string;
  omschrijving: string;
  status: MeldingStatus;
  gemeldDoor: string;
  gemeldOp: Date;
  objecten: { id: string; code: string; naam: string }[];
  bronSoort: BronSoort;
  bronRef: string | null;
  vervallenReden: string | null;
  werkdagenOpen: number;
};

export async function meld(
  db: Db,
  actor: Actor,
  input: { titel: string; omschrijving: string; objectIds?: string[]; bronSoort?: BronSoort; bronRef?: string | null },
): Promise<{ id: string; nummer: string }> {
  if (!input.titel?.trim()) throw new Fout("Titel is verplicht");
  if (!input.omschrijving?.trim()) throw new Fout("Omschrijving is verplicht");
  const nummer = await volgendNummer(db, actor.projectId, "melding");
  const [m] = await db
    .insert(meldingen)
    .values({
      projectId: actor.projectId,
      nummer,
      titel: input.titel.trim(),
      omschrijving: input.omschrijving.trim(),
      faseId: await actieveFase(db, actor.projectId),
      bronSoort: input.bronSoort ?? "waarneming",
      bronRef: input.bronRef ?? null,
      gemeldDoor: actor.gebruikerId,
    })
    .returning({ id: meldingen.id });
  const ids = [...new Set(input.objectIds ?? [])];
  if (ids.length) await db.insert(meldingObjecten).values(ids.map((objectId) => ({ meldingId: m.id, objectId })));
  await logHistorie(db, {
    projectId: actor.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "melding",
    entiteitId: m.id,
    actie: "gemeld",
    nieuw: { nummer, titel: input.titel },
  });
  return { id: m.id, nummer };
}

const delen = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .split(/[\s–—,;()/]+/)
    .filter(Boolean);

/** Objecten die bij alle tokens passen (code exact, of woord in naam, locatie of toepassing). */
export function zoekObjecten(alle: ObjectRij[], tokens: string[]): ObjectRij[] {
  const t = tokens.map((x) => x.toLowerCase()).filter(Boolean);
  if (!t.length) return [];
  const exact = alle.filter((o) => t.length === 1 && o.code.toLowerCase() === t[0]);
  if (exact.length) return exact;
  return alle.filter((o) => {
    const woorden = new Set([...delen(o.naam), ...delen(o.locatie), ...delen(o.toepassing), o.code.toLowerCase()]);
    return t.every((tok) => woorden.has(tok));
  });
}

export async function parseSnelinvoer(
  db: Db,
  projectId: string,
  tekst: string,
): Promise<{ titel: string; objectId: string | null; kandidaten: { id: string; code: string; naam: string }[] }> {
  const tokens = [...tekst.matchAll(/#([^\s#]+)/g)].map((m) => m[1]);
  const titel = tekst.replace(/#[^\s#]+/g, "").replace(/\s+/g, " ").trim();
  if (!tokens.length) return { titel, objectId: null, kandidaten: [] };
  const treffers = zoekObjecten(await laadObjecten(db, projectId), tokens);
  if (treffers.length === 1) return { titel, objectId: treffers[0].id, kandidaten: [] };
  return {
    titel,
    objectId: null,
    kandidaten: treffers
      .map((o) => ({ id: o.id, code: o.code, naam: o.naam }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
}

async function haalMelding(db: Db, actor: Actor, meldingId: string) {
  if (!(await magBeoordelen(db, actor))) throw new Fout("Alleen ontwerpleider of ontwerpcoördinator mag meldingen beoordelen");
  const [m] = await db.select().from(meldingen).where(eq(meldingen.id, meldingId));
  if (!m || m.projectId !== actor.projectId) throw new Fout("Melding bestaat niet");
  if (m.status !== "nieuw") throw new Fout("Melding is al beoordeeld");
  return m;
}

export async function zetOm(
  db: Db,
  actor: Actor,
  meldingId: string,
  doelen: { type: RegistratieType; titel?: string; koppelingen?: Koppeling[] }[],
): Promise<{ id: string; nummer: string }[]> {
  const m = await haalMelding(db, actor, meldingId);
  if (!doelen.length) throw new Fout("Kies minstens één registratietype");
  const objectIds = (await db.select().from(meldingObjecten).where(eq(meldingObjecten.meldingId, meldingId))).map((x) => x.objectId);
  const standaard: Koppeling[] = objectIds.map((objectId) => ({ soort: "exemplaar", objectId }));
  const uit = [];
  for (const d of doelen) {
    const koppelingen = d.koppelingen ?? standaard;
    if (d.type === "raakvlak") {
      uit.push(
        await maakRaakvlak(db, actor, {
          titel: d.titel?.trim() || m.titel,
          omschrijving: m.omschrijving,
          objectIds: koppelingen.flatMap((k) => (k.soort === "exemplaar" ? [k.objectId] : [])),
          details: {},
          bronMeldingIds: [m.id],
        }),
      );
      continue;
    }
    uit.push(
      await maakRegistratie(db, actor, {
        type: d.type,
        titel: d.titel?.trim() || m.titel,
        omschrijving: m.omschrijving,
        faseId: m.faseId,
        koppelingen,
        bronMeldingIds: [m.id],
      }),
    );
  }
  await db.update(meldingen).set({ status: "omgezet", beoordeeldDoor: actor.gebruikerId }).where(eq(meldingen.id, m.id));
  await logHistorie(db, {
    projectId: actor.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "melding",
    entiteitId: m.id,
    actie: "omgezet",
    nieuw: { naar: uit.map((u) => u.nummer) },
  });
  return uit;
}

export async function voegSamen(db: Db, actor: Actor, meldingId: string, registratieId: string): Promise<void> {
  const m = await haalMelding(db, actor, meldingId);
  const [r] = await db.select().from(registraties).where(eq(registraties.id, registratieId));
  if (!r || r.projectId !== actor.projectId) throw new Fout("Registratie bestaat niet");
  await db.insert(registratieBronnen).values({ registratieId, meldingId }).onConflictDoNothing();
  await db.update(meldingen).set({ status: "samengevoegd", beoordeeldDoor: actor.gebruikerId }).where(eq(meldingen.id, m.id));
  await logHistorie(db, {
    projectId: actor.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "melding",
    entiteitId: m.id,
    actie: "samengevoegd",
    nieuw: { met: r.nummer },
  });
}

export async function laatVervallen(db: Db, actor: Actor, meldingId: string, reden: string): Promise<void> {
  if (!reden?.trim()) throw new Fout("Reden is verplicht");
  const m = await haalMelding(db, actor, meldingId);
  await db
    .update(meldingen)
    .set({ status: "vervallen", vervallenReden: reden.trim(), beoordeeldDoor: actor.gebruikerId })
    .where(eq(meldingen.id, m.id));
  await logHistorie(db, {
    projectId: actor.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "melding",
    entiteitId: m.id,
    actie: "vervallen",
    nieuw: { reden },
  });
}

/** Aantal hele werkdagen (ma–vr) tussen twee momenten. */
export function werkdagenTussen(van: Date, tot: Date): number {
  const start = new Date(van.getFullYear(), van.getMonth(), van.getDate());
  const eind = new Date(tot.getFullYear(), tot.getMonth(), tot.getDate());
  let n = 0;
  for (const d = new Date(start); d < eind; d.setDate(d.getDate() + 1)) {
    const volgende = new Date(d);
    volgende.setDate(d.getDate() + 1);
    const dag = volgende.getDay();
    if (dag !== 0 && dag !== 6) n++;
  }
  return n;
}

export async function inbox(
  db: Db,
  projectId: string,
  filter: { status?: MeldingStatus[]; zoek?: string },
): Promise<MeldingRij[]> {
  const voorwaarden = [eq(meldingen.projectId, projectId)];
  if (filter.status?.length) voorwaarden.push(inArray(meldingen.status, filter.status));
  const rijen = await db.select().from(meldingen).where(and(...voorwaarden)).orderBy(desc(meldingen.nummer));
  const ids = rijen.map((r) => r.id);
  const koppels = ids.length
    ? await db
        .select({ meldingId: meldingObjecten.meldingId, id: objecten.id, code: objecten.code, naam: objecten.naam })
        .from(meldingObjecten)
        .innerJoin(objecten, eq(objecten.id, meldingObjecten.objectId))
        .where(inArray(meldingObjecten.meldingId, ids))
    : [];
  const z = filter.zoek?.trim().toLowerCase();
  const nu = new Date();
  return rijen
    .filter((r) => !z || `${r.nummer} ${r.titel} ${r.omschrijving}`.toLowerCase().includes(z))
    .map((r) => ({
      id: r.id,
      nummer: r.nummer,
      titel: r.titel,
      omschrijving: r.omschrijving,
      status: r.status,
      gemeldDoor: r.gemeldDoor,
      gemeldOp: r.gemeldOp,
      bronSoort: r.bronSoort,
      bronRef: r.bronRef,
      vervallenReden: r.vervallenReden,
      objecten: koppels.filter((k) => k.meldingId === r.id).map(({ id, code, naam }) => ({ id, code, naam })),
      werkdagenOpen: werkdagenTussen(r.gemeldOp, nu),
    }));
}
