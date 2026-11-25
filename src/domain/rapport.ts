import { tekstHash } from "./hash";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { documenten, documentObjecten, documentUitsluitingen, rapportSnapshots, registraties } from "@/db/schema";
import { logHistorie } from "./historie";
import { laadObjecten, nakomelingenUit } from "./objecten";
import { geraakteObjectenVan, haalRegistratie, type RegistratieDetail } from "./registraties";
import { faseOverzicht } from "./fasen";
import { Fout, TYPE_LABEL, type Actor, type RegistratieType } from "./types";
import { STATUS_LABEL, TYPE_MEERVOUD } from "./labels";


const tekst = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const d = (r: RegistratieDetail) => r.details as Record<string, unknown>;

export function objectenTekst(r: RegistratieDetail): string {
  return r.koppelingen
    .map((k) =>
      k.soort === "exemplaar"
        ? k.object?.code ?? ""
        : `alle ${k.toepassing ?? k.objecttype}${k.bereik ? ` in ${k.bereik.code}` : ""}`,
    )
    .filter(Boolean)
    .join(", ");
}

function instemmingTekst(r: RegistratieDetail): string {
  const i = d(r).instemming as { nodig?: boolean; status?: string; referentie?: string } | undefined;
  if (!i?.nodig) return "Niet nodig";
  return [i.status ?? "nog aan te vragen", i.referentie].filter(Boolean).join(" — ");
}

type Kolom = { kop: string; waarde: (r: RegistratieDetail) => string };
const basis: Kolom[] = [
  { kop: "Nr.", waarde: (r) => r.nummer },
  { kop: "Titel", waarde: (r) => r.titel },
  { kop: "Object(en)", waarde: objectenTekst },
  { kop: "Status", waarde: (r) => STATUS_LABEL[r.status] ?? r.status },
];
const veld = (kop: string, sleutel: string): Kolom => ({ kop, waarde: (r) => tekst(d(r)[sleutel]) });

export const KOLOMMEN: Record<RegistratieType, Kolom[]> = {
  afwijking: [
    ...basis,
    { kop: "Afwijking van", waarde: (r) => [d(r).afwijkingVan, d(r).artikel].filter(Boolean).join(", ") },
    veld("Eis", "eis"),
    veld("Voorgesteld", "voorgesteld"),
    veld("Motivatie", "motivatie"),
    veld("Maatregelen", "maatregelen"),
    { kop: "Instemming OG", waarde: instemmingTekst },
  ],
  wijziging: [
    ...basis,
    veld("Aanleiding", "aanleiding"),
    veld("Oud", "situatieOud"),
    veld("Nieuw", "situatieNieuw"),
    {
      kop: "Gevolgen",
      waarde: (r) =>
        Object.entries((d(r).gevolgen as Record<string, string>) ?? {})
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; "),
    },
    { kop: "Instemming OG", waarde: instemmingTekst },
  ],
  ontwerpkeuze: [
    ...basis,
    veld("Vraagstuk", "vraagstuk"),
    veld("Gekozen", "gekozen"),
    veld("Motivatie", "motivatie"),
    {
      kop: "Alternatieven",
      waarde: (r) => ((d(r).alternatieven as { naam: string }[]) ?? []).map((a) => a.naam).join("; "),
    },
  ],
  raakvlak: [
    ...basis,
    veld("Soort", "soort"),
    veld("Afspraak", "afspraak"),
    { kop: "Kanten", waarde: (r) => r.kanten.map((k) => k.object.code).join(" ↔ ") },
  ],
  issue: [
    ...basis,
    veld("Prioriteit", "prioriteit"),
    veld("Gevolg", "gevolg"),
    {
      kop: "Opgelost door",
      waarde: (r) => r.relaties.filter((x) => x.soort === "lost_op" && x.richting === "uit").map((x) => x.nummer).join(", "),
    },
  ],
};

export const TYPE_VOLGORDE: RegistratieType[] = ["afwijking", "wijziging", "ontwerpkeuze", "raakvlak", "issue"];

