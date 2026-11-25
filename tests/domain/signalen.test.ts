import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { meldingen, objecten } from "@/db/schema";
import { maakRegistratie } from "@/domain/registraties";
import { biedAan, keurGoed, zetInstemming } from "@/domain/workflow";
import { meld } from "@/domain/meldingen";
import { maakRaakvlak } from "@/domain/raakvlakken";
import { mijnWerk, signalen } from "@/domain/signalen";
import { maakBasisProject, actorVan, metObjecten } from "../helpers";

let db: Db;
let p: Awaited<ReturnType<typeof maakBasisProject>>;
let id: (code: string) => Promise<string>;
const afw = { afwijkingVan: "NEN", eis: "45", voorgesteld: "40", motivatie: "m" };

beforeEach(async () => {
  db = await maakTestDb();
  p = await maakBasisProject(db);
  id = await metObjecten(db, p, "do");
  await db.update(objecten).set({ eigenaarId: p.teamlid2 }).where(eq(objecten.id, await id("VN")));
});

const a = (g: string) => actorVan(p.projectId, g);

describe("mijnWerk", () => {
  it("toont de ontwerpleider wat op goedkeuring wacht, maar niet zijn eigen registratie", async () => {
    const r1 = await maakRegistratie(db, a(p.teamlid), { type: "afwijking", titel: "Van teamlid", omschrijving: "", koppelingen: [], details: afw });
    const r2 = await maakRegistratie(db, a(p.ol), { type: "afwijking", titel: "Van OL", omschrijving: "", koppelingen: [], details: afw });
    await biedAan(db, a(p.teamlid), r1.id);
    await biedAan(db, a(p.ol), r2.id);
    const werk = await mijnWerk(db, a(p.ol));
    expect(werk.wachtOpMijnGoedkeuring.map((r) => r.nummer)).toEqual([r1.nummer]);
    expect((await mijnWerk(db, a(p.teamlid))).wachtOpMijnGoedkeuring).toEqual([]);
  });

  it("toont de objecteigenaar zijn raakvlakkant en eigen registraties", async () => {
    await maakRaakvlak(db, a(p.teamlid), {
      titel: "Oplegging",
      omschrijving: "",
      objectIds: [await id("VN-OV-12"), await id("VN-SP-2")],
      details: { soort: "fysiek", afspraak: "x" },
    });
    const i = await maakRegistratie(db, a(p.teamlid), { type: "issue", titel: "Vraag", omschrijving: "", koppelingen: [{ soort: "exemplaar", objectId: await id("VN-LH-1") }] });
    const werk = await mijnWerk(db, a(p.teamlid2));
    expect(werk.wachtOpMijnAkkoord.map((x) => x.stap)).toEqual(["afstemmen", "afstemmen"]);
    expect(werk.eigenaarVan.map((r) => r.id)).toContain(i.id);
    expect(werk.teBeoordelenMeldingen).toEqual([]);
  });

  it("toont goedgekeurd maar nog niet verwerkt", async () => {
    const r = await maakRegistratie(db, a(p.teamlid), { type: "afwijking", titel: "x", omschrijving: "", koppelingen: [], details: afw });
    await biedAan(db, a(p.teamlid), r.id);
    await keurGoed(db, a(p.ol), r.id);
    expect((await mijnWerk(db, a(p.teamlid))).goedgekeurdNietVerwerkt.map((x) => x.id)).toEqual([r.id]);
  });
});

describe("signalen", () => {
  it("meldt een melding die te lang in de inbox staat, open instemming en ontbrekend eindoordeel", async () => {
    const m = await meld(db, a(p.teamlid), { titel: "Oud", omschrijving: "x" });
    await db.update(meldingen).set({ gemeldOp: new Date(Date.now() - 10 * 86400000) }).where(eq(meldingen.id, m.id));
    await meld(db, a(p.teamlid), { titel: "Nieuw", omschrijving: "x" });
    const r = await maakRegistratie(db, a(p.teamlid), { type: "afwijking", titel: "x", omschrijving: "", koppelingen: [], details: afw });
    await zetInstemming(db, a(p.teamlid), r.id, { nodig: true, status: "aangevraagd" });
    const s = await signalen(db, p.projectId);
    const inbox = s.find((x) => x.soort === "inbox_te_lang")!;
    expect(inbox.tekst).toBe("1 melding staat langer dan 5 werkdagen in de inbox");
    expect(s.map((x) => x.soort)).toContain("instemming_open");
    expect(s.map((x) => x.soort)).not.toContain("goedgekeurd_niet_verwerkt");
  });
});
