import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { documenten, documentObjecten, registraties } from "@/db/schema";
import { maakRegistratie, werkBij, haalRegistratie } from "@/domain/registraties";
import { zetIssueStatus, tekstcorrectie, biedAan, keurGoed, markeerVerwerkt } from "@/domain/workflow";
import { maakRaakvlak, kantAfgestemd, kantVerwerkt } from "@/domain/raakvlakken";
import { voegVoortgangToe } from "@/domain/voortgang";
import { mogelijkeOvergangen, voerOvergangUit } from "@/domain/overgangen";
import { parseDocumentCsv, voerDocumentImportUit, zetDocumentObjecten } from "@/domain/documenten";
import { overzicht } from "@/domain/overzicht";
import { maakBasisProject, actorVan, metObjecten } from "../helpers";

let db: Db;
let p: Awaited<ReturnType<typeof maakBasisProject>>;
let id: (code: string) => Promise<string>;
const a = (g: string) => actorVan(p.projectId, g);
const afw = { afwijkingVan: "NEN", eis: "45 mm", voorgesteld: "40 mm", motivatie: "m" };

beforeEach(async () => {
  db = await maakTestDb();
  p = await maakBasisProject(db);
  id = await metObjecten(db, p, "do");
});

const issue = async () =>
  maakRegistratie(db, a(p.teamlid), { type: "issue", titel: "Funderingsadvies", omschrijving: "x", koppelingen: [{ soort: "exemplaar", objectId: await id("VN-SP-3A") }] });

describe("voortgang bij issues", () => {
  it("legt notities vast, nieuwste eerst", async () => {
    const i = await issue();
    await voegVoortgangToe(db, a(p.teamlid), i.id, "Geotechnisch adviseur gebeld");
    await new Promise((r) => setTimeout(r, 5));
    await voegVoortgangToe(db, a(p.oc), i.id, "Sondering S-15 aangevraagd");
    const d = await haalRegistratie(db, i.id);
    expect(d.voortgang.map((v) => v.tekst)).toEqual(["Sondering S-15 aangevraagd", "Geotechnisch adviseur gebeld"]);
    expect(d.voortgang[0].door).toBe(p.oc);
    expect(d.historie.map((h) => h.actie)).toContain("voortgang");
  });

  it("weigert lege tekst, andere typen en afgeronde issues", async () => {
    const i = await issue();
    await expect(voegVoortgangToe(db, a(p.teamlid), i.id, "  ")).rejects.toThrow("Tekst is verplicht");
    const af = await maakRegistratie(db, a(p.teamlid), { type: "afwijking", titel: "x", omschrijving: "", koppelingen: [] });
    await expect(voegVoortgangToe(db, a(p.teamlid), af.id, "x")).rejects.toThrow("Voortgang geldt alleen voor issues");
    await zetIssueStatus(db, a(p.teamlid), i.id, "vervallen", { reden: "dubbel" });
    await expect(voegVoortgangToe(db, a(p.teamlid), i.id, "x")).rejects.toThrow("Issue is afgerond");
  });

  it("weigert een registratie uit een ander project", async () => {
    const i = await issue();
    const p2 = await maakBasisProject(db, "P-2");
    await expect(voegVoortgangToe(db, actorVan(p2.projectId, p2.teamlid), i.id, "x")).rejects.toThrow("hoort niet bij dit project");
  });
});

describe("bevriezen", () => {
  it("issue is bevroren vanaf in behandeling; tekstcorrectie door OL blijft mogelijk", async () => {
    const i = await issue();
    await werkBij(db, a(p.teamlid), i.id, { titel: "Nog open: aanpassen mag" });
    await zetIssueStatus(db, a(p.teamlid), i.id, "in_behandeling");
    await expect(werkBij(db, a(p.teamlid), i.id, { titel: "y" })).rejects.toThrow("Issue is in behandeling");
    await tekstcorrectie(db, a(p.ol), i.id, { titel: "Funderingsadvies as-3" });
    expect((await haalRegistratie(db, i.id)).titel).toBe("Funderingsadvies as-3");
  });

  it("raakvlakafspraak ligt vast zodra de eerste kant akkoord is", async () => {
    const rv = await maakRaakvlak(db, a(p.teamlid), { titel: "x", omschrijving: "", objectIds: [await id("VN-OV-12"), await id("VN-SP-2")], details: { soort: "fysiek", afspraak: "A" } });
    await werkBij(db, a(p.teamlid), rv.id, { details: { afspraak: "B" } });
    const [k1] = (await haalRegistratie(db, rv.id)).kanten;
    await kantAfgestemd(db, a(p.ol), k1.id);
    await expect(werkBij(db, a(p.teamlid), rv.id, { details: { afspraak: "C" } })).rejects.toThrow("Afstemming is begonnen");
  });
});

