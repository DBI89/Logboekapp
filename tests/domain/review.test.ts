import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { documenten, meldingen, objecten, raakvlakKanten, registraties, registratieKoppelingen } from "@/db/schema";
import { maakRegistratie, werkBij, haalRegistratie } from "@/domain/registraties";
import { biedAan, keurGoed } from "@/domain/workflow";
import { herkoppel, dieperVoorstellen, parseObjectCsv, voerImportUit, teHerkoppelen } from "@/domain/import";
import { meld, zetOm } from "@/domain/meldingen";
import { maakRaakvlak, kantAfgestemd } from "@/domain/raakvlakken";
import { sluitUit, legRevisieVast } from "@/domain/rapport";
import { zetEigenaar } from "@/domain/objecten";
import { readFileSync } from "node:fs";
import path from "node:path";
import { maakBasisProject, actorVan, metObjecten } from "../helpers";

let db: Db;
let p: Awaited<ReturnType<typeof maakBasisProject>>;
let id: (code: string) => Promise<string>;
const afw = { afwijkingVan: "NEN", eis: "45 mm", voorgesteld: "40 mm", motivatie: "m" };
const a = (g: string) => actorVan(p.projectId, g);

beforeEach(async () => {
  db = await maakTestDb();
  p = await maakBasisProject(db);
  id = await metObjecten(db, p, "so");
});

async function goedgekeurdeAfwijking(code: string, titel = "Paalfundering te kort") {
  const r = await maakRegistratie(db, a(p.teamlid), { type: "afwijking", titel, omschrijving: "", koppelingen: [{ soort: "exemplaar", objectId: await id(code) }], details: afw });
  await biedAan(db, a(p.teamlid), r.id);
  await keurGoed(db, a(p.ol), r.id);
  return r;
}
const doImport = async () =>
  voerImportUit(db, a(p.ol), p.fase.DO, "do", parseObjectCsv(readFileSync(path.join(__dirname, "../fixtures/do.csv"), "utf8")).regels);

describe("review #1: herkoppelen mag een bevroren registratie niet omzeilen", () => {
  it("weigert verplaatsen van een goedgekeurde registratie die niet te herkoppelen is", async () => {
    const r = await goedgekeurdeAfwijking("VN-SP-1");
    await doImport();
    const [k] = await db.select().from(registratieKoppelingen).where(eq(registratieKoppelingen.registratieId, r.id));
    await expect(herkoppel(db, a(p.ol), k.id, await id("VN-PF-1"))).rejects.toThrow("Registratie is bevroren");
    expect(await dieperVoorstellen(db, p.projectId)).toEqual([]);
  });

  it("alleen ontwerpleider of coördinator herkoppelt", async () => {
    const r = await maakRegistratie(db, a(p.teamlid), { type: "issue", titel: "x", omschrijving: "", koppelingen: [{ soort: "exemplaar", objectId: await id("VN-SP-3") }] });
    await doImport();
    const [k] = await db.select().from(registratieKoppelingen).where(eq(registratieKoppelingen.registratieId, r.id));
    await expect(herkoppel(db, a(p.teamlid), k.id, await id("VN-SP-3A"))).rejects.toThrow("Alleen ontwerpleider of ontwerpcoördinator");
    await herkoppel(db, a(p.oc), k.id, await id("VN-SP-3A"));
  });

  it("herkoppelen van een raakvlak verplaatst ook de kant", async () => {
    const rv = await maakRaakvlak(db, a(p.teamlid), { titel: "x", omschrijving: "", objectIds: [await id("VN-SP-3"), await id("VN-OV-23")], details: {} });
    await doImport();
    const [item] = await teHerkoppelen(db, p.projectId);
    await herkoppel(db, a(p.ol), item.koppelingId, await id("VN-SP-3A"));
    const kanten = await db.select().from(raakvlakKanten).where(eq(raakvlakKanten.registratieId, rv.id));
    expect(kanten.map((k) => k.objectId)).toContain(await id("VN-SP-3A"));
  });
});

describe("review #2: niet bewerken tijdens ter goedkeuring", () => {
  it("weigert werkBij in ter_goedkeuring", async () => {
    const r = await maakRegistratie(db, a(p.teamlid), { type: "afwijking", titel: "x", omschrijving: "", koppelingen: [], details: afw });
    await biedAan(db, a(p.teamlid), r.id);
    await expect(werkBij(db, a(p.teamlid), r.id, { details: { eis: "" } })).rejects.toThrow("Registratie staat ter goedkeuring");
  });

  it("keurGoed controleert verplichte velden opnieuw", async () => {
    const r = await maakRegistratie(db, a(p.teamlid), { type: "afwijking", titel: "x", omschrijving: "", koppelingen: [], details: afw });
    await biedAan(db, a(p.teamlid), r.id);
    await db.update(registraties).set({ details: { afwijkingVan: "NEN" } }).where(eq(registraties.id, r.id));
    await expect(keurGoed(db, a(p.ol), r.id)).rejects.toThrow("Ontbrekende velden");
  });
});

