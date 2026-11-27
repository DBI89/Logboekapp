"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { huidigeActor } from "@/lib/sessie";
import { actie } from "@/lib/acties";
import { meld, parseSnelinvoer, zetOm, voegSamen, laatVervallen } from "@/domain/meldingen";
import { stelVoor } from "@/domain/ai";
import { werkBij, type Koppeling } from "@/domain/registraties";
import { biedAan, keurGoed, wijsAf, markeerVerwerkt, zetInstemming, tekstcorrectie, zetIssueStatus, delegeer } from "@/domain/workflow";
import { kantAfgestemd, kantVerwerkt, eindoordeel } from "@/domain/raakvlakken";
import { vervang, startFase } from "@/domain/fasen";
import { parseObjectCsv, vergelijkImport, voerImportUit, herkoppel } from "@/domain/import";
import { zetEigenaar } from "@/domain/objecten";
import { sluitUit, neemOp, legRevisieVast } from "@/domain/rapport";
import type { BronSoort } from "@/db/schema";
import type { Instemming } from "@/domain/velden";
import { Fout, type RegistratieType } from "@/domain/types";
import { voerOvergangUit, type OvergangActie, type OvergangInvoer } from "@/domain/overgangen";
import { voegVoortgangToe } from "@/domain/voortgang";
import { maakDirect } from "@/domain/direct";
import { parseDocumentCsv, voerDocumentImportUit, zetDocumentObjecten } from "@/domain/documenten";
import { documenten } from "@/db/schema";
import { eq } from "drizzle-orm";

async function metActor<T>(projectId: string, fn: (db: Awaited<ReturnType<typeof getDb>>, actor: Awaited<ReturnType<typeof huidigeActor>>) => Promise<T>) {
  const res = await actie(async () => fn(await getDb(), await huidigeActor(projectId)));
  if (res.ok) revalidatePath(`/project/${projectId}`, "layout");
  return res;
}

// Inbox
export async function snelMelden(projectId: string, tekst: string) {
  return metActor(projectId, async (db, a) => {
    const p = await parseSnelinvoer(db, projectId, tekst);
    if (p.kandidaten.length) return { gemeld: null, titel: p.titel, kandidaten: p.kandidaten };
    const m = await meld(db, a, { titel: p.titel, omschrijving: p.titel, objectIds: p.objectId ? [p.objectId] : [] });
    return { gemeld: m.nummer, titel: p.titel, kandidaten: [] };
  });
}
export async function meldUitgebreid(
  projectId: string,
  input: { titel: string; omschrijving: string; objectIds: string[]; bronSoort: BronSoort; bronRef: string },
) {
  return metActor(projectId, (db, a) => meld(db, a, { ...input, bronRef: input.bronRef || null }));
}
export async function vraagVoorstel(projectId: string, meldingId: string) {
  return metActor(projectId, (db) => stelVoor(db, projectId, meldingId));
}
export async function zetMeldingOm(projectId: string, meldingId: string, doelen: { type: RegistratieType; titel?: string; koppelingen?: Koppeling[] }[]) {
  return metActor(projectId, (db, a) => zetOm(db, a, meldingId, doelen));
}
export async function voegMeldingSamen(projectId: string, meldingId: string, registratieId: string) {
  return metActor(projectId, (db, a) => voegSamen(db, a, meldingId, registratieId));
}
export async function laatMeldingVervallen(projectId: string, meldingId: string, reden: string) {
  return metActor(projectId, (db, a) => laatVervallen(db, a, meldingId, reden));
}

// Registraties
export async function slaRegistratieOp(
  projectId: string,
  id: string,
  patch: { titel?: string; omschrijving?: string; details?: Record<string, unknown>; koppelingen?: Koppeling[] },
  correctie: boolean,
) {
  return metActor(projectId, (db, a) => (correctie ? tekstcorrectie(db, a, id, patch) : werkBij(db, a, id, patch)));
}
export async function registratieActie(
  projectId: string,
  id: string,
  soort: "aanbieden" | "goedkeuren" | "afwijzen" | "verwerkt" | "in_behandeling" | "opgelost" | "vervallen" | "heropenen",
  opts: { toelichting?: string; oplossingId?: string; reden?: string } = {},
) {
  return metActor(projectId, async (db, a) => {
    if (soort === "aanbieden") return biedAan(db, a, id);
    if (soort === "goedkeuren") return keurGoed(db, a, id);
    if (soort === "afwijzen") return wijsAf(db, a, id, opts.toelichting ?? "");
    if (soort === "verwerkt") return markeerVerwerkt(db, a, id);
    return zetIssueStatus(db, a, id, soort === "heropenen" ? "open" : soort, opts);
  });
}
export async function slaInstemmingOp(projectId: string, id: string, instemming: Instemming) {
  return metActor(projectId, (db, a) => zetInstemming(db, a, id, instemming));
}
export async function kantActie(projectId: string, kantId: string, soort: "afgestemd" | "verwerkt", bron?: string) {
  return metActor(projectId, (db, a) => (soort === "afgestemd" ? kantAfgestemd(db, a, kantId, bron) : kantVerwerkt(db, a, kantId)));
}
export async function geefEindoordeel(projectId: string, id: string, akkoord: boolean, opmerking: string, terugNaarKantIds: string[]) {
  return metActor(projectId, (db, a) => eindoordeel(db, a, id, akkoord, { opmerking, terugNaarKantIds }));
}
export async function startVervanging(projectId: string, id: string) {
  return metActor(projectId, async (db, a) => (await vervang(db, a, id, {})).nummer);
}