describe("statusmenu", () => {
  const acties = async (gebruiker: string, rid: string) => (await mogelijkeOvergangen(db, a(gebruiker), rid)).map((o) => o.actie);

  it("geeft per rol en status de mogelijke overgangen voor een afwijking", async () => {
    const r = await maakRegistratie(db, a(p.teamlid), { type: "afwijking", titel: "x", omschrijving: "", koppelingen: [], details: afw });
    expect(await acties(p.teamlid, r.id)).toEqual(["aanbieden"]);
    expect(await acties(p.teamlid2, r.id)).toEqual([]);
    await biedAan(db, a(p.teamlid), r.id);
    expect(await acties(p.ol, r.id)).toEqual(["goedkeuren", "afwijzen"]);
    expect(await acties(p.teamlid, r.id)).toEqual([]);
    await voerOvergangUit(db, a(p.ol), r.id, "goedkeuren");
    expect(await acties(p.teamlid, r.id)).toEqual(["verwerkt", "vervangen"]);
    await markeerVerwerkt(db, a(p.teamlid), r.id);
    expect(await acties(p.teamlid, r.id)).toEqual(["vervangen"]);
  });

  it("vraagt extra invoer waar nodig en voert uit", async () => {
    const i = await issue();
    const opties = await mogelijkeOvergangen(db, a(p.teamlid), i.id);
    expect(opties.map((o) => [o.actie, o.vraagt ?? null])).toEqual([
      ["in_behandeling", null],
      ["opgelost", "oplossing"],
      ["vervallen", "reden"],
    ]);
    await expect(voerOvergangUit(db, a(p.teamlid), i.id, "vervallen", {})).rejects.toThrow("Reden is verplicht");
    await voerOvergangUit(db, a(p.teamlid), i.id, "in_behandeling");
    expect((await haalRegistratie(db, i.id)).status).toBe("in_behandeling");
    await expect(voerOvergangUit(db, a(p.teamlid), i.id, "goedkeuren")).rejects.toThrow("Deze statuswijziging is nu niet mogelijk");
  });

  it("eindoordeel van een raakvlak alleen voor de ontwerpleider", async () => {
    const rv = await maakRaakvlak(db, a(p.teamlid), { titel: "x", omschrijving: "", objectIds: [await id("VN-OV-12"), await id("VN-SP-2")], details: { soort: "fysiek", afspraak: "A" } });
    const kanten = (await haalRegistratie(db, rv.id)).kanten;
    for (const k of kanten) await kantAfgestemd(db, a(p.ol), k.id);
    for (const k of kanten) await kantVerwerkt(db, a(p.ol), k.id);
    expect(await acties(p.ol, rv.id)).toEqual(["vaststellen", "terugsturen"]);
    expect(await acties(p.teamlid, rv.id)).toEqual([]);
    await voerOvergangUit(db, a(p.ol), rv.id, "terugsturen", { opmerking: "Detail ontbreekt", kantIds: [kanten[0].id] });
    expect((await haalRegistratie(db, rv.id)).status).toBe("afgestemd");
  });
});

const DOCKOP = "nummer;titel;discipline;revisie;status;fase;objecten";

