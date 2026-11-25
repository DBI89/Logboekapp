import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { meldingen, registratieBronnen, objecten } from "@/db/schema";
import { meld, parseSnelinvoer, zetOm, voegSamen, laatVervallen, inbox, werkdagenTussen } from "@/domain/meldingen";
import { maakRegistratie } from "@/domain/registraties";
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
const oc = () => actorVan(p.projectId, p.oc);

describe("meld", () => {
  it("vereist titel en omschrijving", async () => {
    await expect(meld(db, tl(), { titel: "x", omschrijving: " " })).rejects.toThrow("Omschrijving is verplicht");
    await expect(meld(db, tl(), { titel: "", omschrijving: "y" })).rejects.toThrow("Titel is verplicht");
  });

  it("legt melder, fase, nummer en objecten vast", async () => {
    const m = await meld(db, tl(), { titel: "Sparing", omschrijving: "Kabels", objectIds: [await id("VN-LH-1")] });
    expect(m.nummer).toBe("M-0001");
    const lijst = await inbox(db, p.projectId, {});
    expect(lijst[0]).toMatchObject({ nummer: "M-0001", status: "nieuw", gemeldDoor: p.teamlid, bronSoort: "waarneming" });
    expect(lijst[0].objecten.map((o) => o.code)).toEqual(["VN-LH-1"]);
  });
});

describe("parseSnelinvoer", () => {
  it("koppelt een uniek object via #token", async () => {
    const r = await parseSnelinvoer(db, p.projectId, "Kabels passen niet door landhoofd #VN-LH-1");
    expect(r).toEqual({ titel: "Kabels passen niet door landhoofd", objectId: await id("VN-LH-1"), kandidaten: [] });
  });

  it("geeft kandidaten bij meerdere treffers", async () => {
    const r = await parseSnelinvoer(db, p.projectId, "Kabels passen niet door landhoofd #as-1");
    expect(r.objectId).toBeNull();
    expect(r.kandidaten.map((k) => k.code).sort()).toEqual(["VN-DK-12", "VN-LH-1", "VN-OV-12", "VN-PF-1", "VN-SP-1"]);
  });

  it("combineert meerdere tokens", async () => {
    const r = await parseSnelinvoer(db, p.projectId, "Dekking te klein #landhoofd #as-1");
    expect(r.objectId).toBe(await id("VN-LH-1"));
    expect(r.titel).toBe("Dekking te klein");
  });

  it("zonder token geen object", async () => {
    expect(await parseSnelinvoer(db, p.projectId, "  Algemene vraag  ")).toEqual({ titel: "Algemene vraag", objectId: null, kandidaten: [] });
  });
});

describe("beoordelen", () => {
  it("teamlid mag niet omzetten", async () => {
    const m = await meld(db, tl(), { titel: "x", omschrijving: "y" });
    await expect(zetOm(db, tl(), m.id, [{ type: "issue" }])).rejects.toThrow("Alleen ontwerpleider of ontwerpcoördinator");
  });

  it("omzetten naar issue en ontwerpkeuze maakt twee registraties met bron", async () => {
    const m = await meld(db, tl(), { titel: "Kabels", omschrijving: "Kabels passen niet", objectIds: [await id("VN-LH-1")] });
    const res = await zetOm(db, oc(), m.id, [{ type: "issue" }, { type: "ontwerpkeuze", titel: "Kabeltracé" }]);
    expect(res.map((r) => r.nummer)).toEqual(["IS-0001", "OK-0001"]);
    const bronnen = await db.select().from(registratieBronnen).where(eq(registratieBronnen.meldingId, m.id));
    expect(bronnen).toHaveLength(2);
    const [rij] = await db.select().from(meldingen).where(eq(meldingen.id, m.id));
    expect(rij).toMatchObject({ status: "omgezet", beoordeeldDoor: p.oc });
    await expect(zetOm(db, oc(), m.id, [{ type: "issue" }])).rejects.toThrow("Melding is al beoordeeld");
  });

  it("samenvoegen voegt een bron toe", async () => {
    const r = await maakRegistratie(db, tl(), { type: "issue", titel: "Kabels", omschrijving: "", koppelingen: [] });
    const m = await meld(db, tl(), { titel: "Kabels", omschrijving: "nog eens" });
    await voegSamen(db, oc(), m.id, r.id);
    expect(await db.select().from(registratieBronnen).where(eq(registratieBronnen.registratieId, r.id))).toHaveLength(1);
    expect((await inbox(db, p.projectId, { status: ["samengevoegd"] }))).toHaveLength(1);
  });

  it("vervallen vereist een reden", async () => {
    const m = await meld(db, tl(), { titel: "x", omschrijving: "y" });
    await expect(laatVervallen(db, oc(), m.id, "  ")).rejects.toThrow("Reden is verplicht");
    await laatVervallen(db, oc(), m.id, "Dubbel");
    const [rij] = await db.select().from(meldingen).where(eq(meldingen.id, m.id));
    expect(rij).toMatchObject({ status: "vervallen", vervallenReden: "Dubbel" });
  });

  it("inbox zoekt in tekst en telt werkdagen", async () => {
    const m = await meld(db, tl(), { titel: "Sparing kabels", omschrijving: "y" });
    await db.update(meldingen).set({ gemeldOp: new Date(Date.now() - 10 * 86400000) }).where(eq(meldingen.id, m.id));
    await meld(db, tl(), { titel: "Anders", omschrijving: "z" });
    const lijst = await inbox(db, p.projectId, { zoek: "sparing" });
    expect(lijst).toHaveLength(1);
    expect(lijst[0].werkdagenOpen).toBeGreaterThanOrEqual(6);
  });
});

describe("werkdagenTussen", () => {
  it("telt alleen maandag t/m vrijdag", () => {
    expect(werkdagenTussen(new Date("2026-11-20T10:00:00"), new Date("2026-11-23T10:00:00"))).toBe(1);
    expect(werkdagenTussen(new Date("2026-11-16T10:00:00"), new Date("2026-11-23T10:00:00"))).toBe(5);
    expect(werkdagenTussen(new Date("2026-11-23T10:00:00"), new Date("2026-11-23T16:00:00"))).toBe(0);
  });
});

void objecten;
