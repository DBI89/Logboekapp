import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { objecten, registraties, registratieKoppelingen } from "@/db/schema";
import {
  parseObjectCsv,
  vergelijkImport,
  voerImportUit,
  teHerkoppelen,
  herkoppel,
  dieperVoorstellen,
} from "@/domain/import";
import { effectieveEigenaar, nakomelingen, voorouders, objectBoom, objectIdVanCode } from "@/domain/objecten";
import { maakBasisProject, actorVan } from "../helpers";

const csv = (naam: string) => readFileSync(path.join(__dirname, "../fixtures", naam), "utf8");
const KOP = "code;naam;niveau;objecttype;toepassing;locatie;ouder_code;extern;eigenaar_organisatie";

let db: Db;
let p: Awaited<ReturnType<typeof maakBasisProject>>;

beforeEach(async () => {
  db = await maakTestDb();
  p = await maakBasisProject(db);
});

async function importeer(bestand: string, fase: "SO" | "DO") {
  const { regels, fouten } = parseObjectCsv(csv(bestand));
  expect(fouten).toEqual([]);
  return voerImportUit(db, actorVan(p.projectId, p.ol), p.fase[fase], bestand, regels);
}

async function registratieOp(code: string, titel = "Test") {
  const [r] = await db
    .insert(registraties)
    .values({
      projectId: p.projectId,
      type: "issue",
      nummer: "IS-9" + Math.floor(Math.random() * 1000),
      titel,
      faseId: p.fase.VO,
      status: "open",
      aangemaaktDoor: p.teamlid,
    })
    .returning();
  const objectId = await objectIdVanCode(db, p.projectId, code);
  const [k] = await db
    .insert(registratieKoppelingen)
    .values({ registratieId: r.id, soort: "exemplaar", objectId })
    .returning();
  return { registratie: r, koppeling: k };
}

describe("parseObjectCsv", () => {
  it("leest een geldig SO-bestand", () => {
    const { regels, fouten } = parseObjectCsv(csv("so.csv"));
    expect(fouten).toEqual([]);
    expect(regels).toHaveLength(12);
    const ext = regels.find((r) => r.code === "EXT-KL")!;
    expect(ext).toMatchObject({ niveau: 2, extern: true, eigenaarOrganisatie: "Netbeheerder Noord", ouderCode: "TN-WL" });
    expect(regels.find((r) => r.code === "TN")!.ouderCode).toBeNull();
  });

  it("meldt onbekende ouder, niveausprong, niveau 4 en dubbele code", () => {
    const tekst = [
      KOP,
      "A;Alpha;0;Traject;;;;nee;",
      "B;Beta;1;Kunstwerk;;;X;nee;",
      "C;Gamma;3;Draagconstructie;;;A;nee;",
      "D;Delta;4;Laag;;;A;nee;",
      "A;Alpha2;0;Traject;;;;nee;",
    ].join("\n");
    const { fouten } = parseObjectCsv(tekst);
    expect(fouten).toContain('Regel 3: onbekende ouder_code "X"');
    expect(fouten).toContain("Regel 4: niveau 3 kan niet direct onder niveau 0");
    expect(fouten).toContain("Regel 5: niveau 4 wordt niet ondersteund (alleen 0–3)");
    expect(fouten).toContain('Regel 6: dubbele code "A"');
  });

  it("meldt een verkeerde kopregel", () => {
    expect(parseObjectCsv("code;naam\nA;B").fouten[0]).toMatch(/^Kopregel/);
  });
});

