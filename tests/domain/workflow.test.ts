import { describe, it, expect, beforeEach } from "vitest";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { maakRegistratie, werkBij, haalRegistratie } from "@/domain/registraties";
import { biedAan, keurGoed, wijsAf, markeerVerwerkt, zetInstemming, tekstcorrectie, zetIssueStatus, delegeer } from "@/domain/workflow";
import { maakBasisProject, actorVan, metObjecten } from "../helpers";

let db: Db;
let p: Awaited<ReturnType<typeof maakBasisProject>>;
let id: (code: string) => Promise<string>;

const volledig = { afwijkingVan: "NEN-EN 1992-1-1", eis: "dekking 45 mm", voorgesteld: "dekking 40 mm", motivatie: "Uitvoerbaarheid" };

beforeEach(async () => {
  db = await maakTestDb();
  p = await maakBasisProject(db);
  id = await metObjecten(db, p, "do");
});

const tl = () => actorVan(p.projectId, p.teamlid);
const ol = () => actorVan(p.projectId, p.ol);
const oc = () => actorVan(p.projectId, p.oc);

async function afwijking(details: Record<string, unknown> = volledig, door = tl()) {
  return maakRegistratie(db, door, {
    type: "afwijking",
    titel: "Betondekking landhoofd",
    omschrijving: "",
    koppelingen: [{ soort: "exemplaar", objectId: await id("VN-LH-1") }],
    details,
  });
}

describe("goedkeuren", () => {
  it("volledige route concept → verwerkt met historie", async () => {
    const r = await afwijking();
    await biedAan(db, tl(), r.id);
    await keurGoed(db, ol(), r.id);
    await markeerVerwerkt(db, tl(), r.id);
    const d = await haalRegistratie(db, r.id);
    expect(d.status).toBe("verwerkt");
    expect(d.goedgekeurdDoor).toBe(p.ol);
    expect(d.verwerktDoor).toBe(p.teamlid);
    expect(d.historie.map((h) => h.actie)).toEqual(["aangemaakt", "aangeboden", "goedgekeurd", "verwerkt"]);
  });

  it("aanbieden met ontbrekende velden noemt ze", async () => {
    const r = await afwijking({ afwijkingVan: "NEN" });
    await expect(biedAan(db, tl(), r.id)).rejects.toThrow(/Ontbrekende velden: .*Eis/);
  });

  it("afwijzen vereist toelichting en daarna kan opnieuw worden aangeboden", async () => {
    const r = await afwijking();
    await biedAan(db, tl(), r.id);
    await expect(wijsAf(db, ol(), r.id, "")).rejects.toThrow("Toelichting is verplicht");
    await wijsAf(db, ol(), r.id, "Motivatie te dun");
    expect((await haalRegistratie(db, r.id)).status).toBe("afgewezen");
    await werkBij(db, tl(), r.id, { details: { motivatie: "Uitgebreid gemotiveerd" } });
    await biedAan(db, tl(), r.id);
    expect((await haalRegistratie(db, r.id)).status).toBe("ter_goedkeuring");
  });

  it("opsteller kan niet zelf goedkeuren", async () => {
    const r = await afwijking(volledig, ol());
    await biedAan(db, ol(), r.id);
    await expect(keurGoed(db, ol(), r.id)).rejects.toThrow("Opsteller mag niet zelf goedkeuren");
  });

  it("coördinator met delegatie keurt goed onder delegatie", async () => {
    const r = await afwijking();
    await biedAan(db, tl(), r.id);
    await expect(keurGoed(db, oc(), r.id)).rejects.toThrow("Geen delegatie");
    await expect(delegeer(db, oc(), p.oc, true)).rejects.toThrow("Alleen de ontwerpleider");
    await delegeer(db, ol(), p.oc, true);
    await keurGoed(db, oc(), r.id);
    const d = await haalRegistratie(db, r.id);
    expect(d.goedgekeurdOnderDelegatie).toBe(true);
  });

  it("ongeldige overgang wordt geweigerd", async () => {
    const r = await afwijking();
    await expect(keurGoed(db, ol(), r.id)).rejects.toThrow("Overgang niet toegestaan: concept → goedgekeurd");
    await expect(markeerVerwerkt(db, tl(), r.id)).rejects.toThrow("Overgang niet toegestaan: concept → verwerkt");
  });

  it("bevroren registratie: koppeling wijzigen geweigerd, tekstcorrectie alleen door OL", async () => {
    const r = await afwijking();
    await biedAan(db, tl(), r.id);
    await keurGoed(db, ol(), r.id);
    await expect(werkBij(db, ol(), r.id, { koppelingen: [] })).rejects.toThrow("Registratie is bevroren");
    await expect(tekstcorrectie(db, tl(), r.id, { titel: "Betondekking landhoofd as-1" })).rejects.toThrow(
      "Alleen de ontwerpleider",
    );
    await tekstcorrectie(db, ol(), r.id, { titel: "Betondekking landhoofd as-1" });
    const d = await haalRegistratie(db, r.id);
    expect(d.titel).toBe("Betondekking landhoofd as-1");
    expect(d.koppelingen).toHaveLength(1);
    expect(d.historie.at(-1)!.actie).toBe("tekstcorrectie");
  });

  it("tekstcorrectie kan niet op een concept", async () => {
    const r = await afwijking();
    await expect(tekstcorrectie(db, ol(), r.id, { titel: "x" })).rejects.toThrow("Tekstcorrectie alleen op een vastgelegde registratie");
  });

  it("instemming opdrachtgever wordt vastgelegd, ook na goedkeuring", async () => {
    const r = await afwijking();
    await biedAan(db, tl(), r.id);
    await keurGoed(db, ol(), r.id);
    await zetInstemming(db, tl(), r.id, { nodig: true, status: "aangevraagd", referentie: "RFC-012" });
    expect((await haalRegistratie(db, r.id)).details).toMatchObject({ instemming: { nodig: true, status: "aangevraagd" } });
  });
});

describe("issues", () => {
  it("opgelost vereist een oplossing, vervallen een reden", async () => {
    const i = await maakRegistratie(db, tl(), { type: "issue", titel: "Kabels", omschrijving: "", koppelingen: [] });
    await zetIssueStatus(db, tl(), i.id, "in_behandeling");
    await expect(zetIssueStatus(db, tl(), i.id, "opgelost")).rejects.toThrow("Kies de registratie die het issue oplost");
    const k = await maakRegistratie(db, tl(), { type: "ontwerpkeuze", titel: "Tracé", omschrijving: "", koppelingen: [] });
    await zetIssueStatus(db, tl(), i.id, "opgelost", { oplossingId: k.id });
    const d = await haalRegistratie(db, i.id);
    expect(d.status).toBe("opgelost");
    expect(d.relaties).toContainEqual(expect.objectContaining({ soort: "lost_op", nummer: "OK-0001" }));
    const j = await maakRegistratie(db, tl(), { type: "issue", titel: "x", omschrijving: "", koppelingen: [] });
    await expect(zetIssueStatus(db, tl(), j.id, "vervallen")).rejects.toThrow("Reden is verplicht");
  });

  it("workflow-acties werken niet op een issue", async () => {
    const i = await maakRegistratie(db, tl(), { type: "issue", titel: "x", omschrijving: "", koppelingen: [] });
    await expect(biedAan(db, tl(), i.id)).rejects.toThrow("Niet van toepassing op een issue");
  });
});