// Objecten, import, fasen
export async function wijzigEigenaar(projectId: string, objectId: string, eigenaarId: string | null) {
  return metActor(projectId, (db, a) => zetEigenaar(db, a, objectId, eigenaarId));
}
export async function controleerImport(projectId: string, tekst: string) {
  return metActor(projectId, async (db) => {
    const { regels, fouten } = parseObjectCsv(tekst);
    if (fouten.length) return { fouten, diff: null };
    return { fouten: [], diff: await vergelijkImport(db, projectId, regels) };
  });
}
export async function voerImportUitActie(projectId: string, faseId: string, bestandsnaam: string, tekst: string) {
  return metActor(projectId, async (db, a) => {
    const { regels, fouten } = parseObjectCsv(tekst);
    if (fouten.length) throw new Fout(fouten.join("; "));
    return voerImportUit(db, a, faseId, bestandsnaam, regels);
  });
}
export async function herkoppelActie(projectId: string, koppelingId: string, objectId: string) {
  return metActor(projectId, (db, a) => herkoppel(db, a, koppelingId, objectId));
}
export async function startFaseActie(projectId: string, faseId: string, besluiten: { issueId: string; actie: "meenemen" | "vervallen"; reden?: string }[]) {
  return metActor(projectId, (db, a) => startFase(db, a, faseId, besluiten));
}
export async function delegeerActie(projectId: string, gebruikerId: string, actief: boolean) {
  return metActor(projectId, (db, a) => delegeer(db, a, gebruikerId, actief));
}

// Documenten
export async function sluitUitActie(projectId: string, documentId: string, registratieId: string, reden: string) {
  return metActor(projectId, (db, a) => sluitUit(db, a, documentId, registratieId, reden));
}
export async function neemOpActie(projectId: string, documentId: string, registratieId: string) {
  return metActor(projectId, (db, a) => neemOp(db, a, documentId, registratieId));
}
export async function legRevisieVastActie(projectId: string, documentId: string, revisie: string) {
  return metActor(projectId, (db, a) => legRevisieVast(db, a, documentId, revisie));
}

// Ronde 1: statusmenu, voortgang, documentenlijst
export async function wijzigStatus(projectId: string, id: string, actie: OvergangActie, invoer: OvergangInvoer) {
  return metActor(projectId, (db, a) => voerOvergangUit(db, a, id, actie, invoer));
}
export async function voegVoortgangToeActie(projectId: string, id: string, tekst: string) {
  return metActor(projectId, (db, a) => voegVoortgangToe(db, a, id, tekst));
}
export async function controleerDocumentImport(projectId: string, tekst: string) {
  return metActor(projectId, async (db) => {
    const { regels, fouten } = parseDocumentCsv(tekst);
    const bestaand = new Set((await db.select({ nummer: documenten.nummer }).from(documenten).where(eq(documenten.projectId, projectId))).map((d) => d.nummer));
    return { fouten, regels, nieuw: regels.filter((r) => !bestaand.has(r.nummer)).map((r) => r.nummer), bijgewerkt: regels.filter((r) => bestaand.has(r.nummer)).map((r) => r.nummer) };
  });
}
export async function voerDocumentImportUitActie(projectId: string, tekst: string) {
  return metActor(projectId, async (db, a) => {
    const { regels, fouten } = parseDocumentCsv(tekst);
    if (fouten.length) throw new Fout(fouten.join("; "));
    return voerDocumentImportUit(db, a, regels);
  });
}
export async function zetDocumentObjectenActie(projectId: string, documentId: string, objectIds: string[]) {
  return metActor(projectId, (db, a) => zetDocumentObjecten(db, a, documentId, objectIds));
}

// Ronde 2: direct aanmaken vanuit een overzicht (OL/OC)
export async function maakDirectActie(projectId: string, input: { type: RegistratieType; titel: string; objectIds: string[] }) {
  return metActor(projectId, (db, a) => maakDirect(db, a, input));
}