describe("import uitvoeren", () => {
  it("SO-import maakt de boom met ouders", async () => {
    await importeer("so.csv", "SO");
    const boom = await objectBoom(db, p.projectId);
    expect(boom.map((k) => k.code)).toEqual(["TN"]);
    const vn = boom[0].kinderen.find((k) => k.code === "VN")!;
    expect(vn.kinderen.map((k) => k.code)).toContain("VN-SP-3");
  });

  it("alleen de ontwerpleider mag importeren", async () => {
    const { regels } = parseObjectCsv(csv("so.csv"));
    await expect(voerImportUit(db, actorVan(p.projectId, p.oc), p.fase.SO, "so.csv", regels)).rejects.toThrow(
      "Alleen de ontwerpleider mag importeren",
    );
  });

  it("vergelijkImport SO→DO geeft nieuw, gewijzigd en verdwenen", async () => {
    await importeer("so.csv", "SO");
    await registratieOp("VN-SP-3");
    const diff = await vergelijkImport(db, p.projectId, parseObjectCsv(csv("do.csv")).regels);
    expect(diff.nieuw.map((r) => r.code).sort()).toEqual(
      ["TN-WL-RB-R-VH", "VN-DK-12", "VN-LH-1", "VN-LH-4", "VN-PF-1", "VN-PJ-2", "VN-SP-3A", "VN-SP-3B"].sort(),
    );
    expect(diff.gewijzigd).toEqual([{ code: "VN-SP-2", velden: ["naam"] }]);
    expect(diff.verdwenen).toEqual([{ code: "VN-SP-3", naam: "Steunpunt as-3", aantalKoppelingen: 1 }]);
  });

  it("verdwenen object zet koppeling op te herkoppelen en laat andere koppelingen staan", async () => {
    await importeer("so.csv", "SO");
    const { registratie, koppeling } = await registratieOp("VN-SP-3");
    const vn1 = await objectIdVanCode(db, p.projectId, "VN-SP-1");
    await db.insert(registratieKoppelingen).values({ registratieId: registratie.id, soort: "exemplaar", objectId: vn1 });

    const res = await importeer("do.csv", "DO");
    expect(res.teHerkoppelen).toBe(1);
    const lijst = await teHerkoppelen(db, p.projectId);
    expect(lijst).toHaveLength(1);
    expect(lijst[0]).toMatchObject({ koppelingId: koppeling.id, objectCode: "VN-SP-3" });
    expect(lijst[0].voorstellen.map((v) => v.code).sort()).toEqual(["VN-SP-3A", "VN-SP-3B"]);

    const alle = await db.select().from(registratieKoppelingen).where(eq(registratieKoppelingen.registratieId, registratie.id));
    expect(alle).toHaveLength(2);
    expect(alle.filter((k) => k.teHerkoppelen)).toHaveLength(1);

    await herkoppel(db, actorVan(p.projectId, p.ol), koppeling.id, lijst[0].voorstellen[0].objectId);
    expect(await teHerkoppelen(db, p.projectId)).toEqual([]);
  });

  it("een mislukte import slaat niets op", async () => {
    await importeer("so.csv", "SO");
    const voor = await db.select().from(objecten);
    const regels = parseObjectCsv(csv("do.csv")).regels.map((r) =>
      r.code === "VN-LH-4" ? { ...r, ouderCode: "BESTAAT-NIET" } : r,
    );
    await expect(voerImportUit(db, actorVan(p.projectId, p.ol), p.fase.DO, "x.csv", regels)).rejects.toThrow();
    expect(await db.select().from(objecten)).toHaveLength(voor.length);
  });

  it("stelt een dieper object voor als de tekst erover gaat", async () => {
    await importeer("so.csv", "SO");
    const { koppeling } = await registratieOp("VN-SP-1", "Paalfundering te kort bij steunpunt as-1");
    await importeer("do.csv", "DO");
    const voorstellen = await dieperVoorstellen(db, p.projectId);
    expect(voorstellen).toContainEqual(
      expect.objectContaining({ koppelingId: koppeling.id, voorstelCode: "VN-PF-1", huidigCode: "VN-SP-1" }),
    );
  });
});

describe("dieperVoorstellen bij twijfel", () => {
  it("stelt niets voor als de tekst op meerdere onderliggende objecten past", async () => {
    await importeer("so.csv", "SO");
    await registratieOp("VN", "Liggers voor alle overspanningen");
    await importeer("do.csv", "DO");
    expect(await dieperVoorstellen(db, p.projectId)).toEqual([]);
  });
});

describe("boom", () => {
  it("eigenaar erft van ouder, voorouders en nakomelingen", async () => {
    await importeer("do.csv", "DO");
    const vn = await objectIdVanCode(db, p.projectId, "VN");
    const lh1 = await objectIdVanCode(db, p.projectId, "VN-LH-1");
    await db.update(objecten).set({ eigenaarId: p.teamlid }).where(eq(objecten.id, vn));
    expect(await effectieveEigenaar(db, lh1)).toBe(p.teamlid);
    const tn = await objectIdVanCode(db, p.projectId, "TN");
    expect(await voorouders(db, lh1)).toEqual([await objectIdVanCode(db, p.projectId, "VN-SP-1"), vn, tn]);
    expect(await nakomelingen(db, vn)).toContain(lh1);
    expect(await nakomelingen(db, vn)).not.toContain(vn);
  });
});