describe("review #3: raakvlak wijzigen na akkoord", () => {
  it("weigert wijzigen van de afspraak na het eerste akkoord (ronde 1: bevriezen)", async () => {
    const rv = await maakRaakvlak(db, a(p.teamlid), { titel: "x", omschrijving: "", objectIds: [await id("VN-OV-12"), await id("VN-SP-2")], details: { soort: "fysiek", afspraak: "A" } });
    const [k1] = (await haalRegistratie(db, rv.id)).kanten;
    await kantAfgestemd(db, a(p.ol), k1.id);
    await expect(werkBij(db, a(p.teamlid), rv.id, { details: { afspraak: "B" } })).rejects.toThrow("Afstemming is begonnen");
  });
});

describe("review #4: geen schrijfacties op een ander project", () => {
  it("weigert uitsluiten, revisie en herkoppelen buiten het eigen project", async () => {
    const p2 = await maakBasisProject(db, "P-2");
    const [doc2] = await db.insert(documenten).values({ projectId: p2.projectId, nummer: "X", titel: "X", revisie: "0", status: "c", faseId: p2.fase.VO }).returning();
    const r = await maakRegistratie(db, a(p.teamlid), { type: "issue", titel: "x", omschrijving: "", koppelingen: [{ soort: "exemplaar", objectId: await id("VN-SP-3") }] });
    await expect(sluitUit(db, a(p.ol), doc2.id, r.id, "reden")).rejects.toThrow("Document hoort niet bij dit project");
    await expect(legRevisieVast(db, a(p.ol), doc2.id, "A")).rejects.toThrow("Document hoort niet bij dit project");
    await doImport();
    const [k] = await db.select().from(registratieKoppelingen).where(eq(registratieKoppelingen.registratieId, r.id));
    await expect(herkoppel(db, actorVan(p2.projectId, p2.ol), k.id, await id("VN-SP-3A"))).rejects.toThrow("hoort niet bij dit project");
  });

  it("weigert objecten en fasen van een ander project", async () => {
    const p2 = await maakBasisProject(db, "P-2");
    await expect(meld(db, actorVan(p2.projectId, p2.teamlid), { titel: "x", omschrijving: "y", objectIds: [await id("VN")] })).rejects.toThrow(
      "Object bestaat niet of is niet actief",
    );
    await expect(voerImportUit(db, a(p.ol), p2.fase.DO, "x", [])).rejects.toThrow("Fase hoort niet bij dit project");
    await expect(zetEigenaar(db, a(p.ol), await id("VN"), p2.teamlid)).rejects.toThrow("Eigenaar moet lid van het project zijn");
  });
});

describe("review #5: omzetten is alles-of-niets", () => {
  it("maakt niets aan als één doel faalt", async () => {
    const m = await meld(db, a(p.teamlid), { titel: "x", omschrijving: "y", objectIds: [await id("VN-OV-12")] });
    await expect(zetOm(db, a(p.oc), m.id, [{ type: "issue" }, { type: "raakvlak" }])).rejects.toThrow("Kies minstens twee objecten");
    expect(await db.select().from(registraties)).toHaveLength(0);
    const [rij] = await db.select().from(meldingen).where(eq(meldingen.id, m.id));
    expect(rij.status).toBe("nieuw");
  });

  it("werkBij slaat niets op bij ongeldige koppelingen", async () => {
    const r = await maakRegistratie(db, a(p.teamlid), { type: "issue", titel: "oud", omschrijving: "", koppelingen: [] });
    await db.update(objecten).set({ actief: false }).where(eq(objecten.id, await id("VN-SP-4")));
    await expect(werkBij(db, a(p.teamlid), r.id, { titel: "nieuw", koppelingen: [{ soort: "exemplaar", objectId: await id("VN-SP-4") }] })).rejects.toThrow();
    expect((await haalRegistratie(db, r.id)).titel).toBe("oud");
  });
});

describe("review #6: koppelingen bewerken met een te herkoppelen koppeling", () => {
  it("behoudt de te herkoppelen koppeling bij het opslaan van andere koppelingen", async () => {
    const r = await maakRegistratie(db, a(p.teamlid), { type: "issue", titel: "x", omschrijving: "", koppelingen: [{ soort: "exemplaar", objectId: await id("VN-SP-3") }] });
    await doImport();
    await werkBij(db, a(p.teamlid), r.id, { koppelingen: [{ soort: "exemplaar", objectId: await id("VN-SP-1") }] });
    const ks = await db.select().from(registratieKoppelingen).where(eq(registratieKoppelingen.registratieId, r.id));
    expect(ks).toHaveLength(2);
    expect(ks.filter((k) => k.teHerkoppelen)).toHaveLength(1);
  });
});
