import Papa from "papaparse";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { fasen, objectImports, objecten, raakvlakKanten, registraties, registratieKoppelingen } from "@/db/schema";
import { isOntwerpleider, magBeoordelen } from "./rechten";
import { logHistorie } from "./historie";
import { effectieveEigenaarUit, laadObjecten, nakomelingenUit } from "./objecten";
import { BEVROREN, Fout, type Actor } from "./types";

export type ImportRegel = {
  code: string;
  naam: string;
  niveau: 0 | 1 | 2 | 3;
  objecttype: string;
  toepassing: string | null;
  locatie: string | null;
  ouderCode: string | null;
  extern: boolean;
  eigenaarOrganisatie: string | null;
};

export type ImportDiff = {
  nieuw: ImportRegel[];
  gewijzigd: { code: string; velden: string[] }[];
  verdwenen: { code: string; naam: string; aantalKoppelingen: number }[];
};

export const KOLOMMEN = [
  "code",
  "naam",
  "niveau",
  "objecttype",
  "toepassing",
  "locatie",
  "ouder_code",
  "extern",
  "eigenaar_organisatie",
] as const;

const leegNaarNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

export function parseObjectCsv(tekst: string): { regels: ImportRegel[]; fouten: string[] } {
  const res = Papa.parse<Record<string, string>>(tekst.replace(/^﻿/, "").trim(), {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
  });
  const kop = res.meta.fields ?? [];
  if (KOLOMMEN.some((k, i) => kop[i] !== k))
    return { regels: [], fouten: [`Kopregel moet zijn: ${KOLOMMEN.join(";")}`] };

  const fouten: string[] = [];
  const regels: (ImportRegel & { regel: number })[] = [];
  const gezien = new Set<string>();
  res.data.forEach((r, i) => {
    const regel = i + 2;
    const code = (r.code ?? "").trim();
    const niveau = Number(r.niveau);
    if (!code || !(r.naam ?? "").trim()) return void fouten.push(`Regel ${regel}: code en naam zijn verplicht`);
    if (gezien.has(code)) return void fouten.push(`Regel ${regel}: dubbele code "${code}"`);
    gezien.add(code);
    if (!Number.isInteger(niveau) || niveau < 0) return void fouten.push(`Regel ${regel}: ongeldig niveau`);
    if (niveau > 3) return void fouten.push(`Regel ${regel}: niveau ${niveau} wordt niet ondersteund (alleen 0–3)`);
    regels.push({
      regel,
      code,
      naam: r.naam.trim(),
      niveau: niveau as ImportRegel["niveau"],
      objecttype: (r.objecttype ?? "").trim(),
      toepassing: leegNaarNull(r.toepassing),
      locatie: leegNaarNull(r.locatie),
      ouderCode: leegNaarNull(r.ouder_code),
      extern: (r.extern ?? "").trim().toLowerCase() === "ja",
      eigenaarOrganisatie: leegNaarNull(r.eigenaar_organisatie),
    });
  });

  const perCode = new Map(regels.map((r) => [r.code, r]));
  for (const r of regels) {
    if (r.niveau === 0) {
      if (r.ouderCode) fouten.push(`Regel ${r.regel}: niveau 0 heeft geen bovenliggend object`);
      continue;
    }
    if (!r.ouderCode) {
      fouten.push(`Regel ${r.regel}: ouder_code ontbreekt`);
      continue;
    }
    const ouder = perCode.get(r.ouderCode);
    if (!ouder) fouten.push(`Regel ${r.regel}: onbekende ouder_code "${r.ouderCode}"`);
    else if (ouder.niveau !== r.niveau - 1)
      fouten.push(`Regel ${r.regel}: niveau ${r.niveau} kan niet direct onder niveau ${ouder.niveau}`);
  }
  return { regels: regels.map(({ regel: _r, ...rest }) => rest), fouten };
}

