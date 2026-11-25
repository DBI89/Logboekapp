import { describe, it, expect, beforeEach } from "vitest";
import { maakTestDb } from "@/db/test-db";
import type { Db } from "@/db/client";
import { meld } from "@/domain/meldingen";
import { maakRegistratie } from "@/domain/registraties";
import { stelVoor, heuristischType, type AiClient } from "@/domain/ai";
import { maakBasisProject, actorVan, metObjecten } from "../helpers";

let db: Db;
let p: Awaited<ReturnType<typeof maakBasisProject>>;
let id: (code: string) => Promise<string>;

beforeEach(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  db = await maakTestDb();
  p = await maakBasisProject(db);
  id = await metObjecten(db, p, "do");
});

const tl = () => actorVan(p.projectId, p.teamlid);
const nepClient = (antwoord: { stop_reason: string; parsed_output: unknown } | Error): AiClient & { verzoeken: unknown[] } => {
  const verzoeken: unknown[] = [];
  return {
    verzoeken,
    messages: {
      parse: async (verzoek: unknown) => {
        verzoeken.push(verzoek);
        if (antwoord instanceof Error) throw antwoord;
        return antwoord;
      },
    },
  } as AiClient & { verzoeken: unknown[] };
};

describe("heuristischType", () => {
  it("herkent typen aan trefwoorden", () => {
    expect(heuristischType("Afwijking van de norm voor dekking")).toBe("afwijking");
    expect(heuristischType("Opdrachtgever wil extra fietspad")).toBe("wijziging");
    expect(heuristischType("Keuze tussen twee varianten")).toBe("ontwerpkeuze");
    expect(heuristischType("Kabels van derden kruisen landhoofd")).toBe("raakvlak");
    expect(heuristischType("Tekening klopt niet")).toBe("issue");
  });
});

describe("stelVoor", () => {
  it("zonder sleutel: heuristisch voorstel met object en mogelijke dubbele", async () => {
    await maakRegistratie(db, tl(), { type: "issue", titel: "Kabels kruisen landhoofd", omschrijving: "", koppelingen: [] });
    const m = await meld(db, tl(), { titel: "Kabels van derden kruisen landhoofd as-1", omschrijving: "Tracé onduidelijk" });
    const v = await stelVoor(db, p.projectId, m.id);
    expect(v).toMatchObject({ type: "raakvlak", bron: "heuristiek", mogelijkDubbel: ["IS-0001"] });
    expect([...v.objectIds].sort()).toEqual([await id("EXT-KL"), await id("VN-LH-1")].sort());
  });

  it("met client: AI-voorstel, onbekende codes eruit gefilterd", async () => {
    const m = await meld(db, tl(), { titel: "Dekking te klein", omschrijving: "Landhoofd as-1" });
    const client = nepClient({
      stop_reason: "end_turn",
      parsed_output: { type: "afwijking", objectCodes: ["ONBEKEND", "VN-LH-1"], mogelijkDubbel: ["XX-1"], toelichting: "Gaat over dekking." },
    });
    const v = await stelVoor(db, p.projectId, m.id, { client });
    expect(v).toEqual({ type: "afwijking", objectIds: [await id("VN-LH-1")], mogelijkDubbel: [], toelichting: "Gaat over dekking.", bron: "ai" });
    expect(client.verzoeken[0]).toMatchObject({ model: "claude-opus-5-5", output_config: { effort: "low" } });
  });

  it("bij weigering of fout: heuristiek", async () => {
    const m = await meld(db, tl(), { titel: "Afwijking norm dekking", omschrijving: "x" });
    expect((await stelVoor(db, p.projectId, m.id, { client: nepClient({ stop_reason: "refusal", parsed_output: null }) })).bron).toBe("heuristiek");
    expect((await stelVoor(db, p.projectId, m.id, { client: nepClient(new Error("netwerk")) })).bron).toBe("heuristiek");
  });
});
