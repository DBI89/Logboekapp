import { describe, it, expect } from "vitest";
import { maakTestDb } from "@/db/test-db";
import { gebruikers, objecten, meldingen, documenten, registraties } from "@/db/schema";
import { seedDemo } from "@/seed/demo";
import { signalen } from "@/domain/signalen";
import { zetEigenaar } from "@/domain/objecten";
import { haalRegistratie } from "@/domain/registraties";
import { eq } from "drizzle-orm";

describe("demodata", () => {
  it("ingebouwde CSV-tekst is gelijk aan de CSV-bestanden", async () => {
    const { readFileSync } = await import("node:fs");
    const { SO_CSV, DO_CSV } = await import("@/seed/data/csv");
    expect(SO_CSV).toBe(readFileSync("src/seed/data/so.csv", "utf8"));
    expect(DO_CSV).toBe(readFileSync("src/seed/data/do.csv", "utf8"));
  });
});

describe("seedDemo", () => {
  it("vult het demoproject", async () => {
    const db = await maakTestDb();
    const { projectId, gebruikers: g } = await seedDemo(db);
    expect(await db.select().from(gebruikers)).toHaveLength(5);
    expect((await db.select().from(objecten)).length).toBeGreaterThanOrEqual(11);
    expect(await db.select().from(meldingen)).toHaveLength(4);
    expect((await db.select().from(documenten)).map((d) => d.nummer).sort()).toEqual(["TN-NOT-001", "VN-NOT-001", "VN-NOT-002"]);
    const regs = await db.select().from(registraties);
    expect(regs.map((r) => r.nummer).sort()).toEqual(["AF-0001", "IS-0001", "OK-0001", "RV-0001", "RV-0002", "WZ-0001"]);
    const status = Object.fromEntries(regs.map((r) => [r.nummer, r.status]));
    expect(status).toMatchObject({ "OK-0001": "goedgekeurd", "AF-0001": "ter_goedkeuring", "WZ-0001": "concept", "IS-0001": "open", "RV-0001": "afgestemd", "RV-0002": "concept" });
    expect((await signalen(db, projectId)).map((s) => s.soort)).toContain("inbox_te_lang");
    const af = regs.find((r) => r.nummer === "AF-0001")!;
    expect((await haalRegistratie(db, af.id)).koppelingen[0]).toMatchObject({ soort: "type", toepassing: "Steunpunt" });

    const [tn] = await db.select().from(objecten).where(eq(objecten.code, "TN"));
    await expect(zetEigenaar(db, { projectId, gebruikerId: g.constructeur }, tn.id, g.constructeur)).rejects.toThrow("Alleen de ontwerpleider");
  });
});