async function aantalKoppelingenPerObject(db: Db, objectIds: string[]): Promise<Map<string, number>> {
  if (!objectIds.length) return new Map();
  const rijen = await db
    .select({ objectId: registratieKoppelingen.objectId })
    .from(registratieKoppelingen)
    .where(inArray(registratieKoppelingen.objectId, objectIds));
  const m = new Map<string, number>();
  for (const r of rijen) if (r.objectId) m.set(r.objectId, (m.get(r.objectId) ?? 0) + 1);
  return m;
}

export async function vergelijkImport(db: Db, projectId: string, regels: ImportRegel[]): Promise<ImportDiff> {
  const bestaand = await laadObjecten(db, projectId);
  const perCode = new Map(bestaand.map((o) => [o.code, o]));
  const codeVanId = new Map(bestaand.map((o) => [o.id, o.code]));
  const inBestand = new Set(regels.map((r) => r.code));

  const nieuw = regels.filter((r) => !perCode.has(r.code));
  const gewijzigd: ImportDiff["gewijzigd"] = [];
  for (const r of regels) {
    const o = perCode.get(r.code);
    if (!o) continue;
    const velden: string[] = [];
    if (o.naam !== r.naam) velden.push("naam");
    if (o.niveau !== r.niveau) velden.push("niveau");
    if (o.objecttype !== r.objecttype) velden.push("objecttype");
    if ((o.toepassing ?? null) !== r.toepassing) velden.push("toepassing");
    if ((o.locatie ?? null) !== r.locatie) velden.push("locatie");
    if ((o.ouderId ? codeVanId.get(o.ouderId) : null) !== r.ouderCode) velden.push("plaats in boom");
    if (velden.length) gewijzigd.push({ code: r.code, velden });
  }
  const weg = bestaand.filter((o) => !inBestand.has(o.code));
  const tellingen = await aantalKoppelingenPerObject(
    db,
    weg.map((o) => o.id),
  );
  const verdwenen = weg.map((o) => ({ code: o.code, naam: o.naam, aantalKoppelingen: tellingen.get(o.id) ?? 0 }));
  return { nieuw, gewijzigd, verdwenen };
}

export async function voerImportUit(
  db: Db,
  actor: Actor,
  faseId: string,
  bestandsnaam: string,
  regels: ImportRegel[],
): Promise<{ importId: string; teHerkoppelen: number }> {
  if (!(await isOntwerpleider(db, actor))) throw new Fout("Alleen de ontwerpleider mag importeren");
  const [fase] = await db.select().from(fasen).where(eq(fasen.id, faseId));
  if (!fase || fase.projectId !== actor.projectId) throw new Fout("Fase hoort niet bij dit project");
  const codes = new Set(regels.map((r) => r.code));
  for (const r of regels)
    if (r.ouderCode && !codes.has(r.ouderCode)) throw new Fout(`Onbekende ouder_code "${r.ouderCode}" bij ${r.code}`);

  const diff = await vergelijkImport(db, actor.projectId, regels);

  return db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    const [imp] = await tx
      .insert(objectImports)
      .values({ projectId: actor.projectId, faseId, bestandsnaam, uitgevoerdDoor: actor.gebruikerId })
      .returning();

    const bestaand = await laadObjecten(tx, actor.projectId, false);
    const idVanCode = new Map(bestaand.map((o) => [o.code, o.id]));
    for (const r of regels) {
      const velden = {
        naam: r.naam,
        niveau: r.niveau,
        objecttype: r.objecttype,
        toepassing: r.toepassing,
        locatie: r.locatie,
        extern: r.extern,
        eigenaarOrganisatie: r.eigenaarOrganisatie,
        actief: true,
        laatsteImportId: imp.id,
      };
      const id = idVanCode.get(r.code);
      if (id) await tx.update(objecten).set(velden).where(eq(objecten.id, id));
      else {
        const [n] = await tx
          .insert(objecten)
          .values({ ...velden, projectId: actor.projectId, code: r.code })
          .returning({ id: objecten.id });
        idVanCode.set(r.code, n.id);
      }
    }
    for (const r of regels)
      await tx
        .update(objecten)
        .set({ ouderId: r.ouderCode ? idVanCode.get(r.ouderCode)! : null })
        .where(eq(objecten.id, idVanCode.get(r.code)!));

    const wegIds = bestaand.filter((o) => o.actief && !codes.has(o.code)).map((o) => o.id);
    let teHerkoppelenAantal = 0;
    if (wegIds.length) {
      await tx.update(objecten).set({ actief: false }).where(inArray(objecten.id, wegIds));
      const geraakt = await tx
        .update(registratieKoppelingen)
        .set({ teHerkoppelen: true })
        .where(inArray(registratieKoppelingen.objectId, wegIds))
        .returning({ id: registratieKoppelingen.id });
      const bereik = await tx
        .update(registratieKoppelingen)
        .set({ teHerkoppelen: true })
        .where(inArray(registratieKoppelingen.bereikObjectId, wegIds))
        .returning({ id: registratieKoppelingen.id });
      teHerkoppelenAantal = new Set([...geraakt, ...bereik].map((k) => k.id)).size;
    }
    await logHistorie(tx, {
      projectId: actor.projectId,
      gebruikerId: actor.gebruikerId,
      entiteit: "object",
      entiteitId: imp.id,
      actie: "import",
      nieuw: {
        bestandsnaam,
        nieuw: diff.nieuw.length,
        gewijzigd: diff.gewijzigd.length,
        verdwenen: diff.verdwenen.map((v) => v.code),
      },
    });
    return { importId: imp.id, teHerkoppelen: teHerkoppelenAantal };
  });
}