describe("documentenlijst", () => {
  it("leest regels en meldt fouten", () => {
    expect(parseDocumentCsv("nummer;titel\nX;Y").fouten[0]).toMatch(/^Kopregel/);
    const { regels, fouten } = parseDocumentCsv(`${DOCKOP}\nVN-NOT-003;Nota fundering;Geotechniek;A;concept;DO;VN-SP-1, VN-PF-1\nVN-NOT-003;Dubbel;;0;concept;DO;`);
    expect(regels[0]).toEqual({ nummer: "VN-NOT-003", titel: "Nota fundering", discipline: "Geotechniek", revisie: "A", status: "concept", fase: "DO", objecten: ["VN-SP-1", "VN-PF-1"] });
    expect(fouten).toEqual(['Regel 3: dubbel documentnummer "VN-NOT-003"']);
  });

  it("importeert nieuwe documenten, werkt bestaande bij en controleert fase en objecten", async () => {
    await db.insert(documenten).values({ projectId: p.projectId, nummer: "VN-NOT-001", titel: "Oud", revisie: "0", status: "concept", faseId: p.fase.VO });
    const goed = parseDocumentCsv(`${DOCKOP}\nVN-NOT-001;Ontwerpnota VO;Constructief;A;definitief;VO;VN\nVN-NOT-003;Nota fundering;Geotechniek;0;concept;DO;VN-SP-1,VN-PF-1`).regels;
    await expect(voerDocumentImportUit(db, a(p.oc), goed)).rejects.toThrow("Alleen de ontwerpleider");
    expect(await voerDocumentImportUit(db, a(p.ol), goed)).toEqual({ nieuw: 1, bijgewerkt: 1 });
    const docs = await db.select().from(documenten).where(eq(documenten.projectId, p.projectId));
    expect(docs.find((d) => d.nummer === "VN-NOT-001")!.titel).toBe("Ontwerpnota VO");
    const n3 = docs.find((d) => d.nummer === "VN-NOT-003")!;
    expect((await db.select().from(documentObjecten).where(eq(documentObjecten.documentId, n3.id))).length).toBe(2);
    const fout = parseDocumentCsv(`${DOCKOP}\nX;X;;0;concept;ZZ;ONBEKEND`).regels;
    await expect(voerDocumentImportUit(db, a(p.ol), fout)).rejects.toThrow(/onbekende fase "ZZ"[\s\S]*onbekend object "ONBEKEND"/);
  });

  it("ontwerpleider past de objecten van een document aan", async () => {
    const [d] = await db.insert(documenten).values({ projectId: p.projectId, nummer: "D", titel: "D", revisie: "0", status: "c", faseId: p.fase.DO }).returning();
    await expect(zetDocumentObjecten(db, a(p.teamlid), d.id, [await id("VN")])).rejects.toThrow("Alleen de ontwerpleider");
    await zetDocumentObjecten(db, a(p.ol), d.id, [await id("VN"), await id("TN-WL")]);
    expect(await db.select().from(documentObjecten).where(eq(documentObjecten.documentId, d.id))).toHaveLength(2);
    const p2 = await maakBasisProject(db, "P-2");
    await expect(zetDocumentObjecten(db, actorVan(p2.projectId, p2.ol), d.id, [])).rejects.toThrow("Document hoort niet bij dit project");
  });
});

describe("rapporttabel issues", () => {
  it("toont de laatste voortgang", async () => {
    const { KOLOMMEN } = await import("@/domain/rapport");
    const i = await issue();
    await voegVoortgangToe(db, a(p.teamlid), i.id, "Adviseur gebeld");
    const kolom = KOLOMMEN.issue.find((k) => k.kop === "Laatste voortgang")!;
    expect(kolom.waarde(await haalRegistratie(db, i.id))).toMatch(/Adviseur gebeld$/);
  });
});

describe("overzicht per type", () => {
  it("geeft per type de gegevens voor de kolommen", async () => {
    const i = await issue();
    await voegVoortgangToe(db, a(p.teamlid), i.id, "Adviseur gebeld");
    const rv = await maakRaakvlak(db, a(p.teamlid), { titel: "Oplegging", omschrijving: "", objectIds: [await id("VN-OV-12"), await id("VN-SP-2")], details: { soort: "fysiek", afspraak: "A" } });
    await kantAfgestemd(db, a(p.ol), (await haalRegistratie(db, rv.id)).kanten[0].id);
    await maakRegistratie(db, a(p.teamlid), { type: "afwijking", titel: "Dekking", omschrijving: "", koppelingen: [], details: { ...afw, instemming: { nodig: true, status: "aangevraagd" } } });

    const issues = await overzicht(db, p.projectId, "issue");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ nummer: "IS-0001", objecten: "VN-SP-3A", laatsteVoortgang: { tekst: "Adviseur gebeld" } });
    const rvs = await overzicht(db, p.projectId, "raakvlak");
    expect(rvs[0]).toMatchObject({ kanten: "VN-OV-12 ↔ VN-SP-2", afgestemd: 1, aantalKanten: 2 });
    const afs = await overzicht(db, p.projectId, "afwijking", { tekst: "dekk" });
    expect(afs[0].details).toMatchObject({ instemming: { status: "aangevraagd" } });
    expect(await overzicht(db, p.projectId, "afwijking", { tekst: "zzz" })).toEqual([]);
    expect(await overzicht(db, p.projectId, "afwijking", { object: "VN-SP" })).toEqual([]);
    void registraties;
  });
});
