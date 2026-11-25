import { describe, it, expect } from "vitest";
import { actie } from "@/lib/acties";
import { Fout } from "@/domain/types";

describe("actie", () => {
  it("geeft data terug bij succes", async () => {
    expect(await actie(async () => 42)).toEqual({ ok: true, data: 42 });
  });
  it("vangt Fout en geeft de tekst terug", async () => {
    expect(await actie(async () => { throw new Fout("Reden is verplicht"); })).toEqual({ ok: false, fout: "Reden is verplicht" });
  });
  it("vangt Zod-validatie als leesbare fout", async () => {
    const { valideerDetails } = await import("@/domain/velden");
    const r = await actie(async () => valideerDetails("issue", { prioriteit: "superhoog" }));
    expect(r).toMatchObject({ ok: false });
    expect((r as { fout: string }).fout).toMatch(/^Ongeldige invoer/);
  });
  it("laat onverwachte fouten niet lekken", async () => {
    expect(await actie(async () => { throw new Error("SQL syntax error at ..."); })).toEqual({ ok: false, fout: "Er ging iets mis. Probeer het opnieuw." });
  });
});