type Voorstel = { objectId: string; code: string; naam: string };

export async function teHerkoppelen(
  db: Db,
  projectId: string,
): Promise<
  { koppelingId: string; registratieId: string; nummer: string; objectCode: string; objectNaam: string; voorstellen: Voorstel[] }[]
> {
  const rijen = await db
    .select({ k: registratieKoppelingen, r: registraties })
    .from(registratieKoppelingen)
    .innerJoin(registraties, eq(registraties.id, registratieKoppelingen.registratieId))
    .where(and(eq(registraties.projectId, projectId), eq(registratieKoppelingen.teHerkoppelen, true)));
  if (!rijen.length) return [];
  const alle = await laadObjecten(db, projectId, false);
  const perId = new Map(alle.map((o) => [o.id, o]));
  const actief = alle.filter((o) => o.actief);

  return rijen.map(({ k, r }) => {
    const oud = perId.get((k.objectId ?? k.bereikObjectId)!)!;
    const opCode = actief.filter((o) => o.code.startsWith(oud.code));
    const broers = actief.filter(
      (o) =>
        o.ouderId === oud.ouderId &&
        o.objecttype === oud.objecttype &&
        o.locatie &&
        oud.locatie &&
        o.locatie.includes(oud.locatie),
    );
    let kandidaten = [...new Map([...opCode, ...broers].map((o) => [o.id, o])).values()];
    if (!kandidaten.length && oud.ouderId && perId.get(oud.ouderId)?.actief) kandidaten = [perId.get(oud.ouderId)!];
    return {
      koppelingId: k.id,
      registratieId: r.id,
      nummer: r.nummer,
      objectCode: oud.code,
      objectNaam: oud.naam,
      voorstellen: kandidaten
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((o) => ({ objectId: o.id, code: o.code, naam: o.naam })),
    };
  });
}