const OPNEMEN: Record<RegistratieType, string[]> = {
  afwijking: ["goedgekeurd", "verwerkt"],
  wijziging: ["goedgekeurd", "verwerkt"],
  ontwerpkeuze: ["goedgekeurd", "verwerkt"],
  raakvlak: ["afgestemd", "verwerkt", "vastgesteld"],
  issue: ["open", "in_behandeling", "opgelost"],
};

export type RapportInhoud = {
  perType: Record<RegistratieType, RegistratieDetail[]>;
  vervangen: { oud: { nummer: string; titel: string; faseCode: string }; nieuw: { nummer: string; titel: string } }[];
  uitgesloten: { registratie: { id: string; nummer: string; titel: string }; reden: string }[];
};

async function haalDocument(db: Db, documentId: string, projectId?: string) {
  const [doc] = await db.select().from(documenten).where(eq(documenten.id, documentId));
  if (!doc) throw new Fout("Document bestaat niet");
  if (projectId && doc.projectId !== projectId) throw new Fout("Document hoort niet bij dit project");
  return doc;
}

async function controleerRegistratie(db: Db, registratieId: string, projectId: string) {
  const [r] = await db.select({ projectId: registraties.projectId }).from(registraties).where(eq(registraties.id, registratieId));
  if (!r || r.projectId !== projectId) throw new Fout("Registratie hoort niet bij dit project");
}

export async function rapportInhoud(db: Db, documentId: string): Promise<RapportInhoud> {
  const doc = await haalDocument(db, documentId);
  const alle = await laadObjecten(db, doc.projectId);
  const docObjecten = (await db.select().from(documentObjecten).where(eq(documentObjecten.documentId, documentId))).map((x) => x.objectId);
  const doel = new Set(docObjecten.flatMap((o) => [o, ...nakomelingenUit(alle, o)]));
  const kandidaten = await db
    .select()
    .from(registraties)
    .where(and(eq(registraties.projectId, doc.projectId), eq(registraties.faseId, doc.faseId)));
  const geraakt = await geraakteObjectenVan(
    db,
    doc.projectId,
    kandidaten.map((r) => r.id),
  );
  const uitsluitingen = await db.select().from(documentUitsluitingen).where(eq(documentUitsluitingen.documentId, documentId));
  const uitgesloten = new Map(uitsluitingen.map((u) => [u.registratieId, u.reden]));

  const perType = Object.fromEntries(TYPE_VOLGORDE.map((t) => [t, [] as RegistratieDetail[]])) as RapportInhoud["perType"];
  const uitgeslotenLijst: RapportInhoud["uitgesloten"] = [];
  for (const r of kandidaten.sort((a, b) => a.nummer.localeCompare(b.nummer))) {
    if (!OPNEMEN[r.type].includes(r.status)) continue;
    if (![...(geraakt.get(r.id) ?? [])].some((o) => doel.has(o))) continue;
    if (uitgesloten.has(r.id)) {
      uitgeslotenLijst.push({ registratie: { id: r.id, nummer: r.nummer, titel: r.titel }, reden: uitgesloten.get(r.id)! });
      continue;
    }
    perType[r.type].push(await haalRegistratie(db, r.id));
  }
  const opgenomen = new Set(TYPE_VOLGORDE.flatMap((t) => perType[t].map((r) => r.id)));
  const vervangen = (await faseOverzicht(db, doc.projectId, doc.faseId)).vervangenUitVorigeFasen
    .filter((v) => opgenomen.has(v.nieuw.id))
    .map((v) => ({
      oud: { nummer: v.oud.nummer, titel: v.oud.titel, faseCode: v.oud.faseCode },
      nieuw: { nummer: v.nieuw.nummer, titel: v.nieuw.titel },
    }));
  return { perType, vervangen, uitgesloten: uitgeslotenLijst };
}

