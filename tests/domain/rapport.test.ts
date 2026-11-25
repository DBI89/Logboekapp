import { describe, it, expect, beforeEach } from "vitest";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { documenten, documentObjecten } from "@/db/schema";
import { maakRegistratie, haalRegistratie } from "@/domain/registraties";
import { biedAan, keurGoed, tekstcorrectie } from "@/domain/workflow";
import { startFase } from "@/domain/fasen";
import { rapportInhoud, sluitUit, neemOp, legRevisieVast, verschilMetVorige } from "@/domain/rapport";
import { exporteerDocx, exporteerXlsx } from "@/domain/export";
import { maakBasisProject, actorVan, metObjecten } from "../helpers";

let db: Db;
let p: Awaited<ReturnType<typeof maakBasisProject>>;
let id: (code: string) => Promise<string>;
let docId: string;

const tl = () => actorVan(p.projectId, p.teamlid);
const ol = () => actorVan(p.projectId, p.ol);
const afw = { afwijkingVan: "NEN-EN 1992-1-1", eis: "45 mm", voorgesteld: "40 mm", motivatie: "Uitvoerbaar" };

async function goedgekeurd(type: "afwijking" | "ontwerpkeuze", titel: string, koppelingen: Parameters<typeof maakRegistratie>[2]["koppelingen"], details: Record<string, unknown>) {
  const r = await maakRegistratie(db, tl(), { type, titel, omschrijving: "", koppelingen, details });
  await biedAan(db, tl(), r.id);
  await keurGoed(db, ol(), r.id);
  return r;
}

beforeEach(async () => {
  db = await maakTestDb();
  p = await maakBasisProject(db);
  id = await metObjecten(db, p, "do");
  const [d] = await db
    .insert(documenten)
    .values({ projectId: p.projectId, nummer: "VN-NOT-002", titel: "Ontwerpnota Viaduct Noord DO", revisie: "0", status: "concept", faseId: p.fase.DO, discipline: "Constructief" })
    .returning();
  docId = d.id;
  await db.insert(documentObjecten).values({ documentId: docId, objectId: await id("VN") });
});

describe("rapportInhoud", () => {
  it("neemt goedgekeurde registraties van de documentfase op, inclusief onderliggend en typekoppelingen", async () => {
    // VO-keuze hoort niet in de DO-nota
    await goedgekeurd("ontwerpkeuze", "Liggerdek", [{ soort: "exemplaar", objectId: await id("VN") }], {
      vraagstuk: "Dek", alternatieven: [{ naam: "A" }, { naam: "B" }], gekozen: "B", motivatie: "m",
    });
    await startFase(db, ol(), p.fase.DO, []);
    const a1 = await goedgekeurd("afwijking", "Dekking landhoofd", [{ soort: "exemplaar", objectId: await id("VN-LH-1") }], afw);
    const a2 = await goedgekeurd("afwijking", "Dekking alle landhoofden", [{ soort: "type", objecttype: "Draagconstructie", toepassing: "Landhoofd", bereikObjectId: null }], afw);
    await maakRegistratie(db, tl(), { type: "afwijking", titel: "Concept", omschrijving: "", koppelingen: [{ soort: "exemplaar", objectId: await id("VN-LH-1") }] });
    await maakRegistratie(db, tl(), { type: "issue", titel: "Open vraag rijbaan", omschrijving: "", koppelingen: [{ soort: "exemplaar", objectId: await id("TN-WL-RB-R") }] });
    const i = await maakRegistratie(db, tl(), { type: "issue", titel: "Open vraag pijler", omschrijving: "", koppelingen: [{ soort: "exemplaar", objectId: await id("VN-PJ-2") }] });

    const inhoud = await rapportInhoud(db, docId);
    expect(inhoud.perType.afwijking.map((r) => r.nummer)).toEqual([a1.nummer, a2.nummer]);
    expect(inhoud.perType.ontwerpkeuze).toEqual([]);
    expect(inhoud.perType.issue.map((r) => r.id)).toEqual([i.id]);

    await sluitUit(db, ol(), docId, a2.id, "Hoort in algemene nota");
    const na = await rapportInhoud(db, docId);
    expect(na.perType.afwijking.map((r) => r.nummer)).toEqual([a1.nummer]);
    expect(na.uitgesloten).toEqual([{ registratie: expect.objectContaining({ nummer: a2.nummer }), reden: "Hoort in algemene nota" }]);
    await expect(sluitUit(db, ol(), docId, a1.id, " ")).rejects.toThrow("Reden is verplicht");
    await neemOp(db, ol(), docId, a2.id);
    expect((await rapportInhoud(db, docId)).perType.afwijking).toHaveLength(2);
  });
});

describe("export", () => {
  it("Word bevat een tabel met de registratie, Excel een werkblad per type", async () => {
    await startFase(db, ol(), p.fase.DO, []);
    await goedgekeurd("afwijking", "Dekking landhoofd", [{ soort: "exemplaar", objectId: await id("VN-LH-1") }], afw);
    const inhoud = await rapportInhoud(db, docId);
    const doc = { nummer: "VN-NOT-002", titel: "Ontwerpnota Viaduct Noord DO", revisie: "0" };
    const docx = await exporteerDocx(inhoud, doc);
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    const xml = await (await JSZip.loadAsync(docx)).file("word/document.xml")!.async("string");
    expect(xml).toContain("AF-0001");
    expect(xml).toContain("Afwijkingen");
    expect(xml).toContain("VN-LH-1");
    expect(xml).not.toContain("Wijzigingen");

    const xlsx = await exporteerXlsx(inhoud, doc);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Afwijkingen")!;
    expect(ws.getRow(1).getCell(1).value).toBe("Nr.");
    expect(ws.getRow(2).getCell(1).value).toBe("AF-0001");
  });
});

describe("revisies", () => {
  it("legt een revisie vast en toont het verschil met de vorige", async () => {
    await startFase(db, ol(), p.fase.DO, []);
    const a1 = await goedgekeurd("afwijking", "Dekking landhoofd", [{ soort: "exemplaar", objectId: await id("VN-LH-1") }], afw);
    expect(await verschilMetVorige(db, docId)).toEqual({ vorigeRevisie: null, nieuw: ["AF-0001"], gewijzigd: [], vervallen: [] });
    await legRevisieVast(db, ol(), docId, "A");
    expect((await haalRegistratie(db, a1.id)).opgenomenIn).toEqual([expect.objectContaining({ documentNummer: "VN-NOT-002", revisie: "A" })]);
    await expect(legRevisieVast(db, ol(), docId, "A")).rejects.toThrow("Revisie A is al vastgelegd");

    await goedgekeurd("afwijking", "Tweede", [{ soort: "exemplaar", objectId: await id("VN-LH-4") }], afw);
    await tekstcorrectie(db, ol(), a1.id, { titel: "Dekking landhoofd as-1" });
    expect(await verschilMetVorige(db, docId)).toEqual({ vorigeRevisie: "A", nieuw: ["AF-0002"], gewijzigd: ["AF-0001"], vervallen: [] });
  });
});
