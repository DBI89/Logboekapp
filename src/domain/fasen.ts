import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { fasen, projecten, raakvlakKanten, registratieKoppelingen, registratieRelaties, registraties } from "@/db/schema";
import { logHistorie } from "./historie";
import { isOntwerpleider } from "./rechten";
import { actieveFase, haalRij, maakRegistratie, zoekRegistraties, type Koppeling, type RegistratieRij } from "./registraties";
import { maakRaakvlak } from "./raakvlakken";
import { zetIssueStatus } from "./workflow";
import { Fout, type Actor } from "./types";

const VERVANGBAAR = ["goedgekeurd", "verwerkt", "vastgesteld"];

/** Maakt in de actieve fase een nieuwe registratie die de oude vervangt (afronding na goedkeuring van de nieuwe). */
export async function vervang(
  db: Db,
  actor: Actor,
  oudId: string,
  input: { titel?: string; omschrijving?: string; koppelingen?: Koppeling[]; details?: Record<string, unknown> },
): Promise<{ id: string; nummer: string }> {
  const oud = await haalRij(db, oudId);
  if (oud.projectId !== actor.projectId) throw new Fout("Registratie hoort niet bij dit project");
  if (!VERVANGBAAR.includes(oud.status)) throw new Fout("Alleen een vastgelegde registratie kan worden vervangen");
  const lopend = await db
    .select()
    .from(registratieRelaties)
    .where(and(eq(registratieRelaties.naarId, oudId), eq(registratieRelaties.soort, "vervangt")));
  if (lopend.length) throw new Fout("Er loopt al een vervanging voor deze registratie");

  const titel = input.titel ?? oud.titel;
  const omschrijving = input.omschrijving ?? oud.omschrijving;
  const details = { ...oud.details, ...(input.details ?? {}) };
  let nieuw: { id: string; nummer: string };
  if (oud.type === "raakvlak") {
    const kanten = await db.select().from(raakvlakKanten).where(eq(raakvlakKanten.registratieId, oudId));
    const objectIds = input.koppelingen
      ? input.koppelingen.flatMap((k) => (k.soort === "exemplaar" ? [k.objectId] : []))
      : kanten.map((k) => k.objectId);
    nieuw = await maakRaakvlak(db, actor, {
      titel,
      omschrijving,
      objectIds,
      details: details as { soort: "fysiek"; afspraak: string },
    });
  } else {
    const koppelingen =
      input.koppelingen ??
      (await db.select().from(registratieKoppelingen).where(eq(registratieKoppelingen.registratieId, oudId))).map(
        (k): Koppeling =>
          k.soort === "exemplaar"
            ? { soort: "exemplaar", objectId: k.objectId! }
            : { soort: "type", objecttype: k.objecttype!, toepassing: k.toepassing, bereikObjectId: k.bereikObjectId },
      );
    const { instemming: _i, ...zonderInstemming } = details;
    nieuw = await maakRegistratie(db, actor, {
      type: oud.type,
      titel,
      omschrijving,
      koppelingen,
      details: zonderInstemming,
      discipline: oud.discipline,
    });
  }
  await db.insert(registratieRelaties).values({ vanId: nieuw.id, naarId: oudId, soort: "vervangt" });
  await logHistorie(db, {
    projectId: actor.projectId,
    gebruikerId: actor.gebruikerId,
    entiteit: "registratie",
    entiteitId: oudId,
    actie: "vervanging_gestart",
    nieuw: { door: nieuw.nummer },
  });
  return nieuw;
}

export async function faseOverzicht(
  db: Db,
  projectId: string,
  faseId: string,
): Promise<{ registraties: RegistratieRij[]; vervangenUitVorigeFasen: { oud: RegistratieRij; nieuw: RegistratieRij }[] }> {
  const inFase = await zoekRegistraties(db, projectId, { faseId });
  const alle = new Map((await zoekRegistraties(db, projectId)).map((r) => [r.id, r]));
  const ids = inFase.map((r) => r.id);
  const rel = ids.length
    ? await db
        .select()
        .from(registratieRelaties)
        .where(and(inArray(registratieRelaties.vanId, ids), eq(registratieRelaties.soort, "vervangt")))
    : [];
  const vervangenUitVorigeFasen = rel
    .map((r) => ({ oud: alle.get(r.naarId)!, nieuw: alle.get(r.vanId)! }))
    .filter((x) => x.oud && x.nieuw && x.oud.faseId !== faseId);
  return { registraties: inFase, vervangenUitVorigeFasen };
}

export async function openIssuesVorigeFase(db: Db, projectId: string): Promise<RegistratieRij[]> {
  return zoekRegistraties(db, projectId, {
    type: ["issue"],
    status: ["open", "in_behandeling"],
    faseId: await actieveFase(db, projectId),
  });
}

export async function startFase(
  db: Db,
  actor: Actor,
  faseId: string,
  besluiten: { issueId: string; actie: "meenemen" | "vervallen"; reden?: string }[],
): Promise<void> {
  if (!(await isOntwerpleider(db, actor))) throw new Fout("Alleen de ontwerpleider start een nieuwe fase");
  const projectFasen = await db.select().from(fasen).where(eq(fasen.projectId, actor.projectId));
  const actiefId = await actieveFase(db, actor.projectId);
  const actief = projectFasen.find((f) => f.id === actiefId)!;
  const doel = projectFasen.find((f) => f.id === faseId);
  if (!doel || doel.volgorde <= actief.volgorde) throw new Fout("Kies een latere fase");
  const open = await openIssuesVorigeFase(db, actor.projectId);
  for (const issue of open) {
    const b = besluiten.find((x) => x.issueId === issue.id);
    if (!b) throw new Fout(`Besluit ontbreekt voor ${issue.nummer}`);
    if (b.actie === "vervallen" && !b.reden?.trim()) throw new Fout(`Reden is verplicht bij ${issue.nummer}`);
  }
  for (const issue of open) {
    const b = besluiten.find((x) => x.issueId === issue.id)!;
    if (b.actie === "vervallen") await zetIssueStatus(db, actor, issue.id, "vervallen", { reden: b.reden });
    else {
      await db.update(registraties).set({ faseId }).where(eq(registraties.id, issue.id));
      await logHistorie(db, {
        projectId: actor.projectId,
        gebruikerId: actor.gebruikerId,
        entiteit: "registratie",
        entiteitId: issue.id,
        actie: "fase_meegenomen",
        oud: { fase: actief.code },
        nieuw: { fase: doel.code },
      });
    }
  }
  await db.update(projecten).set({ actieveFaseId: faseId }).where(eq(projecten.id, actor.projectId));
}
