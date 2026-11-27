import { describe, it, expect, beforeEach } from "vitest";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { haalRegistratie } from "@/domain/registraties";
import { maakDirect } from "@/domain/direct";
import { filterEnSorteer, uniekeWaarden, type TabelRij } from "@/lib/tabelfilter";
import { maakBasisProject, actorVan, metObjecten } from "../helpers";

let db: Db;
let p: Awaited<ReturnType<typeof maakBasisProject>>;
let id: (code: string) => Promise<string>;
const a = (g: string) => actorVan(p.projectId, g);

beforeEach(async () => {
  db = await maakTestDb();
  p = await maakBasisProject(db);
  id = await metObjecten(db, p, "do");
});

describe("direct een registratie maken", () => {
  it("ontwerpleider en coördinator maken direct een registratie, met objecten", async () => {
    const i = await maakDirect(db, a(p.ol), { type: "issue", titel: "Kabeltracé onduidelijk", objectIds: [await id("VN-SP-1")] });
    expect(i.nummer).toBe("IS-0001");
    const d = await haalRegistratie(db, i.id);
    expect(d).toMatchObject({ status: "open", aangemaaktDoor: p.ol });
    expect(d.koppelingen.map((k) => k.object?.code)).toEqual(["VN-SP-1"]);
    const k = await maakDirect(db, a(p.oc), { type: "ontwerpkeuze", titel: "Dektype", objectIds: [] });
    expect((await haalRegistratie(db, k.id)).status).toBe("concept");
  });

  it("teamleden gebruiken de inbox", async () => {
    await expect(maakDirect(db, a(p.teamlid), { type: "issue", titel: "x", objectIds: [] })).rejects.toThrow(
      "Alleen ontwerpleider of ontwerpcoördinator maakt direct een registratie",
    );
  });

  it("een raakvlakafspraak krijgt kanten en vraagt twee objecten", async () => {
    const rv = await maakDirect(db, a(p.ol), { type: "raakvlak", titel: "Oplegging", objectIds: [await id("VN-OV-12"), await id("VN-SP-2")] });
    expect((await haalRegistratie(db, rv.id)).kanten).toHaveLength(2);
    await expect(maakDirect(db, a(p.ol), { type: "raakvlak", titel: "x", objectIds: [await id("VN-OV-12")] })).rejects.toThrow("Kies minstens twee objecten");
  });

  it("titel is verplicht", async () => {
    await expect(maakDirect(db, a(p.ol), { type: "issue", titel: " ", objectIds: [] })).rejects.toThrow("Titel is verplicht");
  });
});

const rijen: TabelRij[] = [
  { id: "1", waarden: { nummer: "IS-0002", titel: "Fundering as-3", status: "Open", streefdatum: "12-12-2026" }, sorteer: { streefdatum: "2026-12-12" } },
  { id: "2", waarden: { nummer: "IS-0010", titel: "Kabels", status: "In behandeling", streefdatum: "01-02-2027" }, sorteer: { streefdatum: "2027-02-01" } },
  { id: "3", waarden: { nummer: "IS-0001", titel: "Funderingsadvies", status: "Opgelost", streefdatum: "" }, sorteer: { streefdatum: "" } },
];

describe("filteren en sorteren in de tabel", () => {
  it("filtert op tekst (bevat, zonder hoofdletters) en op gekozen waarden", () => {
    expect(filterEnSorteer(rijen, { titel: { tekst: "FUND" } }).map((r) => r.id)).toEqual(["1", "3"]);
    expect(filterEnSorteer(rijen, { titel: { tekst: "fund" }, status: { waarden: ["Open", "Opgelost"] } }).map((r) => r.id)).toEqual(["1", "3"]);
    expect(filterEnSorteer(rijen, { status: { waarden: ["In behandeling"] } }).map((r) => r.id)).toEqual(["2"]);
    expect(filterEnSorteer(rijen, { status: { waarden: [] } }).map((r) => r.id)).toEqual(["1", "2", "3"]);
  });

  it("sorteert natuurlijk op nummer en op sorteerwaarde voor datums", () => {
    expect(filterEnSorteer(rijen, {}, { sleutel: "nummer", richting: "op" }).map((r) => r.waarden.nummer)).toEqual(["IS-0001", "IS-0002", "IS-0010"]);
    expect(filterEnSorteer(rijen, {}, { sleutel: "nummer", richting: "af" }).map((r) => r.waarden.nummer)).toEqual(["IS-0010", "IS-0002", "IS-0001"]);
    expect(filterEnSorteer(rijen, {}, { sleutel: "streefdatum", richting: "op" }).map((r) => r.id)).toEqual(["1", "2", "3"]);
  });

  it("geeft de unieke waarden van een kolom, met lege waarde als '(leeg)'", () => {
    expect(uniekeWaarden(rijen, "status")).toEqual(["In behandeling", "Open", "Opgelost"]);
    expect(uniekeWaarden(rijen, "streefdatum")).toEqual(["(leeg)", "01-02-2027", "12-12-2026"]);
    expect(filterEnSorteer(rijen, { streefdatum: { waarden: ["(leeg)"] } }).map((r) => r.id)).toEqual(["3"]);
  });
});
