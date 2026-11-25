import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { objecten, registraties } from "@/db/schema";
import { maakRegistratie, werkBij, registratiesVoorObject, registratiesOpObjectBoom, haalRegistratie } from "@/domain/registraties";
import { verplichtVoorAanbieden, ontbrekendeVelden } from "@/domain/velden";
import { parseObjectCsv, voerImportUit } from "@/domain/import";
import { readFileSync } from "node:fs";
import path from "node:path";
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

describe("maakRegistratie", () => {
  it("nummert per type en zet beginstatus en actieve fase", async () => {
    const a = await maakRegistratie(db, tl(), { type: "afwijking", titel: "Dekking", omschrijving: "", koppelingen: [] });
    const b = await maakRegistratie(db, tl(), { type: "afwijking", titel: "Dekking 2", omschrijving: "", koppelingen: [] });
    const i = await maakRegistratie(db, tl(), { type: "issue", titel: "Vraag", omschrijving: "", koppelingen: [] });
    expect([a.nummer, b.nummer, i.nummer]).toEqual(["AF-0001", "AF-0002", "IS-0001"]);
    const [rij] = await db.select().from(registraties).where(eq(registraties.id, i.id));
    expect(rij.status).toBe("open");
    expect(rij.faseId).toBe(p.fase.VO);
    const [af] = await db.select().from(registraties).where(eq(registraties.id, a.id));
    expect(af.status).toBe("concept");
  });

  it("weigert koppeling aan een object op niveau 4", async () => {
    await db.update(objecten).set({ niveau: 4 }).where(eq(objecten.id, await id("VN-LH-1")));
    await expect(
      maakRegistratie(db, tl(), {
        type: "issue",
        titel: "x",
        omschrijving: "",
        koppelingen: [{ soort: "exemplaar", objectId: await id("VN-LH-1") }],
      }),
    ).rejects.toThrow("Koppelen kan alleen op niveau 0 t/m 3");
  });

  it("neemt de effectieve eigenaar van het object over", async () => {
    await db.update(objecten).set({ eigenaarId: p.teamlid2 }).where(eq(objecten.id, await id("VN")));
    const r = await maakRegistratie(db, tl(), {
      type: "issue",
      titel: "x",
      omschrijving: "",
      koppelingen: [{ soort: "exemplaar", objectId: await id("VN-LH-1") }],
    });
    expect((await haalRegistratie(db, r.id)).eigenaarId).toBe(p.teamlid2);
  });
});

describe("doortellen en typekoppelingen", () => {
  it("telt een registratie op een landhoofd mee bij het viaduct", async () => {
    await maakRegistratie(db, tl(), {
      type: "afwijking",
      titel: "Dekking landhoofd",
      omschrijving: "",
      koppelingen: [{ soort: "exemplaar", objectId: await id("VN-LH-1") }],
    });
    expect(await registratiesVoorObject(db, await id("VN"), { inclusiefOnderliggend: true })).toHaveLength(1);
    expect(await registratiesVoorObject(db, await id("VN"), { inclusiefOnderliggend: false })).toHaveLength(0);
    const telling = await registratiesOpObjectBoom(db, p.projectId);
    expect(telling.get(await id("TN"))).toBe(1);
    expect(telling.get(await id("VN-LH-4"))).toBeUndefined();
  });

  it("typekoppeling geldt voor alle landhoofden in het bereik, ook later geïmporteerde", async () => {
    await maakRegistratie(db, tl(), {
      type: "afwijking",
      titel: "Dekking alle landhoofden",
      omschrijving: "",
      koppelingen: [{ soort: "type", objecttype: "Draagconstructie", toepassing: "Landhoofd", bereikObjectId: await id("VN") }],
    });
    const lh1 = await registratiesVoorObject(db, await id("VN-LH-1"), { inclusiefOnderliggend: false });
    expect(lh1).toHaveLength(1);
    expect(lh1[0].viaType).toBe(true);
    expect(await registratiesVoorObject(db, await id("VN-PJ-2"), { inclusiefOnderliggend: false })).toHaveLength(0);

    const tekst = readFileSync(path.join(__dirname, "../fixtures/do.csv"), "utf8") +
      "VN-LH-9;Landhoofd extra;3;Draagconstructie;Landhoofd;as-9;VN-SP-4;nee;\n";
    await voerImportUit(db, actorVan(p.projectId, p.ol), p.fase.DO, "do2", parseObjectCsv(tekst).regels);
    expect(await registratiesVoorObject(db, await id("VN-LH-9"), { inclusiefOnderliggend: false })).toHaveLength(1);
  });

  it("toont een registratie één keer als exemplaar en type hetzelfde object raken", async () => {
    await maakRegistratie(db, tl(), {
      type: "afwijking",
      titel: "Dubbel",
      omschrijving: "",
      koppelingen: [
        { soort: "exemplaar", objectId: await id("VN-LH-1") },
        { soort: "type", objecttype: "Draagconstructie", toepassing: "Landhoofd", bereikObjectId: null },
      ],
    });
    const rijen = await registratiesVoorObject(db, await id("VN-LH-1"), { inclusiefOnderliggend: true });
    expect(rijen).toHaveLength(1);
    expect(rijen[0].viaType).toBe(false);
    expect(await registratiesVoorObject(db, await id("VN"), { inclusiefOnderliggend: true })).toHaveLength(1);
  });

  it("filtert op fase", async () => {
    await maakRegistratie(db, tl(), {
      type: "issue",
      titel: "VO",
      omschrijving: "",
      koppelingen: [{ soort: "exemplaar", objectId: await id("VN") }],
    });
    const vn = await id("VN");
    expect(await registratiesVoorObject(db, vn, { inclusiefOnderliggend: false, faseId: p.fase.VO })).toHaveLength(1);
    expect(await registratiesVoorObject(db, vn, { inclusiefOnderliggend: false, faseId: p.fase.DO })).toHaveLength(0);
  });
});

describe("werkBij en velden", () => {
  it("weigert wijzigen van een goedgekeurde registratie", async () => {
    const r = await maakRegistratie(db, tl(), { type: "afwijking", titel: "x", omschrijving: "", koppelingen: [] });
    await db.update(registraties).set({ status: "goedgekeurd" }).where(eq(registraties.id, r.id));
    await expect(werkBij(db, tl(), r.id, { titel: "y" })).rejects.toThrow("Registratie is bevroren");
  });

  it("valideert details per type", async () => {
    const r = await maakRegistratie(db, tl(), { type: "issue", titel: "x", omschrijving: "", koppelingen: [] });
    await expect(werkBij(db, tl(), r.id, { details: { prioriteit: "superhoog" } })).rejects.toThrow();
    await werkBij(db, tl(), r.id, { details: { prioriteit: "hoog" } });
    expect((await haalRegistratie(db, r.id)).details).toMatchObject({ prioriteit: "hoog" });
  });

  it("noemt ontbrekende verplichte velden", () => {
    expect(verplichtVoorAanbieden.afwijking).toEqual(["afwijkingVan", "eis", "voorgesteld", "motivatie"]);
    expect(ontbrekendeVelden("afwijking", { afwijkingVan: "NEN-EN 1992", eis: "45 mm" })).toEqual(["voorgesteld", "motivatie"]);
    expect(ontbrekendeVelden("ontwerpkeuze", { vraagstuk: "a", alternatieven: [{ naam: "A" }], gekozen: "A", motivatie: "m" })).toEqual([
      "alternatieven",
    ]);
  });
});