export async function sluitUit(db: Db, actor: Actor, documentId: string, registratieId: string, reden: string): Promise<void> {
  if (!reden?.trim()) throw new Fout("Reden is verplicht");
  const doc = await haalDocument(db, documentId, actor.projectId);
  await controleerRegistratie(db, registratieId, actor.projectId);
  await db
    .insert(documentUitsluitingen)
    .values({ documentId, registratieId, reden: reden.trim(), door: actor.gebruikerId })
    .onConflictDoUpdate({
      target: [documentUitsluitingen.documentId, documentUitsluitingen.registratieId],
      set: { reden: reden.trim(), door: actor.gebruikerId, op: new Date() },
    });
  await logHistorie(db, { projectId: doc.projectId, gebruikerId: actor.gebruikerId, entiteit: "document", entiteitId: documentId, actie: "uitgesloten", nieuw: { registratieId, reden } });
}

export async function neemOp(db: Db, actor: Actor, documentId: string, registratieId: string): Promise<void> {
  const doc = await haalDocument(db, documentId, actor.projectId);
  await db
    .delete(documentUitsluitingen)
    .where(and(eq(documentUitsluitingen.documentId, documentId), eq(documentUitsluitingen.registratieId, registratieId)));
  await logHistorie(db, { projectId: doc.projectId, gebruikerId: actor.gebruikerId, entiteit: "document", entiteitId: documentId, actie: "weer_opgenomen", nieuw: { registratieId } });
}

function snapshotRegels(inhoud: RapportInhoud) {
  return TYPE_VOLGORDE.flatMap((t) =>
    inhoud.perType[t].map((r) => {
      const waarden = Object.fromEntries(KOLOMMEN[t].map((k) => [k.kop, k.waarde(r)]));
      return { id: r.id, nummer: r.nummer, status: r.status, hash: tekstHash(JSON.stringify(waarden)), waarden };
    }),
  );
}

export async function legRevisieVast(db: Db, actor: Actor, documentId: string, revisie: string): Promise<{ snapshotId: string }> {
  if (!revisie?.trim()) throw new Fout("Revisie is verplicht");
  const doc = await haalDocument(db, documentId, actor.projectId);
  const bestaand = await db
    .select()
    .from(rapportSnapshots)
    .where(and(eq(rapportSnapshots.documentId, documentId), eq(rapportSnapshots.revisie, revisie.trim())));
  if (bestaand.length) throw new Fout(`Revisie ${revisie.trim()} is al vastgelegd`);
  const inhoud = snapshotRegels(await rapportInhoud(db, documentId));
  const [s] = await db
    .insert(rapportSnapshots)
    .values({ documentId, revisie: revisie.trim(), vastgelegdDoor: actor.gebruikerId, inhoud })
    .returning({ id: rapportSnapshots.id });
  await db.update(documenten).set({ revisie: revisie.trim() }).where(eq(documenten.id, documentId));
  await logHistorie(db, { projectId: doc.projectId, gebruikerId: actor.gebruikerId, entiteit: "document", entiteitId: documentId, actie: "revisie_vastgelegd", nieuw: { revisie, aantal: inhoud.length } });
  return { snapshotId: s.id };
}

export async function verschilMetVorige(
  db: Db,
  documentId: string,
): Promise<{ vorigeRevisie: string | null; nieuw: string[]; gewijzigd: string[]; vervallen: string[] }> {
  const [vorige] = await db
    .select()
    .from(rapportSnapshots)
    .where(eq(rapportSnapshots.documentId, documentId))
    .orderBy(desc(rapportSnapshots.vastgelegdOp))
    .limit(1);
  const huidig = snapshotRegels(await rapportInhoud(db, documentId));
  const oud = new Map((vorige?.inhoud ?? []).map((r) => [r.id, r]));
  const nu = new Map(huidig.map((r) => [r.id, r]));
  return {
    vorigeRevisie: vorige?.revisie ?? null,
    nieuw: huidig.filter((r) => !oud.has(r.id)).map((r) => r.nummer),
    gewijzigd: huidig.filter((r) => oud.has(r.id) && oud.get(r.id)!.hash !== r.hash).map((r) => r.nummer),
    vervallen: [...oud.values()].filter((r) => !nu.has(r.id)).map((r) => r.nummer),
  };
}

export { TYPE_LABEL, STATUS_LABEL, TYPE_MEERVOUD };