export async function herkoppel(db: Db, actor: Actor, koppelingId: string, nieuwObjectId: string): Promise<void> {
  if (!(await magBeoordelen(db, actor))) throw new Fout("Alleen ontwerpleider of ontwerpcoördinator mag herkoppelen");
  const [k] = await db.select().from(registratieKoppelingen).where(eq(registratieKoppelingen.id, koppelingId));
  if (!k) throw new Fout("Koppeling bestaat niet");
  const [r] = await db.select().from(registraties).where(eq(registraties.id, k.registratieId));
  if (!r || r.projectId !== actor.projectId) throw new Fout("Registratie hoort niet bij dit project");
  // Een vastgelegde registratie mag alleen worden herkoppeld als het object is verdwenen.
  if (!k.teHerkoppelen && (BEVROREN as readonly string[]).includes(r.status)) throw new Fout("Registratie is bevroren");
  const [o] = await db.select().from(objecten).where(eq(objecten.id, nieuwObjectId));
  if (!o?.actief || o.projectId !== actor.projectId) throw new Fout("Kies een bestaand object");
  const veld = k.soort === "type" ? { bereikObjectId: nieuwObjectId } : { objectId: nieuwObjectId };
  await db
    .update(registratieKoppelingen)
    .set({ ...veld, teHerkoppelen: false })
    .where(eq(registratieKoppelingen.id, koppelingId));
  if (r.type === "raakvlak" && k.soort === "exemplaar" && k.objectId) {
    const alle = new Map((await laadObjecten(db, actor.projectId, false)).map((x) => [x.id, x]));
    await db
      .update(raakvlakKanten)
      .set({ objectId: nieuwObjectId, verantwoordelijkeId: effectieveEigenaarUit(alle, nieuwObjectId) })
      .where(and(eq(raakvlakKanten.registratieId, r.id), eq(raakvlakKanten.objectId, k.objectId)));
  }
  await logHistorie(db, {
    projectId: actor.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "registratie",
    entiteitId: k.registratieId,
    actie: "herkoppeld",
    oud: { objectId: k.objectId ?? k.bereikObjectId },
    nieuw: { objectId: nieuwObjectId },
  });
}

const woorden = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9à-ÿ-]+/)
    .filter((w) => w.length >= 4);

/** Koppelingen waarvan de registratietekst over een dieper (kind)object gaat. */
export async function dieperVoorstellen(
  db: Db,
  projectId: string,
): Promise<{ koppelingId: string; registratieNummer: string; huidigCode: string; voorstelCode: string; voorstelObjectId: string }[]> {
  const alle = await laadObjecten(db, projectId);
  const perId = new Map(alle.map((o) => [o.id, o]));
  const rijen = await db
    .select({ k: registratieKoppelingen, r: registraties })
    .from(registratieKoppelingen)
    .innerJoin(registraties, eq(registraties.id, registratieKoppelingen.registratieId))
    .where(and(eq(registraties.projectId, projectId), eq(registratieKoppelingen.soort, "exemplaar")));
  const uit = [];
  for (const { k, r } of rijen) {
    if (!k.objectId || k.teHerkoppelen || !perId.has(k.objectId)) continue;
    if (r.type === "raakvlak" || (BEVROREN as readonly string[]).includes(r.status) || ["opgelost", "vervallen"].includes(r.status)) continue;
    const tekst = new Set(woorden(`${r.titel} ${r.omschrijving}`));
    const treffers = nakomelingenUit(alle, k.objectId).filter((id) => {
      const o = perId.get(id)!;
      const sleutels = woorden(`${o.objecttype} ${o.toepassing ?? ""}`);
      return sleutels.some((w) => [...tekst].some((t) => t.startsWith(w.slice(0, 6)) || w.startsWith(t)));
    });
    // Alleen eenduidige voorstellen: past de tekst op meerdere onderdelen, dan gaat hij over het geheel.
    if (treffers.length !== 1) continue;
    for (const id of treffers) {
      const o = perId.get(id)!;
      uit.push({
          koppelingId: k.id,
          registratieNummer: r.nummer,
          huidigCode: perId.get(k.objectId)!.code,
          voorstelCode: o.code,
          voorstelObjectId: o.id,
        });
    }
  }
  return uit;
}
