import { describe, it, expect, beforeEach } from "vitest";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { maakRegistratie, haalRegistratie } from "@/domain/registraties";
import { biedAan, keurGoed, zetIssueStatus } from "@/domain/workflow";
import { vervang, faseOverzicht, openIssuesVorigeFase, startFase } from "@/domain/fasen";
import { maakRaakvlak, kantAfgestemd, kantVerwerkt, eindoordeel } from "@/domain/raakvlakken";
import { maakBasisProject, actorVan, metObjecten } from "../helpers";

let db: Db;
let p: Awaited<ReturnType<typeof maakBasisProject>>;
let id: (code: string) => Promise<string>;

beforeEach(async () => {
  db = await maakTestDb();
  p = await maakBasisProject(db);
  id = await metObjecten(db, p, "do");
});

const tl = () => actorVan(p.projectId, p.teamlid);
const ol = () => actorVan(p.projectId, p.ol);
const keuze = { vraagstuk: "Dektype", alternatieven: [{ naam: "Plaatdek" }, { naam: "Liggerdek" }], gekozen: "Liggerdek", motivatie: "Overspanning" };

async function goedgekeurdeKeuze() {
  const r = await maakRegistratie(db, tl(), {
    type: "ontwerpkeuze",
    titel: "Liggerdek",
    omschrijving: "",
    koppelingen: [{ soort: "exemplaar", objectId: await id("VN") }],
    details: keuze,
  });
  await biedAan(db, tl(), r.id);
  await keurGoed(db, ol(), r.id);
  return r;
}

describe("vervang", () => {
  it("vervangt een VO-keuze in het DO pas na goedkeuring van de nieuwe", async () => {
    const oud = await goedgekeurdeKeuze();
    await startFase(db, ol(), p.fase.DO, []);
    const nieuw = await vervang(db, tl(), oud.id, { titel: "Plaatdek met voorspanning" });
    expect(nieuw.nummer).toBe("OK-0002");
    const n = await haalRegistratie(db, nieuw.id);
    expect(n.faseCode).toBe("DO");
    expect(n.koppelingen).toHaveLength(1);
    expect(n.details).toMatchObject({ vraagstuk: "Dektype" });
    expect(n.relaties).toContainEqual(expect.objectContaining({ soort: "vervangt", nummer: "OK-0001", richting: "uit" }));
    expect((await haalRegistratie(db, oud.id)).status).toBe("goedgekeurd");

    await biedAan(db, tl(), nieuw.id);
    await keurGoed(db, ol(), nieuw.id);
    const o = await haalRegistratie(db, oud.id);
    expect(o.status).toBe("vervangen");
    expect(o.vervangenDoorId).toBe(nieuw.id);

    const doOverzicht = await faseOverzicht(db, p.projectId, p.fase.DO);
    expect(doOverzicht.registraties.map((r) => r.nummer)).toEqual(["OK-0002"]);
    expect(doOverzicht.vervangenUitVorigeFasen).toEqual([
      { oud: expect.objectContaining({ nummer: "OK-0001", faseCode: "VO" }), nieuw: expect.objectContaining({ nummer: "OK-0002" }) },
    ]);
    const voOverzicht = await faseOverzicht(db, p.projectId, p.fase.VO);
    expect(voOverzicht.registraties).toContainEqual(expect.objectContaining({ nummer: "OK-0001", status: "vervangen" }));
  });

  it("weigert vervangen van een concept", async () => {
    const r = await maakRegistratie(db, tl(), { type: "ontwerpkeuze", titel: "x", omschrijving: "", koppelingen: [] });
    await expect(vervang(db, tl(), r.id, {})).rejects.toThrow("Alleen een vastgelegde registratie kan worden vervangen");
  });

  it("vervangt ook een vastgestelde raakvlakafspraak", async () => {
    const rv = await maakRaakvlak(db, tl(), {
      titel: "Oplegging",
      omschrijving: "",
      objectIds: [await id("VN-OV-12"), await id("VN-SP-2")],
      details: { soort: "fysiek", afspraak: "Elastomeer" },
    });
    for (const k of (await haalRegistratie(db, rv.id)).kanten) await kantAfgestemd(db, ol(), k.id);
    for (const k of (await haalRegistratie(db, rv.id)).kanten) await kantVerwerkt(db, ol(), k.id);
    await eindoordeel(db, ol(), rv.id, true);
    const nieuw = await vervang(db, tl(), rv.id, { details: { soort: "fysiek", afspraak: "Pot-oplegging" } });
    const n = await haalRegistratie(db, nieuw.id);
    expect(n.kanten).toHaveLength(2);
    for (const k of n.kanten) await kantAfgestemd(db, ol(), k.id);
    for (const k of n.kanten) await kantVerwerkt(db, ol(), k.id);
    await eindoordeel(db, ol(), nieuw.id, true);
    expect((await haalRegistratie(db, rv.id)).status).toBe("vervangen");
  });
});

describe("startFase", () => {
  it("eist een besluit voor elk open issue van de vorige fase", async () => {
    const i1 = await maakRegistratie(db, tl(), { type: "issue", titel: "Open vraag", omschrijving: "", koppelingen: [] });
    const i2 = await maakRegistratie(db, tl(), { type: "issue", titel: "Tweede", omschrijving: "", koppelingen: [] });
    await zetIssueStatus(db, tl(), i2.id, "in_behandeling");
    expect((await openIssuesVorigeFase(db, p.projectId)).map((r) => r.nummer)).toEqual(["IS-0001", "IS-0002"]);
    await expect(startFase(db, ol(), p.fase.DO, [{ issueId: i1.id, actie: "meenemen" }])).rejects.toThrow(
      "Besluit ontbreekt voor IS-0002",
    );
    await expect(startFase(db, tl(), p.fase.DO, [])).rejects.toThrow("Alleen de ontwerpleider");
    await expect(
      startFase(db, ol(), p.fase.DO, [
        { issueId: i1.id, actie: "meenemen" },
        { issueId: i2.id, actie: "vervallen" },
      ]),
    ).rejects.toThrow("Reden is verplicht");
    await startFase(db, ol(), p.fase.DO, [
      { issueId: i1.id, actie: "meenemen" },
      { issueId: i2.id, actie: "vervallen", reden: "Opgelost in VO-overleg" },
    ]);
    expect((await haalRegistratie(db, i1.id)).faseCode).toBe("DO");
    expect((await haalRegistratie(db, i2.id)).status).toBe("vervallen");
    expect((await openIssuesVorigeFase(db, p.projectId)).map((r) => r.nummer)).toEqual(["IS-0001"]);
  });

  it("kan niet terug naar een eerdere fase", async () => {
    await expect(startFase(db, ol(), p.fase.SO, [])).rejects.toThrow("Kies een latere fase");
  });
});
