import Papa from "papaparse";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { documenten, documentObjecten, fasen } from "@/db/schema";
import { logHistorie } from "./historie";
import { laadObjecten } from "./objecten";
import { isOntwerpleider } from "./rechten";
import { Fout, type Actor } from "./types";

export type DocumentRegel = { nummer: string; titel: string; discipline: string; revisie: string; status: string; fase: string; objecten: string[] };

export const DOCUMENT_KOLOMMEN = ["nummer", "titel", "discipline", "revisie", "status", "fase", "objecten"] as const;

export function parseDocumentCsv(tekst: string): { regels: DocumentRegel[]; fouten: string[] } {
  const res = Papa.parse<Record<string, string>>(tekst.replace(/^﻿/, "").trim(), { header: true, delimiter: ";", skipEmptyLines: true });
  const kop = res.meta.fields ?? [];
  if (DOCUMENT_KOLOMMEN.some((k, i) => kop[i] !== k)) return { regels: [], fouten: [`Kopregel moet zijn: ${DOCUMENT_KOLOMMEN.join(";")}`] };
  const regels: DocumentRegel[] = [];
  const fouten: string[] = [];
  const gezien = new Set<string>();
  res.data.forEach((r, i) => {
    const regel = i + 2;
    const nummer = (r.nummer ?? "").trim();
    if (!nummer || !(r.titel ?? "").trim()) return void fouten.push(`Regel ${regel}: nummer en titel zijn verplicht`);
    if (gezien.has(nummer)) return void fouten.push(`Regel ${regel}: dubbel documentnummer "${nummer}"`);
    gezien.add(nummer);
    regels.push({
      nummer,
      titel: r.titel.trim(),
      discipline: (r.discipline ?? "").trim(),
      revisie: (r.revisie ?? "").trim() || "0",
      status: (r.status ?? "").trim() || "concept",
      fase: (r.fase ?? "").trim().toUpperCase(),
      objecten: (r.objecten ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    });
  });
  return { regels, fouten };
}

async function zetObjecten(db: Db, documentId: string, objectIds: string[]) {
  await db.delete(documentObjecten).where(eq(documentObjecten.documentId, documentId));
  const uniek = [...new Set(objectIds)];
  if (uniek.length) await db.insert(documentObjecten).values(uniek.map((objectId) => ({ documentId, objectId })));
}

export async function voerDocumentImportUit(db: Db, actor: Actor, regels: DocumentRegel[]): Promise<{ nieuw: number; bijgewerkt: number }> {
  if (!(await isOntwerpleider(db, actor))) throw new Fout("Alleen de ontwerpleider mag importeren");
  const faseVan = new Map((await db.select().from(fasen).where(eq(fasen.projectId, actor.projectId))).map((f) => [f.code, f.id]));
  const objectVan = new Map((await laadObjecten(db, actor.projectId)).map((o) => [o.code, o.id]));
  const fouten: string[] = [];
  for (const r of regels) {
    if (!faseVan.has(r.fase)) fouten.push(`${r.nummer}: onbekende fase "${r.fase}"`);
    for (const code of r.objecten) if (!objectVan.has(code)) fouten.push(`${r.nummer}: onbekend object "${code}"`);
  }
  if (fouten.length) throw new Fout(fouten.join("; "));
  return db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    let nieuw = 0;
    let bijgewerkt = 0;
    for (const r of regels) {
      const velden = { titel: r.titel, discipline: r.discipline || null, revisie: r.revisie, status: r.status, faseId: faseVan.get(r.fase)! };
      const [bestaand] = await tx.select().from(documenten).where(and(eq(documenten.projectId, actor.projectId), eq(documenten.nummer, r.nummer)));
      let documentId: string;
      if (bestaand) {
        await tx.update(documenten).set(velden).where(eq(documenten.id, bestaand.id));
        documentId = bestaand.id;
        bijgewerkt++;
      } else {
        const [d] = await tx.insert(documenten).values({ ...velden, projectId: actor.projectId, nummer: r.nummer }).returning({ id: documenten.id });
        documentId = d.id;
        nieuw++;
      }
      await zetObjecten(tx, documentId, r.objecten.map((c) => objectVan.get(c)!));
    }
    await logHistorie(tx, { projectId: actor.projectId, gebruikerId: actor.gebruikerId, entiteit: "document", entiteitId: actor.projectId, actie: "documentenlijst_import", nieuw: { nieuw, bijgewerkt } });
    return { nieuw, bijgewerkt };
  });
}

export async function zetDocumentObjecten(db: Db, actor: Actor, documentId: string, objectIds: string[]): Promise<void> {
  if (!(await isOntwerpleider(db, actor))) throw new Fout("Alleen de ontwerpleider past de objecten van een document aan");
  const [doc] = await db.select().from(documenten).where(eq(documenten.id, documentId));
  if (!doc || doc.projectId !== actor.projectId) throw new Fout("Document hoort niet bij dit project");
  const actief = new Set((await laadObjecten(db, actor.projectId)).map((o) => o.id));
  if (objectIds.some((o) => !actief.has(o))) throw new Fout("Object bestaat niet of is niet actief");
  await zetObjecten(db, documentId, objectIds);
  await logHistorie(db, { projectId: actor.projectId, gebruikerId: actor.gebruikerId, entiteit: "document", entiteitId: documentId, actie: "objecten_gewijzigd", nieuw: { objectIds } });
}
