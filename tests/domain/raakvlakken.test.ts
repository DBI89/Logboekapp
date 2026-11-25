import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { objecten } from "@/db/schema";
import { haalRegistratie } from "@/domain/registraties";
import { maakRaakvlak, kantAfgestemd, kantVerwerkt, eindoordeel, verfijn } from "@/domain/raakvlakken";
import { maakBasisProject, actorVan, metObjecten } from "../helpers";

let db: Db;
let p: Awaited<ReturnType<typeof maakBasisProject>>;
let id: (code: string) => Promise<string>;

beforeEach(async () => {
  db = await maakTestDb();
  p = await maakBasisProject(db);
  id = await metObjecten(db, p, "do");
  // teamlid is eigenaar van het viaduct, teamlid2 van het weglichaam
  await db.update(objecten).set({ eigenaarId: p.teamlid }).where(eq(objecten.id, await id("VN")));
  await db.update(objecten).set({ eigenaarId: p.teamlid2 }).where(eq(objecten.id, await id("TN-WL")));
});

const a = (g: string) => actorVan(p.projectId, g);
const details = { soort: "fysiek" as const, afspraak: "Oplegging met elastomeer" };

async function rvViaduct() {
  return maakRaakvlak(db, a(p.teamlid), {
    titel: "Oplegging overspanning op steunpunt as-2",
    omschrijving: "",
    objectIds: [await id("VN-OV-12"), await id("VN-SP-2")],
    details,
  });
}

describe("maakRaakvlak", () => {
  it("weigert objecten op verschillende niveaus", async () => {
    await expect(
      maakRaakvlak(db, a(p.teamlid), { titel: "x", omschrijving: "", objectIds: [await id("VN-OV-12"), await id("VN-LH-1")], details }),
    ).rejects.toThrow("Raakvlak alleen tussen objecten op hetzelfde niveau");
  });

  it("vereist minstens twee objecten", async () => {
    await expect(maakRaakvlak(db, a(p.teamlid), { titel: "x", omschrijving: "", objectIds: [await id("VN-OV-12")], details })).rejects.toThrow(
      "Kies minstens twee objecten",
    );
  });

  it("maakt een kant per object met de objecteigenaar als verantwoordelijke", async () => {
    const r = await maakRaakvlak(db, a(p.teamlid), {
      titel: "Kabels kruisen rijbaan",
      omschrijving: "",
      objectIds: [await id("EXT-KL"), await id("TN-WL-RB-R")],
      details,
    });
    expect(r.nummer).toBe("RV-0001");
    const d = await haalRegistratie(db, r.id);
    expect(d.kanten.map((k) => [k.object.code, k.verantwoordelijkeId]).sort()).toEqual([
      ["EXT-KL", p.teamlid2],
      ["TN-WL-RB-R", p.teamlid2],
    ]);
    expect(d.koppelingen).toHaveLength(2);
  });
});

describe("afstemmen, verwerken en eindoordeel", () => {
  it("alleen de verantwoordelijke van een kant (of OL) stemt af", async () => {
    const r = await maakRaakvlak(db, a(p.teamlid), {
      titel: "Kabels",
      omschrijving: "",
      objectIds: [await id("EXT-KL"), await id("TN-WL-RB-R")],
      details,
    });
    const kanten = (await haalRegistratie(db, r.id)).kanten;
    const rijbaan = kanten.find((k) => k.object.code === "TN-WL-RB-R")!;
    const extern = kanten.find((k) => k.object.code === "EXT-KL")!;
    await expect(kantAfgestemd(db, a(p.teamlid), rijbaan.id)).rejects.toThrow("Alleen de verantwoordelijke van deze kant");
    await kantAfgestemd(db, a(p.teamlid2), rijbaan.id);
    await expect(kantAfgestemd(db, a(p.teamlid2), extern.id)).rejects.toThrow("Leg de bron van het akkoord van de externe partij vast");
    await kantAfgestemd(db, a(p.teamlid2), extern.id, "Mail netbeheerder 12-11");
    expect((await haalRegistratie(db, r.id)).status).toBe("afgestemd");
  });

  it("volledige route tot vastgesteld, en terug bij niet akkoord", async () => {
    const r = await rvViaduct();
    const kanten = (await haalRegistratie(db, r.id)).kanten;
    await expect(kantVerwerkt(db, a(p.teamlid), kanten[0].id)).rejects.toThrow("Eerst afstemmen");
    for (const k of kanten) await kantAfgestemd(db, a(p.teamlid), k.id);
    expect((await haalRegistratie(db, r.id)).status).toBe("afgestemd");
    await kantVerwerkt(db, a(p.teamlid), kanten[0].id);
    expect((await haalRegistratie(db, r.id)).status).toBe("afgestemd");
    await expect(eindoordeel(db, a(p.ol), r.id, true)).rejects.toThrow("Overgang niet toegestaan: afgestemd → vastgesteld");
    await kantVerwerkt(db, a(p.teamlid), kanten[1].id);
    expect((await haalRegistratie(db, r.id)).status).toBe("verwerkt");

    await expect(eindoordeel(db, a(p.oc), r.id, true)).rejects.toThrow("Alleen de ontwerpleider");
    await expect(eindoordeel(db, a(p.ol), r.id, false, { opmerking: "" })).rejects.toThrow("Opmerking is verplicht");
    await eindoordeel(db, a(p.ol), r.id, false, { opmerking: "Oplegdetail ontbreekt", terugNaarKantIds: [kanten[1].id] });
    let d = await haalRegistratie(db, r.id);
    expect(d.status).toBe("afgestemd");
    expect(d.kanten.find((k) => k.id === kanten[1].id)!.verwerktOp).toBeNull();
    expect(d.kanten.find((k) => k.id === kanten[0].id)!.verwerktOp).not.toBeNull();

    await kantVerwerkt(db, a(p.teamlid), kanten[1].id);
    await eindoordeel(db, a(p.ol), r.id, true);
    d = await haalRegistratie(db, r.id);
    expect(d.status).toBe("vastgesteld");
    expect(d.historie.map((h) => h.actie)).toContain("eindoordeel_akkoord");
  });
});

describe("verfijnen", () => {
  it("maakt een afspraak een niveau lager met relatie verfijnt", async () => {
    const r = await rvViaduct();
    const f = await verfijn(db, a(p.teamlid), r.id, {
      titel: "Dek op pijler as-2",
      omschrijving: "",
      objectIds: [await id("VN-DK-12"), await id("VN-PJ-2")],
      details,
    });
    const d = await haalRegistratie(db, f.id);
    expect(d.relaties).toContainEqual(expect.objectContaining({ soort: "verfijnt", nummer: "RV-0001" }));
    await expect(
      verfijn(db, a(p.teamlid), r.id, { titel: "x", omschrijving: "", objectIds: [await id("VN-DK-12"), await id("VN-LH-4")], details }),
    ).rejects.toThrow("Verfijnen kan alleen naar objecten onder de oorspronkelijke kanten");
  });
});
